// middleware.js
// Provides a base class for pre and post middleware on events.

/*
Example Usage

    var mdw = new MiddlewareProvider()
      .pre('event', someCallback).use(anotherCallback)
      .on('event').(useCalback)
      .post('event').use(yetAnotherCallback);

    mdw.emit('event1', args...);

    function callbackFormat(args..., next);
*/

// vendor
var _ = require('underscore');

function MiddlewareProvider () {
  this._current_event = null;
  this._wares = {};
  this._once = {};
}

// .pre, .post, and .on
// Set the current event to pre:event, post:event or event
// Also call .use on any extra arguments
_.each({pre: 'pre:', post: 'post:', on: '', once: 'once:'}, function (prefix, name) {
  MiddlewareProvider.prototype[name] = createSetterFunc(prefix)
})

// Add the middleware
MiddlewareProvider.prototype.use = function use(ware) {
  if (!this._current_event) throw new Error('You must call .pre, .post, or .on before .use');
  this._wares[this._current_event] = (this._wares[this._current_event] || []).concat(ware);
  return this;
}

// Emit a middleware event
MiddlewareProvider.prototype.emit = function emit(event) {
  var self = this,
    args = Array.prototype.slice.call(arguments, 1),
    callback = _.isFunction(_.last(args)) ? args.pop() : null,
    wares = (this._wares['pre:'+event] || [])
      .concat(this._wares['once:'+event] || [])
      .concat(this._wares[event] || [])
      .concat((this._wares['post:'+event] || []).reverse()),
    next = createMiddlewareChain(wares, args, function (err) {
      if (callback) callback(err);
    });

  delete this._wares['once:'+event];
  next();
  return this;
}

function createSetterFunc(prefix) {
  return function setter(event) {
    this._current_event = prefix+event;

    var self = this;
    Array.prototype.slice.call(arguments, 1).forEach(function (f) {
      self.use(f);
    });

    return this;
  };
}

function createMiddlewareChain(wares, args, callback) {
  var cbargs = args.concat([next]);

  function next(err) {
    if (err) {
      callback.apply(null, [err].concat(args));
    } else if (wares.length) {
      try {
        var ware = wares.shift()
        if (ware.length >= cbargs.length) {
          ware.apply(null, cbargs)
        } else {
          ware.apply(null, args)
          next()
        }
      } catch (err) {
        callback.apply(null, [err].concat(args));
      }
    } else {
      callback.apply(null, [null].concat(args));
    }
  }

  return next;
}

module.exports = MiddlewareProvider;