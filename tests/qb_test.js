// qb_test.js
require('longjohn');

// Trivia Answer: Invert horizontally, then vertically to find the symmetry.

var _ = require('underscore'),
  uuid = require('uuid');

var qbPkg = require('..');

var qb;

// If we are getting a test.done complaint, turn this on. It helps find errors
process.on('uncaughtException', function (err) {
  console.error(err.stack);
});

var tests = exports.tests = {};

tests.setUp = function (cb) {
  qb = new qbPkg.QB({
    defer_polling_interval: 50,
  });
  cb();
}

tests.tearDown = function (cb) {
  qb.end();
  cb();
}

tests.basic = function basic (test) {
  var called = false;
  qb.on('error', test.ifError)
    .can('foobar', function (task, done) {
      test.equal(task.foo, 'bar');
      called = true;
      done();
    })
    .post('process')
      .use(function (type, task, next) {
        test.equal(type, 'foobar');
        test.equal(task.foo, 'bar');
        test.equal(called, true);
        next();
      })
    .on('finish', function (type, task, next) {
      test.done();
    })
    .start()

    .push('foobar', {foo: 'bar'}, test.ifError);
}

tests.push_middleware = function push_middleware (test) {
  qb.on('error', test.ifError)
    .can('cancan', function (task, done) {
      test.equal(task.prepush, true);
      done();
    })
    .pre('push', function (type, task, next) {
      test.equal(type, 'cancan');
      test.equal(task.can, 'can');
      task.prepush = true;
      next();
    })
    .on('finish', function () { test.done(); })
    .start()
    .push('cancan', {can: 'can'}, test.ifError);
}

tests.process_middleware = function process_middleware(test) {
  qb.on('error', test.done)
    .can('dodo', function (task, done) {
      test.equal(task.preprocess, true);
      task.process = true;
      done();
    })
    .pre('process', function (type, task, next) {
      test.equal(type, 'dodo');
      test.equal(task.do, 'do');
      task.preprocess = true;
      next();
    })
    .post('process', function (type, task, next) {
      test.equal(task.do, 'do');
      test.equal(task.process, true);
      test.equal(task.preprocess, true);
      task.postprocess = true;
      next();
    })
    .on('finish', function (type, task, next) {
      test.equal(type, 'dodo')
      test.equal(task.process, true)
      test.equal(task.postprocess, true)
      test.done();
    })
    .start()
    .push('dodo', {do: 'do'}, test.ifError);
}

tests.failed_tasks = function failed_tasks(test) {
  qb.on('error', test.done)
    .can('bad', function (task, done) {
      test.equal(task.hate, 'love')
      done(new Error('failure'));
    })
    .on('finish', function (type, task, next) {
      test.done(new Error('should have failed'))
    })
    .on('fail', function (type, task, next) {
      test.equal(type, 'bad')
      test.equal(task.error, 'Error: failure')
      test.equal(task.hate, 'love')
      test.done();
    })
    .start()
    .push('bad', {hate:'love'}, test.ifError);
}

tests.multiple = function multiple(test) {
  var n = 0, tend = function () {if (++n > 4) test.done(); }

  qb.on('error', test.done)
    .can('super-soaker', function (task, done) {
      task.soak = true;
      done();
    })
    .can('bad-soaker', function (task, done) {
      task.soak = false;
      done();
    })
    .can('super-fail', function (task, done) {
      // do nothing
      done();
    })
    .pre('process')
      .use(function (type, task, next) {
        if (type === 'super-fail') {
          return next(new Error('andross'));
        }
        next();
      })
    .pre('push', function (type, task, next) {
      next();
    })
    .on('fail')
      .use(function (type, task, next) {
        test.equal(type, 'super-fail');
        tend();
        next();
      })
    .on('finish')
      .use(function (type, task, next) {
        test.ok(_.contains(['super-soaker', 'bad-soaker'], type))
        test.equal(task.soak, type === 'super-soaker')
        tend();
        next();
      })
    .start()

    .push('super-soaker', {something: 'here'}, test.ifError)
    .push('super-soaker', {something: 'else'}, test.ifError)
    .push('bad-soaker', {something: 'here'}, test.ifError)
    .push('super-fail', {something: 'here'}, test.ifError)
    .push('bad-soaker', {something: 'here'}, test.ifError);
}

tests.deferred = function deferred(test) {
  var called = false;

  qb.on('error', test.done)
    .can('after', function (task, done) {
      test.ok(task.received + 50 < Date.now(), 'processing time too early recieved: ' + task.received + ' now: ' + Date.now());
      called = true;
      done();
    })
    .pre('push', qbPkg.mdw.setTimestamp('received'))
    .on('finish', function (type, task, next) {
      test.ok(called);
      test.done();
    })
    .start();

  process.nextTick(function () {
    qb.push('after', {foo:'bar', when: Date.now() + 100});
  });
}

tests.setTimestamp = function setTimestamp (test) {
  var called = false;
  qb.on('error', test.done)
    .can('foobar', function (task, done) {
      test.ok(task.pushtime > Date.now() - 1000 && task.pushtime < Date.now());
      test.ok(task.timestamp > Date.now() - 100 && task.timestamp <= Date.now(), 'Timestamp isnt close enough ('+task.timestamp+') to now ('+Date.now()+')');
      called = true;
      done();
    })
    .pre('push')
      .use(qbPkg.mdw.setTimestamp('pushtime'))
    .pre('process')
      .use(qbPkg.mdw.setTimestamp())
    .on('finish', function (type, task, next) {
      test.equal(called, true);
      test.done();
    })
    .start()

    .push('foobar', {foo: 'bar'}, test.ifError);
}