var config = require('./config')
var log = require('./log')
var db = require('./db')
var hapi = require('hapi')
var joi = require('joi')
var server = new hapi.Server()

server.connection({
  host: config.server.host,
  port: config.server.port
})

server.route([
  {
    method: 'POST',
    path: '/v1/publish',
    config: {
      validate: {
        payload: {
          events: joi.array().max(1000).includes(joi.string()).required()
        }
      }
    },
    handler: function (req, reply) {
      var events = req.payload.events
      for (var i = 0; i < events.length; i++) {
        db.append(events[i])
      }
      reply({})
    }
  },
  {
    method: 'GET',
    path: '/v1/events',
    config: {
      validate: {
        query: {
          pos: joi.string().optional(),
          num: joi.number().min(1).max(1000).optional(),
          uid: joi.string().optional(),
          rid: joi.string().optional(),
          iss: joi.string().optional(),
          typ: joi.string().optional()
        }
      }
    },
    handler: function (req, reply) {
      var query = req.query
      var pos = query.pos || 0
      reply(db.read(pos))
    }
  },
  {
    method: 'GET',
    path: '/v1/events/head',
    handler: function (req, reply) {
      reply({
        pos: db.head()
      })
    }
  },
  {
    method: 'GET',
    path: '/v1/events/tail',
    handler: function (req, reply) {
      reply({
        pos: db.tail()
      })
    }
  },
  {
    method: 'POST',
    path: '/v1/subscribe',
    config: {
      validate: {
        payload: {
          notify_url: joi.string().required(),
          filter: joi.object().keys({
            uid: joi.string().optional(),
            rid: joi.string().optional(),
            iss: joi.string().optional(),
            typ: joi.string().optional()
          }).optional(),
          ttl: joi.number().min(0).optional(),
          pos: joi.string().optional()
        }
      }
    },
    handler: function (req, reply) {
      reply({})
    }
  },
  {
    method: 'GET',
    path: '/v1/subscription/:id',
    handler: function (req, reply) {
      reply({})
    }
  },
  {
    method: 'POST',
    path: '/v1/subscription/:id',
    config: {
      validate: {
        payload: {
          pos: joi.string().optional(),
          notify_url: joi.string().optional()
        }
      }
    },
    handler: function (req, reply) {
      reply({})
    }
  },
  {
    method: 'DELETE',
    path: '/v1/subscription/:id',
    handler: function (req, reply) {
      reply({})
    }
  },
  {
    method: 'GET',
    path: '/v1/subscription/:id/events',
    config: {
      validate: {
        query: {
          pos: joi.string().optional(),
          num: joi.number().min(1).max(1000).optional()
        }
      }
    },
    handler: function (req, reply) {
      reply({})
    }
  },
  {
    method: 'POST',
    path: '/v1/subscription/:id/events',
    config: {
      validate: {
        payload: {
          pos: joi.string().required()
        }
      }
    },
    handler: function (req, reply) {
      reply({})
    }
  }
])

server.start()

process.on(
  'SIGINT',
  function () {
    server.stop()
  }
)
