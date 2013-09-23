// qb_test.js
require('longjohn');

var _ = require('underscore');

var qbPkg = require('..');

var dialects = {
  http: [{
    port: 8777,
    base: '/api'
  }, 'http://127.0.0.1:8777/api']
}

// If we are getting a test.done complaint, turn this on. It helps find errors
process.on('uncaughtException', function (err) {
  console.error(err.stack);
});

_.each(dialects, function (args, dialect) {
  createTests(args[0], dialect, args[1])
});

function createTests(options, dialect, endpoint) {
  var tests = exports[dialect] = {},
    qb;

  tests.setUp = function (cb) {
    qb = new qbPkg.QB({prefix:'qb1'})
      .pre('push', qbPkg.mdw.ensureId())
      .speaks(dialect, options);
    cb();
  }

  tests.tearDown = function (cb) {
    qb.end();
    cb();
  }

  tests.nothing = function (test) {
    qb.on('error', test.done)
      .can('testf', function (task, done) {
        test.done(new Error('shouldnt be here'));
      })
      .start();

    var caller = qb.speak(dialect);
    process.nextTick(test.done);
  }

  tests.basic_push = function basic_push(test) {
    qb.on('error', test.done)
      .pre('push', function (type, task, next) {
        task.push = true;
        next();
      })
      .can('fn', function (task, done) {
        test.equal(task.push, true);
        test.equal(task.heli, 'copter');
        done();
      })
      .on('finish', function () {
        test.done();
      })
      .start()
      .speak(dialect).to(endpoint)
        .push('fn', {heli: 'copter'}, test.ifError);
  }

  tests.multiple_pushes = function multiple_pushes(test) {
    var i = 0, j = 0;
    qb.on('error', test.done)
      .can('cnt', function (task, done) {
        test.equal(task.i, i++);
        done();
      })
      .on('finish', function () {
        if (i == 3) {
          test.done();
        }
      })
      .start()
      .speak(dialect).to(endpoint)
        .push('cnt', {i: j++}, test.ifError)
        .push('cnt', {i: j++}, test.ifError)
        .push('cnt', {i: j++}, test.ifError);

  }
}