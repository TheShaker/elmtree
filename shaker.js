// shaker corkboard (tech wizard) — standalone, localStorage backed.
// A blank, standalone corkboard mirroring dshaker.space/kandan.
// No gate, no backend — everything persists to localStorage. Non-sensitive only.
const LS='elmtree_shaker_board';
const COLORS=['','pink','blue','green','orange'];
const DEFAULT_TAGS=['#school','#home'];
let board=null, saveTimer=null, dirty=false, state={filter:''};
function uid(p){return p+Math.random().toString(36).slice(2,9)}

// ---------- tag helpers ----------
function addTag(){
  const t=prompt('New tag (e.g. #project):', '#');
  if(!t) return;
  let tag=t.trim(); if(!tag) return;
  if(tag[0]!=='#') tag='#'+tag;
  if(!board.tags.includes(tag)) board.tags.push(tag);
  scheduleSave(); renderTagsUI(); render();
}
function renderTagsUI(){
  const sel=document.getElementById('filter');
  const cur=state.filter;
  sel.innerHTML='';
  ['', '__untagged'].concat((board.tags||[])).forEach(t=>{
    const o=document.createElement('option'); o.value=t;
    o.textContent = t===''? 'All' : t==='__untagged'? 'Untagged' : t;
    sel.appendChild(o);
  });
  if(cur) sel.value=cur;
}
function setFilter(v){ state.filter=v; render(); }
function passesFilter(cd){
  if(!state.filter) return true;
  if(state.filter==='__untagged') return !cd.tag;
  return cd.tag===state.filter;
}

// ---------- due helper ----------
function fmtDue(iso){
  if(!iso) return '';
  const d=new Date(iso), now=new Date();
  const days=Math.floor((d-now)/86400000);
  const txt=d.toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
  return {txt, over: d<now, soon: days<=3 && d>=now};
}
function setDue(cd){
  const picker=document.getElementById('duePicker');
  picker.value=cd.due||'';
  picker.showPicker?.();
  const apply=()=>{ cd.due=picker.value||null; scheduleSave(); render(); };
  picker.onchange=apply;
}

const DEFAULT_COLS=[
  {id:uid('c'),title:'Backlog',cards:[]},
  {id:uid('c'),title:'Doing',cards:[]},
  {id:uid('c'),title:'Done',cards:[]}
];

function defaultBoard(){return {columns:JSON.parse(JSON.stringify(DEFAULT_COLS)),scratch:'',tags:DEFAULT_TAGS.slice()}}

function loadBoard(){
  try{ board = JSON.parse(localStorage.getItem(LS)) || defaultBoard(); }
  catch(e){ board = defaultBoard(); }
  if(!board.columns||!Array.isArray(board.columns)) board.columns=JSON.parse(JSON.stringify(DEFAULT_COLS));
  if(board.scratch===undefined) board.scratch='';
  if(!Array.isArray(board.tags)) board.tags=DEFAULT_TAGS.slice();
  // migrate cards: ensure tag/notes/due fields
  board.columns.forEach(c=>{ (c.cards||[]).forEach(cd=>{ if(cd.tag===undefined)cd.tag=''; if(cd.notes===undefined)cd.notes=''; if(cd.due===undefined)cd.due=null; }); });
  document.getElementById('scratch').value=board.scratch||'';
  renderTagsUI();
  render();
}

function scheduleSave(){
  dirty=true;
  board.scratch=document.getElementById('scratch').value;
  localStorage.setItem(LS, JSON.stringify(board));
  clearTimeout(saveTimer); saveTimer=setTimeout(()=>{
    const el=document.getElementById('saved');
    if(dirty){ dirty=false; el.classList.add('on'); setTimeout(()=>el.classList.remove('on'),1400); }
  },700);
}

