var QB = require('..')
  , qb

var tests = exports.tests = {}

process.on('uncaughtError', function (err) {
  console.log('error', err)
})

tests.setUp = function (callback) {
  qb = new QB({aliases: { 'avery': 'beer://gunbarrel' }})
  callback()
}

tests.tearDown = function (callback) {
  if (qb)
    qb.end(callback)
  delete qb
}

tests.canprocess = function (test) {
  test.expect(4)
  qb.on('error', test.ifError)
    .post('finish', function (type, task, next) {
      test.equal(type, 'task')
      test.ok(task.truefield)
      setImmediate(test.done)
      next()
    })
    .on('process-ready', function (type, next) {
      test.equal(type, 'task')
      next()
      qb.process('task', {truefield: true})
    })
    .can('task', function (task, callback) {
      test.ok(task.truefield)
      callback()
    })
}

tests.fail = function (test) {
  test.expect(9)
  qb.on('error', test.done)
    .post('fail', function (err, type, task) {
      test.equal(type, 'task')
      test.ok(task.truefield)
      test.ok(task.fail)
      test.ok(/test/.test(err.toString()))
      setImmediate(test.done)
    })
    .post('finish', function (type, task) {
      test.equal(type, 'task')
      test.ok(!task.fail)
    })
    .on('process-ready', function (type, next) {
      test.equal(type, 'task')
      next()
      qb.process('task', {truefield: true})
      qb.process('task', {truefield: true, fail: true})
    })
    .can('task', function (task, callback) {
      test.ok(task.truefield)
      callback(task.fail ? new Error('test') : null)
    })
}

tests.push_does_nothing = function (test) {
  test.expect(1)
  qb.on('error', test.ifError)
    .on('process-ready', function (type, next) {
      test.equal(type, 'never-run-task')
      next()
      qb.push('never-run-task', {truefield: true})
      setTimeout(test.done, 50)
    })
    .can('never-run-task', function (task, callback) {
      test.ifError(new Error('shouldnt process task'))
      callback()
    })
}

tests.aliases = function (test) {
  var count = 0
  test.expect(3)
  qb.on('error', test.ifError)
    .alias('upslope', 'beer://boulder')
    .alias('upslope', 'mountain://sanitas')
    .on('push', function (location, task, next) {
      if (location.split('://')[0] === 'beer') {
        test.equal(location, task.location)
      } else {
        test.equal(location, task.location2)
      }
      next()

      if (count++ == 2) setImmediate(test.done)
    })
    .push('avery', {location: 'beer://gunbarrel'})
    .push('upslope', {location: 'beer://boulder', location2: 'mountain://sanitas'})
}

tests.component = function (test) {
  var comp = function (qb, opts) {
    test.ok(opts.truefield)
    test.ok(qb instanceof QB)
    test.done()
  }

  qb.component(comp, {truefield: true})
}