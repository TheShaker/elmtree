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
  document.getElementById('lfSub').textContent = theme.sub || 'your corkboard & assistant';
  document.getElementById('chatName').textContent = theme.assistant || 'Assistant';
  if (theme.accent) { /* corkboard chrome ignores accent */ }
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

const COLORS = ['', 'pink', 'blue', 'green', 'orange'];
const DEFAULT_TAGS = ['#today'];
let state = { filter: '' };

// Theme defaults (with starter cards) are cloneable, not shared.
function themedColumns() {
  return theme.columns.map(c => ({ id: uid('c'), title: c.title, cards: (c.cards || []).map(t => ({ id: uid('k'), text: t })) }));
}
function defaultBoard() { return { columns: themedColumns(), scratch: '', tags: DEFAULT_TAGS.slice() }; }

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
      restoreAux();
    } else { board = defaultBoard(); restoreAux(); }
  } catch (e) { board = defaultBoard(); restoreAux(); }
  render();
}

function migrate(d) {
  if (!d || !Array.isArray(d.columns)) return defaultBoard();
  d.columns.forEach(c => {
    if (!Array.isArray(c.cards)) c.cards = [];
    c.cards.forEach(cd => {
      if (cd.tag === undefined) cd.tag = '';
      if (cd.notes === undefined) cd.notes = '';
      if (cd.due === undefined) cd.due = null;
      if (cd.color === undefined) cd.color = '';
    });
  });
  return d;
}

// load scratch + tag filter into their controls after a board load
function restoreAux() {
  const sc = document.getElementById('scratch');
  if (sc) sc.value = board.scratch || '';
  renderTagsUI();
}

function scheduleSave() {
  const sc = document.getElementById('scratch');
  if (sc) board.scratch = sc.value;
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

// ---------- tags / filter ----------
function addTag() {
  const t = prompt('New tag (e.g. #project):', '#');
  if (!t) return;
  let tag = t.trim(); if (!tag) return;
  if (tag[0] !== '#') tag = '#' + tag;
  if (!board.tags.includes(tag)) board.tags.push(tag);
  scheduleSave(); renderTagsUI(); render();
}
function renderTagsUI() {
  const sel = document.getElementById('filter');
  if (!sel) return;
  const cur = state.filter;
  sel.innerHTML = '';
  ['', '__untagged'].concat((board.tags || [])).forEach(t => {
    const o = document.createElement('option'); o.value = t;
    o.textContent = t === '' ? 'All' : t === '__untagged' ? 'Untagged' : t;
    sel.appendChild(o);
  });
  if (cur) sel.value = cur;
}
function setFilter(v) { state.filter = v; render(); }
function passesFilter(cd) {
  if (!state.filter) return true;
  if (state.filter === '__untagged') return !cd.tag;
  return cd.tag === state.filter;
}

// ---------- due helper ----------
function fmtDue(iso) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date();
  const days = Math.floor((d - now) / 86400000);
  const txt = d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  return { txt, over: d < now, soon: days <= 3 && d >= now };
}
function setDue(cd) {
  const picker = document.getElementById('duePicker');
  picker.value = cd.due || '';
  picker.showPicker?.();
  picker.onchange = () => { cd.due = picker.value || null; scheduleSave(); render(); };
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
    const shown = col.cards.filter(passesFilter);
    shown.forEach((cd) => { cards.appendChild(cardEl(cd, col)); });
    const empty = document.createElement('div');
    empty.className = 'colempty'; empty.textContent = state.filter ? 'no matches' : 'empty';
    empty.style.display = shown.length ? 'none' : 'block';
    const add = document.createElement('button');
    add.className = 'addcard'; add.textContent = '+ add card';
    add.onclick = () => { col.cards.push({ id: uid('k'), text: '', tag: '', notes: '', due: null, color: '' }); scheduleSave(); render(); };
    sec.append(inp, cnt, cards, empty, add);
    bd.appendChild(sec);
  });
}

