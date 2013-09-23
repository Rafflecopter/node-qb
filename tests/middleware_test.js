// qb_test.js
require('longjohn');

var _ = require('underscore');

var qbPkg = require('..');

var qb;

// If we are getting a test.done complaint, turn this on. It helps find errors
process.on('uncaughtException', function (err) {
  console.error(err.stack);
});

var exports = module.exports = {},
  tests = exports.middlewareTests = {};

tests.setUp = function (cb) {
  qb = new qbPkg.QB();
  cb();
}

tests.tearDown = function (cb) {
  qb.end();
  cb();
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

tests.ensureId = function ensureId (test) {
  var called = false,
    i = 0,
    j = 0;
  qb._options.idfield = 'myid';

  qb.on('error', test.done)
    .can('countid', function (task, done) {
      test.equal(task.id, undefined)
      test.equal(task.myid, j++)
      called = true
      done()
    })
    .pre('push')
      .use(qbPkg.mdw.ensureId('myid', function () { return i++; }))
      .use(function (type, task, next) {
        next();
      })
    .on('finish', function (type, task, next) {
      if (j == 3) {
        test.done();
      }
    })
    .start()

    .push('countid', {foo: 'bar'}, test.ifError)
    .push('countid', {foo: 'bar'}, test.ifError)
    .push('countid', {foo: 'bar'}, test.ifError);
}
