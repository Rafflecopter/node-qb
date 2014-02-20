// qb/index.js
// qb is a quarterback for your soul

// Trivia: How is the digram 'qb' symmetric?
// See qb_test.js for the answer!

// builtin
var util = require('util');

// vendor
var _ = require('underscore'),
  async = require('async'),
  relyq = require('relyq'),
  redis = require('redis'),
  uuid = require('uuid');
  book = require('book');

// local
var MiddlewareProvider = require('./middleware_provider'),
  Dialects = require('./dialects');

var default_options = {
  prefix: 'qb', //qb: Base prefix of all redis keys
  clean_finish: true, //relyq: Don't keep jobs after being finished
  delimeter: ':', //all: Redis key delimeter
  idfield: 'id', //relyq/qb: Field containing the id
  Q: 'RedisJsonQ', //qb: relyq Queue Type
  max_concurrent_callbacks: 100, //relyq-listener: default maximum number of concurrent callbacks per service
  allow_defer: true, //relyq: Allow deferred tasks
  defer_field: 'when', //qb: Field containing a timestamp signifying a deferred task
  defer_polling_interval: 1000, //relyq: interval between checking for deferred tasks
  allow_recur: true, //relyq: Allow recurring tasks
  recur_field: 'every', //qb: Field containing a millisecond interval
  recur_polling_interval: 60000, //relyq: Polling interval between recurring task checks
  catch_sigterm_end: true, //qb: Catch sigterm and call qb.end()
  end_timeout: 10000, //qb: Timeout on an end() call
  specific: {}, //qb: A list of specific relyq options for any type of queue
}

// -- Exports --
// =============

module.exports = QB;

// -- Main Type and Public API --
/*
* QB - The primary type of the qb package
*
* @param options - See README.md for options documentation
*/
function QB (options) {
  if (!(this instanceof QB)) {
    return new QB(options);
  }

  // Super constructor
  MiddlewareProvider.call(this);

  var qb = this;

  // Options
  qb._options = _.defaults(options || {}, default_options);
  qb._redis = qb._options.redis || redis.createClient();

  // Init
  qb._dialects = new Dialects(qb, qb._options);
  qb._types = {};
  qb._started = [];
  qb._queues = {};
  qb._contacts = {};

  qb.log = book.default();


  qb.on('error', qb.log.error.bind(qb.log));

  if (qb._options.catch_sigterm_end)
    _handle_sigterm(qb);
}

util.inherits(QB, MiddlewareProvider);

/*
* Enable a type to process
*
* @param type string
* @param @optional mcc number - Max concurrent callbacks at one time
* @param callback function(task, $done) - Task processor function
*/
QB.prototype.can = function can(type, mcc, callback) {
  var qb = this,
    alreadyCalledCan = qb._types[type] !== undefined;

  if (callback === undefined) {
    callback = mcc;
    mcc = qb._options.max_concurrent_callbacks;
  }

  qb._types[type] = {mcc:mcc, callback: callback};
  qb._dialects.can(type);

  // Handle early .start
  if (qb._started.length) {
    if (alreadyCalledCan) {
      qb._queues[type].queue._max_out = mcc;
    } else {
      _start(qb, _.object([type],[mcc]), function (err) {
        if (err) qb.emit('error', err);
      });
    }
  }

  return qb;
}

QB.prototype.types = function () {
  return _.keys(this._types);
}

/*
* Enable a dialect to receive .push tasks onto our queue
*
* @param dialect
*/
QB.prototype.speaks = function speaks(dialect, options) {
  var qb = this;

  options = _.defaults(options || {}, qb._options);
  qb._dialects.speaks(dialect, options);

  return qb;
}


/*
* Get a dialect's instance for inspection and modification.
* Must be called after .start()
*
* @param name
*/
QB.prototype.dialect = function dialect(name) {
  return this._dialects.get(name);
}

/*
* Get a types's underlying queue for inspection and modification.
* Must be called after .start()
*
* @param type
*/
QB.prototype.queue = function queue(type) {
  return this._queues[type].queue;
}

/*
* Start qb. Although this should be called after all .can and .speaks methods,
*   it is built to be called at any time.
*
* @param optional_callback - Optional node-style callback that will be called when start is finished.
*/
QB.prototype.start = function start(optional_callback) {
  var qb = this,
    types = _.omit(qb._types, qb._started);

  if (qb._hasstarted) {
    throw new Error('A qb instance can only be started once!')
  }
  qb._hasstarted = true;

  qb._dialects.start();

  _start(qb, types, function (err) {
    if (err) qb.emit('error', err);
    if (optional_callback) optional_callback(err)
  });

  qb.log.info('QB Started All Queues and Dialects')
  return qb;
}

