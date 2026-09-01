// /api/board — per-leaf kanban board, KV-backed, write-protected by token.
// GET  ?leaf=id  (auth via X-Elm-Token header) -> columns
// POST ?leaf=id  (body = board JSON, auth via X-Elm-Token header)
import { json } from '../_shared.js';
import { verifyToken } from '../_token.js';

async function kvKey(env, leafId) {
  // Require the ELM KV binding to be present.
  if (!env.ELM) return null;
  return env.ELM;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const leafId = (url.searchParams.get('leaf') || '').trim();
  if (!leafId) return json({ error: 'missing leaf' }, 400);

  const kv = await kvKey(env, leafId);
  if (!kv) return json({ error: 'server not configured (ELM binding)' }, 500);

  const token = request.headers.get('X-Elm-Token') || '';
  const auth = await verifyToken(token, leafId, env);
  if (!auth.ok) return json({ error: auth.error || 'denied' }, 403);

  const KEY = `board:${leafId}`;

  if (request.method === 'GET') {
    const raw = await kv.get(KEY, 'json');
    return json(raw || { columns: [] });
  }

  if (request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch (_) { return json({ error: 'bad json' }, 400); }
    if (!body || !Array.isArray(body.columns)) return json({ error: 'invalid board' }, 400);
    await kv.put(KEY, JSON.stringify(body));
    return json({ ok: true });
  }

  return json({ error: 'method not allowed' }, 405);
}