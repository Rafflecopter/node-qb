// example/local.js
// Local enqueuing of tasks

var qb = require('qb').qb, // singleton
  Moniker = require('moniker');

qb
  // Enqueue any recurring tasks using the `every` keyword
  .push('email-to-list', {
    list: 'local-list',
    subject: 'Recurring Email',
    body: 'Recurring Email',
    id: 'recurring-email-id', // Recurring tasks should have IDs so they don't get double written
    every: 2000, //2s
  })

  // Deferred tasks using the `when` keyword
  .push('add-email-to-list', {
    list: 'local-list',
    email: Moniker.choose() + '@local.no',
    when: Date.now() + 3000
  })

  // Deferred tasks using the `when` keyword
  .push('add-email-to-list', {
    list: 'local-list',
    email: Moniker.choose() + '@local.no',
    when: Date.now() + 3500
  });