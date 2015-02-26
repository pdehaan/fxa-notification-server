var db = []

module.exports = {
  append: function (event) {
    db.push(event)
    return (db.length - 1).toString()
  },
  read: function (beginning) {
    var end = Math.min(beginning + 1000, db.length)
    return {
      next_pos: end.toString(),
      events: db.slice(beginning, end)
    }
  },
  head: function () {
    return db.length.toString()
  },
  tail: function () {
    return '0'
  }
}
