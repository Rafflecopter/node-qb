// qb_test.js
require('longjohn');

var _ = require('underscore');

var qbPkg = require('..');

var dialects = {
  messageq: {
    discovery_prefix: 'qb-test:discovery',
    max_listeners: 20
  },
  nats: {}
}

// If we are getting a test.done complaint, turn this on. It helps find errors
process.on('uncaughtException', function (err) {
  console.error(err.stack);
});
process.setMaxListeners(40);

_.each(dialects, createTests);

function createTests(options, dialect) {
  var tests = exports[dialect] = {},
    qb1, qb2, qb3;

  function endpoint(chan) {
    return dialect + '://' + chan;
  }

  tests.setUp = function (cb) {
    qb1 = new qbPkg.QB({prefix:'qb1'})
      .speaks(dialect, _.clone(options));
    qb2 = new qbPkg.QB({prefix:'qb2'})
      .speaks(dialect, _.clone(options));
    qb3 = new qbPkg.QB({prefix:'qb3'})
      .speaks(dialect, _.clone(options));
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

    var caller = qb1.contact(endpoint('abc'));
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
      .contact(endpoint('bazchan'))
        .subscribe(function (msg) {
          test.equal(msg.foo.slice(0, 3), 'bar')
          cbc++;
        }, 'something');


    qb2.on('error', test.done)
      .start()

      .contacts(endpoint('barbaz'), 'bar')
      .qb.contacts(endpoint('bazchan'), 'baz');

    qb2.contact('baz')
      .publish({foo: 'bar'}, test.ifError)
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

      .contact(endpoint('one-chan'))
        .subscribe('one')
      .qb.contact(endpoint('two-chan'));

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

      .contact(endpoint('two-chan'))
        .subscribe('two')
      .qb.contact(endpoint('one-chan'));

    setTimeout(function () {
      call1.publish({bound: 'two'}, test.ifError);
      call2.publish({bound: 'one'}, test.ifError);
      call1.publish({bound: 'two'}, test.ifError);
      call2.publish({bound: 'one'}, test.ifError);
    }, 50);
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
      .contact(endpoint('steak-sauce'))
        .subscribe(function (msg) { msg.chan = 'steak-sauce'; }, 'A1')
      .qb.contact(endpoint('wannabe-ketchup'))
        .subscribe(function (msg) { msg.chan = 'wannabe-ketchup'; }, 'Heinz57')
      .qb.contact(endpoint('just-sauce'))
        .subscribe(function (msg) { msg.chan = 'just-sauce'; }, 'A1', 'Heinz57');

    qb2.on('error', test.done)
      .start()
      .contact(endpoint('wannabe-ketchup'))
        .publish({Heinz57: true})

      .qb.contact(endpoint('steak-sauce'))
        .publish({A1:true})

      .qb.contact(endpoint('just-sauce'))
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

      .contact(endpoint('multi-receive-2'))
        .subscribe(function(msg){msg.on='qb1';},'can')
      .qb.contact(endpoint('multi-receive-3'))
        .subscribe(function(msg){msg.on='qb1';},'can')
      .qb.contact(endpoint('multi-receive-1'));

    var call2 = qb2.on('error', test.done)
      .can('can', function (task, done) {
        test.ok(task.from !== 'qb2', 'bad from: ' + JSON.stringify(task));
        called.qb2 = (called.qb2 || 0) + 1;
        done();
      })
      .on('finish', finish)
      .start()

      .contact(endpoint('multi-receive-1'))
        .subscribe(function(msg){msg.on='qb2';},'can')
      .qb.contact(endpoint('multi-receive-3'))
        .subscribe(function(msg){msg.on='qb2';},'can')
      .qb.contact(endpoint('multi-receive-2'));

    var call3 = qb3.on('error', test.done)
      .can('can', function (task, done) {
        test.ok(task.from !== 'qb3','bad from: ' + JSON.stringify(task));
        called.qb3 = (called.qb3 || 0) + 1;
        done();
      })
      .on('finish', finish)
      .start()

      .contact(endpoint('multi-receive-1'))
        .subscribe(function(msg){msg.on='qb3';},'can')
      .qb.contact(endpoint('multi-receive-2'))
        .subscribe(function(msg){msg.on='qb3';},'can')
      .qb.contact(endpoint('multi-receive-3'));

    setTimeout(function () {
      call1.publish({from:'qb1'});
      call2.publish({from:'qb2'});
      call3.publish({from:'qb3'});
    }, 50);
  }
}