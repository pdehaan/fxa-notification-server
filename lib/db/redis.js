var redis = require('redis')
var jws = require('jws')

function match(filter, str) {
  try { // too lazy
    var event = JSON.parse(jws.decode(str).payload)
    var filterNames = Object.keys(filter)
    for (var i = 0; i < filterNames.length; i++) {
      var name = filterNames[i]
      if (event[name] && event[name] === filter[name]) {
        continue
      }
      else {
        return false
      }
    }
    return true
  } catch (e) {
    return false
  }
}

function RedisDB(options) {
  this.db = redis.createClient(options.port, options.host)
}

RedisDB.create = function (options, cb) {
  var x = new RedisDB(options)
  x.db.once('ready', cb.bind(null, null, x))
}

RedisDB.prototype.append = function (str, cb) {
  this.db.rpush('fxa', str, cb)
}

RedisDB.prototype.read = function (pos, num, filter, cb) {
  pos = +pos || 0
  num = num || 1000
  filter = filter || {}
  var matchFilter = match.bind(null, filter)
  this.db.lrange('fxa', pos, (pos + num), function (err, results) {
    if (err) { return cb(err) }
    var events = results.filter(matchFilter)
    cb(
      null,
      {
        next_pos: (pos + results.length).toString(),
        events: events
      }
    )
  })
}

RedisDB.prototype.head = function (cb) {
  this.db.llen('fxa', function (err, len) {
    cb(err, len && len.toString())
  })
}

RedisDB.prototype.tail = function (cb) {
  process.nextTick(cb.bind(null, null, '0'))
}

module.exports = RedisDB