function render(){
  const bd=document.getElementById('board'); bd.innerHTML='';
  board.columns.forEach(col=>{
    const sec=document.createElement('section'); sec.className='col';
    const head=document.createElement('div'); head.style.display='flex'; head.style.alignItems='center'; head.style.gap='.4rem';
    const inp=document.createElement('input'); inp.className='coltitle'; inp.value=col.title; inp.placeholder='Column';
    inp.oninput=()=>{col.title=inp.value;scheduleSave();};
    const del=document.createElement('button'); del.className='mini'; del.textContent='✕';
    del.title='Delete column'; del.onclick=()=>{if(confirm('Delete "'+col.title+'" and its cards?')){board.columns=board.columns.filter(c=>c!==col);scheduleSave();render();}};
    const cnt=document.createElement('span'); cnt.className='colcount'; cnt.textContent=col.cards.length;
    head.append(inp,del,cnt);
    const cards=document.createElement('div'); cards.className='cards';
    const shown = col.cards.filter(passesFilter);
    shown.forEach(cd=>cards.appendChild(cardEl(cd,col)));
    const empty=document.createElement('div'); empty.className='colempty';
    empty.style.display=shown.length?'none':'block'; empty.textContent= state.filter? 'no matches' : 'empty';
    const add=document.createElement('button'); add.className='addcard'; add.textContent='+ add card';
    add.onclick=()=>{ col.cards.push({id:uid('k'),text:'',tag:'',notes:'',due:null}); scheduleSave(); render(); };
    sec.append(head,cards,empty,add); bd.appendChild(sec);
  });
}

function cardEl(cd,col){
  const div=document.createElement('div');
  div.className='card'+(cd.color&&COLORS.includes(cd.color)?' c-'+cd.color:'');
  const ta=document.createElement('textarea'); ta.className='ctext'; ta.rows=1; ta.placeholder='Task…'; ta.value=cd.text;
  ta.oninput=()=>{cd.text=ta.value;scheduleSave();};
  ta.addEventListener('input',()=>{ta.style.height='auto';ta.style.height=ta.scrollHeight+'px';});
  requestAnimationFrame(()=>{ta.style.height='auto';ta.style.height=ta.scrollHeight+'px';});

  const meta=document.createElement('div'); meta.className='cmeta';
  const left=document.createElement('div'); left.className='cmeta-left';
  const right=document.createElement('div'); right.className='cmeta-left';

  // priority: slot number + move up/down
  const idx=col.cards.indexOf(cd);
  const up=document.createElement('button'); up.className='prio'; up.textContent='▲';
  up.title='Raise priority'; up.disabled=(idx===0);
  up.onclick=()=>moveCard(col,cd,-1);
  const num=document.createElement('span'); num.className='colcount'; num.textContent=idx+1;
  const dn=document.createElement('button'); dn.className='prio'; dn.textContent='▼';
  dn.title='Lower priority'; dn.disabled=(idx===col.cards.length-1);
  dn.onclick=()=>moveCard(col,cd,1);
  const prioW=document.createElement('span'); prioW.style.display='flex'; prioW.style.alignItems='center'; prioW.style.gap='.12rem';
  prioW.append(up,num,dn);
  left.appendChild(prioW);

  // tag chip + tag selector
  if(cd.tag){ const chip=document.createElement('span'); chip.className='tagchip'; chip.textContent=cd.tag; left.appendChild(chip); }
  const tag=document.createElement('select'); tag.className='ctagsel'; tag.title='Tag';
  const o0=document.createElement('option'); o0.value=''; o0.textContent='—'; tag.appendChild(o0);
  (board.tags||[]).forEach(t=>{ const o=document.createElement('option'); o.value=t; o.textContent=t; tag.appendChild(o); });
  tag.value=cd.tag||''; tag.onchange=()=>{ cd.tag=tag.value||''; scheduleSave(); render(); };
  left.appendChild(tag);

  // due button (status: due/soon/over)
  const due=document.createElement('button'); due.className='cdue';
  if(cd.due){ const f=fmtDue(cd.due); due.textContent='⏱ '+f.txt;
    due.classList.add(f.over?'over':f.soon?'soon':'due');
  } else due.textContent='⏱ +';
  due.title=cd.due?('Due '+cd.due+' — click to change'):'Set due';
  due.onclick=()=>setDue(cd);
  left.appendChild(due);

  // color dots
  const dots=document.createElement('span'); dots.style.display='flex'; dots.style.gap='.15rem';
  COLORS.forEach(c=>{
    const d=document.createElement('button'); d.className='mini'; d.style.width='14px';d.style.height='14px';d.style.borderRadius='50%';
    d.style.background={x:'#fff3a3',pink:'#ffc9d8',blue:'#cfe5ff',green:'#d4f2c8',orange:'#ffe0b3'}[c];
    d.style.outline=(cd.color===c)?'2px solid #333':'';
    d.onclick=()=>{cd.color=c;scheduleSave();render();};
    dots.appendChild(d);
  });
  right.appendChild(dots);

  // delete
  const del=document.createElement('button'); del.className='mini'; del.textContent='✕';
  del.title='Delete card'; del.onclick=()=>{col.cards=col.cards.filter(x=>x!==cd);scheduleSave();render();};
  right.appendChild(del);

  meta.append(left,right);

  // notes
  const nt=document.createElement('textarea'); nt.className='cnotes'; nt.rows=2; nt.placeholder='details…'; nt.value=cd.notes||'';
  nt.oninput=()=>{cd.notes=nt.value;scheduleSave();};

  div.append(ta,meta,nt); return div;
}
function moveCard(col,cd,delta){
  const k=col.cards.indexOf(cd), j=k+delta;
  if(j<0||j>=col.cards.length) return;
  col.cards.splice(k,1); col.cards.splice(j,0,cd);
  scheduleSave(); render();
}

