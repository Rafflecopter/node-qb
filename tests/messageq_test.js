// qb_test.js
require('longjohn');

var _ = require('underscore');

var qbPkg = require('..');

var qb1, qb2,
  options = {
    discovery_prefix: 'qb-test:discovery',
  };

// If we are getting a test.done complaint, turn this on. It helps find errors
process.on('uncaughtException', function (err) {
  console.error(err.stack);
});

var tests = exports.messageq = {};

tests.setUp = function (cb) {
  qb1 = new qbPkg.QB();
  qb2 = new qbPkg.QB();
  cb();
}

tests.tearDown = function (cb) {
  qb1.end();
  qb2.end();
  cb();
}

tests.nothing = function (test) {
  qb1.on('error', test.done)
    .can('testf', function (task, done) {
      test.done(new Error('shouldnt be here'));
    })
    .speaks('messageq', options)
    .start();

  var caller = qb1.call('messageq');
  process.nextTick(test.done);
}

tests.pubsub = function (test) {
  var called = 0, cbc = 0;
  qb1.on('error', test.done)
    .pre('push', qbPkg.mdw.ensureId())
    .can('something', function (task, done) {
      test.equal(task.foo, 'bar' + (called == 1 ? 'n' : ''));
      called++;
      done();
    })
    .on('finish', function (type, task, done) {
      if (called == 2 && cbc == 2)
        process.nextTick(test.done);
    })
    .speaks('messageq', options)
    .start()
    .call('messageq', 'bazchan')
      .subscribe(function (msg) {
        test.equal(msg.foo.slice(0, 3), 'bar')
        cbc++;
      }, 'something');


  qb2.on('error', test.done)
    .speaks('messageq', options)
    .start()

    .call('messageq', 'barbaz')
      .publish('bazchan', {foo: 'bar'}, test.ifError)
      .qb
    .call('messageq', 'bazchan')
      .publish({foo: 'barn'}, test.ifError);
}