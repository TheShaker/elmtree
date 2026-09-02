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
  size();
  // Debounced: no janky star re-scatter on every resize tick.
  let rto=null;
  window.addEventListener('resize',()=>{clearTimeout(rto);rto=setTimeout(()=>{size();makeStars();},150);});
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
  const planetCircle = el('circle',{cx:500,cy:930,r:200,fill:'url(#planetGrad)'}, planet);
  // planet surface speckle (crater-dots like the Mercury map vibe)
  for(let i=0;i<28;i++){
    const a=rnd()*Math.PI*2, rr=Math.sqrt(rnd())*200;
    const px=500+Math.cos(a)*rr*0.9, py=930+Math.sin(a)*rr*0.9;
    if(py>760) el('circle',{cx:px,cy:py,r:rnd()*3+1,fill:'rgba(0,40,15,'+(0.06+rnd()*0.1)+')'}, planet);
  }

  // trunk base (sits on the planet horizon)
  const origin = {x:500, y:738};

  // ---------- Canopy underlay: soft silhouette + a moderate scatter of leaves ----------
  // OPTIMIZATION: instead of ~95 tiny leaf-blobs (each in its own wrapper <g>),
  // we draw 3 blurred silhouette ellipses for the canopy MASS, then ~50 leaf
  // blobs with no wrapper (translate+rotate merged into one transform attr).
  // Wrapper <g>s are only created for the ~1-in-5 drifting leaves, since the
  // CSS fall animation needs a dedicated transform slot.
  const foliage = el('g',{id:'elmFoliage'}, svg);
  const cx=500, cy=255;                       // crown center (raised/wider)
  const blur = el('filter',{id:'softCanopy',x:'-30%',y:'-30%',width:'160%',height:'160%'}, defs);
  el('feGaussianBlur',{stdDeviation:26}, blur);
  const silG = el('g',{filter:'url(#softCanopy)'}, foliage);
  // fuller, natural (slightly asymmetric) canopy silhouette — larger to match dome
  [[-150,40,330,165,'#1e4d24'],[180,25,310,155,'#245c2b'],[20,-55,260,130,'#2e7a35']]
    .forEach(s=> el('ellipse',{cx:cx+s[0],cy:cy+s[1],rx:s[2],ry:s[3],fill:s[4],opacity:0.7}, silG));
  const canopyHerbs=['#3f9e43','#57b755','#2f7d34','#6ecf5a','#4caf50'];
  for(let i=0;i<66;i++){
    // elliptical crown: denser toward the middle, thinning at the edge
    let px,py,rr=Math.pow(rnd(),0.7);
    const ang=rnd()*Math.PI*2;
    // mostly fill the ellipse, some scatter outward near branch tips
    px=cx+Math.cos(ang)*(100+rnd()*200)*rr;
    py=cy+Math.sin(ang)*(70+rnd()*145)*rr;
    py=Math.min(650, Math.max(45,py));
    if(px<90||px>910) continue;
    const sz=rnd()*9+7;                       // slightly larger blobs, more of them
    const d=`M0 0 C ${-sz*0.6} ${-sz*0.5} ${-sz} ${-sz*0.3} ${-sz*0.5} 0 C 0 ${sz*0.45} ${sz*0.5} ${sz*0.2} 0 0 Z`;
    const fill=canopyHerbs[Math.floor(rnd()*canopyHerbs.length)];
    const op=(0.5+rnd()*0.3).toFixed(2);
    const rot=(rnd()*90-45).toFixed(0);
    if(rnd()<0.20){
      // drifting leaf: needs a wrapper <g> so the CSS transform animation
      // doesn't clobber the placement translate on the path itself.
      const grofWrap=el('g',{transform:`translate(${px.toFixed(1)} ${py.toFixed(1)})`}, foliage);
      const grof=el('path',{d,fill,opacity:op,transform:`rotate(${rot})`}, grofWrap);
      grof.classList.add('leaf-fall');
      grof.style.setProperty('--fx1', (rnd()*34-17).toFixed(0)+'px');
      grof.style.setProperty('--fy1', (30+rnd()*60).toFixed(0)+'px');
      grof.style.setProperty('--fr1', (rnd()*46-23).toFixed(0)+'deg');
      grof.style.setProperty('--fdur', (5.5+rnd()*5).toFixed(1)+'s');
      grof.style.setProperty('--fdel', (rnd()*4).toFixed(1)+'s');
      grof.style.setProperty('--fomax', (0.3+rnd()*0.22).toFixed(2));
    }else{
      el('path',{d,fill,opacity:op,transform:`translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${rot})`}, foliage);
    }
  }

  // branch defs
  const groupMain = el('g',{id:'elmMain'}, svg);
  const nodes = [];   // every branch endpoint (for canopy-tip leaves)

  // Curved tapered limb: a gentle seeded bow (quadratic control point) turns
  // the old straight polygons into organic sweeping branches. Endpoints stay
  // EXACT so the leaf-slot tips are untouched.
  function limb(x,y,x2,y2,width){
    nodes.push({x:x2,y:y2,depth:2,ang:Math.atan2(y2-y,x2-x)});
    const len=Math.hypot(x2-x,y2-y)||1;
    const dx=(x2-x)/len, dy=(y2-y)/len, px=-dy, py=dx;
    const w0=width, w1=Math.max(1,width*0.6);
    // perpendicular bow: up to ~4.5% of length, scaled up a touch on thick wood
    const bow=(rnd()*2-1)*len*0.045*(1+Math.min(1,width/30));
    const mx=(x+x2)/2+px*bow, my=(y+y2)/2+py*bow;
    el('path',{
      d:`M${x+px*w0} ${y+py*w0} Q${(mx+px*w0*0.75).toFixed(1)} ${(my+py*w0*0.75).toFixed(1)} ${x2+px*w1} ${y2+py*w1} L${x2-px*w1} ${y2-py*w1} Q${(mx-px*w0*0.75).toFixed(1)} ${(my-py*w0*0.75).toFixed(1)} ${x-px*w0} ${y-py*w0} Z`,
      fill:'url(#woodGrad)', stroke:'rgba(20,12,5,.6)','stroke-width':'0.8'
    }, groupMain);
    if(width>=8){
      // bark ridges merged into ONE compound path per limb (was N <path>s)
      let bark='';
      const steps=Math.max(2,Math.floor(len/22));
      for(let s=1;s<steps;s++){ const t=s/steps; const bx=x+(x2-x)*t, by=y+(y2-y)*t; const jag=rnd()*2.4*width-1.2*width;
        bark+=`M${(bx+jag).toFixed(1)} ${by.toFixed(1)} Q ${(bx+jag*0.4).toFixed(1)} ${(by+rnd()*6).toFixed(1)} ${(bx+jag).toFixed(1)} ${(by-1).toFixed(1)} `;
      }
      el('path',{d:bark,fill:'none',stroke:'rgba(20,12,5,.5)','stroke-width':Math.max(1,width*0.12),'stroke-linecap':'round'}, groupMain);
    }
    // single curved grain/highlight line, only on mid+ thick limbs
    if(width>=5){
      el('path',{d:`M${x} ${y} Q${mx.toFixed(1)} ${my.toFixed(1)} ${x2} ${y2}`,fill:'none',stroke:'rgba(255,240,210,.13)','stroke-width':Math.max(1,width*0.25),'stroke-linecap':'round'}, groupMain);
    }
  }

  // A curved twig for recursion.
  // OPTIMIZATION: hundreds of twigs shared one style each -> one <path> per
  // twig. They are now accumulated into per-width compound paths and flushed
  // once (see flushTwigs below), cutting the path count dramatically.
  const twigBatches = {};
  function twig(x,y,x2,y2,width){
    const w = (Math.max(1,Math.round(width*2)/2)).toFixed(1);
    (twigBatches[w] = twigBatches[w] || '');
    twigBatches[w] += `M${x.toFixed(1)} ${y.toFixed(1)} C ${(x+(x2-x)*0.5).toFixed(1)} ${(y+(y2-y)*0.4).toFixed(1)}, ${(x2-(x2-x)*0.2).toFixed(1)} ${(y2-(y2-y)*0.2).toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)} `;
  }
  function flushTwigs(){
    for(const w in twigBatches){
      el('path',{d:twigBatches[w],fill:'none',stroke:'#3a2615','stroke-width':w,'stroke-linecap':'round'}, groupMain);
    }
  }

  // ---------- Trunk: rises to the same crown anchor, now with a gentle bow ----------
  const crown={x:500, y:385};                 // trunk top (raised → larger tree)
  limb(origin.x, origin.y, crown.x, crown.y, 30);
  // bark knots: a couple of seeded elliptical whorls low on the trunk
  for(let k=0;k<2;k++){
    const ky=origin.y-60-rnd()*120, kx=500+(rnd()*2-1)*9;
    el('ellipse',{cx:kx.toFixed(1),cy:ky.toFixed(1),rx:(4+rnd()*3).toFixed(1),ry:(7+rnd()*5).toFixed(1),
      fill:'none',stroke:'rgba(20,12,5,.55)','stroke-width':'2','transform':`rotate(${(rnd()*30-15).toFixed(0)} ${kx.toFixed(1)} ${ky.toFixed(1)})`}, groupMain);
  }

  // ---------- Primary fan spanning the leaf slot pool ----------
  // A primary is grown from the crown out to each slot's leaf point (varied
  // heights), so every leaf sits at a branch tip and nothing protrudes past.
  // REALISM: each primary sprouts from a slightly jittered point near the crown
  // and its stations are individually re-timed, so the fan keeps its wide
  // spread but no longer reads as a hard mirror-symmetric machine fan.
  const prim=[];
  for(let i=0;i<SLOT_POOL.length;i++){
    const sl=SLOT_POOL[i];
    const sp=slotXY(sl);
    const tx=sp.x, ty=sp.y;
    prim.push({x:tx,y:ty,angle:sl.deg});
    const jx=crown.x+(rnd()*2-1)*12, jy=crown.y+(rnd()*2-1)*7;  // jittered sprout point
    // outward direction from the jittered crown to the leaf point
    const dir = Math.atan2(ty-jy, tx-jx);
    const L = Math.hypot(tx-jx, ty-jy);
    // thick trunk-stroke only reaches ~40% out; the outer portion thins as it
    // leaves (taper handled by the stations below)
    const bx = jx + Math.cos(dir)*L*0.40;
    const by = jy + Math.sin(dir)*L*0.40;
    limb(crown.x, crown.y, bx, by, 13);
    prim[i].base={x: jx + Math.cos(dir)*L*0.92, y: jy + Math.sin(dir)*L*0.92};
    prim[i].origin={x:jx,y:jy};
    prim[i].angle=sl.deg;
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
    const o=p.origin||crown;                  // jittered sprout point
    const dir = Math.atan2(b.y-o.y, b.x-o.x);
    const out=[];
    // Twigs at inner stations; branch thickness tapers outward so the giant
    // primary stems from the trunk get thinner as they fan out to the leaves.
    // Station positions are individually re-timed (±8%) per primary so the
    // sub-branching never mirrors between the two sides of the fan.
    const stations=[{t:0.30,w:12.5},{t:0.55,w:9},{t:0.80,w:6}]
      .map(st=>({t:st.t*(0.92+rnd()*0.16), w:st.w}));
    let carry={x:crown.x,y:crown.y};
    stations.forEach((st,si)=>{
      const sx=o.x+(b.x-o.x)*st.t;
      const sy=o.y+(b.y-o.y)*st.t;
      const segLen = Math.hypot(sx-carry.x, sy-carry.y)||1;
      const segDir = Math.atan2(sy-carry.y, sx-carry.x);
      // primary limb, thickness tapering outward
      limb(carry.x, carry.y, sx, sy, st.w);
      // a few twigs fanning sideways (inner clump only, near the trunk)
      if(si<2){
        const ntw=2+Math.floor(rnd()*2);      // 2-3 twigs, varied per station
        for(let k=0;k<ntw;k++){
          const a=segDir + (rnd()*1.1-0.55);
          const tl = segLen*(0.45+rnd()*0.4);
          out.push(branch(sx,sy, tl, a, 2, 3));
        }
      }
      carry={x:sx,y:sy};
    });
    // finish the clean thin outer limb out to the leaf arc point (no crown)
    limb(carry.x, carry.y, b.x, b.y, 4);
    return {itemsTree: out, x:b.x, y:b.y};
  })};

  // flush all batched twig strokes now — after the limbs (so twig start-caps
  // sit naturally on the bark) but before the portal leaves are placed.
  flushTwigs();

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

