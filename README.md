# qb [![Build Status][1]][2]

A framework for queue-based services.

`qb` makes it easy to create a service-oriented architecture built on whatever queue you like.

The currently only queue implementaion is built on Redis queues (specifically [relyq](https://github.com/Rafflecopter/relyq)), but with version 2.0, we have expanded extensibility to possibly other queue types.

To get started, check out the [example app](https://github.com/Rafflecopter/node-qb/blob/master/example/app.js).

Minimal Example (using `qb-relyq` backend):

```javascript
var QB = require('qb')
  , qb = new QB(qbOptions)

  // pull tasks off of relyq
qb.component(require('qb-relyq').queue, relyqOptions)
  // get tasks from an http api server
  .component(require('qb-http').receive, httpIncomingOptions)
  // push tasks to other http api servers
  .component(require('qb-http').push, httpOutgoingOptions)
  // process "email" tasks
  .can('email', sendEmail)
  // Create some middleware
  .post('push', function (location, task, next) {
    console.log('pushing task into the queue: ' + location + ' and id ' + task.id)
    next()
  })
  .pre('process', function (type, task, next) {
    console.log('about to process task of type ' + type + ' and id ' + task.id)
    next()
  })
  .post('finish', function (type, task, next) {
    console.log('finished processing task of type ' + type + ' and id ' + task.id)
    next()
  })
  .post('fail', function (type, task, next) {
    console.log('failed processing task of type ' + type + a' and id ' + task.id  + ' with error ' + task.error)
    next()
  })
```

## Features

- Easy service setup: `.can` method
- Extensible interfaces for queue pulling and communication
- Flexible middleware system: `.pre` and `.post` methods
- Graceful shutdown: `.post('end', onReadyToShutdown).end` methods
- Easy configuration

## Install

```
npm install qb
```

## Options

`qb` makes a lot of assumptions on how you might use it. But most of those are configurable. I've highlighted the most commonly used options, while being complete with the description of all options.

### `qbOptions`

```javascript
var qb = new QB(qbOptions)
```

Available options:

- `name` The name used in log messages.
- `aliases` An object mapping a pushable type to a location
```javascript
{
  sometype: 'http://my.other.service.com/api/push/sometype',
  othertype: 'relyq://otherservice:othertype'
}
```
- `catch_sigterm_end` Catch SIGTERM and start a graceful shutdown (default: `true`)
- `end_timeout` Timeout to wait for graceful shutdown of processing tasks

## Components

`qb` is useless framework without its components. The primary component is one that can pull tasks off of a queue for processing (called queue compenents). Other components will allow pushing of tasks to other queues (push components), as well as receiving tasks from other means (receiver components). Some components provide none of the above, simply middleware or convienience.

- [`qb-relyq`](https://github.com/Rafflecopter/node-qb-relyq) Provider of a queue component and pusher component for pushing directly onto other service's queues.
- [`qb-http`](https://github.com/Rafflecopter/node-qb-http) Provider of receive and push components.
- [`qb-statsd`](https://github.com/Rafflecopter/node-qb-statsd) Records statistics on queues to statsd.
- [`qb-monitor`](https://github.com/Rafflecopter/node-qb-monitor) Works with `qb-statsd` and `qb-http` to provide monitoring solutions for queues.

#### Component API

Developing a Component is easy. `qb` works on an event and middleware model that make it really easy to extend.

All components are `function (qb, options) {}` and are called by the user as `qb.component(comp, options)`.

All components must end on the `end` event.

```javascript
qb.on('component-end', function (next) {
  endAllMyStuff(next)
})
```

##### Queue Components

Queue components should listen on `process-type` for types that are able to be processed. This is fired after the user calls `qb.can(type, processFunc)`. The queue should setup a listener. When a task is pulled, it should call `qb.emit('process', type, task)`.

```javascript
qb.on('process-type', function (type, next) {
  setupQueue(function onTask(task, callback) {
    qb.process(type, task, callback)
  })
})
```

Additionally, the queue component should start a corresponding push component and add aliases for processable types.

```javascript
qb.component(correspondingPushComponent)

qb.on('process-type', function (type, next) {
  qb.alias(type, 'myprotocol://queue_name_for_type')
})
```

##### Push Components

Push components' job is to listen on the `push` event for its protocol.

```javascript
qb.on('push', function (location, task, next) {
  // if location starts with "myprotocol://"
  if (/^myprotocol:\/\//.test(location)) {
    pushIntoQueue(location, task, next)
  } else {
    next()
  }
})
```

##### Receive Components

Receive components' job is to listen for tasks and `push` them into the local queue.

```javascript
setupSomeListener(function onReceive(type, task, callback) {
  if (qb._types[type]) {
    qb.push(type, task, callback)
  } else {
    callback(new Error('Cant push task types that arent processable via qb.can()'))
  }
}
```

## Notes

- `qb.log` is a default instance of [node-book](https://github.com/shtylman/node-book). You can configure it with middleware and all `qb.log` calls will be formatted as appropriate. (See [book-raven](https://github.com/shtylman/node-book-raven) and [book-loggly](https://github.com/yanatan16/node-book-loggly).)

## Middleware

Middleware can be put on the following events: `push`, `process`, `fail`, `finish`, and `error`. All middleware can be either `.pre(event)`, `.post(event)`, or `.on(event)` to control flow.

These are the primary points for middleware:

- `.pre('push', function (type, task, next) {})` Before a push occurs, modify the task. Erroring here will cause an error response by receive components.
- `.on('finish', function (type, task, next) {})` Do something upon a successful completion of a task.
- `.on('fail', function (type, task, next) {})` Do something upon a failed task. `task.error` will be available as a stringified error form.
- `.on('error', function (err, next) {})` Do something upon an internal error occurring.

### Provided Middleware

```javascript
qb.pre('push')
  .use(QB.middleware.setTimestamp('field-to-set-in-the-task'))

qb.on('fail')
  .use(QB.middleware.retry(['type-to-retry','another-type'], 2 /* times */))
```

## Tests

```
npm install -g nodeunit
npm test
```

## License

See LICENSE file.

[1]: https://travis-ci.org/Rafflecopter/node-qb.png?branch=master
[2]: http://travis-ci.org/Rafflecopter/node-qb