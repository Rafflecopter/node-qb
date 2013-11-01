// dialects/messageq.js
// Provides a pub/sub-like dialect for qb

// vendor
var messageq = require('messageq'),
  Moniker = require('moniker'),
  _ = require('underscore');

function MessageQDialect(qb, options) {
  var prefix = [options.prefix, 'mq'].join(options.delimeter);
  this.mq = new messageq.RedisMQ(options.redis || qb._redis, _.extend(_.clone(options), {prefix: prefix}));
  qb.log.info("Started MessageQ on discovery prefix %s", options.discovery_prefix);
}

MessageQDialect.prototype.subscribe = function subscribe(uri, onmessage) {
  this.mq.subscribe(_.last(uri.split('://')), onmessage);
}

MessageQDialect.prototype.publish = function publish(uri, message, callback) {
  this.mq.publish(_.last(uri.split('://')), message, callback);
}

MessageQDialect.prototype.end = function end(cb) {
  this.mq.end(cb)
}

function startup(qb, options) {
  return new MessageQDialect(qb, options);
}

module.exports = {
  type: 'pubsub',
  startup: startup,
}