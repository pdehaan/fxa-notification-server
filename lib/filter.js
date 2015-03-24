var jws = require('jws')

function Filter(options) {
  this.src = options || {}
  this.filters = Object.keys(this.src).map(
    function (key) {
      return { key: key, val: options[key] }
    }
  )
}

Filter.prototype.toJSON = function () {
  return this.src
}

Filter.prototype.test = function (str) {
  try {
    return this.testJWT(jws.decode(str, { json: true }))
  } catch (e) {
    /* istanbul ignore next */
    return false
  }
}

Filter.prototype.testJWT = function (jwt) {
  var payload = jwt.payload
  return this.filters.every(
    function (f) {
      return payload[f.key] && payload[f.key] === f.val
    }
  )
}

module.exports = Filter
