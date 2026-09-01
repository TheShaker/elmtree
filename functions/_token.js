// Token verification helper shared by board + chat.
// Validates the HMAC-signed token and that it hasn't expired and matches leafId.

function b64urlDecode(s) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return atob(b);
}

export async function verifyToken(token, leafId, env) {
  if (!token || !leafId || !env.ELM_TOKEN_SECRET) return { ok: false, error: 'missing token/leaf/secret' };
  const parts = String(token).split('.');
  if (parts.length !== 2) return { ok: false, error: 'malformed token' };
  const [payloadB64, sigB64] = parts;

  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.ELM_TOKEN_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const sigBytes = new Uint8Array([...b64urlDecode(sigB64)].map(c => c.charCodeAt(0)));
  const validSig = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(b64urlDecode(payloadB64)));
  if (!validSig) return { ok: false, error: 'bad signature' };

  const payload = b64urlDecode(payloadB64); // "leafId.epoch"
  const dot = payload.lastIndexOf('.');
  const tokLeaf = payload.slice(0, dot);
  const exp = parseInt(payload.slice(dot + 1), 10);
  if (tokLeaf !== leafId) return { ok: false, error: 'leaf mismatch' };
  if (Date.now() / 1000 > exp) return { ok: false, error: 'token expired' };
  return { ok: true };
}