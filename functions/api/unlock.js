// POST /api/unlock — verify a leaf password and issue a short-lived HMAC token.
// Body: { leaf, pass }. On success returns { ok:true, token }.
// Token = base64url("leafId.epochSeconds") + "." + hmacSha256(secret).
// The token is what gates board writes + chat. It expires after TOKEN_TTL.
import { LEAF_REGISTRY, json, hashLeafSecrets, DEFAULT_ASSISTANT } from '../_shared.js';

const TOKEN_TTL = 4 * 60 * 60; // 4 hours

// Brute-force throttle: per (leaf, client IP) sliding window of failed attempts.
// KV-backed (free Pages); eventual consistency is fine for throttling.
const MAX_ATTEMPTS = 10;      // failed unlocks allowed per window…
const WINDOW_SEC   = 15 * 60; // …before a 429 cooldown

// constant-time string compare (equal-length hex digests)
function secureEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function b64url(s) {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);

  const secretCfg = hashLeafSecrets(env);
  const tokenSecret = env.ELM_TOKEN_SECRET;
  if (!tokenSecret) return json({ ok: false, error: 'server not configured' }, 500);

  let body;
  try { body = await request.json(); } catch (_) { return json({ ok: false, error: 'bad json' }, 400); }

  const leafId = String(body.leaf || '').trim();
  const pass = String(body.pass || '');
  if (!leafId || !pass) return json({ ok: false, error: 'missing leaf or password' }, 400);

  const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';

  // ---- brute-force throttle (KV-backed): block if the window is exhausted ----
  const rlKey = `rl:unlock:${leafId}:${ip}`;
  let blocked = false;
  if (env.ELM) {
    try {
      const rl = await env.ELM.get(rlKey, 'json');
      if (rl && rl.n >= MAX_ATTEMPTS && (Date.now() / 1000 - rl.t) < WINDOW_SEC) blocked = true;
    } catch (_) { /* fail open if KV hiccups */ }
  }
  if (blocked) return json({ ok: false, error: 'too many attempts — try again later' }, 429);

  const leaf = LEAF_REGISTRY.find(l => l.id === leafId);
  const cfg = secretCfg[leafId];
  if (!leaf || !cfg || !cfg.pass_hash) return json({ ok: false, error: 'access denied' }, 403);

  const digest = await sha256Hex(pass);
  // constant-time compare (hash digests are fast; timing leak is minor but cheap to close)
  if (!secureEqual(digest, cfg.pass_hash)) {
    // record the failure toward the throttle window
    if (env.ELM) {
      try {
        const now = Math.floor(Date.now() / 1000);
        const rl = (await env.ELM.get(rlKey, 'json')) || { n: 0, t: now };
        if (now - rl.t > WINDOW_SEC) { rl.n = 0; rl.t = now; }
        rl.n = (rl.n || 0) + 1;
        await env.ELM.put(rlKey, JSON.stringify(rl), { expirationTtl: WINDOW_SEC });
      } catch (_) { /* non-fatal */ }
    }
    return json({ ok: false, error: 'access denied' }, 403);
  }

  // success: clear any throttle so legit users aren't penalized
  if (env.ELM) { try { await env.ELM.delete(rlKey); } catch (_) { /* non-fatal */ } }

  // build token: payload = leafId.expiryEpoch
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL;
  const payload = `${leafId}.${exp}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(tokenSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const sigB64 = b64url(String.fromCharCode(...new Uint8Array(sig)));
  const token = `${b64url(payload)}.${sigB64}`;

  return json({ ok: true, token, name: leaf.name, assistant: cfg.assistant || DEFAULT_ASSISTANT });
}