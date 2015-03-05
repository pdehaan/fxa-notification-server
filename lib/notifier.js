var log = require('./log')

module.exports = {
  ping: function (urls) {
    log.info('notifying', { urls: urls })
  }
}
