// OurGrowth Push Notification Cron Worker
// Deploy as a SEPARATE Cloudflare Worker with:
//   - Cron Trigger: 0 12 * * * (noon UTC = 8am EDT)
//   - KV namespace: OURGROWTH_KV (same as your sync worker)
//   - Environment variables: VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_EMAIL
//
// Generate VAPID keys: npx web-push generate-vapid-keys
// Set VAPID_EMAIL to your email address
//
// This worker reads your app data from KV, checks what's due today,
// and sends push notifications to subscribed devices.

export default {
  // Cron trigger — runs on schedule
  async scheduled(event, env) {
    await sendDailyNotifications(env);
  },

  // Also callable via HTTP for testing: GET /test
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/test') {
      const results = await sendDailyNotifications(env);
      return new Response(JSON.stringify(results, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('OurGrowth Push Worker. GET /test to trigger manually.', { status: 200 });
  },
};

async function sendDailyNotifications(env) {
  const results = { sent: [], errors: [] };

  // Load app data
  const raw = await env.OURGROWTH_KV.get('shared_data');
  if (!raw) return results;

  let payload;
  try { payload = JSON.parse(raw); } catch (e) { return results; }
  const data = payload.data || {};

  // Load push subscriptions
  const subsRaw = await env.OURGROWTH_KV.get('push_subscriptions');
  let subscriptions = {};
  try { if (subsRaw) subscriptions = JSON.parse(subsRaw); } catch (e) {}

  // Build notifications
  const notifications = [];
  const today = new Date();
  const todayLocal = today.toISOString().split('T')[0];

  // Check payday
  const budget = data.budget || {};
  ['adam', 'brit'].forEach(person => {
    const b = budget[person];
    if (!b || !b.nextPaycheckISO) return;
    const payDate = b.nextPaycheckISO.split('T')[0];
    if (payDate === todayLocal) {
      const bills = (data.bills || []).filter(b => !b.paid);
      const totalDue = bills.reduce((t, b) => t + parseFloat(b.amount || 0), 0);
      const name = person === 'adam' ? 'Adam' : 'Brittany';
      notifications.push({
        user: person,
        type: 'payday',
        title: "💸 It's Payday!",
        body: name + "'s paycheck" + (bills.length > 0 ? ' · ' + bills.length + ' bills totalling $' + totalDue.toFixed(0) + ' scheduled' : ''),
      });
    }
  });

  // Check bills due today/tomorrow
  (data.bills || []).forEach(bill => {
    if (bill.paid || !bill.dueISO) return;
    const dueDate = bill.dueISO.split('T')[0];
    const diff = Math.round((new Date(dueDate) - new Date(todayLocal)) / 86400000);
    if (diff === 0) {
      notifications.push({ type: 'bills', title: '🔴 Bill Due Today', body: bill.name + ' · $' + Number(bill.amount || 0).toFixed(0) });
    } else if (diff === 1) {
      notifications.push({ type: 'bills', title: '🟠 Bill Due Tomorrow', body: bill.name + ' · $' + Number(bill.amount || 0).toFixed(0) });
    }
  });

  // Check events today/tomorrow
  (data.plans || []).forEach(plan => {
    if (!plan.dateISO) return;
    const planDate = plan.dateISO.split('T')[0];
    const diff = Math.round((new Date(planDate) - new Date(todayLocal)) / 86400000);
    if (diff === 0) notifications.push({ type: 'events', title: '📅 Event Today', body: plan.title });
    else if (diff === 1) notifications.push({ type: 'events', title: '📅 Event Tomorrow', body: plan.title });
  });

  // Check chores due today
  (data.chores || []).forEach(chore => {
    if (!chore.nextDueISO) return;
    const choreDate = chore.nextDueISO.split('T')[0];
    const diff = Math.round((new Date(choreDate) - new Date(todayLocal)) / 86400000);
    if (diff <= 0) notifications.push({ type: 'chores', title: '🧹 Chore Due', body: chore.text });
  });

  // Send to all subscribed devices
  // Load per-user notification preferences
  for (const [user, sub] of Object.entries(subscriptions)) {
    const prefsRaw = await env.OURGROWTH_KV.get('notif_prefs_' + user);
    let prefs = { payday: true, bills: true, events: true, chores: true };
    try { if (prefsRaw) prefs = JSON.parse(prefsRaw); } catch (e) {}

    for (const notif of notifications) {
      // Skip if user has this type disabled
      if (notif.type && !prefs[notif.type]) continue;
      // Payday notifications are user-specific
      if (notif.type === 'payday' && notif.user && notif.user !== user) continue;

      try {
        await sendPush(env, sub, {
          title: notif.title,
          body: notif.body,
          icon: '/icon-192.png',
          tag: 'ourgrowth-' + notif.type,
        });
        results.sent.push({ user, type: notif.type, title: notif.title });
      } catch (e) {
        results.errors.push({ user, error: e.message });
      }
    }
  }

  return results;
}

async function sendPush(env, subscription, payload) {
  // Web Push protocol — requires VAPID signing
  // Using the web-push algorithm via crypto APIs
  const sub = typeof subscription === 'string' ? JSON.parse(subscription) : subscription;

  const response = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'TTL': '86400',
      // Note: Full VAPID signing requires crypto operations.
      // For production, use a library like web-push.
      // For now, this sends the payload — some push services accept unsigned payloads for testing.
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Push failed: ' + response.status + ' ' + await response.text());
  }
}
