# Firefox Accounts Notification Server

The Firefox Accounts Notification Server provides a way for services in the
Firefox Accounts ecosystem to publish event notifications, and for reliers to
detect and act on such events.  It is designed to be simple, extensible and
secure.

Think "pub-sub hub" and you'll be pretty close to the mark.


## Design Principles

* Pull is fundamental, push is a bonus.  Reliers should always be abe to
  "re-sync from scratch" to ensure they have all the latest information.
  The ability to get timely notifications and incremental updates is
  important but must be treated as unreliable.

* Ad-hoc many-to-many.  The Firefox Accounts ecosystem consists of many small
  services that interact in a distributed manner.  This service should not
  need to know about who they all are and what the connections are between
  them.

* Don't handle sensitive data.  In fact, it's best not to handle any data
  at all.  This service is designed to channel "ping" type events to the
  relevant listeners, with just enough data that they can query the originating
  service to get the full update. 

* Delegate identity and authentication.  New consumers of this service must be
  able to come and go without having to reconfigure the server, create or
  change shared secrets, or depend on other such points of centralization.
  

## Core Concepts

The service exposes a single, shared "event log" into which events can be
published, and which can be read incrementally by clients.  Events are
uniquely identified by their position in the log.  The primitive producer
operation is "append this event to the log" and the primitive consumer
operation is "fetch events newer than this point in the log".

Each event is a JWT signed by the issuing service.  The notification server
validates each event as it is received, but clients may also perform their
own validation.  Events must have the following standard set of fields:

  * iss:  hostname of the server issuing the event
  * aud:  hostname of the fxa-notification-server receiving the event
  * iat:  wall-clock time at which the event occurred
  * typ:  issuer-specific string describing the type of event

They may also include the following fields if relevant:

  * uid:  a specific firefox accounts uid to which this event refers
  * rid:  a specific relier to which this event is relevant
  * sub:  typ-specific string identifying data relevant to the event

Producers are discouraged from including additional information in the event.
In particular, they should *not* include any sensitive account data like
email addresses.  Consumers are responsible for fetching this data directly
from the controlling service in response to an event.

Queries to the event log can be filtered to a specific value of `iss`, `typ`,
`uid` and `rid`.


In addition to the core client-pull-based API, it's possible to have the
notification server call a webhook or simplepush endpoint when new events
are added to the log.

A subscription specifies the endpoint URL to hit and any filters to apply to
the log.  It also maintains a "last seen position" so that clients can treat it
like a queue without maintaining their own internal state.

XXX TODO:

  * A full-blown JWT for each event?
     * Is this overkill?
     * Will the overhead of verifying the JWTs destroy us all?
  * Formalize the JKU used in JWT, trusted JKUs etc.
     * we may want to restrict publishing by wildcard-matching on issuers
     * the JKU should be at a URL that's obviously controlled by the issuer
     * some sort of well-known location to fetch from by default?


## Authentication and Security

Publishers do not need to authenticate explicitly to the service, since
all events are signed JWTs.  Instead, the notification server has internal
rules for which issuers to allow and which to ignore.

Consumers make requests to the API with FxA oauth service tokens.  They must
have scope "notifications".

XXX TODO: should non-trusted reliers *have* to filter explicitly by uid?
To prevent them from seeing events from users that have never authorized
that service?  It might even require a user-specific oauth token.


## Example Events

Account create/delete/verify/pwdchange/pwdreset:
* iss: api.accounts.firefox.com
* uid: account-id
* typ: create/delete/verify/pwdchange/pwdreset

Oauth token lifecycle:
* iss: oauth.accounts.firefox.com
* uid: account-id
* rid: relier client id
* sub: hash of token id
* typ: destroy

Profile data change:
* iss: profile.accounts.firefox.com
* uid: account-id
* typ: change

