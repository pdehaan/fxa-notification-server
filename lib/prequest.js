var P = require('./promise')
module.exports = P.promisifyAll(require('request'))