/*
* Push a task of some type onto our own queue.
* If you mean to push onto a remote queue, see .call.
*
* @param type string
* @param task object
* @param @optional callback function (err) - Avoid the thrown error by passing a callback
*   If callback doesn't exist, will throw if an error occurs.
*/
QB.prototype.push = function push(type, task, callback) {
  var qb = this,
    q = qb._queues[type];

  if (!q) {
    cb(new Error('Cannot push a type that this qb isn\'t able (use .can). Or see .call for remote push'));
  } else {
    qb.emit('push', type, task);

    cb();
  }

  return qb;

  function cb(err) {
    if (callback)
      callback(err);
    else if (err)
      throw err;
  }
}

/*
* Assign a contact to an alias
*
* @param uri - A uri formatted as dialect://location
*   For example, http is a simple http url. messageq is messageq://channel
* @param @optional alias An alias for later use with .contact()
*/
QB.prototype.contacts = function contacts(uri, alias) {
  var qb = this,
    dialect = uri.split('://')[0],
    contact = qb._contacts[uri] = qb._contacts[uri] || qb._dialects.speak(dialect, uri);

  if (alias) {
    qb._contacts[alias] = contact;
  }

  return contact;
}

/*
* Get a contact from an alias or uri
*
* @param alias_or_uri an alias (previously assigned with .contacts) or uri to contact
*/
QB.prototype.contact = function contact(alias_or_uri) {
  var qb = this;
  return qb._contacts[alias_or_uri] || qb.contacts(alias_or_uri);
}

/*
* Gracefully end the QB System
*
* @param @optional callback function (err, caller) - .end(f) is equivalent to .on('end', f).end()
*/
QB.prototype.end = function end(callback) {
  var qb = this;
  if (qb._ended) {
    return callback && callback();
  }
  qb._ended = true;
  qb.log.info('Ending QB %s', qb._options.prefix);

  if (callback) {
    qb.once('end', callback);
  }

  _end(qb, function (err) {
    if (err) {
      qb.emit('error', err);
    }
    qb.log.info('All tasks finished. QB %s Ended.', qb._options.prefix);
    qb.emit('end', err);
  });
}

// -- Helpers --

function _listeners(qb, cb) {
  if (!qb._listening) {
    qb.on('push', function onpush(type, task, next) {
        try {
          if (qb._options.allow_defer && task[qb._options.defer_field]) {
            qb._queues[type].queue.defer(task, task[qb._options.defer_field], next);
          } else if (qb._options.allow_recur && task[qb._options.recur_field]) {
            qb._queues[type].queue.recur(task, task[qb._options.recur_field], next);
          } else {
            qb._queues[type].queue.push(task, next);
          }
        } catch (err) {
          next(err);
        }
      })
      .on('process', function onprocess(type, task, next) {
        try {
          qb._types[type].callback(task, next);
        } catch (err) {
          next(err);
        }
      })
      .on('process', function deleteHiddenFields(type, task, next) {
        _.each(_.keys(task), function (key) {
          if (key[0] === '_') {
            delete(task[key]);
          }
        });
        next();
      });

    qb._listening = true;
  }

  cb();
}

function _start(qb, types, callback) {
  var Qopt = qb._options.Q,
    Q = _.isFunction(Qopt) ? Qopt : relyq[Qopt];

  qb._started = _.union(qb._started, types);

  async.parallel([
    // Start up each of queues
    async.apply(async.each, _.pairs(types), function (pair, cb) {
      var type = pair[0],
        mcc = pair[1],
        key = [qb._options.prefix, 'service', type].join(qb._options.delimeter),
        queue = new Q(qb._redis, _.extend(_.clone(qb._options), {prefix: key}, qb._options.specific[type] || {})),
        listener = queue.listen(qb._options)
          .on('error', function (err, taskref, task) {
            qb.emit('error', err);
          })
          .on('task', function (task, done) {
            qb.emit('process', type, task, function (err) {
              done(err);

              if (err) {
                qb.emit('fail', type, task);
              } else {
                qb.emit('finish', type, task);
              }
            });
          });

      qb._queues[type] = {queue: queue, listener: listener};
      cb();
    }),

    // Setup event listeners
    async.apply(_listeners, qb)
  ], callback);
}


function _end(qb, callback) {
  var called = false, timeout = 0;
  function doCallback(err) {
    if (!called) {
      qb._redis.end()
      callback(err)
      called = true
      clearTimeout(timeout)
    }
  }

  async.parallel([
    _.bind(qb._dialects.end, qb._dialects),
    _.bind(async.each, null, _.pluck(qb._queues, 'queue'), function (q, cb) { q.end(cb); }),
  ], doCallback);

  timeout = setTimeout(function () {
    doCallback(new Error('TIMEOUT on End'))
  }, qb._options.end_timeout);
}

function _handle_sigterm(qb) {
  process.on('SIGTERM', function() {
    qb.log.info('([~~~ Got SIGTERM ~~~])')

    qb.end(function (err) {
      if (err) {
        return qb.log.error(err, '([~~~ Exiting Due to SIGTERM ~~~])')
      }
      qb.log.info('([~~~ Exiting Due to SIGTERM ~~~])')
    })
  })
}
