# qb [![Build Status][1]][2]

A super-simple service-provder framework.

`qb` makes it easy to create a service-oriented architecture built on Redis queues (specifically [relyq](https://github.com/Rafflecopter/relyq)).

```javascript
// Init
var qb = require('qb').init(options);

// Set up services to provide
qb.can('email', [max_concurrent_callbacks,] sendEmail )
  .can('add-subscriber', [max_concurrent_callbacks,] addSubscriber)
  .speaks('http' [,httpOptions])
  .speaks('messageq' [, messageqOptions])
  .start();

// Push tasks onto remote services
qb.call('http').push('other-service', {a:'new', job:'description'})
  .call('messageq').push('yet-another-service', {do:'this',a:'lot'});

// You can setup middleware
qb.pre('push').use(setId).use(addReceivedTimestamp)
  .pre('process').use(addProcessTimestamp)
  .post('finish').use(logFinish)
  .post('fail').use(sendFailureReport);

// Some time later, graceful shutdown
qb.post('end', quit).end();

// Handle errors
qb.on('error', function (err) {
  var args = Array.prototype.slice.call(arguments, 1);

  // do something with err and args
})
```

## Features

- Easy service setup: `.can` method
- Multiple dialects for sending and receiving tasks: `.speaks` and `.dialect().push` methods
- Flexible middleware system: `.pre` and `.post` methods
- Graceful shutdown: `.post('end', onReadyToShutdown).end` methods

## Install

```
npm install qb
```

## Options

`qb` makes a lot of assumptions on how you might use it. But most of those are configurable. I've highlighted the most commonly used options, while being complete with the description of all options.

### on `.init()`

The `require('qb').init()` function takes an options object for its instantiated relyq. The options available are below:

```javascript
require('qb').init();
//or
require('qb').init(options);
```

Common:

- `prefix: 'my-services'` (default: 'qb') The [relyq](https://github.com/Rafflecopter/relyq) service prefix for Redis queue keys. (Service endpoints will take the type name after the prefix.)
- `timeout: 1` (in seconds, defaults to 1) The timeout of blocking redis calls on the queue. This determines how often `qb` checks for `.end()` calls.

Others:

- `clean_finish: true` (default: true) If true, no jobs are kept after being successfully finished.
- `delimeter: ':'` (default: ':') Sets the Redis delimeter
- `idfield: 'id'` (default: 'id') Sets the id field to use on tasks. IDs will be distinct and uniquely set on push if they don't already exist.
- `Q: relyq.RedisJsonQ` (defaults to RedisJsonQ) A [relyq](https://github.com/Rafflecopter/relyq) queue type to use. The suggested ones are `RedisJsonQ`, `RedisMsgPackQ`, and `MongoQ` (which only uses mongo for storing task objects, not the queue itself which is still in Redis).
  - If using `relyq.MongoQ`, additional options are required: `mongo: mongodb.mongoClient`, `db: dbname`, and `collection: collname`.
- `max_concurrent_callbacks: 100` (defaults to 100) Set the default max_concurrent_callbacks in case its not passed in on `.can`.


## Dialects

Each dialect has its own specific options, which are passed in upon doing `speaks(dialect, options)`.

### http

TODO

### messageq

[messageq](https://github.com/Rafflecopter/node-messageq) is a simple, reliable Redis-backed task queue based pub/sub messaging system based on [relyq](https://github.com/Rafflecopter/relyq). The options below will default to the values in `.init(options)`.

- `discovery_prefix: 'my-soa-discovery'` (required) - Redis key prefix for the discovery service.

- `Q: relyq.RedisJsonQ` (defaults to RedisJsonQ) A [relyq](https://github.com/Rafflecopter/relyq) queue type to use. The suggested ones are `RedisJsonQ`, `RedisMsgPackQ`, and `MongoQ` (which only uses mongo for storing task objects, not the queue itself which is still in Redis).
  - If using `relyq.MongoQ`, additional options are required: `mongo: mongodb.mongoClient`, `db: dbname`, and `collection: collname`.
- `max_out: 100` (default: 100) Max number of push events to fire concurrently. It is usually safe to keep this high (unless you have significant `.pre('push')` middleware).

## Tests

```
npm install -g nodeunit
npm install --dev
npm test
```

## License

See LICENSE file.

[1]: https://travis-ci.org/Rafflecopter/node-qb.png?branch=master
[2]: http://travis-ci.org/Rafflecopter/node-qb