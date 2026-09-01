/* ELMTREE — generative elm with clickable leaves */
"use strict";

// ---------- Seeded RNG (deterministic tree across reloads) ----------
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const rnd = mulberry32(1337);

// ---------- Starfield backdrop ----------
(function(){
  const cvs = document.getElementById('starfield');
  if(!cvs) return;
  const ctx = cvs.getContext('2d');
  let W,H,stars=[];
  function size(){ W=cvs.width=cvs.offsetWidth; H=cvs.height=cvs.offsetHeight; }
  function makeStars(){ stars=[]; const n=Math.floor((W*H)/3200); for(let i=0;i<n;i++) stars.push({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.3+.3,a:Math.random(),t:Math.random()*6.28,s:.005+Math.random()*.02}); }
  size(); window.addEventListener('resize',()=>{size();makeStars();});
  makeStars();
  const c=0;
  function draw(t){
    ctx.clearRect(0,0,W,H);
    for(const s of stars){
      s.t+=s.s;
      const a=0.35+0.55*Math.abs(Math.sin(s.t));
      ctx.globalAlpha=a;
      ctx.fillStyle='#cfe8ff';
      ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,6.283); ctx.fill();
    }
    ctx.globalAlpha=1;
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
})();

// ---------- Tree generation ----------
const SVGB = 'http://www.w3.org/2000/svg';
const LEAVES_BY_NAME = {};

function el(name, attrs, parent){
  const e = document.createElementNS(SVGB, name);
  for(const k in attrs||{}) e.setAttribute(k, attrs[k]);
  if(parent) parent.appendChild(e);
  return e;
}

function genTree(){
  const svg = document.getElementById('trSvg');
  svg.innerHTML='';
  svg.setAttribute('viewBox','0 0 1000 860');
  svg.setAttribute('preserveAspectRatio','xMidYMax meet');

  // trunk base
  const origin = {x:500, y:830};

  // branch defs
  const groupMain = el('g',{id:'elmMain'}, svg);

  function branch(x,y,len,ang,depth,width){
    const ex = x + Math.cos(ang)*len;
    const ey = y + Math.sin(ang)*len;
    // draw branch
    const p = el('path',{
      d:`M${x} ${y} C ${x+Math.cos(ang)*len*0.5} ${y+Math.sin(ang)*len*0.4}, ${x+Math.cos(ang)*len*0.8} ${y+Math.sin(ang)*len*0.8}, ${ex} ${ey}`,
      fill:'none', stroke:'#4a3a28', 'stroke-width':width,
      'stroke-linecap':'round'
    }, groupMain);

    if(depth<=0) return {x:ex,y:ey};

    const n = depth>3 ? 3 : (depth>2 ? (rnd()<.5?2:3) : (rnd()<.7?2:3));
    const kids=[];
    for(let i=0;i<n;i++){
      const spread = depth>3 ? 0.5 : rnd()*.7+.35;
      const na = ang + (Math.random()*2-1)*spread;
      const nl = len * (0.62 + rnd()*0.22);
      const nw = Math.max(1, width*0.66);
      const child = branch(ex,ey,nl,na,depth-1,nw);
      kids.push(child);
    }
    return {x:ex,y:ey, kids};
  }
  const root = branch(origin.x, origin.y, 190, -Math.PI/2, 5, 22, []);

  // collect terminal leaf positions
  const terminals=[];
  function walk(n){
    if(n.kids && n.kids.length){ n.kids.forEach(walk); }
    else terminals.push(n);
  }
  walk(root);

  // assign leaves from a list (injected) or generate generic ones
  return {svg, groupMain, terminals};
}

// per-leaf sway + label handled by caller after leaves fixture is known
const TREE = genTree();

// ---------- Leaf placement fixtures ----------
window.ELM_LEAVES = window.ELM_LEAVES || null;

function loadLeaves(){
  fetch('/api/leaves').then(r=>r.json()).then(json=>{
    const leaves = (json && json.leaves) || window.ELM_LEAVES || [];
    placeLeaves(leaves);
  }).catch(()=>{ placeLeaves(window.ELM_LEAVES || []); });
}

