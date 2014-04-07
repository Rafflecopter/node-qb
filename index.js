// qb/index.js
// qb is a quarterback for your soul

// local
var QB = require('./lib/qb'),
  middleware = require('./lib/middleware');

// -- Exports --
// =============

module.exports = {
  backend: backend,
  global: global,

  // alias
  mdw: middleware,
  middleware: middleware
};

function backend(bk) {
  return function (options) {
    var qb = new QB(options)
    bk(options, qb)
    return qb
  }
}

function global(options, bkend) {
  if (module.exports.qb) {
    return module.exports.qb;
  }
  var Klass = backend(bkend)
  return (module.exports.qb = new Klass(options));
}