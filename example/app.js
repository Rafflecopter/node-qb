// example/app.js
// Qb Example App
// Provides an email-to-list service and an add-email-to-list service

// vendor
var qb = require('qb'),
  services = require('./services');

// Setup
qb.init({
    prefix: 'qb:email-service',
    recur_polling_interval: 500,
    defer_polling_interval: 500,
  })
  .on('error', function (err) { console.error(err.stack); })

  // Services provided
  .can('email-to-list', 10 /* max concurrent callbacks */, services.emailToList /* callback func */)
  .can('add-email-to-list', 50 /* max concurrent callbacks */, services.addEmailToList /* callback func */)

  // Communication
  .speaks('http', {port: 8000, base: '/qb'})
  .speaks('messageq', {discovery_prefix: 'qb:messageq:discovery'})

  // Middleware
  .pre('push').use(qb.mdw.setTimestamp('received'))
  .pre('process').use(qb.mdw.setTimestamp('process'))
  .pre('finish')
    .use(function (type, task, next) { // custom middleware
      task.processing_time = Date.now() - task.process;
      next();
    })
    // .use(function (type, task, next) {
    //   console.log('Finished processing a task in ' + type + ' at ' + task.process + ' in ' + task.processing_time + 'ms');
    // })
  .on('fail', function (type, task, next) {
    console.error('FAIL: Type ' + type + ': ' + task.error);
  })
  .on('process').use(endWhenIShould)

  // Start!
  .start()

  // For messageq, you have to listen on channels rather than service-specific things
  .speak('messageq')
    .to('new-email')
      .subscribe('add-email-to-list') // This will pass the message as a task to the service
    .to('mq-email')
      // You can use a function, and have as many callbacks as you like.
      .subscribe(function (msg) { msg.list = 'mq-list' }, 'email-to-list');

console.log('qb started!')

// End during processing so we can see graceful ending
var shouldEnd = false;
function endWhenIShould (type, task, next) {
  if (shouldEnd) {
    process.nextTick(qb.qb.end.bind(qb.qb, function () {
      console.log('Ended');
    }));
    shouldEnd = false;
  }
  next();
}
setTimeout(function () {
  console.log('Ending')
  shouldEnd = true
}, 7000);