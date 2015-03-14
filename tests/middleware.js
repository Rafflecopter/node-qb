var QB = require('..')
  , qb

var tests = exports.tests = {}

tests.setUp = function (callback) {
  qb = new QB()
  callback()
}

tests.tearDown = function (callback) {
  if (qb)
    qb.end(callback)
  delete qb
}

tests.setTimestamp = function setTimestamp (test) {
  var called = false;
  test.expect(3)
  qb.on('error', test.done)
    .on('process-ready', function () {
      qb.process('foobar', {foo: 'bar'}, test.ifError);
    })
    .pre('process', QB.middleware.setTimestamp('processing_time'))
    .on('finish', function (type, task) {
      test.equal(called, true);
      setImmediate(test.done);
    })
    .can('foobar', function (task, done) {
      test.ok(task.processing_time > Date.now() - 100 && task.processing_time <= Date.now(), 'Timestamp isnt close enough ('+task.timestamp+') to now ('+Date.now()+')');
      called = true;
      done();
    })
}

tests.retryer = function (test) {
  var i = 0
  test.expect(5)
  qb.on('error', test.done)
    .on('fail', QB.middleware.retry(qb, 'serve', 2))
    .on('fail', function (err, type, task) {
      test.ok(/yolo/.test(err.toString()))
      test.equal(task.retry, 2)
      setImmediate(test.done)
    })
    .on('push', function (location, task) {
      // connect push and process
      test.equal(location, 'serve')
      qb.process('serve', task)
    })
    .on('process-ready', function () {
      qb.process('serve', {yolo:'yolo'})
    })
    .can('serve', function (task, done) {
      test.equal(task.retry, i++ ? i-1 : undefined)
      done(new Error('yolo'))
    })
}