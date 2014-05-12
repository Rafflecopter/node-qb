// qb/index.js
// qb is a quarterback for your soul

// Trivia: How is the digram 'qb' symmetric?
// See qb_test.js for the answer!

// builtin
var util = require('util');

// vendor
var _ = require('underscore'),
  async = require('async'),
  uuid = require('uuid');
  book = require('book');

// local
var MiddlewareProvider = require('./middleware_provider'),
  Dialects = require('./dialects');

var default_options = {
  idfield: 'id', //qb: Field containing the id
  catch_sigterm_end: true, //qb: Catch sigterm and call qb.end()
  end_timeout: 10000, //qb: Timeout on an end() call
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

  // Init
  qb._options = _.defaults(options, default_options)
  qb._dialects = new Dialects(qb, qb._options);
  qb._types = {};
  qb._started = [];
  qb._contacts = {};

  qb.log = book.default();

  qb.on('error', function (err, next) {
    qb.log.error(err)
    next()
  });

  if (qb._options.catch_sigterm_end)
    _handle_sigterm(qb);
}

util.inherits(QB, MiddlewareProvider);

/*
* Enable a type to process
*
* @param type string
* @param callback function(task, $done) - Task processor function
*/
QB.prototype.can = function can(type, callback) {
  var qb = this;

  if (qb._types[type] !== undefined) {
    return
  }

  qb._types[type] = callback;
  qb._dialects.can(type);

  // Handle early .start
  if (qb._hasstarted) {
    qb.emit('queue-start', type, function (err) {
      if (err) {
        qb.emit('error', err)
      } else {
        qb.emit('queue-ready', type)
      }
    });
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
    if (err) {
      qb.emit('error', err);
      qb.log.warn('Unable to start QB!')
    } else {
      qb.log.info('QB Started All Queues and Dialects. Ready to push.')
    }
    if (optional_callback) optional_callback(err)
  });

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
  var qb = this;

  if (!qb._types[type]) {
    cb(new Error('Cannot push a type that this qb isn\'t able (use .can). Or see .call for remote push'));
  } else {
    qb.emit('push', type, task, cb);
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
    qb.emit('end');
  });

  return qb
}

// -- Helpers --

function _listen(qb) {
  if (!qb._listening) {
    qb.on('process', function onprocess(type, task, next) {
      try {
        qb._types[type](task, callback);
      } catch (err) {
        callback(err);
      }

      function callback(err) {
        next(err)
        if (err) {
          qb.emit('fail', type, task, function (err) { if (err) qb.emit('error', err) });
        } else {
          qb.emit('finish', type, task, function (err) { if (err) qb.emit('error', err) });
        }
      }
    });

    qb._listening = true;
  }
}

function _start(qb, types, callback) {
  var ready = 0, total = _.keys(types).length

  _.keys(types).forEach(function (type) {
    qb.emit('queue-start', type, function (err) {
      if (err) { return qb.emit('error', err) }

      ready++
      if (ready == total) {
        qb.emit('ready')
      }
    })
    qb._started.push(type)
  })

  _listen(qb)
}


function _end(qb, callback) {
  var called = false, timeout = 0;
  function doCallback(err) {
    if (!called) {
      callback(err)
      called = true
      clearTimeout(timeout)
    }
  }

  async.parallel([
    qb.emit.bind(qb, 'queues-end'),
    qb._dialects.end.bind(qb._dialects)
  ], doCallback)

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
