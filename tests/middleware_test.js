// middleware_test.js

var MiddlewareProvider = require('../lib/middleware');

var tests = module.exports = {},
  MP;

// If we are getting a test.done complaint, turn this on. It helps find errors
process.on('uncaughtException', function (err) {
  console.error(err.stack);
});

tests.setUp = function (cb) {
  MP = new MiddlewareProvider();
  cb();
}

// The tests
tests.basic = function basic(test) {
  MP.on('error', test.ifError)
    .on('event', function (arg, next) {
      test.equal(arg, 'yolo');
      next();
      test.done();
    })
    .emit('event', 'yolo');
}

tests.pre_on_post = function pre_on_post(test) {
  var state = 0;
  MP.on('error', test.ifError)
    .pre('event')
      .use(testState(0))
    .on('event')
      .use(testState(2))
      .use(testState(3))
    .post('event')
      .use(testState(4))
      .use(function (next) {
        next();
        test.done();
      })
    .pre('event', testState(1))
    .emit('event');

  function testState(n) {
    return function (next) {
      test.equal(state++, n, 'state ('+(state-1)+') should be '+n);
      next();
    };
  }
}

tests.modify_args = function modify_args(test) {
  MP.on('error', test.ifError)
    .pre('event')
      .use(function (arg, next) {
        test.equal(arg.hello, 'world');
        arg.hello = 'monster';
        next();
      })
    .on('event')
      .use(function (arg, next) {
        test.equal(arg.hello, 'monster')
        arg.hello = 'little bird';
        next();
      })
    .post('event')
      .use(function (arg, next) {
        test.equal(arg.hello, 'little bird');
        next();
        test.done();
      })
    .emit('event', {hello: 'world'});
}

tests.error_trigger = function error_trigger(test) {
  MP.on('error', function (err, arg1, arg2, next) {
      test.equal(err.message, 'omgomgomg');
      test.deepEqual(arg1, {trigger:'error'});
      test.deepEqual(arg2, {for:'reals'});
      test.done();
    })
    .on('event', function (arg1, arg2, next) {
      if (arg1.trigger === 'error') {
        next(new Error('omgomgomg'));
      }
    })
    .emit('event', {trigger: 'nothing'})
    .emit('event', {trigger: 'error'}, {for: 'reals'});
}

tests.multiple_events = function multiple_events(test) {
  MP.on('error', test.ifError)
    .on('ev1').use(function (arg, next) {
      test.equal(arg.is, 'c1');
      next();
    })
    .on('ev2').use(function (arg, next) {
      test.equal(arg.is, 'c2');
      next();
    })
    .post('ev1', function (arg, next) {
      if (arg.last) {
        test.done();
      }
    })
    .emit('ev1', {is:'c1'})
    .emit('ev1', {is:'c1'})
    .emit('ev2', {is: 'c2'})
    .emit('ev1', {is: 'c1',last:true});
}