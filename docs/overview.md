Firefox Accounts Notification Server
====================================

The Firefox Accounts Notification Server provides a way for for services in the
Firefox Accounts ecosystem to publish event notifications, and for reliers to
detect and act on such events.  It is designed to be simple, extensible and
secure.

Think "pub-sub hub" and you'll be pretty close to the mark.


Design Principles
-----------------

* Pull is fundamental, push is a bonus.  Reliers should always be abe to
  "re-sync from scratch" to ensure they have all the latest information.
  The ability to get timely notifications and incremental updates is
  important but must be treated as unreliable.

* Many-to-many.  The Firefox Accounts ecosystem consists of many small
  services that interact in a distributed manner.  This service should not
  need to know about who they all are and what the connections are between
  them.

* Don't handle sensitive data.  In fact, it's best not to handle any data
  at all.  This service is designed to channel "ping" type events to the
  relevant listeners, with just enough data that they can query the originating
  service to get the full update. 

* Delegate identity and authentication.  New consumers of this service must be
  able to come and go without having to reconfigure the server, create or
  change shared secrets, or other such points of centralization.
  

Core Concepts
-------------

The service exposes a single, shared "event log" into which events can be
published, and which can be read incrementally by clients.  Events are
uniquely identified by their position in the log.  The primitive producer
operation is "append this event to the log" and the primitive consumer
operation is "fetch events newer than this in the log".

Each event is a JWT signed by the issuing service.  The notification server
validates each event as it is received, but clients may also perform their
own validation.  Events have precisely the following set of fields:

  * iss:  the server issuing the event
  * iat:  wall-clock time at which the event occurred
  * sub:  the firefox accounts uid
  * typ:  string describing type of event
  * aud:  a specific relier to whom this event is relevant
  * XXX TODO: maybe "uid" for account-uid field?
  * XXX TODO: maybe "exp" if we know the event will be useless after a while?

Producers are discouraged from including additional information in the event.
In particular, they should *not* include any sensitive account data like
email addresses.  Consumers are responsible for fetching this data directly
from the controlling service in response to an event.

Queries to the event log can be filtered according to these fields:

  * events from a specific issuer
  * events regarding a specific account
  * events of a specific type

XXX TODO:

  * full-blown JWT?  Is this overkill?
  * formalize the JKU used in JWT, trusted JKUs etc.
     * then we can potential limit by wildcard-matching on issuers


Authentication and Security
---------------------------

Publishers do not need to authenticate explicitly to the service, since
all events are signed JWTs.  Instead, the notification server has internal
rules for which issuers to allow and which to ignore.

Consumers make requests to the API with FxA oauth service tokens.  They must
have scope "notifications".

XXX TODO: should non-trusted reliers *have* to filter explicitly by uid?
To prevent them from seeing events from users that have never authorized
that service?  It might even require a user-specific oauth token.


Subscriptions
-------------

In addition to the core client-pull-based API, it's possible to have the
notification server call a webhook or simplepush endpoint when new events
are added to the log.

A subscription specifies the endpoint URL to hit and any filters to apply to
the log.  It also maintains the last-seen-event so that clients can treat it
like a queue.

XXX TODO define API for this.


Example Events
--------------

Account create/delete/verify/pwdchange/pwdreset:
* iss: api.accounts.firefox.com
* sub: account-id
* typ: create/delete/verify/pwdchange/pwdreset

Oauth token lifecycle:
* iss: oauth.accounts.firefox.com
* sub: account-id
* typ: revoke/expire
* XXX TODO: somehow include identifier for the token...?
* aud: relier client id

Profile data change:
* iss: profile.accounts.firefox.com
* sub: account-id
* typ: change


Example Subscriptions
---------------------

Watch for change in user's profile data:
* iss: profile.accounts.firefox.com
* uid: account-id
* typ: change

