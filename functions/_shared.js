// Shared config for ELMTREE Cloudflare Functions.
// Leaf definitions live here (id, name, visible). Passwords are NOT stored as
// plaintext — each leaf's digest is a separate secret env binding or a hash
// configured in ELM_LEAF_SECRETS.
//
// A public leaf has: { id, name }.
// Secrets live in a single JSON binding ELM_LEAF_SECRETS => { "<id>": {"pass_hash": "<sha256 hex>", "assistant": "<system prompt>"} }
//
// Tokens are signed HMAC-SHA256 over (leafId + expiry) with ELM_TOKEN_SECRET.

export const LEAF_REGISTRY = [
  { id: 'shaker',   name: '🧙' },
  { id: 'facilities', name: '🔧' },
  { id: 'frontdesk',  name: '🛎️' },
  { id: 'athletics',  name: '🏅' },
  { id: 'nurse',      name: '🩺' },
  { id: 'library',    name: '📚' },
  { id: 'cafeteria',  name: '🍽️' },
  { id: 'music',      name: '🎵' },
];

// Optional per-leaf assistant personas; falls back to a shared default.
export const DEFAULT_ASSISTANT =
  "You are a helpful workplace assistant for a small school. Be concise, friendly, " +
  "and practical. You can read facts the user tells you, but you cannot take " +
  "actions on external systems yet.";

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  });
}

export function hashLeafSecrets(env) {
  // Accept secret bindings that may arrive as JSON strings.
  if (typeof env.ELM_LEAF_SECRETS === 'string') {
    try { return JSON.parse(env.ELM_LEAF_SECRETS); } catch (_) { return {}; }
  }
  return env.ELM_LEAF_SECRETS || {};
}