var redis = require('redis')
var jws = require('jws')
var P = require('../promise')

function match(filter, str) {
  try { // too lazy
    var payload = JSON.parse(jws.decode(str).payload)
    return Object.keys(filter).every(
      function (name) {
        return payload[name] && payload[name] === filter[name]
      }
    )
  } catch (e) {
    /* istanbul ignore next */
    return false
  }
}

function defer(d) {
  return function (err, data) {
    return err ? d.reject(err) : d.resolve(data)
  }
}

function RedisDB(options) {
  this.options = options
  this.db = null
}

RedisDB.prototype.start = function () {
  var d = P.defer()
  this.db = redis.createClient(this.options.port, this.options.host)
  this.db.once('ready', function () { d.resolve() })
  return d.promise
}

RedisDB.prototype.stop = function () {
  var d = P.defer()
  this.db.quit(defer(d))
  return d.promise
}

RedisDB.prototype.append = function (str) {
  var d = P.defer()
  this.db.rpush(this.options.keyPrefix, str, defer(d))
  return d
}

RedisDB.prototype.read = function (pos, num, filter) {
  pos = +pos || 0
  num = num || 1000
  filter = filter || {}
  var d = P.defer()
  var matchFilter = match.bind(null, filter)
  this.db.lrange(this.options.keyPrefix, pos, (pos + num - 1), defer(d))
  return d.promise.then(
    function (results) {
      return {
        next_pos: (pos + results.length).toString(),
        events: results.filter(matchFilter)
      }
    }
  )
}

RedisDB.prototype.head = function () {
  var d = P.defer()
  this.db.llen(this.options.keyPrefix, defer(d))
  return d.promise.then(function (len) { return len.toString() })
}

RedisDB.prototype.tail = function () {
  return P.resolve('0')
}

RedisDB.prototype.wipe = function () {
  var d = P.defer()
  this.db.flushall(defer(d))
  return d.promise
}

module.exports = RedisDB
