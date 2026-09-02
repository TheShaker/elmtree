/* leaf.js — per-leaf themed kanban board + assistant chat (gated) */
"use strict";

// ---------- Leaf themes ----------
// One theme per leaf id: title/emoji/subtitle shown in the header, a friendly
// assistant display name, an accent color, and department-appropriate default
// columns with a few non-sensitive starter cards so an empty board still looks
// alive on first open. NOTE: boards already saved to KV win; defaults only
// appear until the user has real content.
const THEMES = {
  facilities: {
    emoji: '🔧', title: 'Facilities', sub: 'maintenance & grounds',
    assistant: 'Facilities assistant', accent: '#ffca28',
    columns: [
      { title: 'Work Orders',   cards: ['Lamp out — 2nd floor hall', 'Adjust AC thermostat — library'] },
      { title: 'In Progress',   cards: ['Fix front door hinge'] },
      { title: 'Scheduled',     cards: ['HVAC filter swap — next month'] },
      { title: 'Done',          cards: ['Replace hall floor tile'] },
    ],
  },
  frontdesk: {
    emoji: '🛎️', title: 'Front Desk', sub: 'visitors & calls',
    assistant: 'Front desk assistant', accent: '#81d8f0',
    columns: [
      { title: 'Visitor Log',   cards: ['Tour party — 9:30am'] },
      { title: 'Calls',         cards: ['Follow up — vendor contract'] },
      { title: 'Follow-ups',    cards: ['Email family re: admissions'] },
      { title: 'Done',          cards: ['Today\'s mail sorted'] },
    ],
  },
  athletics: {
    emoji: '🏅', title: 'Athletics', sub: 'teams & games',
    assistant: 'Athletics assistant', accent: '#ff8a65',
    columns: [
      { title: 'Backlog',       cards: ['Order team jerseys'] },
      { title: 'Practice',      cards: ['Varsity practice — 3pm'] },
      { title: 'Games',         cards: ['Home game — Friday 4pm'] },
      { title: 'Done',          cards: ['Confirm bus for away trip'] },
    ],
  },
  nurse: {
    emoji: '🩺', title: 'Nurse', sub: 'health office',
    assistant: 'School nurse assistant', accent: '#ff8a80',
    columns: [
      { title: 'Backlog',       cards: ['Update allergy list'] },
      { title: 'Today',         cards: ['Medication — per plan'] },
      { title: 'Follow-ups',    cards: ['Check in with PE class'] },
      { title: 'Done',          cards: ['Health forms filed'] },
    ],
  },
  library: {
    emoji: '📚', title: 'Library', sub: 'books & research',
    assistant: 'Library assistant', accent: '#b39ddb',
    columns: [
      { title: 'Backlog',       cards: ['Catalogue new donations'] },
      { title: 'Requests',      cards: ['Hold — English 9 essays'] },
      { title: 'Shelving',      cards: ['Reshelve returns cart'] },
      { title: 'Done',          cards: ['Repair 3 damaged books'] },
    ],
  },
  cafeteria: {
    emoji: '🍽️', title: 'Cafeteria', sub: 'meals & prep',
    assistant: 'Cafeteria assistant', accent: '#ffd54f',
    columns: [
      { title: 'Menu',          cards: ['Confirm Friday lunch menu'] },
      { title: 'Prep',          cards: ['Inventory check — dry goods'] },
      { title: 'Service',       cards: ['Lunch — 11:30–1:00'] },
      { title: 'Done',          cards: ['Order restocked'] },
    ],
  },
  music: {
    emoji: '🎵', title: 'Music', sub: 'bands & rehearsals',
    assistant: 'Music assistant', accent: '#80deea',
    columns: [
      { title: 'Backlog',       cards: ['Pick spring concert program'] },
      { title: 'Rehearsals',    cards: ['Jazz band — 2pm'] },
      { title: 'Performances',  cards: ['Winter showcase — Dec 12'] },
      { title: 'Done',          cards: ['Tune pianos in practice rooms'] },
    ],
  },
  shaker: {
    emoji: '🧙', title: 'Tech Wizard', sub: 'devices & tickets',
    assistant: 'Tech wizard', accent: '#66bb6a',
    columns: [
      { title: 'Backlog', cards: [] }, { title: 'Doing', cards: [] }, { title: 'Done', cards: [] },
    ],
  },
};

const COLORS = ['', 'pink', 'blue', 'green', 'orange'];

// ---------- Identity + theme ----------
let leafId = sessionStorage.getItem('elm_leaf') || '';
if (!leafId) {
  const q = new URLSearchParams(location.search).get('leaf');
  if (q) { leafId = q; sessionStorage.setItem('elm_leaf', q); }
}
const token = leafId ? (sessionStorage.getItem('elm_token_' + leafId) || '') : '';
const theme = THEMES[leafId] || THEMES.shaker;

