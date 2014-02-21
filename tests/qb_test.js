// qb_test.js

// Trivia Answer: Invert horizontally, then vertically to find the symmetry.

var _ = require('underscore'),
  uuid = require('uuid'),
  Moniker = require('moniker'),
  redis = require('redis');

var qbPkg = require('..');

var qb;

// If we are getting a test.done complaint, turn this on. It helps find errors
process.on('uncaughtException', function (err) {
  console.error(err.stack);
});
process.setMaxListeners(100);

var tests = exports.tests = {};

tests.setUp = function (cb) {
  var cli = redis.createClient(6379, 'localhost', { enable_offline_queue: false })
    .on('ready', function () {
      qb = new qbPkg.QB({
        prefix: 'qb:'+Moniker.choose(),
        defer_polling_interval: 50,
        recur_polling_interval: 50,
        redis: cli
      });
      cb();
    });
}

tests.tearDown = function (cb) {
  qb && qb.end();
  cb();
}

tests.ready = function ready (test) {
  var called = false
  test.expect(1)
  qb
    .on('error', test.ifError)
    .can('something', function () {})
    .can('else', function () {})
    .start()
    .on('ready', function () {
      test.equal(called, false)
      called = true
      setTimeout(test.done, 50)
    })
}

tests.basic = function basic (test) {
  var called = false;
  qb.on('error', test.ifError)
    .can('foobar', function (task, done) {
      console.log('foobar')
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

    .on('ready', function () {
      qb.push('foobar', {foo: 'bar'}, test.done);
    })
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
    .on('ready', function () {
      qb.push('cancan', {can: 'can'}, test.ifError);
    });
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
    .on('ready', function () {
      qb.push('dodo', {do: 'do'}, test.ifError);
    });
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
      test.ok(task.error && task.error.match(new RegExp('^Error: failure')))
      test.equal(task.hate, 'love')
      test.done();
    })
    .start()
    .on('ready', function () {
      qb.push('bad', {hate:'love'}, test.ifError);
    });
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
    .on('ready', function () {
      qb
        .push('super-soaker', {something: 'here'}, test.ifError)
        .push('super-soaker', {something: 'else'}, test.ifError)
        .push('bad-soaker', {something: 'here'}, test.ifError)
        .push('super-fail', {something: 'here'}, test.ifError)
        .push('bad-soaker', {something: 'here'}, test.ifError);
    })

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
    .start()
    .on('ready', function () {
      qb.push('after', {foo:'bar', when: Date.now() + 100});
    });
}

tests.recurring = function recurring(test) {
  var called = 0, now = Date.now();

  qb.on('error', test.done)
    .can('joomla', function (task, done) {
      test.ok(now <= task.received && task.received < Date.now(), 'received is not in the right band ' + now + ' < ' + task.received + ' < ' + Date.now())
      test.ok(now + (called++) * 75 < Date.now(), 'processing time too early n: ' + called + ' recieved: ' + task.received + ' now: ' + Date.now())
      done();
    })
    .pre('push', qbPkg.mdw.setTimestamp('received'))
    .on('finish', function (type, task, next) {
      if (called === 3)
        test.done();
    })
    .start()
    .on('ready', function () {
      qb.push('joomla', {foo:'bar', every: 75, id: 'xxrecur123'});
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
    .on('ready', function () {
      qb.push('foobar', {foo: 'bar'}, test.ifError);
    })

}

tests.retryer = function retry(test) {
  var i = 0
  qb.on('error', test.done)
    .can('serve', function (task, done) {
      test.equal(task.retry, i++ ? i-1 : undefined)
      done(new Error('yolo'))
    })
    .on('fail', qbPkg.mdw.retry(qb, 'serve', 2))
    .on('fail', function (type, task, next) {
      test.equal(task.retry, 2)
      test.done()
    })
    .start()
    .on('ready', function () {
      qb.push('serve', {yolo:'yolo'})
    })

}

tests.doublePushCallback = function doublePushCallback(test) {
  test.expect(6);
  var seen = {},
    readycall = false
  qb.on('error', test.done)
    .can('lark', function (task, done) {
      test.ok(false, 'shouldn\'t be here')
      done()
    })
    .start()
    .can('bark', function (task, done) {
      test.equal(seen[task.x], undefined, 'Task ' + JSON.stringify(task) + ' seen twice!')
      seen[task.x] = true
      done()
    })
    .on('finish', function (type, task, next) {
      if (seen.a && seen.b) {
        test.done()
      }
      next()
    })
    .on('ready', function () {
      // Wait for the second ready to go (bark gets setup secondly)
      if (readycall) {
        qb
          .push('bark', {x: 'a'}, notwicecall('a'))
          .push('bark', {x: 'b'}, notwicecall('b'))
      }
      readycall = true
    })

  function notwicecall(name) {
    var called = false
    return function (err) {
      test.ifError(err)
      test.equal(called, false, "No twicecall for " + name + " called twice!")
      called = true
    }
  }
}

tests.startTwice = function startTwice(test) {
  try {
    qb.on('error', test.done)
      .can('lark', function () {})
      .start()
      .can('bark', function () {})
      .start()
    test.done(new Error("Should have thrown on second start!"))
  } catch (err) {
    test.done();
  }
}

tests.earlyStartEnd = function earlyStartEnd(test) {
  qb.on('error', test.done)
    .can('ack', function (){})
    .start()
    .can('nack', function() {})
    .end(test.done)
}