function placeLeaves(leaves){
  const terms = TREE.terminals;
  if(!terms.length) return;
  const {svg, groupMain} = TREE;
  const count = document.getElementById('leafCount');

  const N = Math.min(leaves.length || 0, terms.length);
  // pick roughly every (terms/N)th terminal, offset by a bit for organic feel
  const stride = Math.max(1, Math.floor(terms.length/(N||1)));
  const picks = [];
  for(let i=0;i<N;i++){
    let ti = i*stride + Math.floor(rnd()*stride*0.5);
    if(ti>=terms.length) ti = terms.length-1-i;
    picks.push({leaf:leaves[i], term:terms[ti]});
  }

  let ok=0;
  picks.forEach(({leaf, term}, idx)=>{
    if(!leaf || !leaf.id) return;
    const g = el('g',{class:'leafg', 'data-leaf':leaf.id}, groupMain);
    g.style.setProperty('--du', (0.5+Math.random()*1.1).toFixed(2)+'s');
    g.style.setProperty('--db', (Math.random()*4).toFixed(2)+'s');

    // leaf shape (two arcs) rotated toward branch
    const rot = (Math.random()*40-20 + idx*7)* (idx%2? -1:1);
    const leafShape = el('path',{
      d:'M 0 0 C -7 -6 -12 -10 -14 0 C -12 9 -7 5 0 0 Z',
      class:'leafshape', transform:`rotate(${rot})`
    }, g);

    // soft glow backing
    el('circle',{cx:0,cy:0,r:26,class:'leafhalo'}, g);

    // label
    const label = el('text',{class:'leaflabel','text-anchor':'middle',dy:34}, g);
    label.textContent = leaf.name || leaf.id;

    // stem connector
    el('path',{d:`M 0 0 L 0 ${2+Math.random()*6}`,class:'leafstem'}, g);

    const tx = term.x, ty = term.y;
    g.setAttribute('transform',`translate(${tx} ${ty})`);

    g.addEventListener('click', ()=>{
      openGate(leaf);
    });
    g.addEventListener('mouseenter', ()=>{
      g.classList.add('hov');
    });
    g.addEventListener('mouseleave', ()=>{ g.classList.remove('hov'); });
    LEAVES_BY_NAME[leaf.id] = g;
    ok++;
  });

  // grow-in
  svg.classList.add('grown');
  count.textContent = ok;
}

// ---------- Lock gate ----------
let activeLeaf=null;
function openGate(leaf){
  activeLeaf = leaf;
  const gate = document.getElementById('gate');
  document.getElementById('gateTitle').textContent = (leaf.name||leaf.id).toUpperCase() + ' · LEAF';
  document.getElementById('gateSub').textContent = 'Enter the password for this leaf.';
  document.getElementById('gateErr').textContent='';
  document.getElementById('gateIn').value='';
  gate.classList.remove('hidden');
  setTimeout(()=>document.getElementById('gateIn').focus(),60);
}

async function unlock(){
  const v = document.getElementById('gateIn').value.trim();
  const err = document.getElementById('gateErr');
  if(!activeLeaf){ closeGate(); return; }
  if(!v){ err.textContent='enter the password'; return; }
  try{
    const r = await fetch('/api/unlock', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({leaf: activeLeaf.id, pass: v})
    });
    const d = await r.json();
    if(d.ok && d.token){
      sessionStorage.setItem('elm_token_'+activeLeaf.id, d.token);
      sessionStorage.setItem('elm_leaf', activeLeaf.id);
      window.location.href = '/leaf.html?leaf='+encodeURIComponent(activeLeaf.id);
    } else {
      err.textContent = d.error || '✗ access denied';
    }
  }catch(e){ err.textContent='server unreachable'; }
  document.getElementById('gateIn').value='';
}

function closeGate(){ document.getElementById('gate').classList.add('hidden'); activeLeaf=null; }

// ---------- Wire up ----------
window.addEventListener('load', ()=>{
  const gateBtn = document.getElementById('gateBtn');
  const gateIn = document.getElementById('gateIn');
  gateBtn.addEventListener('click', unlock);
  gateIn.addEventListener('keydown', e=>{ if(e.key==='Enter') unlock(); });
  document.getElementById('gate').addEventListener('click', e=>{ if(e.target===document.getElementById('gate')) closeGate(); });
  loadLeaves();
});