document.getElementById('scratch').addEventListener('input',scheduleSave);
document.getElementById('filter').addEventListener('change', e=> setFilter(e.target.value));
loadBoard();

// ---------- Groove oracle: canned random responses (placeholders for now) ----------
const chatBody=document.getElementById('chatBody');
const chatIn=document.getElementById('chatIn');
const chatSend=document.getElementById('chatSend');
const chatState=document.getElementById('chatState');
const chatErr=document.getElementById('chatErr');

// Default responses picked at random (no LLM call yet). Slotted by rough intent.
const RESPONSES=[
  "Noted. The grove is a state of mind, and today it is aware of you.",
  "The oracle senses the shuffle. Ask again, or go stick a note on the board.",
  "Interesting. The leaves rustled when you said that.",
  "I'd consult the board before answering. What's on it?",
  "The branch you chose is a good one. Carry on.",
  "Deep thought… or at least a theatrical pause.",
  "That's above my paygrade until the OpenClaw brain arrives tomorrow.",
  "The grove hears you. I, however, have canned responses.",
  "Good. Now make it a card, follow the priority arrows, and tag it.",
  "An elm once asked me that. I gave it the same answer.",
];
function pick(){ return RESPONSES[Math.floor(Math.random()*RESPONSES.length)]; }

function addMsg(who,text){
  const m=document.createElement('div');
  m.className='msg '+who;
  const w=document.createElement('span'); w.className='who';
  w.textContent = who==='user'?'you':'oracle';
  const t=document.createElement('div'); t.textContent=text; t.style.whiteSpace='pre-wrap';
  m.appendChild(w); m.appendChild(t);
  chatBody.appendChild(m); chatBody.scrollTop=chatBody.scrollHeight;
  return m;
}
function setBusy(b){ chatSend.disabled=b; chatIn.disabled=b; chatState.textContent=b?'…':'idle'; }

addMsg('bot','Hey — I’m your grove oracle. Ask away (answers are canned for now).');
chatSend.disabled=false;

function send(){
  const text=chatIn.value.trim();
  if(!text) return;
  chatIn.value=''; chatErr.textContent='';
  addMsg('user', text);
  const typing=addMsg('bot','…'); typing.classList.add('typing');
  setBusy(true);
  // small delay for a human-ish feel, then a random canned reply
  setTimeout(()=>{
    typing.remove();
    addMsg('bot', pick());
    setBusy(false);
  }, 500 + Math.random()*500);
}
chatSend.addEventListener('click', send);
chatIn.addEventListener('keydown', e=>{ if(e.key==='Enter') send(); });