var Server = require('../../server')
module.exports = {
  start: function (config) {
    return (new Server(config)).start()
  }
}
