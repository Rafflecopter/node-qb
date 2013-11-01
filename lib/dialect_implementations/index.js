// dialects/index.js
// Require-all file and documentation for dialects

/*
  Dialects are ways to communicate with, to, and between qb service-providers.

  Some dialects act like remote procedure calls, such as http.
  Other dialects act like pub/sub semantics, such as messageq.
  Each has its own api.

  For rpc-like dialects, they should export the following:

  module.exports = {
    type: 'rpc',
    startup: function (qb, options) {
      return {
        can: function (type, type, ...) {},
        push: function (endpoint, type, task, callback) {},
        end: function () {}
      }
    },
  };

  Startup should return an object that can perform dialect call operations. It should also start any listeners.
  Valid service types are then passed in via can and listeners should be updated to them.
  Push is a function to perform a remote push to another qb instance over the dialect.
  End should close all listeners (asynchronously if necessary).

  For pub/sub-like dialects, they should export the following:

  module.exports = {
    type: 'pubsub',
    startup: function (qb, options) {
      return {
        subscribe: function (channel, onmessage) {},
        publish: function (channel, task, callback) {},
        end: function () {},
      }
    },
  }

  Startup should act similar to rpc, in that it sets up and retruns a singleton dialect.
  Subscribe will give a channel and a callback function to be called when the message arrives.
  Publish will publish a task on a given channel.
  End should close all listeners (asynchronously if necessary).
*/

module.exports = {
  messageq: require('./messageq'),
  nats: require('./nats'),
  http: require('./http')
};

