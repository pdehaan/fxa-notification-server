
var uuid = require('uuid')

function Subscription(options) {
  this.id = options.id || uuid.v4()
  this.notify_url = options.notify_url
  this.pos = options.pos || '0'
  this.filter = options.filter || {}
  this.ttl = options.ttl || 60 * 60 * 24
}

Subscription.parse = function (str) {
  return new Subscription(JSON.parse(str))
}

function Subs(db) {
  this.db = db
}

Subs.prototype.create = function (options) {
  return this.set(new Subscription(options))
}

Subs.prototype.remove = function (id) {
  return this.db.del(id)
}

Subs.prototype.get = function (id) {
  return this.db.get(id)
    .then(
      function (str) {
        return Subscription.parse(str)
      }
    )
}

Subs.prototype.set = function (sub) {
  return this.db.set(sub.id, JSON.stringify(sub), sub.ttl)
    .then(
      function () {
        return sub
      }
    )
}

module.exports = function (db) {
  return new Subs(db)
}
