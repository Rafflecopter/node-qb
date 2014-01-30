// example/app.js
// Qb Example App
// Provides an email-to-list service and an add-email-to-list service

// vendor
var QB = require('qb'),
  config = require('config'), // simple config package
  services = require('./services'),
  redis = require('redis');

// Stick redis in the init options
var options = config.qb;
options.redis = redis.createClient();

// Setup
var qb = QB.init(options)

  // Services provided
  .can('email-to-list', 10 /* max concurrent callbacks */, services.emailToList /* callback func */)
  .can('add-email-to-list', 50 /* max concurrent callbacks */, services.addEmailToList /* callback func */)

  // Communication
  .speaks(require('qb-http'), config.http)
  .speaks(require('qb-messageq'), config.messageq)

  // Middleware
  .pre('push').use(QB.mdw.setTimestamp('received'))
  .pre('process').use(QB.mdw.setTimestamp('process'))
  .pre('finish')
    .use(function (type, task, next) { // custom middleware
      task.processing_time = Date.now() - task.process;
      next();
    })
    // .use(function (type, task, next) {
    //   console.log('Finished processing a task in ' + type + ' at ' + task.process + ' in ' + task.processing_time + 'ms');
    // })
  .on('fail', function (type, task, next) {
    qb.log.error('FAIL: Type %s: %s', type, task.error);
  })
  .on('process').use(endWhenIShould)

  // Start!
  .start()

  // For messageq, you have to listen on channels rather than service-specific things
  qb.contact('messageq://new-email')
    .subscribe('add-email-to-list') // This will pass the message as a task to the service
  qb.contact('messageq://mq-email')
    // You can use a function, and have as many callbacks as you like.
    .subscribe(function (msg) { msg.list = 'mq-list' }, 'email-to-list');

qb.log.info('qb started!')

// End during processing so we can see graceful ending
var shouldEnd = false;
function endWhenIShould (type, task, next) {
  if (shouldEnd) {
    shouldEnd = false;
    process.nextTick(qb.end.bind(qb, function (){}));
  }
  next();
}
setTimeout(function () {
  shouldEnd = true
}, 7000);