function applyTheme() {
  document.title = (theme.title || leafId || 'LEAF') + ' · ELMTREE';
  document.getElementById('lfLeaf').textContent = (theme.emoji || '') + ' ' + (theme.title || leafId || 'LEAF');
  document.getElementById('lfWho').textContent = theme.sub || 'your grove';
  document.getElementById('lfSub').textContent = theme.sub || 'your corkboard & assistant';
  document.getElementById('chatName').textContent = theme.assistant || 'Assistant';
  if (theme.accent) document.documentElement.style.setProperty('--accent', theme.accent);
}
applyTheme();

// starfield
(function () {
  const cvs = document.getElementById('starfield'); if (!cvs) return;
  const ctx = cvs.getContext('2d'); let W, H, stars = [];
  function size() { W = cvs.width = cvs.offsetWidth; H = cvs.height = cvs.offsetHeight; }
  function mk() { stars = []; const n = Math.floor(W * H / 3800); for (let i = 0; i < n; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.2 + .3, t: Math.random() * 6.28, s: .005 + Math.random() * .015 }); }
  size(); window.addEventListener('resize', () => { size(); mk(); }); mk();
  function draw() { ctx.clearRect(0, 0, W, H); for (const s of stars) { s.t += s.s; ctx.globalAlpha = .3 + .5 * Math.abs(Math.sin(s.t)); ctx.fillStyle = '#cfe8ff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill(); } ctx.globalAlpha = 1; requestAnimationFrame(draw); }
  requestAnimationFrame(draw);
})();

// ---------- Board (KV-backed, corkboard) ----------
let board = null, saveTimer = null, dirty = false;

function uid(p) { return p + Math.random().toString(36).slice(2, 9); }

// Theme defaults (with starter cards) are cloneable, not shared.
function themedColumns() {
  return theme.columns.map(c => ({ id: uid('c'), title: c.title, cards: (c.cards || []).map(t => ({ id: uid('k'), text: t })) }));
}
function defaultBoard() { return { columns: themedColumns() }; }

async function loadBoard() {
  if (!leafId) { render(); return; }
  try {
    const r = await fetch('/api/board?leaf=' + encodeURIComponent(leafId), { headers: { 'X-Elm-Token': token }, cache: 'no-store' });
    if (r.status === 403) { alert('Session expired. Re-enter your leaf.'); location.href = 'index.html'; return; }
    if (r.ok) {
      const d = await r.json();
      // Empty board (no saved columns yet) falls back to theme defaults so the
      // page never renders a blank board.
      board = (d && Array.isArray(d.columns) && d.columns.length) ? migrate(d) : defaultBoard();
    } else { board = defaultBoard(); }
  } catch (e) { board = defaultBoard(); }
  render();
}

function migrate(d) {
  if (!d || !Array.isArray(d.columns)) return defaultBoard();
  d.columns.forEach(c => { if (!Array.isArray(c.cards)) c.cards = []; });
  return d;
}

function scheduleSave() {
  dirty = true; clearTimeout(saveTimer); saveTimer = setTimeout(save, 700);
}
async function save() {
  const el = document.getElementById('saved');
  if (!leafId) return;
  try {
    const r = await fetch('/api/board?leaf=' + encodeURIComponent(leafId), {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Elm-Token': token },
      body: JSON.stringify(board)
    });
    if (r.ok && dirty) { dirty = false; el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 1400); }
    else if (r.status === 403) { alert('Session expired. Re-enter your leaf.'); location.href = 'index.html'; }
  } catch (e) { }
}

function render() {
  let bd = document.getElementById('board');
  bd.innerHTML = '';
  (board || defaultBoard()).columns.forEach(col => {
    const sec = document.createElement('section');
    sec.className = 'col';
    const inp = document.createElement('input');
    inp.className = 'coltitle'; inp.value = col.title; inp.placeholder = 'Column';
    inp.oninput = () => { col.title = inp.value; scheduleSave(); };
    const cnt = document.createElement('span');
    cnt.className = 'colcount'; cnt.textContent = col.cards.length;
    sec.appendChild(inp); sec.appendChild(cnt);
    const cards = document.createElement('div');
    cards.className = 'cards';
    col.cards.forEach((cd) => { cards.appendChild(cardEl(cd, col)); });
    const empty = document.createElement('div');
    empty.className = 'colempty'; empty.textContent = col.cards.length ? '' : 'empty'; empty.style.display = col.cards.length ? 'none' : 'block';
    const add = document.createElement('button');
    add.className = 'addcard'; add.textContent = '+ add card';
    add.onclick = () => { col.cards.push({ id: uid('k'), text: '' }); scheduleSave(); render(); };
    sec.append(inp, cnt, cards, empty, add);
    bd.appendChild(sec);
  });
}

