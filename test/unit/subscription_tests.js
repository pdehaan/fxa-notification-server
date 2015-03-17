var test = require('../lib/ptaptest')
var config = require('../../lib/config')
var TestServer = require('../lib/test_server')
var r = require('../../lib/prequest')

var keys = require('../../lib/keys')(config)
var base = 'http://' + config.server.host + ':' + config.server.port
var sub = base + '/v0/subscription/'
var authHeaders = {
  'Authorization': 'Bearer foo-bar-notify'
}

TestServer.start(config)
.then(function (server) {

  test(
    'subscribe',
    function (t) {
      return r.postAsync(
        {
          url: base + '/v0/subscribe',
          headers: authHeaders,
          json: {
            notify_url: 'foo',
            ttl: 1
          }
        }
      )
      .then(
        function (result) {
          var res = result[0]
          var data = result[1]
          t.equal(res.statusCode, 200)
          t.equal(typeof(data.id), 'string')
          return r.getAsync(
            {
              url: sub + data.id,
              headers: authHeaders,
              json: true
            }
          )
          .then(
            function (result) {
              var res2 = result[0]
              var data2 = result[1]
              t.equal(res2.statusCode, 200)
              t.deepEqual(
                data2,
                {
                  id: data.id,
                  notify_url: 'foo',
                  pos: '0',
                  filter: {},
                  ttl: 1
                }
              )
              return r.delAsync(
                {
                  url: sub + data.id,
                  headers: authHeaders,
                  json: true
                }
              )
            }
          )
          .then(
            function (result) {
              var res3 = result[0]
              var data3 = result[1]
              t.equal(res3.statusCode, 200)
              t.deepEqual(data3, {})
            }
          )
        }
      )
    }
  )

  test(
    'teardown',
    function (t) {
      return server.db.wipe()
        .then(server.stop.bind(server))
    }
  )
})
