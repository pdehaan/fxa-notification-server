========================================
Firefox Accounts Notification Server API
========================================

This document provides protocol-level details of the Firefox Accounts
Notification Server API.

Overview
========

URL Structure
-------------

All requests will be to URLs of the form:

    https://<server-url>/v1/<api-endpoint>

Note that:

  * All API access must be over a properly-validated HTTPS connection.
  * The URL embeds a version identifier "v1"; future revisions of this API
    may introduce new version numbers.
  * The base URL of the server may be configured on a per-client basis:
    * For a list of development servers see [Firefox Accounts deployments on MDN](https://developer.mozilla.org/en-US/Firefox_Accounts#Firefox_Accounts_deployments).
    * The canonical URL for Mozilla's hosted Firefox Accounts server is https://notifications.accounts.firefox.com/

Request Format
--------------

All request bodies must have a content-type of `application/json`, be encoded
as utf8 and include the `Content-Length` header.

Where necessary, authentication is via Firefox Accounts OAuth bearer tokens
provided in the `Authorization` header.

Response Format
---------------

All response bodies will have a content-type of `application/json` and be
encoded as utf8.  Responses that do not return any data will return an
empty JSON object.

All successful requests will produce a response with HTTP status code in the
"2XX" range. The structure of the response body will depend on the endpoint in
question.

Successful responses will also include the following headers, which may be
useful for the client:

* `Timestamp`:  the current POSIX timestamp as seen by the server, in integer
  seconds.

Failures due to invalid behavior from the client will produce a response with
HTTP status code in the "4XX" range. Failures due to an unexpected situation
on the server will produce a response with HTTP status code in the "5XX" range.
Error response bodies follow a standard format outlined below.

To simplify error handling for the client, the type of error is indicated both
by a particular HTTP status code, and by an application-specific error code in
the JSON response body.  For example:

```js
{
  "code": 400, // matches the HTTP status code
  "errno": 107, // stable application-level error number
  "error": "Bad Request", // string description of the error type
  "message": "XXX TODO"
}
```

Responses for particular types of error may include additional parameters.

The currently-defined error responses are:

* status code 400, errno 106:  request body was not valid json
* status code 400, errno 107:  request body contains invalid parameters
* status code 400, errno 108:  request body missing required parameters
* status code 411, errno 112:  content-length header was not provided
* status code 413, errno 113:  request body too large
* status code 429, errno 114:  client has sent too many requests (see [backoff protocol](#backoff-protocol))
* status code 410, errno 116:  endpoint is no longer supported
* status code 503, errno 201:  service temporarily unavailable to due high load (see [backoff protocol](#backoff-protocol))
* any status code, errno 999:  unknown or unexpected error condition

The follow error responses include additional parameters:

* errno 114:  a `retryAfter` parameter indicating how long the client should wait before re-trying.
* errno 201:  a `retryAfter` parameter indicating how long the client should wait before re-trying.


Responses from Intermediary Servers
-----------------------------------

Since this is a HTTP-based protocol, clients should be prepared to gracefully
handle standard HTTP error responses that may be produced by proxies, load-
balancers, or other intermediary servers.  Non-application responses can be
identified by their lack of properly-formatted JSON response body.  Common
examples would include:


* "413 Request Entity Too Large" may be produced by an upstream proxy server.
* "502 Gateway Timeout" may be produced by a load-balancer if it cannot contact the application servers.
* "3XX" level redirects may be produced to move load around in a datacenter.


API Endpoints
=============

* Publishers:
    * [POST /v1/publish](#post-v1publish)
* Consumers:
    * [GET /v1/events](#get-events)
    * [GET /v1/events/pos](#get-eventspos)
* Subscribers:
    * [POST /v1/subscribe](#post-v1subscribe)
    * [GET /v1/subscription/:id](#get-v1subscriptionid)
    * [POST /v1/subscription/:id](#post-v1subscriptionid)
    * [DELETE /v1/subscription/:id](#delete-v1subscriptionid)
    * [GET /v1/subscription/:id/events](#get-v1subscriptionidevents)
    * [POST /v1/subscription/:id/events](#post-v1subscriptionidevents)


POST /v1/publish
----------------

This endpoint allows publishers to submit events to the log.  The request
body must be a JSON object with single key "events", mapping to an array
of event JWTs:

```sh
curl -v \
-X POST \
-H "Content-Type: application/json" \
https://latest.dev.lcip.org/notifications/v1/publishe \
-d '{
  "events": [
    "ABCDEFABCDEF",
    "123456123456"
  ]
}'
```

Up to 1000 events may be submitted in a single batch.

No explicit `Authorization` header is required for this endpoint.
Instead, the server will authenticate the JWTs submitted as events
and return an error if any signatures are invalid, or if the issuer
is not allowed to publish as this endpoint.

XXX TODO: maybe we could just have one big JWT with all the events
in it..?

Failing requests may be due to the following errors:

* status code 400, errno 106:  request body was not valid json
* status code 400, errno 107:  request body contains invalid parameters
* status code 400, errno 108:  request body missing required parameters
* status code 401, errno TODO:  invalid signature on event JWT 
* status code 401, errno TODO:  issuer not authorized to publish via this server
* status code 411, errno 112:  content-length header was not provided
* status code 413, errno 113:  request body too large


GET /v1/events
--------------

Authenticated with FxA OAuth token.

This endpoint allows stateless reading from the event log.  Clients using
this endpoint are responsible for managing their own state in order to 
page through the available events.  It accepts for following query parameters:

* `pos`: the position from which to read in the log
* `limit`: the number of events to fetch (default and max is 1000)
* `uid`:  only fetch events for a specific account id
* `rid`:  only fetch events for a specific relier id
* `iss`:  only fetch events from a specific issuer hostname
* `typ`:  only fetch events of a specific type

The response body will be a JSON object with the following members:

* `events`: an array of event JWTs matching the query criteria
* `next_pos`: the position from which to read for future events

Events are returned in increasing order by position in the log.
Clients can page through all available events by repeatedly requesting with the
returned value of `next_pos`.

XXX TODO: failure modes
- bad auth
- auth scoped to particular user, but you didnt filter by that uid
- position is too old and has been trimmed from the log


GET /v1/events/pos
------------------

Authenticated with FxA OAuth token.

This endpoints returns the position currently at the head of the log.
Immediately attempting to read events from this position would return
am empty list.  The response body is a JSON object with "pos" key.

XXX TODO: failure modes


POST /v1/subscribe
------------------

Authenticated with FxA OAuth token.

This endpoint allows consumers to create a subscription through which to
receive events.  The request body must be a JSON object and may specify
any of the following keys:

* `notify_url`:  a URL that will be requested when new events are available
* `notify_method`:  how the `notify_url` will be requested; see below
* `filter`:  a JSON object specifying properties by which to filter events;
  see below
* `ttl`:  time in seconds after which the subscription will be deleted if
  inactive
* `pos`:  position at which to start in the log; may be missing or null to
  receive only new events, the empty string to retrieve all available events,
  or a specific position string.

The response body will be a JSON object with the id of the new subscription
as its only member.

The following values of `notify_method` are supported:

* `"POST"`:  the default, this will cause `notify_url` to receive a HTTP POST
  request with the current log position in the request body.
* `"PUSH"`:  for SimplePush endpoints, this will cause `notify_url` to receive
  a HTTP PUT request with empty body.

The following keys may be specified in the `filter` object:

* `uid`:  only receive events for a specific account id
* `rid`:  only receive events for a specific relier id
* `iss`:  only receive events from a specific issuer hostname
* `typ`:  only receive events of a specific type

Only events that match *all* filter criteria will appear in the subscription.

XXX TODO: failure modes.


GET /v1/subscription/:id
------------------------

Authenticated with FxA OAuth token.

Retrieve the current state of a subscription.  The response body will be a
JSON object with the following members:

* id:  the subscription id
* notify_url:  the current notification url
* notify_method:  the current notification method
* filter:  the current filter
* ttl:  the current ttl
* pos:  the current position in the log

XXX TODO: failure modes.


POST /v1/subscription/:id
-------------------------

Authenticated with FxA OAuth token.

Update the current state of a subscription.  The request body takes the
same form as for POST /v1/subscribe.  Ommitted paramters retain their
current value.

The response body is the same as GET /v1/subscription/:id, i.e. it echos
back the full updated state of the subscription.

XXX TODO: failure modes.


DELETE /v1/subscription/:id
----------------------------

Authenticated with FxA OAuth token.

Delete a subscription.  The notification URL will no longer receive requests
when new events become available.


GET /v1/subscription/:id/events
-------------------------------

Authenticated with FxA OAuth token.

This endpoint functions identically to `/v1/events` except that instead
of taking arguments as query parameters, it uses the values of `pos` and
`filter` from the subscription data.


POST /v1/subscription/:id/events
--------------------------------

Authenticated with FxA OAuth token.

This endpoint functions similarly to `GET /v1/subscription/:id/events` but
additionally updates the current position in the sbuscription.

The request body should be a JSON object with "pos" member giving an
existing position in the log.  If this is greater than or equal to the
currently recorded position for that subscription, then the subscription's
position is updated to that value before proceeding as with a GET request
on this endpoint.

Thus is can be used as an atomic "advance position and fetch next batch"
operation when paging through the available events.


XXX TODO: failure modes
- submitted position is behind the currently recorded position?



Backoff Protocol
================

During periods of heavy load, the server may request that clients enter a
"backoff" state in which they avoid making further requests.

If the server is under too much load to handle the client's request, it will
return a `503 Service Unavailable` HTTP response.  The response will include
a `Retry-After` header giving the number of seconds that the client should
wait before issuing any further requests.  It will also include a [JSON error
response](#response-format) with `errno` of 201, and with a `retryAfter` field
that matches the value in the `Retry-After` header.  For example, the following
 response would indicate that the server could not process the request and the
client should avoid sending additional requests for 30 seconds:

```
HTTP/1.1 503 Service Unavailable
Retry-After: 30
Content-Type: application/json

{
 "code": 503,
 "errno": 201,
 "error": "Service Unavailable",
 "message": "The server is experiencing heavy load, please try again shortly",
 "retryAfter": 30
}
```

The `Retry-After` value is included in both the headers and body so that
clients can choose to handle it at the most appropriate level of abstraction
for their environment.

If an individual client is found to be issuing too many requests in quick
succession, the server may return a `429 Too Many Requests` response.  This is
similar to the `503 Service Unavailable` response but indicates that the
problem originates from the client's behavior, rather than the server.  The
response will include a `Retry-After` header giving the number of seconds that
the client should wait before issuing any further requests.  It will also
include a [JSON error response](#response-format) with `errno` of 114, and with
 a `retryAfter` field that matches the value in the `Retry-After` header.  For
example:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 30
Content-Type: application/json

{
 "code": 429,
 "errno": 114,
 "error": "Too Many Requests",
 "message": "This client has sent too many requests",
 "retryAfter": 30
}
```

