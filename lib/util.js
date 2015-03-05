var util = require('util')

exports.inherits = util.inherits

exports.throwIfNoCallback = function (callback) {
  return function (err) {
    if (callback)
      callback(err)
    else if (err)
      throw err
  }
}

exports.handle_sigterm = function (qb) {
  process.on('SIGTERM', function() {
    qb.log.info('([~~~ Got SIGTERM ~~~])')

    qb.end(function (err) {
      if (err) {
        return qb.log.error(err, '([~~~ Exiting Due to SIGTERM ~~~])')
      }
      qb.log.info('([~~~ Exiting Due to SIGTERM ~~~])')
    })
  })
}

exports.callOnce = function (f) {
  var called = false
  return function () {
    if (called)
      return
    f.apply(arguments)
    called = true
  }
}