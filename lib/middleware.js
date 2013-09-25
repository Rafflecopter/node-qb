// lib/middleware.js
// Provided middleware primitives

// vendor
var uuid = require('uuid'),
  _ = require('underscore')

module.exports = {
  setTimestamp: setTimestamp
}

function setTimestamp(field) {
  field = field || 'timestamp';

  return function (type, task, next) {
    task[field] = Date.now();
    next();
  }
}