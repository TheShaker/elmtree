/* ELMTREE — generative elm with clickable leaves */
"use strict";

// ---------- Seeded RNG ----------
// Seed is random each load so the tree shuffles a bit on every refresh, but the
// branch-spread parameters below are kept wide so the canopy ALWAYS opens into
// a large sprawling spread regardless of seed.
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const rnd = mulberry32(Math.floor(Math.random()*0xffffffff)+1);

// ---------- Starfield backdrop ----------
(function(){
  const cvs = document.getElementById('starfield');
  if(!cvs) return;
  const ctx = cvs.getContext('2d');
  let W,H,stars=[];
  function size(){ W=cvs.width=cvs.offsetWidth; H=cvs.height=cvs.offsetHeight; }
  function makeStars(){ stars=[]; const n=Math.floor((W*H)/3200); for(let i=0;i<n;i++) stars.push({x:rnd()*W,y:rnd()*H,r:rnd()*1.3+.3,t:rnd()*6.28,s:.005+rnd()*.02}); }
  size(); window.addEventListener('resize',()=>{size();makeStars();});
  makeStars();
  function draw(){
    ctx.clearRect(0,0,W,H);
    for(const s of stars){
      s.t+=s.s;
      ctx.globalAlpha=0.35+0.55*Math.abs(Math.sin(s.t));
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

  const defs = el('defs',{}, svg);

  // Wood gradient + a subtle bark noise for texture
  const wood = el('linearGradient',{id:'woodGrad',x1:'0',y1:'0',x2:'1',y2:'1'}, defs);
  el('stop',{offset:'0%','stop-color':'#6b4c2a'}, wood);
  el('stop',{offset:'50%','stop-color':'#4a3418'}, wood);
  el('stop',{offset:'100%','stop-color':'#2e1f0e'}, wood);

  // Green planet for the tree to rest on
  const planet = el('g',{id:'elmPlanet'}, svg);
  const grad = el('radialGradient',{id:'planetGrad',cx:'38%',cy:'32%',r:'75%'}, defs);
  el('stop',{offset:'0%','stop-color':'#8fd6a0'}, grad);
  el('stop',{offset:'55%','stop-color':'#3d9c4f'}, grad);
  el('stop',{offset:'100%','stop-color':'#14521f'}, grad);
  const planetCircle = el('circle',{cx:500,cy:880,r:300,fill:'url(#planetGrad)'}, planet);
  // planet surface speckle (crater-dots like the Mercury map vibe)
  for(let i=0;i<40;i++){
    const a=rnd()*Math.PI*2, rr=Math.sqrt(rnd())*300;
    const px=500+Math.cos(a)*rr*0.9, py=880+Math.sin(a)*rr*0.9;
    if(py>740) el('circle',{cx:px,cy:py,r:rnd()*3+1,fill:'rgba(0,40,15,'+(0.06+rnd()*0.1)+')'}, planet);
  }

  // trunk base (sits on the planet horizon)
  const origin = {x:500, y:660};

  // ---------- Canopy underlay: a dense, rounded elm crown of small leaves ----------
  const foliage = el('g',{id:'elmFoliage'}, svg);
  const cx=500, cy=270;                       // crown center
  const canopyHerbs=['#3f9e43','#57b755','#2f7d34','#6ecf5a','#4caf50'];
  for(let i=0;i<95;i++){
    // elliptical crown: denser toward the middle, thinning at the edge
    let px,py,rr=Math.pow(rnd(),0.7);
    const ang=rnd()*Math.PI*2;
    // mostly fill the ellipse, some scatter outward near branch tips
    px=cx+Math.cos(ang)*(90+rnd()*175)*rr;
    py=cy+Math.sin(ang)*(60+rnd()*125)*rr;
    py=Math.min(610, Math.max(60,py));
    if(px<110||px>890) continue;
    const sz=rnd()*6+5;
    const grofWrap=el('g',{transform:`translate(${px} ${py})`}, foliage);
    const grof=el('path',{
      d:`M0 0 C ${-sz*0.6} ${-sz*0.5} ${-sz} ${-sz*0.3} ${-sz*0.5} 0 C 0 ${sz*0.45} ${sz*0.5} ${sz*0.2} 0 0 Z`,
      fill:canopyHerbs[Math.floor(rnd()*canopyHerbs.length)],
      opacity:0.5+rnd()*0.3,
      transform:`translate(0 0) rotate(${rnd()*90-45})`
    }, grofWrap);
    // ~1 in 4 canopy leaves gently drifts + fades (falling effect)
    if(rnd()<0.28){
      grof.classList.add('leaf-fall');
      grof.style.setProperty('--fx0', '0px');
      grof.style.setProperty('--fy0', '0px');
      grof.style.setProperty('--fx1', (rnd()*34-17).toFixed(0)+'px');
      grof.style.setProperty('--fy1', (30+rnd()*60).toFixed(0)+'px');
      grof.style.setProperty('--fr0', '0deg');
      grof.style.setProperty('--fr1', (rnd()*46-23).toFixed(0)+'deg');
      grof.style.setProperty('--fdur', (5.5+rnd()*5).toFixed(1)+'s');
      grof.style.setProperty('--fdel', (rnd()*4).toFixed(1)+'s');
      grof.style.setProperty('--fomax', (0.3+rnd()*0.22).toFixed(2));
    }
  }

  // branch defs
  const groupMain = el('g',{id:'elmMain'}, svg);
  const nodes = [];   // every branch endpoint (for canopy-tip leaves)

  function limb(x,y,x2,y2,width){
    // straight tapered filled limb between two points (used for trunk + primaries)
    nodes.push({x:x2,y:y2,depth:2,ang:Math.atan2(y2-y,x2-x)});
    const len=Math.hypot(x2-x,y2-y)||1;
    const dx=(x2-x)/len, dy=(y2-y)/len, px=-dy, py=dx;
    const w0=width, w1=Math.max(1,width*0.6);
    el('path',{
      d:`M${x+px*w0} ${y+py*w0} L${x2+px*w1} ${y2+py*w1} L${x2-px*w1} ${y2-py*w1} L${x-px*w0} ${y-py*w0} Z`,
      fill:'url(#woodGrad)', stroke:'rgba(20,12,5,.6)','stroke-width':'0.8'
    }, groupMain);
    el('path',{d:`M${x} ${y} L${x2} ${y2}`,fill:'none',stroke:'rgba(255,240,210,.16)','stroke-width':Math.max(1,width*0.3),'stroke-linecap':'round'}, groupMain);
    if(width>=8){
      const steps=Math.max(2,Math.floor(len/22));
      for(let s=1;s<steps;s++){ const t=s/steps; const mx=x+(x2-x)*t,my=y+(y2-y)*t; const jag=rnd()*2.4*width-1.2*width;
        el('path',{d:`M${mx+jag} ${my+1} Q ${mx+jag*0.4} ${my+rnd()*6} ${mx+jag} ${my-1}`,fill:'none',stroke:'rgba(20,12,5,.5)','stroke-width':Math.max(1,width*0.12),'stroke-linecap':'round'}, groupMain);
      }
    }
  }

  // A curved twig for recursion.
  function twig(x,y,x2,y2,width){
    el('path',{
      d:`M${x} ${y} C ${x+(x2-x)*0.5} ${y+(y2-y)*0.4}, ${x2-(x2-x)*0.2} ${y2-(y2-y)*0.2}, ${x2} ${y2}`,
      fill:'none', stroke:'#3a2615','stroke-width':width,'stroke-linecap':'round'
    }, groupMain);
  }

  // ---------- Trunk: straight up (no random bend) ----------
  const crown={x:500, y:430};                 // trunk top
  limb(origin.x, origin.y, crown.x, crown.y, 30);

  // ---------- Symmetric primary fan spanning the leaf arc ----------
  // Leaves sit on the outer arc (cx,cy,rx,ry) below. Radiate primaries from the
  // crown outward (down-left to down-right through the top) so the whole canopy
  // spans WHERE the leaves are, evenly and symmetrically.
  const leafArc={cx:500, cy:300, rx:392, ry:260};
  const NPRIM = 9;
  const prim=[];
  for(let i=0;i<NPRIM;i++){
    // a sweeps from the left arc point (angle~PI) through the top to the right
    // arc point (angle~0). At each, the primary points radially OUTWARD-DOWN
    // from the crown toward that arc point (so both far edges are covered).
    const f=i/(NPRIM-1);
    const a = Math.PI + (0-Math.PI)*f;        // PI..0 (top arc)
    const tx = leafArc.cx + Math.cos(a)*leafArc.rx*0.98;
    const ty = leafArc.cy - Math.sin(a)*leafArc.ry*0.9 + 10;
    prim.push({x:tx,y:ty});
    // outward direction: from crown (spine) outward to the leaf point
    const dir = Math.atan2(ty-crown.y, tx-crown.x);
    const L = Math.hypot(tx-crown.x, ty-crown.y);
    // draw to ~85% of the way (leaves sit just beyond the branch tips)
    const bx = crown.x + Math.cos(dir)*L*0.8;
    const by = crown.y + Math.sin(dir)*L*0.8;
    limb(crown.x, crown.y, bx, by, 13);
    prim[i].base={x:bx,y:by};
  }

  // ---------- Recursive branching: bush up each primary, starting way early ----------
  function branch(x,y,len,ang,depth,width){
    const ex = x+Math.cos(ang)*len, ey=y+Math.sin(ang)*len;
    nodes.push({x:ex,y:ey,depth,ang});
    if(width>=2.2){
      limb(x,y,ex,ey,width);
    } else {
      twig(x,y,ex,ey,Math.max(1,width));
    }
    if(depth<=0) return {x:ex,y:ey};
    const n = depth>=2 ? 3 : 3;
    const kids=[];
    for(let i=0;i<n;i++){
      const spread = 0.75 + rnd()*0.55;
      const na = ang + (rnd()*2-1)*spread;
      const nl = len*(0.55+rnd()*0.2);
      const nw = Math.max(1.1, width*0.74);
      kids.push(branch(ex,ey,nl,na,depth-1,nw));
    }
    return {x:ex,y:ey, kids};
  }

  // Grow subtrees. Twigs only appear NEAR the trunk/crown (inner canopy only);
  // the outer part of each primary stays clean so density falls off toward the
  // leaf tips instead of clumping at the external branches.
  const root = {items: prim.map(p=>{
    const b=p.base||{x:p.x,y:p.y};
    const dir = Math.atan2(b.y-crown.y, b.x-crown.x);
    const out=[];
    // twigs only at the inner stations (close to the crown)
    const stations=[0.32,0.55];
    let carry={x:crown.x,y:crown.y};
    stations.forEach((t,si)=>{
      const sx=crown.x+(b.x-crown.x)*t;
      const sy=crown.y+(b.y-crown.y)*t;
      const segLen = Math.hypot(sx-carry.x, sy-carry.y)||1;
      const segDir = Math.atan2(sy-carry.y, sx-carry.x);
      // primary limb up to this station
      limb(carry.x, carry.y, sx, sy, 13);
      // a few twigs fanning sideways (inner clump only)
      for(let k=0;k<2;k++){
        const a=segDir + (rnd()*1.1-0.55);
        const tl = segLen*(0.45+rnd()*0.4);
        out.push(branch(sx,sy, tl, a, 2, 3));
      }
      carry={x:sx,y:sy};
    });
    // finish the clean outer limb out to the leaf arc point (no crown)
    limb(carry.x, carry.y, b.x, b.y, 10);
    // a single light outer twig for a hint of life, not a crown
    out.push(branch(b.x, b.y, 18+rnd()*16, dir+(rnd()*0.5-0.25), 1, 2.5));
    return {itemsTree: out, x:b.x, y:b.y};
  })};

  // collect terminals (for any logic that wants them)
  const terminals=[];
  (function walk(n){
    if(n.itemsTree && n.itemsTree.length){ n.itemsTree.forEach(walk); }
    else if(n.kids && n.kids.length){ n.kids.forEach(walk); }
    else if(n.items){ n.items.forEach(walk); }
    else terminals.push(n);
  })(root);

  return {svg, groupMain, terminals, foliage, root};
}

// ---------- Leaf placement fixtures ----------
window.ELM_LEAVES = window.ELM_LEAVES || null;

function loadLeaves(){
  fetch('/api/leaves').then(r=>r.json()).then(json=>{
    const leaves = (json && json.leaves) || window.ELM_LEAVES || [];
    placeLeaves(leaves);
  }).catch(()=>{ placeLeaves(window.ELM_LEAVES || []); });
}

function placeLeaves(leaves){
  const {svg, groupMain} = TREE;
  const count = document.getElementById('leafCount');
  const N = leaves.length;
  if(!N){ svg.classList.add('grown'); return; }

  // Place every portal leaf on the outer semicircle spanning the canopy, matching
  // the primary fan reach (leafArc in genTree). Leaves sit high in the canopy.
  const cx=500, cy=300;              // crown center (matches genTree leafArc)
  const rx=392, ry=260;              // semi-ellipse reach (full canopy width)
  const startA=Math.PI, endA=0;      // left -> top -> right (top of tree = up)
  let ok=0;
  for(let i=0;i<N;i++){
    const leaf=leaves[i];
    if(!leaf || !leaf.id) continue;
    // evenly slot each leaf across the top semicircle
    const frac = N>1 ? i/(N-1) : 0.5;
    const a = startA + (endA-startA)*frac;
    const px = cx + Math.cos(a)*rx;
    const py = cy - Math.sin(a)*ry;
    const g = el('g',{class:'leafg','data-leaf':leaf.id}, groupMain);
    g.style.setProperty('--brot', i);

    // bob wrapper: all visible leaf content + hit target sit here so the whole
    // leaf + label lifts together on a gentle idle bob (placement translate
    // stays on the outer g, so the arc is never disturbed).
    const bob = el('g',{class:'leafbob'}, g);

    // --- invisible hit target: generous circle covering the giant leaf + label ---
    const hit = el('circle',{cx:0,cy:70,r:70,class:'leafhit',fill:'rgba(0,0,0,0)'}, bob);

    // --- stem (drawn from branch node toward the leaf) ---
    el('path',{d:'M 0 0 C 2 14 4 26 0 40', class:'leafstem'}, bob);

    // --- leaf + midrib: GIANT so it fills the hit circle ---
    const rot = (rnd()*20-10 + i*5)*(i%2?-1:1);
    const lf = el('g',{class:'leafbody', transform:`translate(0 40) rotate(${rot})`}, bob);
    el('path',{
      d:'M 0 0 C -26 -22 -48 -36 -56 0 C -48 34 -26 20 0 0 Z',
      class:'leafshape', fill:'#86e25a', stroke:'#1d5c20','stroke-width':'3'
    }, lf);
    el('path',{d:'M -55 0 L 0 0', class:'midrib','stroke':'#17651b','stroke-width':'2.4','opacity':'0.5'}, lf);

    // subtle white ring, shown on hover
    el('ellipse',{cx:0,cy:40,rx:56,ry:60,class:'leafring',fill:'none'}, bob);

    // label
    const label = el('text',{class:'leaflabel','text-anchor':'middle',y:116,fill:'#ffffff'}, bob);
    label.textContent = leaf.name || leaf.id;

    g.setAttribute('transform',`translate(${px} ${py})`);

    g.addEventListener('click', ()=> openGate(leaf));
    g.addEventListener('mouseenter', ()=> g.classList.add('hov'));
    g.addEventListener('mouseleave', ()=> g.classList.remove('hov'));
    LEAVES_BY_NAME[leaf.id]=g;
    ok++;
  }

  svg.classList.add('grown');
  count.textContent = ok;
}

const TREE = (function(){
  // build the real root + terminals exactly like genTree does
  const svg = document.getElementById('trSvg');
  const inst = genTree();
  // terminals are filled by the walk referencing branch terminal recursion;
  // collectTree is defined below, but genTree built its own; here we rebuild from inst's nodes class tree.
  return inst;
})();

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
      // Static board pages for the leaves that have them; others fall back to
      // the locked leaf.html (which shows a lock prompt until a token proves in).
      const BOARD_PAGES = { shaker:'/shaker.html', athletics:'/athletics.html' };
      const dest = BOARD_PAGES[activeLeaf.id] || ('/leaf.html?leaf='+encodeURIComponent(activeLeaf.id));
      window.location.href = dest;
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