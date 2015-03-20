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

function MemDB() {
  this.db = []
}

MemDB.prototype.start = function () {
  return P.resolve()
}

MemDB.prototype.stop = function () {
  return P.resolve()
}

MemDB.prototype.append = function (str) {
  this.db.push(str)
  return P.resolve((this.db.length - 1).toString())
}

MemDB.prototype.read = function (pos, num, filter) {
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
  return P.resolve({
    next_pos: pos.toString(),
    events: events
  })
}

MemDB.prototype.head = function () {
  return P.resolve(this.db.length.toString())
}

MemDB.prototype.tail = function () {
  return P.resolve('0')
}

MemDB.prototype.wipe = function () {
  this.db = []
  return P.resolve()
}

module.exports = MemDB
