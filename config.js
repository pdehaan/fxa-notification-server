var convict = require('convict')

var config = convict(
  {
    log: {
      level: {
        format: String,
        default: 'info'
      },
      fmt: {
        format: String,
        default: 'heka'
      }
    },
    server: {
      host: {
        format: 'ipaddress',
        default: '127.0.0.1'
      },
      port: {
        format: 'port',
        default: 7879
      }
    }
  }
)

try {
  config.loadFile('./config.json')
}
catch (e) {}

config.validate()

module.exports = config.root()
