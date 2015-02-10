
# Firefox Accounts Notification Server API

This document provides protocol-level details of the Firefox Accounts
Notification Server API.  For a higher-level perspective you should
read the [System Overview](./overview.md) document.

## General Structure

### URL Format

All requests will be to URLs of the form:

    https://<server-url>/v1/<api-endpoint>

Note that:

  * All API access must be over a properly-validated HTTPS connection.
  * The URL embeds a version identifier "v1"; future revisions of this API
    may introduce new version numbers.
  * The base URL of the server may be configured on a per-client basis:
    * For a list of development servers see [Firefox Accounts deployments on MDN](https://developer.mozilla.org/en-US/Firefox_Accounts#Firefox_Accounts_deployments).
    * The canonical URL for Mozilla's hosted Firefox Accounts server is https://notifications.accounts.firefox.com/


### Request Format

All request bodies must have a content-type of `application/json`, be encoded
as utf8 and include the `Content-Length` header.

Where necessary, authentication is via Firefox Accounts OAuth bearer tokens
provided in the `Authorization` header.  The token must include scope
`notifications`.


### Response Format

All response bodies will have a content-type of `application/json` and be
encoded as utf8.  Responses that do not return any data will return an
empty JSON object.

All successful requests will produce a response with HTTP status code in the
"2XX" range. The structure of the response body will depend on the endpoint in
question.

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


### Error Response Codes

The currently-defined error responses cores are:

* status code 400, errno 106:  request body was not valid json
* status code 400, errno 107:  request body contains invalid parameters
* status code 400, errno 108:  request body missing required parameters
* status code 411, errno 112:  content-length header was not provided
* status code 413, errno 113:  request body too large
* status code 429, errno 114:  client has sent too many requests (see [backoff protocol](#backoff-protocol))
* status code 410, errno 116:  endpoint is no longer supported
* status code 503, errno 201:  service temporarily unavailable to due high load (see [backoff protocol](#backoff-protocol))
* any status code, errno 999:  unknown or unexpected error condition

Additional codes may be added without changing the version number of the
protocol; clients should respond to any unrecognized code as through it
were a `999`.

The follow error responses include additional parameters:

* errno 114:  a `retryAfter` parameter indicating how long the client should wait before re-trying.
* errno 201:  a `retryAfter` parameter indicating how long the client should wait before re-trying.


### Responses from Intermediary Servers

Since this is a HTTP-based protocol, clients should be prepared to gracefully
handle standard HTTP error responses that may be produced by proxies, load-
balancers, or other intermediary servers.  Non-application responses can be
identified by their lack of properly-formatted JSON response body.  Common
examples would include:


* "413 Request Entity Too Large" may be produced by an upstream proxy server.
* "502 Gateway Timeout" may be produced by a load-balancer if it cannot contact the application servers.
* "3XX" level redirects may be produced to move load around in a datacenter.


## API Endpoints

* Publishers:
    * [POST /v1/publish](#post-v1publish)
* Consumers:
    * [GET /v1/events](#get-events)
    * [GET /v1/events/head](#get-eventshead)
    * [GET /v1/events/tail](#get-eventstail)
* Subscribers:
    * [POST /v1/subscribe](#post-v1subscribe)
    * [GET /v1/subscription/:id](#get-v1subscriptionid)
    * [POST /v1/subscription/:id](#post-v1subscriptionid)
    * [DELETE /v1/subscription/:id](#delete-v1subscriptionid)
    * [GET /v1/subscription/:id/events](#get-v1subscriptionidevents)
    * [POST /v1/subscription/:id/events](#post-v1subscriptionidevents)


### POST /v1/publish

This endpoint allows publishers to submit events to the log.

The request body must be a JSON object with single key "events", mapping to an
array of event JWTs.

The response body will be an empty JSON object.

```
>  POST /v1/publish HTTP/1.1
>  Host: notifications.accounts.firefox.com
>  Content-Type: application/json
>  Content-Length: XXX TODO
>  {
>    "events": [
>      "ABCDEFABCDEF",
>      "123456123456"
>    ]
>  }
.
<  200 OK
<  Content-Type: application/json
<  Content-Length: 2
<  {}
```

Up to 1000 events may be submitted in a single batch.

No explicit `Authorization` header is required for this endpoint.
Instead, the server will authenticate the JWTs submitted as events
and return an error if any signatures are invalid, or if the issuer
is not allowed to publish as this endpoint.

XXX TODO: if we give up on the idea of consumers having the power to validate
events, we could just have one big JWT with all the events in it..?

Failing requests may be due to the following errors:

* status code 400, errno 106:  request body was not valid json
* status code 400, errno 107:  request body contains invalid parameters
* status code 400, errno 108:  request body missing required parameters
* status code 401, errno TODO:  invalid or malformed on event JWT 
* status code 401, errno TODO:  invalid signature on event JWT 
* status code 401, errno TODO:  issuer not authorized to publish via this server
* status code 401, errno TODO:  issuer does not match key used to sign JWT 
* status code 411, errno 112:  content-length header was not provided
* status code 413, errno 113:  request body too large


### GET /v1/events

Authenticated with an FxA OAuth token.

This endpoint allows simple stateless reading from a position the event log.
Clients using this endpoint are responsible for managing their own state in
order to  page through the available events.  It accepts the following query
parameters:

* `pos`:  the position from which to read in the log
* `num`:  the number of events to fetch (default and max is 1000)
* `uid`:  only fetch events for a specific account id
* `rid`:  only fetch events for a specific relier id
* `iss`:  only fetch events from a specific issuer hostname
* `typ`:  only fetch events of a specific type

The response body will be a JSON object with the following members:

* `events`: an array of event JWTs matching the query criteria
* `next_pos`: the position from which to read for future events

```
>  GET /v1/events?pos=OPAQUE_TOKEN HTTP/1.1
>  Host: notifications.accounts.firefox.com
.
<  200 OK
<  Content-Type: application/json
<  Content-Length: XXX TODO
<  {
<    "next_pos": "A_NEW_OPAQUE_TOKEN",
<    "events": [
<      "ABCDEFABCDEF",
<      "123456123456"
<    ]
<  }
```

Events are returned in order of increasing position in the log.  Clients can
thus page through all available events by repeatedly requesting with the
returned value of `next_pos`.

Note that the position token is an opaque string generated by the server.
Clients should not try to parse the string, generate their own position
tokens, or compare two position tokens.

If the FxA OAuth token used to authenticate this request is scoped to a
specific user, then the `uid` query parameter must be provided and must
match the user associated with the token.

Failing requests may be due to the following errors:

* status code 400, errno TODO:  query string contains invalid parameters
* status code 400, errno TODO:  position has been trimmed from the log
* status code 401, errno TODO:  missing FxA oauth bearer token
* status code 401, errno TODO:  invalid FxA oauth bearer token
* status code 401, errno TODO:  uid mismatch with user-scoped oauth token


### GET /v1/events/head

Authenticated with an FxA OAuth token.

This endpoint returns the position currently at the head of the log.
Assuming no new events were published in the interim, reading from this
position would return an empty list.

The response body is a JSON object with `"pos"` key.

```
>  GET /v1/events/head HTTP/1.1
>  Host: notifications.accounts.firefox.com
.
<  200 OK
<  Content-Type: application/json
<  Content-Length: XXX TODO
<  {
<    "pos": "OPAQUE_TOKEN_FOR_HEAD_OF_LOG"
<  }
```

Failing requests may be due to the following errors:

* status code 401, errno TODO:  missing FxA oauth bearer token
* status code 401, errno TODO:  invalid FxA oauth bearer token


### GET /v1/events/tail

Authenticated with an FxA OAuth token.

This endpoint returns the position currently at the tail of the log.
Reading from this position (with appropriate pagination via `"next_pos"`) would
yield all available events.

The response body is a JSON object with `"pos"` key.

```
>  GET /v1/events/tail HTTP/1.1
>  Host: notifications.accounts.firefox.com
.
<  200 OK
<  Content-Type: application/json
<  Content-Length: XXX TODO
<  {
<    "pos": "OPAQUE_TOKEN_FOR_TAIL_OF_LOG"
<  }
```

Failing requests may be due to the following errors:

* status code 401, errno TODO:  missing FxA oauth bearer token
* status code 401, errno TODO:  invalid FxA oauth bearer token


### POST /v1/subscribe

Authenticated with an FxA OAuth token.

This endpoint allows consumers to create a subscription through which to
receive events.  The request body must be a JSON object and may specify
any of the following keys:

* `notify_url`:  an endpoint URL to notify when new events are available
* `filter`:  a JSON object specifying properties by which to filter events
* `ttl`:  time in seconds after which the subscription will be deleted if
  inactive
* `pos`:  position at which to start in the log; by default it will be
  set to the current head of the log

The following keys may be specified in the `filter` object:

* `uid`:  only receive events for a specific account id
* `rid`:  only receive events for a specific relier id
* `iss`:  only receive events from a specific issuer hostname
* `typ`:  only receive events of a specific type

Only events that match *all* filter criteria will appear in the subscription.

The response body will be a JSON object with the id of the new subscription
as its only member.

```
>  POST /v1/subscribe HTTP/1.1
>  Host: notifications.accounts.firefox.com
>  Content-Type: application/json
>  Content-Length: XXX TODO
>  {
>    "notify_url": "https://push.services.mozilla.com/ABCDEF",
>    "ttl": 600,
>    "filter": {
>      "iss": "api.accounts.firefox.com"
>    }
>  }
.
<  200 OK
<  Content-Type: application/json
<  Content-Length: XXX TODO
<  {
<    "id": "SUBSCRIPTION_ID"
<  }
```

If the FxA OAuth token used to authenticate this request is scoped to a
specific user, then the `uid` filter parameter must be provided and must
match the user associated with the token.

If the `rid` filter parameter is provided, it must match the relier id
to which the FxA OAuth token used to authenticate this request is scoped.

Failing requests may be due to the following errors:

* status code 400, errno 106:  request body was not valid json
* status code 400, errno 107:  request body contains invalid parameters
* status code 400, errno TODO:  position has been trimmed from the log
* status code 401, errno TODO:  missing FxA oauth bearer token
* status code 401, errno TODO:  invalid FxA oauth bearer token
* status code 401, errno TODO:  relier not authorized for this operation
* status code 401, errno TODO:  uid mismatch with user-scoped oauth token
* status code 411, errno 112:  content-length header was not provided
* status code 413, errno 113:  request body too large



### GET /v1/subscription/:id

Authenticated with an FxA OAuth token.

This endpoint allows a relier to retrieve the current state of a subscription.
The response body will be a JSON object with the following members:

* id:  the subscription id
* filter:  the filter, as specified at creation time.
* ttl:  the ttl, as specified at creation time
* pos:  the current position in the log
* notify_url:  the current notification url
* notify_error:  if present and true, indicates that push notifications
  have been disabled due to errors

```
>  GET /v1/subscription/SUB_ID HTTP/1.1
>  Host: notifications.accounts.firefox.com
.
<  200 OK
<  Content-Type: application/json
<  Content-Length: XXX TODO
<  {
<    "id": "SUB_ID",
<    "ttl": 600,
<    "pos": "OPAQUE_POS_TOKEN",
<    "notify_url": "https://push.services.mozilla.com/A_TYPO",
<    "notify_error": true,
<    "filter": {
<      "iss": "api.accounts.firefox.com"
<    }
<  }
```

Subscriptions can only be accessed with FxA OAuth tokens scoped to the
relier that created them.

Failing requests may be due to the following errors:

* status code 401, errno TODO:  missing FxA oauth bearer token
* status code 401, errno TODO:  invalid FxA oauth bearer token
* status code 401, errno TODO:  relier not authorized for this operation
* status code 404, errno TODO:  subscription not found


### POST /v1/subscription/:id

Authenticated with an FxA OAuth token.

This endpoint allows a relier to update the position and notification url
for their subscription.  No other properties of the subscription can be
modified.

The request body must be a JSON object with the following optional members:
* `"pos"`:  the new log position for the subscription
* `"notify_url"`:  the new notification URL for the subscription

The response body will be a JSON object in the same for as a GET request
to this endpoint, i.e. it echos back the updated state of the subscription.

```
>  POST /v1/subscription/SUB_ID HTTP/1.1
>  Host: notifications.accounts.firefox.com
>  Content-Type: application/json
>  Content-Length: XXX TODO
>  {
>    "notify_url": "https://push.services.mozilla.com/UPDATED_ENDPOINT"
>  }
.
<  200 OK
<  Content-Type: application/json
<  Content-Length: XXX TODO
<  {
<    "id": "SUB_ID",
<    "ttl": 600,
<    "pos": "OPAQUE_POS_TOKEN",
>    "notify_url": "https://push.services.mozilla.com/UPDATED_ENDPOINT"
<    "filter": {
<      "iss": "api.accounts.firefox.com"
<    }
<  }
```

Changing the value of `"notify_url"` will clear the `"notify_error"` flag.

Subscriptions can only be updated with FxA OAuth tokens scoped to the
relier that created them.

Failing requests may be due to the following errors:

* status code 400, errno 106:  request body was not valid json
* status code 400, errno 107:  request body contains invalid parameters
* status code 400, errno TODO:  position has been trimmed from the log
* status code 401, errno TODO:  missing FxA oauth bearer token
* status code 401, errno TODO:  invalid FxA oauth bearer token
* status code 401, errno TODO:  relier not authorized for this operation
* status code 404, errno TODO:  subscription not found
* status code 411, errno 112:  content-length header was not provided
* status code 413, errno 113:  request body too large


### DELETE /v1/subscription/:id

Authenticated with an FxA OAuth token.

This endpoint allows a relier to explicitly delete a subscription.
Any configured notification URL will no longer receive requests when
new events are published.

The response body is an empty JSON object.

```
>  DELETE /v1/subscription/SUB_ID HTTP/1.1
>  Host: notifications.accounts.firefox.com
.
<  200 OK
<  Content-Type: application/json
<  Content-Length: 2
<  {}
```

Subscriptions can only be deleted with FxA OAuth tokens scoped to the
relier that created them.

Failing requests may be due to the following errors:

* status code 401, errno TODO:  missing FxA oauth bearer token
* status code 401, errno TODO:  invalid FxA oauth bearer token
* status code 401, errno TODO:  relier not authorized for this operation
* status code 404, errno TODO:  subscription not found


### GET /v1/subscription/:id/events

Authenticated with an FxA OAuth token.

This endpoint functions identically to `GET /v1/events` except that instead
of taking arguments as query parameters, it uses the values of `pos` and
`filter` from the subscription data.  The request accepts the following
query parameters:

* `pos`:  the position from which to read in the log
* `num`:  the number of events to fetch (default and max is 1000)

The response body will be a JSON object with the following members:

* `events`: an array of event JWTs matching the query criteria
* `next_pos`: the position from which to read for future events

```
>  GET /v1/subscription/SUB_ID/events?num=2 HTTP/1.1
>  Host: notifications.accounts.firefox.com
.
<  200 OK
<  Content-Type: application/json
<  Content-Length: XXX TODO
<  {
<    "next_pos": "A_NEW_OPAQUE_POS_TOKEN",
<    "events": [
<      "ABCDEFABCDEF",
<      "123456123456"
<    ]
<  }
```

Events are returned in order of increasing position in the log.  Clients can
thus page through all available events by repeatedly requesting with the
returned value of `next_pos`.

Note that the position token is an opaque string generated by the server.
Clients should not try to parse the string, generate their own position
tokens, or compare two position tokens.

Subscriptions can only be queried with FxA OAuth tokens scoped to the
relier that created them.

If the FxA OAuth token used to authenticate this request is scoped to a
specific user, then the `uid` filter parameter on the subscription must
match the user associated with the token.

Failing requests may be due to the following errors:

* status code 400, errno TODO:  query string contains invalid parameters
* status code 400, errno TODO:  position has been trimmed from the log
* status code 401, errno TODO:  missing FxA oauth bearer token
* status code 401, errno TODO:  invalid FxA oauth bearer token
* status code 401, errno TODO:  uid mismatch with user-scoped oauth token
* status code 401, errno TODO:  relier not authorized for this operation
* status code 404, errno TODO:  subscription not found


### POST /v1/subscription/:id/events

Authenticated with an FxA OAuth token.

This endpoint functions similarly to `GET /v1/subscription/:id/events` but
additionally updates the current position in the subscription.  It provides
an atomic "advance position and fetch next batch" operation.

The request body should be a JSON object with "pos" member giving an
existing position in the log.  If this is greater than or equal to the
currently recorded position for that subscription, then the subscription's
position is updated to that value before proceeding as with a GET request
on this endpoint.

```
>  POST /v1/subscription/SUB_ID/events?num=2 HTTP/1.1
>  Host: notifications.accounts.firefox.com
>  Content-Type: application/json
>  Content-Length: XXX TODO
>  {
>    "pos": "OPAQUE_POS_TOKEN"
>  }
.
<  200 OK
<  Content-Type: application/json
<  Content-Length: XXX TODO
<  {
<    "next_pos": "A_NEW_OPAQUE_POS_TOKEN",
<    "events": [
<      "ABCDEFABCDEF",
<      "123456123456"
<    ]
<  }
```

Subscriptions can only be queried with FxA OAuth tokens scoped to the
relier that created them.

If the FxA OAuth token used to authenticate this request is scoped to a
specific user, then the `uid` filter parameter on the subscription must
match the user associated with the token.

Failing requests may be due to the following errors:

* status code 400, errno TODO:  query string contains invalid parameters
* status code 400, errno 106:  request body was not valid json
* status code 400, errno 107:  request body contains invalid parameters
* status code 400, errno TODO:  position has been trimmed from the log
* status code 401, errno TODO:  missing FxA oauth bearer token
* status code 401, errno TODO:  invalid FxA oauth bearer token
* status code 401, errno TODO:  uid mismatch with user-scoped oauth token
* status code 401, errno TODO:  relier not authorized for this operation
* status code 404, errno TODO:  subscription not found
* status code 411, errno 112:  content-length header was not provided
* status code 413, errno 113:  request body too large



## Additional Features

### Subscription Activity Timeouts

XXX TODO

### Push Notification Protocol

When a subscription is created with the `"notify_url"` field, it is assumed
to be a SimplePush-compatible endpoint URL.  When there are new events
available on the subscription, a HTTP PUT request with empty body will be
made to the specified URL.

Under normal operation, the URL is expected to return a 2XX-level HTTP
status code to indicate successful receipt of the notification.  Other
status codes are treated as follows:

* 3XX:  the standard semantics of HTTP redirection are obeyed, including
  updating the `"notify_url"` field for permanent redirects.  If more than
  two levels of redirection are encountered, this will be treated like
  a 404 response.
* 5XX:  the notification will be retried periodically...XXX TODO flesh
  this out.
* 4XX:  the notification will be retried once; if another 4XX-level code
  is returned then the subscription will be deleted.
* Any other status code is treated like a 404 response.


### Backoff Protocol

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

