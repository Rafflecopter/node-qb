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
        push: function (endpoint, task, callback) {},
        end: function () {}
      }
    },
  };

  Startup should setup all singletones.
  Service types are then passed in via can. Any listeners should be setup here.
  The call function should return an object with a `push(task, callback)` method on it.

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

  Startup should act similar to rpc, in that it sets up all singletons. Because services are not passed in, it shouldn't be called twice.
  Subscribe will give a channel and a callback function to be called when the message arrives.
  Publish will publish a task on a given channel.
*/

module.exports = {
  messageq: require('./messageq'),
  // http: require('./http')
};

