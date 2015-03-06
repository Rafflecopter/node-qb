// qb/index.js
// qb is a framework for queue-based services

// local
var QB = require('./lib/qb')
  , middleware = require('./lib/middleware')

module.exports = QB
module.exports.middleware = middleware