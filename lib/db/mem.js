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

function MemDB() {
  this.db = []
}

MemDB.create = function (options, cb) {
  process.nextTick(cb.bind(null, null, new MemDB()))
}

MemDB.prototype.append = function (str, cb) {
  this.db.push(str)
  process.nextTick(cb.bind(null, null, (this.db.length - 1).toString()))
}

MemDB.prototype.read = function (pos, num, filter, cb) {
  pos = +pos || 0
  num = num || 1000
  filter = filter || {}
  var events = []
  while (events.length < num && pos < this.db.length) {
    var str = this.db[pos]
    if (match(filter, str)) {
      events.push(str)
    }
    pos++
  }
  process.nextTick(cb.bind(null, null, {
    next_pos: pos.toString(),
    events: events
  }))
}

MemDB.prototype.head = function (cb) {
  process.nextTick(cb.bind(null, null, this.db.length.toString()))
}

MemDB.prototype.tail = function (cb) {
  process.nextTick(cb.bind(null, null, '0'))
}

module.exports = MemDB
