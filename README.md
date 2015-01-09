Firefox Accounts Notification Server
====================================

This is an experimental hub service for handling account event notifications
in the Firefox Accounts ecosystem.  Service Providers will be able to use it
to publish notifications of various events, and Reliers will be able to use it
to subscribe to said notifications.

It's most definitely *not* ready for production use.

In fact, there's not even any code here yet, just some notes and bugs and
ideas...


Notes and Questions
-------------------

Do we want push, pull, or both?  E.g. webhooks or a long-poll API?

What sort of reliability guarantees are we after here?

What sorts of events are likely to flow through this system, and in
what format?
   - account creation, deletion
   - password change and reset
   - oauth token revocation and expiry
   - profile data change

How do we ensure security of receipt, e.g. that reliers can't listen for
events that they shouldn't be able to receive?
   - maybe we just never include sensitive information in the notice,
     so it's just a "hey something changed go look it up" type ping.

How do we ensure security of submission, e.g. so that reliers can be sure
that the actual auth-server is the one sending the messages?
   - JWTs signed with well-known JKUs?

Interesting prior art:
  - facebook: https://developers.facebook.com/docs/graph-api/real-time-updates/
  - github: https://developer.github.com/webhooks/ and https://developer.github.com/v3/activity/events/

How do we authenticate API operations?
  - this seems a good candidate for oauth "service tokens" that are issue
    only to the relier, not tied to a particular user. 