// Shared leaf-slot pool: one slot per leaf, spread across a symmetric top dome.
// Each slot has an angle AND a height factor, so leaves land at different
// heights for a dynamic canopy while staying centered + branch-touched.
const SLOT_POOL = [
  { deg:-75, h:0.72 },
  { deg:-52, h:0.98 },
  { deg:-29, h:0.82 },
  { deg:-8,  h:0.98 },
  { deg: 8,  h:0.84 },
  { deg: 29, h:0.95 },
  { deg: 52, h:0.78 },
  { deg: 75, h:0.9  },
];
const DOME={ cx:500, cy:315, rx:400, ry:255 };
function slotXY(s){
  const r=s.deg*Math.PI/180;
  return { x:DOME.cx + Math.sin(r)*DOME.rx, y:DOME.cy - Math.cos(r)*DOME.ry*s.h };
}

function loadLeaves(){
  fetch('/api/leaves').then(r=>r.json()).then(json=>{
    const leaves = (json && json.leaves) || window.ELM_LEAVES || [];
    placeLeaves(leaves);
  }).catch(()=>{ placeLeaves(window.ELM_LEAVES || []); });
}

function placeLeaves(leaves){
  const {svg, groupMain} = TREE;
  if(!leaves || !leaves.length){ svg.classList.add('grown'); return; }

  // Place each portal leaf at its shared slot point (angle + varied height).
  let ok=0;
  const N = Math.min(leaves.length, SLOT_POOL.length);
  for(let i=0;i<N;i++){
    const leaf=leaves[i];
    if(!leaf || !leaf.id) continue;
    const sp=slotXY(SLOT_POOL[i]||SLOT_POOL[SLOT_POOL.length-1]);
    const px=sp.x, py=sp.y;
    const g = el('g',{class:'leafg','data-leaf':leaf.id}, groupMain);
    g.style.setProperty('--brot', i);

    // bob wrapper: all visible leaf content + hit target sit here so the whole
    // leaf + label lifts together on a gentle idle bob (placement translate
    // stays on the outer g, so the arc is never disturbed).
    const bob = el('g',{class:'leafbob'}, g);

    // --- invisible hit target: generous circle covering leaf + icon ---
    const hit = el('circle',{cx:0,cy:40,r:78,class:'leafhit',fill:'rgba(0,0,0,0)'}, bob);

    // --- stem (from branch tip down to the leaf) ---
    el('path',{d:'M 0 0 C 1 8 2 16 0 26', class:'leafstem'}, bob);

    // --- leaf + midrib: giant leaf, stem attaches to the far pointed tip ---
    // REALISM: each portal leaf varies in size, green shade, and orientation.
    // Orientation is fully randomized (seeded rnd → randomizes on every refresh)
    // and decoupled from the slot index so leaves point every which way.
    const LEAF_TINTS=['#86e25a','#79d84f','#93ea6a','#6fd044','#8ae662'];
    const rot = (rnd()*150-75).toFixed(1);     // -75..+75 deg, fully random per leaf
    const scl = (0.88+rnd()*0.26).toFixed(2);
    const lf = el('g',{class:'leafbody', transform:`translate(56 26) rotate(${rot}) scale(${scl})`}, bob);
    el('path',{
      d:'M 0 0 C -26 -22 -48 -36 -56 0 C -48 34 -26 20 0 0 Z',
      class:'leafshape', fill:LEAF_TINTS[Math.floor(rnd()*LEAF_TINTS.length)], stroke:'#1d5c20','stroke-width':'3'
    }, lf);
    el('path',{d:'M -55 0 L 0 0', class:'midrib','stroke':'#17651b','stroke-width':'2.4','opacity':'0.5'}, lf);

    // subtle white ring, shown on hover
    el('ellipse',{cx:0,cy:26,rx:60,ry:62,class:'leafring',fill:'none'}, bob);

    // emoji icon: hovers ABOVE the branch tip (negative y = above anchor)
    const label = el('text',{class:'leaflabel','text-anchor':'middle',y:-22,fill:'#ffffff'}, bob);
    label.textContent = leaf.name || leaf.id;

    g.setAttribute('transform',`translate(${px} ${py})`);

    g.addEventListener('click', ()=> openGate(leaf));
    g.addEventListener('mouseenter', ()=> g.classList.add('hov'));
    g.addEventListener('mouseleave', ()=> g.classList.remove('hov'));
    LEAVES_BY_NAME[leaf.id]=g;
    ok++;
  }

  svg.classList.add('grown');
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