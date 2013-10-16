// example/config/default.js
// Default configuration for qb

module.exports = {
  qb: {
    prefix: 'qb', //qb: Base prefix of all redis keys
    clean_finish: true, //relyq: Don't keep jobs after being finished
    delimeter: ':', //all: Redis key delimeter
    idfield: 'id', //relyq/qb: Field containing the id
    Q: 'RedisJsonQ', //qb: relyq Queue Type
    max_concurrent_callbacks: 100, //relyq-listener: default maximum number of concurrent callbacks per service
    allow_defer: true, //relyq: Allow deferred tasks
    defer_field: 'when', //qb: Field containing a timestamp signifying a deferred task
    defer_polling_interval: 1000, //relyq: interval between checking for deferred tasks
    allow_recur: true, //relyq: Allow recurring tasks
    recur_field: 'every', //qb: Field containing a millisecond interval
    recur_polling_interval: 60000, //relyq: Polling interval between recurring task checks
    catch_sigterm_end: true, //qb: Catch sigterm and call qb.end()
    end_timeout: 10000, //qb: Timeout on an end() call
  },
  http: {
    port: 8000,
    base: '/qb',
    auth: null, // If available, should contain {user: , pass: }
  },
  messageq: {
    discovery_prefix: 'qb:messageq:discovery',
    ttl: 60000, // time between subscriber lookups (1m)
  },
}