function cardEl(cd, col) {
  const div = document.createElement('div');
  div.className = 'card' + (cd.color && COLORS.includes(cd.color) ? ' c-' + cd.color : '');
  const grip = document.createElement('div');
  grip.textContent = '⠿'; grip.style.cursor = 'grab'; grip.style.opacity = .5;
  grip.addEventListener('pointerdown', e => startDrag(e, cd, col, div));
  const ta = document.createElement('textarea');
  ta.className = 'ctext'; ta.rows = 1; ta.placeholder = 'Task…'; ta.value = cd.text;
  ta.oninput = () => { cd.text = ta.value; scheduleSave(); };
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; });
  requestAnimationFrame(() => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; });
  const meta = document.createElement('div'); meta.className = 'cmeta';
  const del = document.createElement('button'); del.className = 'mini'; del.textContent = '✕';
  del.title = 'Delete'; del.onclick = () => { col.cards = col.cards.filter(c => c !== cd); scheduleSave(); render(); };
  const dots = document.createElement('span'); dots.style.display = 'flex'; dots.style.gap = '.15rem';
  COLORS.forEach(c => {
    const d = document.createElement('button'); d.className = 'mini';
    d.style.width = '14px'; d.style.height = '14px'; d.style.borderRadius = '50%';
    d.style.background = { x: '#3c4a1f', pink: '#66304b', blue: '#274c6b', green: '#2c4f2f', orange: '#6b4a26' }[c];
    d.style.outline = (cd.color === c) ? '2px solid #ffd54f' : '';
    d.onclick = () => { cd.color = c; scheduleSave(); render(); };
    dots.appendChild(d);
  });
  meta.append(dots, del);
  div.append(grip, ta, meta);
  return div;
}

// drag to reorder
let dragGhost = null;
function startDrag(e, cd, col, div) {
  e.preventDefault();
  const ghost = div.cloneNode(true);
  ghost.style.position = 'fixed'; ghost.style.pointerEvents = 'none'; ghost.style.zIndex = 999;
  ghost.style.width = div.offsetWidth + 'px'; ghost.style.opacity = .5; ghost.style.left = '-9999px';
  document.body.appendChild(ghost); dragGhost = ghost;
  function move(ev) {
    if (!dragGhost) return;
    dragGhost.style.left = (ev.clientX + 8) + 'px';
    dragGhost.style.top = (ev.clientY + 8) + 'px';
    dragGhost.classList.add('dragging');
  }
  function up() {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    if (dragGhost) { dragGhost.remove(); dragGhost = null; }
  }
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
}

// ---------- Chat (DeepSeek via Function) ----------
const chatBody = document.getElementById('chatBody');
const chatIn = document.getElementById('chatIn');
const chatSend = document.getElementById('chatSend');
const chatState = document.getElementById('chatState');
const chatErr = document.getElementById('chatErr');
const history = [];

function addMsg(who, text) {
  const m = document.createElement('div');
  m.className = 'msg ' + who;
  m.innerHTML = '<span class="who">' + (who === 'user' ? 'you' : (theme.assistant || leafId || 'assistant')) + '</span>' + escapeHtml(text);
  chatBody.appendChild(m);
  chatBody.scrollTop = chatBody.scrollHeight;
  return m;
}
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
}
function setBusy(b) {
  chatSend.disabled = b; chatIn.disabled = b; chatState.textContent = b ? 'thinking…' : 'idle';
}
async function send() {
  const text = chatIn.value.trim();
  if (!text) return;
  chatIn.value = '';
  chatErr.textContent = '';
  addMsg('user', text);
  history.push({ role: 'user', content: text });
  const typing = addMsg('bot', '…'); typing.classList.add('typing');
  setBusy(true);
  try {
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Elm-Token': token },
      body: JSON.stringify({ leaf: leafId, history })
    });
    const d = await r.json().catch(() => ({}));
    if (d.reply) {
      typing.remove();
      history.push({ role: 'assistant', content: d.reply });
      addMsg('bot', d.reply);
    } else {
      typing.remove();
      chatErr.textContent = d.error || 'No reply.';
    }
  } catch (e) {
    typing.remove();
    chatErr.textContent = 'Could not reach the assistant.';
  }
  setBusy(false);
}
chatSend.addEventListener('click', send);
chatIn.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });

// ---------- Boot ----------
window.addEventListener('load', () => {
  if (!leafId) { document.getElementById('board').textContent = 'No leaf selected.'; return; }
  if (!token) {
    addMsg('bot', 'This leaf is locked. Go back to the tree and enter its password to load your board & assistant.');
    document.getElementById('board').innerHTML = '<p style="color:var(--dim);font-size:.8rem;">Locked — no session.</p>';
    return;
  }
  loadBoard();
  addMsg('bot', 'Hey — I\'m your ' + theme.assistant + '. Ask me for help, or I can read your board below to keep tabs on what you\'re juggling.');
});