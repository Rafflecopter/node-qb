// example/external.js
// This file runs some things cause external influence toward the example/app.js

var qb = require('qb').qb,
  Moniker = require('moniker');

var endpoint = 'http://127.0.0.1:8000/qb',
  discovery_prefix = 'qb:messageq:discovery';

var i = 0;

// These are usually done via other qb instances and require .speaks calls before .speak
// Straight http and messageq are available but not as easy
var httpSpkr = qb.speak('http', endpoint);

// With qb/messageq, you can't talk to yourself,
// so we have to create a new qb instance
var mqSpkr = new require('qb').QB({prefix:'qb:external'})
  .speaks('messageq', {discovery_prefix: discovery_prefix})
  .start()
  .speak('messageq');

function pushHttpTask() {
  httpSpkr.push('email-to-list', {
    subject: 'Number ' + (i++),
    body: 'External Email',
    list: 'http-list',
  }, function (err) {
    if (err) console.error('Error pushing http task', err.message)
  })

  .push('add-email-to-list',{
    email: Moniker.choose() + '@from-http.no',
    list: 'http-list',
  }, function (err) {
    if (err) console.error('Error pushing http task', err.message)
  });
}

function pushMqTask() {
  mqSpkr
    .to('new-email')
      .publish({
        email: Moniker.choose() + '@from-mq.no',
        list: 'mq-list'
      }, function (err) {
        if (err) console.error('Error pushing mq task', err.message)
      })
    .to('mq-email')
      .publish({
        subject: 'Number ' + (i++),
        body: 'External Email',
      }, function (err) {
        if (err) console.error('Error pushing mq task', err.message)
      });
}

function loop(n, interval) {
  if (n % 2)
    pushHttpTask()
  else
    pushMqTask()

  n && setTimeout(function () {loop(n-1, interval);}, interval)

  if (!n) {
    mqSpkr.qb.end()
  }
}

loop(10, 1000)