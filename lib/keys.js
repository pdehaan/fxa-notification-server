var fs = require('fs')
var path = require('path')
var JWK = require('fxa-jwtool').JWK

module.exports = function (config) {
  var secretKey = JWK.fromFile(
    path.resolve(__dirname, '..', config.jwk.secretKeyFile),
    {
      alg: 'RS256',
      kid: config.jwk.kid,
      jku: config.jwk.jku,
      iss: config.jwk.iss
    }
  )
  var publicKey = JWK.fromFile(
    path.resolve(__dirname, '..', config.jwk.publicKeyFile),
    {
      kid: config.jwk.kid,
      use: 'sig',
      alg: 'RS256'
    }
  )
  return {
    secret: secretKey,
    public: publicKey
  }
}
