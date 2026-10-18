# Notification hooks

This phase records notification intent without sending network requests. Firebase
Cloud Messaging and Capacitor will be connected after the native app shells exist.

## Event contract

| Event | Created when | Recipient | Deep-link payload |
| --- | --- | --- | --- |
| challenge_received | A direct challenge or rematch is created | Invited player | Match, round 1 |
| challenge_accepted | The invited player accepts | Challenger | Match, round 1 |
| match_found | Random matchmaking pairs two players | Waiting player | Match, round 1 |
| turn_ready | The first player submits a round | Other player | Match and round |
| results_ready | The second player submits a round | First player | Match and round |
| nudge | A valid nudge is recorded | Nudged player | Match |
| weekly_summary | A weekly reward is calculated | Reward owner | Weekly summary |

Every event has a unique dedupe_key. Game changes and their notification events
commit in the same database transaction, so a failed game save cannot queue a
misleading notification.

## Device contract

The native app calls register_push_device(platform, token, installationId) after
the user grants notification permission and whenever Firebase rotates its token.
It calls unregister_push_device(token) on sign-out or when notifications are
disabled.

Tokens are stored in public.devices, protected by row-level security. The current
provider is fixed to FCM, but keeping it as a column makes a future migration
possible.

## Future sender

A scheduled Supabase Edge Function will:

1. Claim up to 100 pending rows with claim_notification_outbox.
2. Load every enabled FCM token belonging to the recipient.
3. Build user-facing copy from the event type and actor profile.
4. Send a multicast FCM message containing the stored deep-link payload.
5. Disable permanently invalid tokens.
6. Call complete_notification_delivery.

Failed events retry with exponential backoff and become terminally failed after
eight attempts. Only the service_role can claim or complete outbox rows. The
browser client cannot read or mutate the outbox.

## Web push (Home Screen beta)

The web client now uses standard Web Push, separately from the future native FCM
registrations. `push.js` registers the network-only `sw.js`; no game or auth
responses are cached. iPhone players must launch the Home Screen installation,
then tap Enable Alerts and allow the system permission prompt. Settings includes
Send test alert and a turn-alert off switch.

`register_web_push` binds the subscription to the authenticated player. Direct
client access to subscriptions and delivery receipts is revoked; owner-checked
RPCs handle registration and removal. Subscriptions transfer when the same
installation signs into another player. The sender allows only Apple, Google,
and Mozilla push hosts, rejects redirects, and uses encrypted Web Push payloads.

`send-web-push` runs from pg_cron once a minute when there is work. Its gateway JWT
check is disabled because it uses a separate random cron credential, checked
before claiming events. This credential and the VAPID signing keys live in Vault;
only service_role can retrieve sender configuration. VAPID keys must be generated
once per environment and stored as battle_picz_vapid_public/private. Never rotate
them casually: subscriptions are tied to the public key.

Events older than 24 hours expire; subscriptions only receive events created after
registration. Permanently expired subscriptions are disabled. Transient delivery
failures retry through the existing backoff, with per-device receipts preventing
normal retries from duplicating successful sends. A crash between delivery and
receipt can still repeat a push; stable notification tags replace duplicate cards.
Stuck processing events are reclaimed after five minutes. Results copy contains
no scores. Native FCM delivery is not connected yet.
