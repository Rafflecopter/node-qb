// example/external.js
// This file runs some things cause external influence toward the example/app.js

var Moniker = require('moniker')
  , _ = require('underscore')
  , config = require('config');

var endpoint = 'http://127.0.0.1:8188/qb'
  , httpOptions = _.extend(_.clone(config.http), {port: 8189})

var i = 0;

// These are usually done via other qb instances and require .speaks calls before .speak
// Straight http and messageq are available but not as easy
var httpSpkr = new require('qb').QB({prefix:'qb:external'})
  .speaks(require('qb-http'), httpOptions)
  .start()
  .contact(endpoint);

// With qb/messageq, you can't talk to yourself,
// so we have to create a new qb instance
var mqSpkr = new require('qb').QB({prefix:'qb:external'})
  .speaks(require('qb-messageq'), config.messageq)
  .start();

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
    .contact('messageq://new-email')
      .publish({
        email: Moniker.choose() + '@from-mq.no',
        list: 'mq-list'
      }, function (err) {
        if (err) console.error('Error pushing mq task', err.message)
      });
  mqSpkr
    .contact('messageq://mq-email')
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