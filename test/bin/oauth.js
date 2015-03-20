var hapi = require('hapi')
var config = require('../../lib/config')

var server = new hapi.Server()

server.connection({
  host: config.oauth.host,
  port: config.oauth.port
})

server.register(require('../lib/oauth_plugin'), function () {})

server.start()
