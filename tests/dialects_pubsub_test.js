// qb_test.js
require('longjohn');

var _ = require('underscore');

var qbPkg = require('..');

var dialects = {
  messageq: {
    discovery_prefix: 'qb-test:discovery',
  },
}

// If we are getting a test.done complaint, turn this on. It helps find errors
process.on('uncaughtException', function (err) {
  console.error(err.stack);
});

_.each(dialects, createTests);

function createTests(options, dialect) {
  var tests = exports[dialect] = {},
    qb1, qb2, qb3;

  tests.setUp = function (cb) {
    qb1 = new qbPkg.QB({prefix:'qb1'})
      .pre('push', qbPkg.mdw.ensureId())
      .speaks(dialect, options);
    qb2 = new qbPkg.QB({prefix:'qb2'})
      .pre('push', qbPkg.mdw.ensureId())
      .speaks(dialect, options);
    qb3 = new qbPkg.QB({prefix:'qb3'})
      .pre('push', qbPkg.mdw.ensureId())
      .speaks(dialect, options);
    cb();
  }

  tests.tearDown = function (cb) {
    qb1.end();
    qb2.end();
    qb3.end();
    cb();
  }

  tests.nothing = function (test) {
    qb1.on('error', test.done)
      .can('testf', function (task, done) {
        test.done(new Error('shouldnt be here'));
      })
      .start();

    var caller = qb1.call(dialect);
    process.nextTick(test.done);
  }

  tests.pubsub = function (test) {
    var called = 0, cbc = 0;
    qb1.on('error', test.done)
      .can('something', function (task, done) {
        test.equal(task.foo, 'bar' + (called == 1 ? 'n' : ''));
        called++;
        done();
      })
      .on('finish', function (type, task, done) {
        if (called == 2 && cbc == 2)
          process.nextTick(test.done);
      })
      .start()
      .call(dialect, 'bazchan')
        .subscribe(function (msg) {
          test.equal(msg.foo.slice(0, 3), 'bar')
          cbc++;
        }, 'something');


    qb2.on('error', test.done)
      .start()

      .call(dialect, 'barbaz')
        .publish('bazchan', {foo: 'bar'}, test.ifError)
      .call(dialect, 'bazchan')
        .publish({foo: 'barn'}, test.ifError);
  }

  tests.twoways = function twoways(test) {
    var called = {one: 0, two: 0};
    var call1 = qb1.on('error', test.done)
      .can('one', function (task, done) {
        test.equal(task.bound, 'one');
        called.one++;
        done();
      })
      .on('finish', function () {
        if (called.one === 2 && called.two === 2) {
          process.nextTick(test.done);
        }
      })
      .start()
      .call(dialect, 'two-chan')
        .subscribe('one');

    var call2 = qb2.on('error', test.done)
      .can('two', function (task, done) {
        test.equal(task.bound, 'two')
        called.two++;
        done();
      })
      .on('finish', function () {
        if (called.one === 2 && called.two === 2) {
          process.nextTick(test.done);
        }
      })
      .start()
      .call(dialect, 'two-chan')
        .subscribe('two');

    call1.publish({bound: 'two'});
    call2.publish({bound: 'one'});
    call1.publish({bound: 'two'});
    call2.publish({bound: 'one'});
  }

  tests.multiroute = function multiroute(test) {
    var called = {A1: 0, Heinz57: 0};
    qb1.on('error', test.done)
      .can('A1', function (task, done) {
        test.ok(task.chan === 'steak-sauce' || task.chan === 'just-sauce');
        test.equal(task.A1, true);
        called.A1++;
        done();
      })
      .can('Heinz57', function (task, done) {
        test.ok(task.chan === 'wannabe-ketchup' || task.chan === 'just-sauce');
        test.equal(task.Heinz57, true);
        called.Heinz57++;
        done();
      })
      .on('finish', function () {
        if (called.A1 === 2 && called.Heinz57 === 2) {
          process.nextTick(test.done);
        }
      })
      .start()
      .call(dialect, 'steak-sauce')
        .subscribe(function (msg) { msg.chan = 'steak-sauce'; }, 'A1')
      .call('wannabe-ketchup')
        .subscribe(function (msg) { msg.chan = 'wannabe-ketchup'; }, 'Heinz57')
      .call('just-sauce')
        .subscribe(function (msg) { msg.chan = 'just-sauce'; }, 'A1', 'Heinz57');

    qb2.on('error', test.done)
      .start()
      .call(dialect, 'wannabe-ketchup')
        .publish({Heinz57: true})
      .call('steak-sauce')
        .publish({A1:true})
      .call('just-sauce')
        .publish({Heinz57:true, A1:true});
  }

  tests.multireceive = function multireceive(test) {
    var called = {};
    function finish () {
      if (called.qb1 === 2 && called.qb2 === 2 && called.qb3 === 2) {
        process.nextTick(test.done);
      }
    }

    var call1 = qb1.on('error', test.done)
      .can('can', function (task, done) {
        test.ok(task.from !== 'qb1','bad from: ' + JSON.stringify(task));
        called.qb1 = (called.qb1 || 0) + 1;
        done();
      })
      .on('finish', finish)
      .start()
      .call(dialect, 'multi-receive')
        .subscribe(function(msg){msg.on='qb1';},'can');

    var call2 = qb2.on('error', test.done)
      .can('can', function (task, done) {
        test.ok(task.from !== 'qb2', 'bad from: ' + JSON.stringify(task));
        called.qb2 = (called.qb2 || 0) + 1;
        done();
      })
      .on('finish', finish)
      .start()
      .call(dialect, 'multi-receive')
        .subscribe(function(msg){msg.on='qb2';},'can');

    var call3 = qb3.on('error', test.done)
      .can('can', function (task, done) {
        test.ok(task.from !== 'qb3','bad from: ' + JSON.stringify(task));
        called.qb3 = (called.qb3 || 0) + 1;
        done();
      })
      .on('finish', finish)
      .start()
      .call(dialect, 'multi-receive')
        .subscribe(function(msg){msg.on='qb3';},'can');

    call1.publish({from:'qb1'});
    call2.publish({from:'qb2'});
    call3.publish({from:'qb3'});
  }
}