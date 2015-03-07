
module.exports = function (qb) {
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