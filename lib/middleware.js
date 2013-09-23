// lib/middleware.js
// Provided middleware primitives

// vendor
var uuid = require('uuid'),
  _ = require('underscore')

module.exports = {
  ensureId: ensureId,
  setTimestamp: setTimestamp
}

function ensureId (idfield, generator) {
  if (_.isFunction(idfield)) generator = idfield, idfield = undefined;
  idfield = idfield || 'id';
  generator = generator || uuid.v4;

  return function ensureIdActual (type, task, next) {
    task[idfield] = task[idfield] || generator();
    next();
  }
}

function setTimestamp(field) {
  field = field || 'timestamp';

  return function (type, task, next) {
    task[field] = Date.now();
    next();
  }
}