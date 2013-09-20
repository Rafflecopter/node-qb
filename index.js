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

// local
var MiddlewareProvider = require('./lib/middleware'),
  dialects = require('./dialects');

var default_options = {
  prefix: 'qb',
  timeout: 1,
  clean_finish: true,
  delimeter: ':',
  idfield: 'id',
  Q: relyq.RedisJsonQ,
  max_concurrent_callbacks: 100,
  getid: function (task) { return task.id || (task.id = uuid.v4()); }
}

// -- Exports --
// =============

module.exports = {
  QB: QB,
  init: function (options) {
    if (module.exports.qb) {
      return module.exports.qb;
    }
    return (module.exports.qb = new QB(options));
  }
};

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

  var qb = this;

  // Options
  qb._options = _.defaults(options || {}, default_options);
  qb._redis = redis.createClient(qb._options.redis);

  // Init
  qb._spoken = [];
  qb._types = {};
  qb._started = [];
  qb._queues = {};

  // Super constructor
  MiddlewareProvider.call(qb);
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
    mcc = qb._max_concurrent_callbacks;
  }

  qb._types[type] = {mcc:mcc, callback: callback};

  // Handle early .start
  if (qb._started.length) {
    if (alreadyCalledCan) {
      qb._queues[type].queue._max_out = mcc;
    } else {
      _start(qb, qb._spoken, _.object(type,mcc), function (err) {
        if (err) qb.emit('error', err);
      });
    }
  }

  return qb;
}

/*
* Enable a dialect to receive .push tasks onto our queue
*
* @param dialect
*/
QB.prototype.speaks = function speaks(dialect, options) {
  var qb = this;

  options = _.defaults(options, qb._options);

  dialects[dialect].init(options);
  qb._spoken.push(dialect);

  // Handle early .start
  if (qb._started.length) {
    _start(qb, [dialect], qb._types, function (err) {
      if (err) qb.emit('error', err);
    });
  }

  return qb;
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

  _start(qb, qb._spoken, types, function (err) {
    if (err) qb.emit('error', err);
    if (optional_callback) optional_callback(err)
  });

  qb._started = _.union(qb._started, types);

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
    var err = new Error('Cannot push a type that this qb isn\'t able (use .can). Or see .call for remote push')
    if (callback)
      callback(err);
    else
      throw err;
  }

  qb.emit('push', type, task);

  if (callback)
    callback();

  return qb;
}

/*
* Create a remote caller using a given dialect.
* You must call .speaks(dialect) prior to using .call
*
* @param dialect string
* @param @optional callback function (err, caller) - Avoid the thrown error by passing a callback
*   If callback doesn't exist, will throw and return.
*/
QB.prototype.call = function call(dialect, callback) {
  var qb = this,
    err, ret;

  if (!_.contains(qb._spoken, dialect)) {
    err = new Error('Cannot .call a dialect that is not spoken (via .speaks)');
  } else {
    ret = dialects[dialect].caller();
  }

  if (callback) {
    callback(err, ret);
  } else if (err) {
    throw err;
  } else {
    return ret;
  }
}

/*
* Gracefully end the QB System
*
* @param @optional callback function (err, caller) - .end(f) is equivalent to .on('end', f).end()
*/
QB.prototype.end = function end(callback) {
  var qb = this;

  if (callback) {
    qb.once('end', callback);
  }

  _end(qb, function (err) {
    if (err) {
      qb.emit('error', err, 'end');
    }
    qb.emit('end');
  });
}

// -- Helpers --

function _listeners(qb, cb) {
  qb.on('push', function onpush(type, task, next) {
      try {
        qb._queues[type].queue.push(task, next);
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

  cb();
}

function _start(qb, dialects, types, callback) {
  var Q = qb._options.Q;

  async.parallel([
    // Start each of the dialects
    async.apply(async.each, dialects, function (dialect, cb) {
      dialects[dialect].start(types, cb);
    }),

    // Start up each of queues
    async.apply(async.each, _.pairs(types), function (pair, cb) {
      var type = pair[0],
        mcc = pair[1],
        key = [qb._options.prefix, 'service', type].join(qb._options.delimeter),
        queue = new Q(qb._redis, _.extend(_.clone(qb._options), {prefix: key})),
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
  async.parallel([
    async.apply(async.each, qb._spoken, function (dsys, cb) {
      dsys.end(cb);
    }),
    async.apply(async.each, _.pluck(qb._queues, 'listener'), function (list, cb) {
      list.once('end', cb).end();
    })
  ], function (err) {
    qb._redis.end();
    callback(err);
  });
}