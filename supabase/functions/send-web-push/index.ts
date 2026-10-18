import webpush from 'npm:web-push@3.6.7';
const base = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
async function db(path: string, method = 'GET', body?: unknown) {
  const r = await fetch(`${base}/rest/v1/${path}`, { method, headers: {
    apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json'
  }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!r.ok) throw new Error(`Database ${path.split("?")[0]} failed (${r.status})`);
  const text = await r.text(); return text ? JSON.parse(text) : null;
}
function allowed(endpoint: string) {
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port &&
      (u.hostname === 'web.push.apple.com' || u.hostname.endsWith('.push.apple.com') ||
       u.hostname === 'fcm.googleapis.com' || u.hostname === 'updates.push.services.mozilla.com');
  } catch { return false; }
}
Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  try {
    const config = await db('rpc/web_push_sender_config', 'POST', {});
    if (!config?.cron_secret || req.headers.get('x-push-secret') !== config.cron_secret)
      return new Response('Unauthorized', { status: 401 });
    webpush.setVapidDetails('https://battle-picz-game.vercel.app', config.public_key, config.private_key);
    const events = await db('rpc/claim_web_push_events', 'POST', {});
    let sent = 0, skipped = 0, failed = 0;
    for (const event of events) {
      event.event_id = event.id;
      try {
        const subscriptions = await db(`web_push_subscriptions?user_id=eq.${event.recipient_user_id}&enabled=eq.true&select=id,subscription,created_at`);
        const receipts = await db(`web_push_receipts?event_id=eq.${event.event_id}&select=subscription_id`);
        const done = new Set(receipts.map((r: any) => r.subscription_id));
        let delivered = receipts.length, retry = false;
        const actor = event.actor_user_id ? await db(`profiles?id=eq.${event.actor_user_id}&select=display_name`) : [];
        const name = actor[0]?.display_name || 'Your opponent';
        const copy: Record<string, string[]> = {
          turn_ready: ['Your turn!', `${name} has played. Your next round is ready.`],
          results_ready: ['Results ready', `${name} has finished. Open Battle Picz to reveal the result.`],
          nudge: ['Ready to play?', `${name} gave you a nudge. It’s your turn.`],
          challenge_received: ['New challenge', `${name} challenged you to Battle Picz.`],
          challenge_accepted: ['Challenge accepted', `${name} joined your battle.`],
          match_found: ['Opponent found', 'Your new battle is ready.'],
          weekly_summary: ['Weekly results', 'Your weekly Battle Picz results are ready.']
        };
        const [title, body] = event.payload?.test ? ['Battle Picz test alert', 'Notifications are working on this device.'] : copy[event.event_type];
        let url = '/';
        if (event.match_id) {
          const match = await db(`matches?id=eq.${event.match_id}&select=seed`);
          if (match[0]) {
            const screen = event.event_type === 'results_ready' ? 'results' : 'game';
            url = `/?match=${encodeURIComponent(match[0].seed)}&matchId=${encodeURIComponent(event.match_id)}&screen=${screen}`;
            if (event.round_no) url += `&round=${encodeURIComponent(event.round_no)}`;
          }
        }
        for (const sub of subscriptions) {
          if (done.has(sub.id) || new Date(sub.created_at) > new Date(event.created_at)) continue;
          if (!allowed(sub.subscription.endpoint)) {
            await db(`web_push_subscriptions?id=eq.${sub.id}`, 'PATCH', { enabled: false }); continue;
          }
          try {
            // Generate encrypted Web Push with a maintained library; fetch prevents redirects/SSRF.
            const request = webpush.generateRequestDetails(sub.subscription, JSON.stringify({ title, body, url, tag: `bp-${event.event_id}` }), { TTL: 3600, urgency: 'normal' });
            const response = await fetch(request.endpoint, { method: 'POST', headers: request.headers, body: request.body, redirect: 'error', signal: AbortSignal.timeout(10000) });
            if (response.status === 404 || response.status === 410) {
              await db(`web_push_subscriptions?id=eq.${sub.id}`, 'PATCH', { enabled: false });
            } else if (!response.ok) { retry = true; }
            else {
              delivered++;
              await db('web_push_receipts', 'POST', { event_id: event.event_id, subscription_id: sub.id });
            }
          } catch { retry = true; }
        }
        if (retry) {
          failed++;
          await db('rpc/complete_notification_delivery', 'POST', { p_event_id: event.event_id, p_success: false, p_error: 'Push provider delivery failed; retry scheduled' });
        } else if (delivered) {
          sent++;
          await db('rpc/complete_notification_delivery', 'POST', { p_event_id: event.event_id, p_success: true });
        } else {
          skipped++;
          await db(`notification_outbox?id=eq.${event.event_id}&status=eq.processing`, 'PATCH', { status: 'cancelled', locked_at: null, last_error: 'No eligible push subscription' });
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : 'Event failed');
        failed++;
        await db('rpc/complete_notification_delivery', 'POST', { p_event_id: event.event_id, p_success: false, p_error: 'Sender failed; retry scheduled' });
      }
    }
    return Response.json({ sent, skipped, failed });
  } catch { return Response.json({ error: 'Push sender unavailable' }, { status: 500 }); }
});
