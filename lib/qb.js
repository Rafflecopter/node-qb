// qb/index.js
// qb is a quarterback for your soul

// vendor
var async = require('async')
  , uuid = require('uuid')
  , book = require('book')

// local
var MiddlewareProvider = require('./middleware_provider')
  , util = require('./util')

var default_options = {
  aliases: {}
  catch_sigterm_end: true, //qb: Catch sigterm and call qb.end()
  end_timeout: 10000, //qb: Timeout on an end() call
  allow_defer: false, // Allow deferring tasks
  defer_field: 'when', // Field containing timestamp signifying deferred task
  allow_recur: false, // Allow recurring tasks
  recur_field: 'every', // Field containing millisecond recurring interval
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
  qb._types = {};
  qb._aliases = qb._options.aliases || {};

  qb.log = book.default();

  if (qb._options.catch_sigterm_end)
    util.handle_sigterm(qb);

  _listen(qb)
}

util.inherits(QB, MiddlewareProvider);

/*
* Include a component in this qb system.
* This is used to provide backend queue functionality as well as push dialects
*
* @param component Component
*/
QB.prototype.component = function (component, config) {
  component(this, config)
  return this
}

/*
* Enable a type to process
*
* @param type string
* @param callback function(task, $done) - Task processor function
*/
QB.prototype.can = function can(type, callback) {
  var qb = this;

  if (qb._types[type]) {
    return
  }

  qb._types[type] = callback;

  qb.emit('process-type', type, function (err) {
    if (err) {
      qb.emit('error', err)
    } else {
      qb.emit('type-ready', type)
    }
  })

  return qb;
}

QB.prototype.types = function () {
  return _.keys(this._types);
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
  var qb = this

  var location = qb._aliases[type] || type

  return qb.emit('push', location, task, util.throwIfNoCallback(callback))
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
  qb.on('error', function (err, next) {
    qb.log.error(err)
    next()
  })

  qb.on('process', function (type, task, next) {
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
}

function _end(qb, callback) {
  var called = false
    , timeout = 0
    , cb = util.callOnce(function (err) {
        callback(err)
        clearTimeout(timeout)
      })

  qb.emit('component-end', cb)

  timeout = setTimeout(function () {
    cb(new Error('TIMEOUT on End'))
  }, qb._options.end_timeout)
}
