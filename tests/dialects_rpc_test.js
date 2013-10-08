// qb_test.js
require('longjohn');

var _ = require('underscore'),
  express = require('express');

var qbPkg = require('..'),
  qb;

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
  var tests = exports[dialect] = {};

  tests.setUp = function (cb) {
    qb = new qbPkg.QB({prefix:'qb1'});
    cb();
  }

  tests.tearDown = function (cb) {
    qb.end();
    cb();
  }

  tests.nothing = function (test) {
    qb.speaks(dialect, options)
      .on('error', test.done)
      .can('testf', function (task, done) {
        test.done(new Error('shouldnt be here'));
      })
      .start();

    var caller = qb.speak(dialect);
    process.nextTick(test.done);
  }

  tests.basic_push = function basic_push(test) {
    qb.speaks(dialect, options)
      .on('error', test.done)
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
    qb.speaks(dialect, options)
      .on('error', test.done)
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

exports.http.passed_in_app = function passed_in_app(test) {
  var app = express().use(express.json()),
    server = app.listen(8912);

  qb.speaks('http', {app: app, base: '/passin'})
    .on('error', test.done)
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
      finish();
    })
    .start()
    .speak('http').to('http://localhost:8912/passin')
      .push('fn', {heli: 'copter'}, test.ifError);

  function finish() {
    server.close();
    test.done();
  }
}