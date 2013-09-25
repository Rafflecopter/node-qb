// qb/index.js
// qb is a quarterback for your soul

// local
var QB = require('./lib/qb'),
  middleware = require('./lib/middleware');

// -- Exports --
// =============

module.exports = {
  QB: QB,
  init: function (options) {
    if (module.exports.qb) {
      return module.exports.qb;
    }
    return (module.exports.qb = new QB(options));
  },
  mdw: middleware,
};


process.on('uncaughtException', function (err) {
  if (module.exports.qb) {
    module.exports.qb.log.panic(err);
  } else {
    console.error(err);
  }
})