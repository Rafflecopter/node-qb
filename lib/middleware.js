// lib/middleware.js
// Provided middleware primitives

// vendor
var uuid = require('uuid'),
  _ = require('underscore')

module.exports = {
  setTimestamp: setTimestamp,
  retry: retry,
  deleteHiddenFields: deleteHiddenFields
}

function setTimestamp(field) {
  field = field || 'timestamp';

  return function (type, task, next) {
    task[field] = Date.now();
    next();
  }
}

function retry(qb, types, times) {
  times--;
  types = [].concat(types)
  return function (type, task, next) {
    if (_.contains(types, type)) {
      if ((task.retry || 0) < times) {
        task.retry = (task.retry || 0) + 1
        qb.log.info('Retrying task of type %s', type, task)
        delete(task.id)
        return qb.push(type, task)
      } else {
        task.retry++
        qb.log.error('retry task of type %s failed %d times!', type, task.retry + 1, task)
      }
    }

    next()
  }
}

function deleteHiddenFields(type, task, next) {
  _.each(_.keys(task), function (key) {
    if (key[0] === '_') {
      delete(task[key]);
    }
  });
  next();
}