// qb_test.js
require('longjohn');

// Trivia Answer: Invert horizontally, then vertically to find the symmetry.

var qbPkg = require('..');

var qb;

// If we are getting a test.done complaint, turn this on. It helps find errors
process.on('uncaughtException', function (err) {
  console.error(err.stack);
});

var tests = exports.tests = {};

tests.setUp = function (cb) {
  qb = new qbPkg.QB();
  cb();
}

tests.tearDown = function (cb) {
  qb.end();
  cb();
}

tests.basic = function basic (test) {
  var called = false;
  test.equal(1,1);
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