// dialects/nats.js
// Provides a pub/sub-like dialect for qb

// vendor
var Nats = require('nats'),
  _ = require('underscore');

function NatsDialect(qb, options) {
  this.nats = Nats.connect(options.nats);
  this.qb = qb;
  qb.log.info("Started Nats with options", options.nats);
}

NatsDialect.prototype.subscribe = function subscribe(uri, onmessage) {
  var qb = this.qb;
  this.nats.subscribe(_.last(uri.split('://')), function (msg) {
    try {
      onmessage(JSON.parse(msg));
    } catch (err) {
      qb.emit('error', err);
    }
  });
};

NatsDialect.prototype.publish = function publish(uri, message, callback) {
  this.nats.publish(_.last(uri.split('://')), JSON.stringify(message), callback);
};

NatsDialect.prototype.end = function end(cb) {
  this.nats.close()
  cb();
};

function startup(qb, options) {
  return new NatsDialect(qb, options);
}

module.exports = {
  type: 'pubsub',
  startup: startup,
};