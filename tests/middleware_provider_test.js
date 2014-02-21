// middleware_test.js

var MiddlewareProvider = require('../lib/middleware_provider');

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

tests.callback = function callback(test) {
  MP.on('error', test.ifError)
    .on('event', function (arg, next) {
      test.equal(arg, 'yolo');
      next();
    })
    .emit('event', 'yolo', test.done);
}

tests.nocallbacks = function nocallbacks(test) {
  MP.on('event', function () {
    test.equal(arguments.length, 0)
  })
  .on('event', function () {
    test.equal(arguments.length, 0)
  })
  .emit('event', test.done)
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
  MP.on('error', test.ifError)
    .on('event', function (arg1, arg2, next) {
      if (arg1.trigger === 'error') {
        next(new Error('omgomgomg'));
      }
    })
    .emit('event', {trigger: 'nothing'})
    .emit('event', {trigger: 'error'}, {for: 'reals'}, function (err) {
      test.equal(err.message, 'omgomgomg')
      test.done();
    });
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
    .emit('ev1', {is:'c1'})
    .emit('ev1', {is:'c1'})
    .emit('ev2', {is: 'c2'})
    .emit('ev1', {is: 'c1'}, test.done);
}

tests.once = function once(test) {
  MP.on('error', test.ifError)
    .once('event')
      .use(function (arg, next) {
        test.equal(arg.hello, 'world');
        arg.hello = 'monster';
        next();
      })
    .post('event')
      .use(function (arg, next) {
        test.equal(arg.hello, arg.first ? 'monster' : 'world');
        next();
      })

    .emit('event', {hello: 'world', first:true})
    .emit('event', {hello:'world'}, test.done);
}


tests.reversed_post = function reversed_post(test) {
  MP.on('error', test.ifError)
    .post('event')
      .use(function (arg, next) {
        test.equal(arg.i++, 1);
        next();
      })
      .use(function (arg, next) {
        test.equal(arg.i++, 0);
        next();
      })

    .emit('event', {i:0}, test.done);
}
