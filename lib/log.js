var config = require('./config')
var mozlog = require('mozlog')
mozlog.config({
  app: 'fxa-notification-server',
  level: config.log.level,
  fmt: config.log.fmt
})
module.exports = mozlog('fxa-ns')
