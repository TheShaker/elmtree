// POST /api/unlock — verify a leaf password and issue a short-lived HMAC token.
// Body: { leaf, pass }. On success returns { ok:true, token }.
// Token = base64url("leafId.epochSeconds") + "." + hmacSha256(secret).
// The token is what gates board writes + chat. It expires after TOKEN_TTL.
import { LEAF_REGISTRY, json, hashLeafSecrets, DEFAULT_ASSISTANT } from '../_shared.js';

const TOKEN_TTL = 4 * 60 * 60; // 4 hours

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

  const leaf = LEAF_REGISTRY.find(l => l.id === leafId);
  const cfg = secretCfg[leafId];
  if (!leaf || !cfg || !cfg.pass_hash) return json({ ok: false, error: 'access denied' }, 403);

  const digest = await sha256Hex(pass);
  // constant-ish time compare (moderately; hash compare is fast anyway)
  if (digest !== cfg.pass_hash) return json({ ok: false, error: 'access denied' }, 403);

  // build token: payload = leafId.expiryEpoch
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL;
  const payload = `${leafId}.${exp}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(tokenSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const sigB64 = b64url(String.fromCharCode(...new Uint8Array(sig)));
  const token = `${b64url(payload)}.${sigB64}`;

  return json({ ok: true, token, name: leaf.name, assistant: cfg.assistant || DEFAULT_ASSISTANT });
}