function cardEl(cd, col) {
  const div = document.createElement('div');
  div.className = 'card' + (cd.color && COLORS.includes(cd.color) ? ' c-' + cd.color : '');
  const ta = document.createElement('textarea'); ta.className = 'ctext'; ta.rows = 1; ta.placeholder = 'Task…'; ta.value = cd.text;
  ta.oninput = () => { cd.text = ta.value; scheduleSave(); };
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; });
  requestAnimationFrame(() => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; });

  const meta = document.createElement('div'); meta.className = 'cmeta';
  const left = document.createElement('div'); left.className = 'cmeta-left';
  const right = document.createElement('div'); right.className = 'cmeta-left';

  // priority: slot number + move up/down
  const idx = col.cards.indexOf(cd);
  const up = document.createElement('button'); up.className = 'prio'; up.textContent = '▲';
  up.title = 'Raise priority'; up.disabled = (idx === 0);
  up.onclick = () => moveCard(col, cd, -1);
  const num = document.createElement('span'); num.className = 'colcount'; num.textContent = idx + 1;
  const dn = document.createElement('button'); dn.className = 'prio'; dn.textContent = '▼';
  dn.title = 'Lower priority'; dn.disabled = (idx === col.cards.length - 1);
  dn.onclick = () => moveCard(col, cd, 1);
  const prioW = document.createElement('span'); prioW.style.display = 'flex'; prioW.style.alignItems = 'center'; prioW.style.gap = '.12rem';
  prioW.append(up, num, dn);
  left.appendChild(prioW);

  // tag chip + tag selector
  if (cd.tag) { const chip = document.createElement('span'); chip.className = 'tagchip'; chip.textContent = cd.tag; left.appendChild(chip); }
  const tag = document.createElement('select'); tag.className = 'ctagsel'; tag.title = 'Tag';
  const o0 = document.createElement('option'); o0.value = ''; o0.textContent = '—'; tag.appendChild(o0);
  (board.tags || []).forEach(t => { const o = document.createElement('option'); o.value = t; o.textContent = t; tag.appendChild(o); });
  tag.value = cd.tag || ''; tag.onchange = () => { cd.tag = tag.value || ''; scheduleSave(); render(); };
  left.appendChild(tag);

  // due button
  const due = document.createElement('button'); due.className = 'cdue';
  if (cd.due) { const f = fmtDue(cd.due); due.textContent = '⏱ ' + f.txt;
    due.classList.add(f.over ? 'over' : f.soon ? 'soon' : 'due');
  } else due.textContent = '⏱ +';
  due.title = cd.due ? ('Due ' + cd.due + ' — click to change') : 'Set due';
  due.onclick = () => setDue(cd);
  left.appendChild(due);

  // color dots
  const dots = document.createElement('span'); dots.style.display = 'flex'; dots.style.gap = '.15rem';
  COLORS.forEach(c => {
    const d = document.createElement('button'); d.className = 'mini'; d.style.width = '14px'; d.style.height = '14px'; d.style.borderRadius = '50%';
    d.style.background = { x: '#fff3a3', pink: '#ffc9d8', blue: '#cfe5ff', green: '#d4f2c8', orange: '#ffe0b3' }[c];
    d.style.outline = (cd.color === c) ? '2px solid #333' : '';
    d.onclick = () => { cd.color = c; scheduleSave(); render(); };
    dots.appendChild(d);
  });
  right.appendChild(dots);

  // delete
  const del = document.createElement('button'); del.className = 'mini'; del.textContent = '✕';
  del.title = 'Delete card'; del.onclick = () => { col.cards = col.cards.filter(x => x !== cd); scheduleSave(); render(); };
  right.appendChild(del);

  meta.append(left, right);

  // notes
  const nt = document.createElement('textarea'); nt.className = 'cnotes'; nt.rows = 2; nt.placeholder = 'details…'; nt.value = cd.notes || '';
  nt.oninput = () => { cd.notes = nt.value; scheduleSave(); };

  div.append(ta, meta, nt); return div;
}
function moveCard(col, cd, delta) {
  const k = col.cards.indexOf(cd), j = k + delta;
  if (j < 0 || j >= col.cards.length) return;
  col.cards.splice(k, 1); col.cards.splice(j, 0, cd);
  scheduleSave(); render();
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
document.getElementById('scratch').addEventListener('input', scheduleSave);
const filterSel = document.getElementById('filter');
if (filterSel) filterSel.addEventListener('change', e => setFilter(e.target.value));

window.addEventListener('load', () => {
  if (!leafId) { document.getElementById('board').textContent = 'No leaf selected.'; return; }
  if (!token) {
    addMsg('bot', 'This leaf is locked. Go back to the tree and enter its password to load your board & assistant.');
    document.getElementById('board').innerHTML = '<p style="color:var(--t2);font-size:.8rem;">Locked — no session.</p>';
    return;
  }
  loadBoard();
  addMsg('bot', 'Hey — I\'m your ' + theme.assistant + '. Ask me for help, or I can read your board below to keep tabs on what you\'re juggling.');
});