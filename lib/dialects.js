// lib/dialects.js
// Helpers to handle and manage dialects.

// vendor
var _ = require('underscore'),
  async = require('async');

module.exports = Dialects;

function Dialects(qb, options) {
  this.qb = qb;
  this.options = options;
  this.spoken = {};
  this.started = false;
  this.types = [];
}

// Get an instance of a dialect for user inspection and modification
Dialects.prototype.get = function (name) {
  if (!this.spoken[name]) {
    throw new Error('Dialect ' + name + ' is not spoken!')
  } else if (!this.started) {
    throw new Error('Can only "get" a dialect AFTER starting it.')
  }

  return this.spoken[name].instance
}

Dialects.prototype.speaks = function (dialect, extraopts) {
  if (!(dialect.type && dialect.name && dialect.startup)) {
    if (typeof dialect === 'string') {
      throw new Error('Use require(\'qb-' + dialect + '\') instead of \''+dialect+'\' for version 0.5+ of qb')
    } else {
      throw new Error('Dialect ' + dialect.name + ' is not available.');
    }
  }

  this.spoken[dialect.name] = {
    started: false,
    pkg: dialect,
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

Dialects.prototype.end = function (callback) {
  async.each(_.values(this.spoken), function (dobj, cb) {
    if (dobj.started)
      dobj.instance.end(cb);
    else
      cb()
  }, callback);
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

  var chan = this.channel;
  this.c.subscribe(chan, function (message, done) {
    _.each(factions, function (f) {
      f(message);
    });
    done && done();
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