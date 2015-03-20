var fs = require('fs')
var path = require('path')
var JWK = require('fxa-jwtool').JWK

module.exports = function (config) {
  var secretPem = fs.readFileSync(
    path.resolve(__dirname, '..', config.jwk.secretKeyFile),
    'utf8'
  )
  var publicPem = fs.readFileSync(
    path.resolve(__dirname, '..', config.jwk.publicKeyFile),
    'utf8'
  )
  return {
    secret: JWK.fromPEM(
      secretPem,
      {
        alg: 'RS256',
        kid: config.jwk.kid,
        jku: config.jwk.jku,
        iss: config.jwk.iss
      }
    ),
    public: JWK.fromPEM(
      publicPem,
      {
        kid: config.jwk.kid,
        use: 'sig',
        alg: 'RS256'
      }
    ),
    secretPem: secretPem,
    publicPem: publicPem
  }
}
