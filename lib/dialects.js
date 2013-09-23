// lib/dialects.js
// Helpers to handle and manage dialects.

// vendor
var _ = require('underscore'),
  async = require('async');

// local
var available = require('../dialects');

module.exports = Dialects;

function Dialects(qb, options) {
  this.qb = qb;
  this.options = options;
  this.spoken = {};
  this.started = false;
  this.types = [];
}

Dialects.prototype.speaks = function (dialect, extraopts) {
  if (!available[dialect]) {
    throw new Error('Dialect ' + dialect + ' is not available.');
  }

  this.spoken[dialect] = {
    started: false,
    pkg: available[dialect],
    options: _.extend(_.clone(this.options), extraopts),
    types: [],
  };

  if (this.started) this._start();
}

Dialects.prototype.can = function (type) {
  this.types.push(type);

  if (this.started) this._start();
}

Dialects.prototype.start = function () {
  this.started = true;
  this._start();
}

Dialects.prototype.speak = function (dialect, to) {
  var dobj = this.spoken[dialect];

  if (!dobj) {
    throw new Error('Must speak a dialect before calling it!')
  } else if (!dobj.started) {
    throw new Error('Must start() qb before calling other qb providers');
  }

  switch (dobj.pkg.type) {
  case 'rpc':
    return new RpcCaller(dobj.instance, to);
  case 'pubsub':
    return new PubSubCaller(this.qb, dobj.instance, to);
  default:
    throw new Error('unsupported');
  }
}

Dialects.prototype.end = function () {
  _.each(this.spoken, function (dobj) {
    if (dobj.started)
      dobj.instance.end();
  });
}

// Idempotent start function
Dialects.prototype._start = function () {
  var self = this;
  _.each(this.spoken, function (dobj, dname) {
    if (!dobj.started) {
      dobj.instance = dobj.pkg.startup(self.qb, dobj.options);
      dobj.started = true;
    }

    if (dobj.pkg.type === 'rpc') {
      var newtypes = _.difference(self.types, dobj.types || []);
      if (newtypes.length) {
        dobj.instance.can.apply(dobj.instance, newtypes);
        dobj.types = _.union(dobj.types, newtypes);
      }
    }
  });
}

function PubSubCaller(qb, caller, channel) {
  this.qb = qb;
  this.c = caller;
  this.channel = channel;
}

PubSubCaller.prototype.to = function (channel) {
  this.channel = channel;
  return this;
}

PubSubCaller.prototype.subscribe = function () {
  var qb = this.qb,
    actions = Array.prototype.slice.call(arguments),
    factions = _.map(actions, function (a) {
      if (_.isFunction(a)) {
        return a;
      } else if (_.isString(a)) {
        // Its a service type. Check that its .can'ed
        if (_.contains(qb.types(), a)) {
          return function (msg) {
            qb.push(a, msg);
          }
        } else {
          throw new Error('Type ' + a + ' is not .can\'d, so it cant be a subscriber action');
        }
      } else {
        throw new Error('Dont know how to build subscribe functionality from ' + a);
      }
    });

  this.c.subscribe(this.channel, function (message, done) {
    _.each(factions, function (f) {
      f(message);
    });
    done();
  });

  return this;
}

PubSubCaller.prototype.publish = function (message, callback) {
  var channel = this.channel;
  if (arguments.length == 3) {
    channel = message;
    message = callback;
    callback = arguments[2];
  }

  this.c.publish(channel, message, callback || function(){});

  return this;
}

function RpcCaller(caller, endpoint) {
  this.c = caller;
  this.endpoint = endpoint;
}

RpcCaller.prototype.push = function (type, message, callback) {
  this.c.push(this.endpoint, type, message, callback || function (){});
  return this;
}

RpcCaller.prototype.to = function (endpoint) {
  return new RpcCaller(this.c, endpoint);
}