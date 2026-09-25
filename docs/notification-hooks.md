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
