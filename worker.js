// OurGrowth Sync Worker v2 — Secure
// Environment variables: SYNC_TOKEN, SYNC_TOKEN_OLD (optional, for rotation)
// KV namespace: OURGROWTH_KV

export default {
  async fetch(request, env) {
    const ALLOWED_ORIGINS = [
      'https://yourdomain.com',          // CHANGE THIS to your GitHub Pages domain
      'https://www.yourdomain.com',       // CHANGE THIS
      'http://localhost:8080',
      'http://127.0.0.1:8080',
    ];

    const origin = request.headers.get('Origin') || '';
    const isAllowed = ALLOWED_ORIGINS.some(o => origin.startsWith(o)) || origin === '';

    const corsHeaders = {
      'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Sync-Token',
      'Content-Type': 'application/json',
      'Vary': 'Origin',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (!isAllowed) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
    }

    const token = request.headers.get('X-Sync-Token');
    const validTokens = [env.SYNC_TOKEN];
    if (env.SYNC_TOKEN_OLD) validTokens.push(env.SYNC_TOKEN_OLD);

    if (!token || !validTokens.includes(token)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const key = 'shared_data';

    // Push subscription storage
    if (request.method === 'POST' && url.pathname.endsWith('/push-subscribe')) {
      const body = await request.json();
      if (!body.user || !body.subscription) {
        return new Response(JSON.stringify({ error: 'Missing user or subscription' }), { status: 400, headers: corsHeaders });
      }
      const subsRaw = await env.OURGROWTH_KV.get('push_subscriptions');
      let subs = {};
      try { if (subsRaw) subs = JSON.parse(subsRaw); } catch (e) {}
      subs[body.user] = body.subscription;
      await env.OURGROWTH_KV.put('push_subscriptions', JSON.stringify(subs));
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    if (request.method === 'GET') {
      const data = await env.OURGROWTH_KV.get(key);
      return new Response(data || '{}', { headers: corsHeaders });
    }

    if (request.method === 'POST') {
      const contentLength = parseInt(request.headers.get('Content-Length') || '0');
      if (contentLength > 512000) {
        return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413, headers: corsHeaders });
      }

      const body = await request.text();
      if (body.length > 512000) {
        return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413, headers: corsHeaders });
      }

      let updatedAt = Date.now();
      try {
        const parsed = JSON.parse(body);
        if (parsed.updatedAt) updatedAt = parsed.updatedAt;
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: corsHeaders });
      }

      await env.OURGROWTH_KV.put(key, body);
      return new Response(JSON.stringify({ ok: true, updatedAt }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
  },
};
