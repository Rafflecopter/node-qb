// dialects/http.js
// Provide service endpoints for pushing to services in qb

// vendor
var _ = require('underscore'),
  express = require('express'),
  request = require('request');

module.exports = {
  type: 'rpc',
  startup: startup,
}

function HttpDialect(qb, options) {
  this.qb = qb;
  this.options = options;
  this.retry = options.retry === undefined ? 0 : options.retry * 1;
  this.types = {};
  this.app = create_app(qb, options, this.types);
  this.ended = false;
}

HttpDialect.prototype.can = function() {
  var newtypes = Array.prototype.slice.call(arguments),
    types = this.types;

  _.each(newtypes, function (type) {
    types[type] = true;
  });
}

HttpDialect.prototype.push = function (endpoint, type, task, callback) {
  if (this.ended)
    return callback(new Error('qb ended'))
  make_request(endpoint, type, task, this.retry, callback);
}

HttpDialect.prototype.end = function (cb) {
  this.ended = true;
  if (this.app) {
    this.app.close(cb)
  }
  else
    cb();
}

function startup(qb, options) {
  return new HttpDialect(qb, options);
}

function create_app(qb, options, types) {
  var base = options.base || '',
    port = options.port;

  // If no port is given, we assume they don't want to listen
  if (!port) return null;

  return express()
    .use(express.logger())
    .use(verifyBaseUrl(base))
    .use(base, getTypeCallback(types))
    .use(express.json())
    .use(express.urlencoded())
    .use(base, pushEndpoint(qb))
    .listen(port);
}

function make_request(endpoint, type, task, nretries, callback) {
  // Here's a good way to do
  request({
    method: 'POST',
    uri: endpoint + '/' + type,
    json: task,
  }, function (err, resp) {
    if (err && nretries > 0) {
      return make_request(endpoint, type, task, nretries - 1, callback);
    } else if (!resp || resp.statusCode !== 200) {
      err = new Error(JSON.stringify(resp ? resp.body : 'no response'));
    }
    callback(err, resp);
  });
}

function verifyBaseUrl(base) {
  return function (req, res, next) {
    // Set the base url
    if (req.path.slice(0, base.length) === base) {
      return next();
    }
    res.send(404, {error: 'all routes begin with ' + base});
  }
}

function getTypeCallback(types) {
  return function (req, res, next) {
    var split = req.path.split('/').slice(1),
      type = split[0],
      rest = '/' + split.slice(1).join('/');

    if (types[type]) {
      req.path = rest;
      req.type = type;
      return next();
    }

    res.send(404, {error: 'type ' + type + ' not used on this qb endpoint'});
  }
}

function pushEndpoint(qb) {
  return function (req, res) {
    var type = req.type;
    qb.push(type, req.body, function (err) {
      if (err) {
        res.send(500, {error: err.message, stack: err.stack});
      } else {
        res.send({ok:true, type:type});
      }
    });
  }
}