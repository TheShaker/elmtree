// POST /api/chat — stream-converting proxy to an OpenAI-compatible chat API.
// Default backend is DeepSeek (cheap). Key lives ONLY in the DEEPSEEK_API_KEY
// secret binding — never in client code or this repo.
// Body { leaf, history: [{role, content}, ...] }
// The assistant is told the user's current board columns/cards as grounding.
import { json, hashLeafSecrets, DEFAULT_ASSISTANT } from '../_shared.js';
import { verifyToken } from '../_token.js';

const PROVIDERS = {
  deepseek: {
    url: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-chat',
    key: (env) => env.DEEPSEEK_API_KEY,
  },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'deepseek/deepseek-chat',
    key: (env) => env.OPENROUTER_API_KEY,
  },
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    key: (env) => env.OPENAI_API_KEY,
  },
};

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);

  const token = request.headers.get('X-Elm-Token') || '';
  let body;
  try { body = await request.json(); } catch (_) { return json({ error: 'bad json' }, 400); }
  const leafId = String(body.leaf || '').trim();
  if (!leafId) return json({ error: 'missing leaf' }, 400);

  const auth = await verifyToken(token, leafId, env);
  if (!auth.ok) return json({ error: auth.error || 'denied' }, 403);

  // pick provider: env ELM_CHAT_PROVIDER or deepseek
  const providerName = env.ELM_CHAT_PROVIDER || 'deepseek';
  const provider = PROVIDERS[providerName];
  if (!provider) return json({ error: 'unknown chat provider' }, 500);
  const apiKey = provider.key(env);
  if (!apiKey) return json({ error: 'chat not configured (missing key)' }, 500);

  const secretCfg = hashLeafSecrets(env);
  const cfg = secretCfg[leafId] || {};
  const assistant = cfg.assistant || DEFAULT_ASSISTANT;

  // load board as grounding context
  let boardContext = '';
  if (env.ELM) {
    try {
      const raw = await env.ELM.get(`board:${leafId}`, 'json');
      if (raw && Array.isArray(raw.columns)) {
        boardContext = 'The user\'s kanban board currently has:\n' +
          raw.columns.map(c => `- ${c.title}: ${(c.cards||[]).map(x=>x.text||'').filter(Boolean).join(', ')||'(empty)'}`).join('\n');
      }
    } catch (_) { /* non-fatal */ }
  }

  const system = assistant + (boardContext ? '\n\n' + boardContext : '');
  const history = Array.isArray(body.history) ? body.history.slice(-20) : [];
  const messages = [{ role: 'system', content: system }].concat(history);

  const upstream = await fetch(provider.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: provider.model, messages, temperature: 0.5, max_tokens: 600 }),
  });

  if (!upstream.ok) {
    const err = await upstream.text().catch(() => '');
    return json({ error: `upstream ${upstream.status}` }, 502);
  }
  const data = await upstream.json();
  const reply = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!reply) return json({ error: 'empty reply' }, 502);
  return json({ reply });
}