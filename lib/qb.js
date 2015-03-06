// qb/index.js
// qb is a quarterback for your soul

// vendor
var async = require('async')
  , uuid = require('uuid')
  , book = require('book')
  , defaults = require('defaults')

// local
var MiddlewareProvider = require('./middleware_provider')
  , util = require('./util')

var default_options = {
  aliases: {}
, catch_sigterm_end: true //qb: Catch sigterm and call qb.end()
, end_timeout: 10000 //qb: Timeout on an end() call
, allow_defer: false // Allow deferring tasks
, defer_field: 'when' // Field containing timestamp signifying deferred task
, allow_recur: false // Allow recurring tasks
, recur_field: 'every' // Field containing millisecond recurring interval
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
  qb._options = defaults(options, default_options)
  qb._types = {}
  qb._aliases = {}

  // TODO process this into .alias
  _processAliasOptions(qb, qb._options.aliases)

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
      qb.emit('process-ready', type)
    }
  })

  return qb;
}

/*
* Alias a type for a location.
* This allows remote pushes via different protocols to be switched out using config
* Note that options.aliases is used as well
*
* @param alias string type or name that can be called in .push(alias, task)
* @param location actual protocol://location to push the task to
*/
QB.prototype.alias = function (alias, location) {
  var loclist = this._aliases[alias] = this._aliases[alias] || []
  loclist.push(location)
  return this
}

/*
* Start the processing pipeline for a task.
* This immediately starts processing the task. If you meant to push into a queue, see .push
*
* @param type string
* @param task object
* @param @optional callback function (err) - Avoid the thrown error by passing a callback
*   If callback doesn't exist, will throw if an error occurs.
*/
QB.prototype.process = function (type, task, callback) {
  var qb = this
  if (!qb._types[type])
    return callback(new Error('no ability to process task of type ' + type))

  return qb.emit('process', type, task, callback || errcallback(qb))
}

/*
* Push a task of some type onto our own queue.
*
* @param type string of the type to push if its aliased or a protocol://location
* @param task object
* @param @optional callback function (err) - Avoid the thrown error by passing a callback
*   If callback doesn't exist, will throw if an error occurs.
*/
QB.prototype.push = function push(type, task, callback) {
  var qb = this
    , locations = qb._aliases[type] || [type]

  async.each(locations, function (location, cb) {
    qb.emit('push', location, task, cb)
  }, util.throwIfNoCallback(callback))

  return qb
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
    qb.once('end', function (next) { callback(); next() });
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
        qb.emit('fail', type, task, errcallback(qb));
      } else {
        qb.emit('finish', type, task, errcallback(qb));
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

function errcallback(qb) {
  return function (err) {
    if (err)
      qb.emit('error', err)
  }
}

function _processAliasOptions(qb, aliases) {
  Object.keys(aliases).forEach(function (alias) {
    var locations = Array.isArray(aliases[alias]) ? aliases[alias] : [aliases[alias]]
    locations.forEach(function (loc) {
      qb.alias(alias, loc)
    })
  })
}