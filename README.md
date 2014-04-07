# qb [![Build Status][1]][2]

A super-simple service-provder framework.

`qb` makes it easy to create a service-oriented architecture built on Redis queues (specifically [relyq](https://github.com/Rafflecopter/relyq)).

To get started, check out the [example app](https://github.com/Rafflecopter/node-qb/blob/master/example/app.js) look below.

Minimal Example (using `qb-relyq` backend):

```javascript
require('qb').init({prefix: 'qb'}, require('qb-relyq'))
  .can('email', sendEmail)
  .speaks('http', {port: 8000})
  .start();
```

Full Example:

```javascript
// Init
var qbPkg = require('qb'),
  QB = qbPkg.backend(require('qb-relyq'))
  mdw = qbPkg.mdw;

// Initialize qb
var qb = new QB({
    prefix: 'my-emailer'
  })

  // Service to provide
  .can('email', [max_concurrent_callbacks,] sendEmail )
  .can('add-subscriber', [max_concurrent_callbacks,] addSubscriber)

  // Tell it what dialects to speak (i.e. communicate with other qb instances on)
  .speaks(require('qb-http'), { port: 8000, base: '/qb' })
  .speaks(require('qb-messageq'), { discovery_prefix: 'qb:discovery' })

  // Add some middleware
  .pre('push').use(mdw.setTimestamp('received'))
  .pre('process').use(mdw.setTimestamp('processed'))
  .post('fail').use(sendFailureReport /* custom middleware */);

  // Start!
  .start();

// Contact another qb instance

// Option 1: use the returned dialect
var myFriend = qb.contacts('http://my.friend.com/qb');
myFriend.push('other-service', {a:'new', job:'description'});

// Option 2: use an alias
qb.contacts('messageq://some-channel', 'somechan');
qb.contacts('messageq://other-channel', 'otherchan');

// Option 3: Always use .contact(uri)
qb.contact('http://my.service.com/api/do/something').push(task);

// ...later...
qb.contact('somechan')
  .subscribe(function(msg) { msg.email = 'abc@jon.com' }, 'email')
  .publish({do:'this', a:'lot'});

qb.contact('otherchan').publish({seri:'ously'});

// Some time later, graceful shutdown
qb.end(onend);

// Handle errors
qb.on('error', function (err) {
  var args = Array.prototype.slice.call(arguments, 1);
  //etc..
})

// You can locally push tasks
qb.push('email', {email: 'this-guy', template: 'whatever'})

  // Or use deferred tasks
  .push('email', {when: Date.now() + 60000, email: 'another-guy', template: 'whatever'})

  // And you can do recurring tasks
  .push('email', {every: 60*60*1000, email: 'our-man', template: 'recurring'});
```

## Features

- Easy service setup: `.can` method
- Multiple dialects for sending and receiving tasks: `.speaks` and `.dialect().push` methods
- Flexible middleware system: `.pre` and `.post` methods
- Graceful shutdown: `.post('end', onReadyToShutdown).end` methods
- Easy configuration
- Fields on a task starting with an underscore will not be saved to the database. You can safely add them to the task in pre-process middleware.

## Install

```
npm install qb
```

## Options

`qb` makes a lot of assumptions on how you might use it. But most of those are configurable. I've highlighted the most commonly used options, while being complete with the description of all options.

### on `.init()`

The `require('qb').init(options)` (as well as `new require('qb').backend(backend)(options)`) function takes an options object. The options available are below:

```javascript
var qb = require('qb').init(options, backend);
//or
var QB = require('qb').backend(backend)
  , qb = new QB(options)
```

Options:

- `idfiled`: (default: `'id'`). The field of the task objects containing a unique ID.
- `catch_sigterm_end`: (default: `true`). Catch SIGTERM and call `qb.end()` on receiving it.
- `end_timeout`: (defualt: `1000` ms). Timeout on `qb.end()` waiting times before callback.

## Backends

`qb` is pluggable and requires backends in order to run a work queue. The original backend in [qb-relyq](https://github.com/Rafflecopter/node-qb-relyq). Another backend is in the works for kafka ([qb-kafka](https://github.com/Rafflecopter/node-qb-kafka)).

#### Backend API

A backend is a function of an options object and the qb object. It can then do whatever it wants to the qb object using its event emitter system. Here is a basic backend that doesn't use a work queue and immediately routes pushed tasks to be processed.

```javascript
function immediateProcessorBackend(options, qb) {
  qb.on('queue-start', function (type, next) {
      // start queue is a no-op
      next()
    })
    .on('push', function (type, task, next) {
      // No work queue is used here
      setImmediate(function () {
        qb.emit('process', type, task)
      })
      next()
    })
    .on('queues-end', function (next) {
      next()
    })
}

var QB = require('qb').backend(immediateProcessorBackend)
  , qb = new QB(options)
```

## Notes

- `qb.log` is a default instance of [node-book](https://github.com/shtylman/node-book). You can configure it with middleware and all `qb.log` calls will be formatted as appropriate. (See [book-raven](https://github.com/shtylman/node-book-raven) and [book-loggly](https://github.com/yanatan16/node-book-loggly).)

## Dialects

Each dialect has its own specific options, which are passed in upon doing `speaks(dialect, options)`. Available dialects are used by requiring their respective packages:

- [http](https://github.com/rafflecopter/node-qb-http) Simple http based RPC
- [messageq](https://github.com/rafflecopter/node-qb-messageq) Simple redis-backed reliable message passing ([messageq](https://github.com/rafflecopter/node-messageq)). (Uses same task queue as qb)
- [nats](https://github.com/rafflecotper/node-qb-nats) Pub/sub message passing using [nats](https://github.com/derekcollison/nats)

If necessary, you can access a dialects internal instance by calling `.dialect(name)`; for instance to add middleware to an http express server.

```javascript
qb.dialect('http').app.use(someNewMiddleware)
```

### Creating your own dialect

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

_Note_: QB doesn't actually allow RPC, only the use of it to push tasks onto another QB instance.

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

## Middleware

Middleware can be put on the following events: `push`, `process`, `fail`, `finish`, and `error`. All middleware can be either `.pre(event)`, `.post(event)`, or `.on(event)` to control flow.

These are the primary points for middleware:

- `.pre('push').use(function (type, task, next) {})` Before a push occurs, modify the task. Erroring here will cause an error response by service-oriented dialects such as api `.push` and `http` dialect.
- `.on('finish').use(function (type, task, next) {})` Do something upon a successful completion of a task. If `clean_finish` is `true` (by default it is), this is the last point which the task will be available before being dropped.
- `.on('fail').use(function (type, task, next) {})` Do something upon a failed task. `task.error` will be available as a stringified error form.
- `.on('error').use(function (err, next) {})` Do something upon an internal error occurring.

Provided Middleware

```javascript
qb.pre('push')
  .use(qb.mdw.setTimestamp('field-to-set-in-the-task'))

qb.on('fail')
  .use(qb.mdw.retry(['service-to-retry','another-service'], 2 /* times */))
```

## Tests

```
npm install -g nodeunit
npm test
```

## TODO

- logging using [book](http://npmjs.org/book)
- Html gui akin to [kue](http://npmjs.org/kue)

## License

See LICENSE file.

[1]: https://travis-ci.org/Rafflecopter/node-qb.png?branch=master
[2]: http://travis-ci.org/Rafflecopter/node-qb