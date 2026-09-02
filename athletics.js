// A blank, standalone corkboard mirroring dshaker.space/kandan.
// No gate, no backend — everything persists to localStorage. Non-sensitive only.
const LS='elmtree_atheletics_board';
const COLORS=['','pink','blue','green','orange'];
let board=null, saveTimer=null, dirty=false;
function uid(p){return p+Math.random().toString(36).slice(2,9)}

const DEFAULT_COLS=[
  {id:uid('c'),title:'Backlog',cards:[]},
  {id:uid('c'),title:'Practice',cards:[]},
  {id:uid('c'),title:'Games',cards:[]},
  {id:uid('c'),title:'Done',cards:[]}
];

function defaultBoard(){return {columns:JSON.parse(JSON.stringify(DEFAULT_COLS)),scratch:''}}

function loadBoard(){
  try{ board = JSON.parse(localStorage.getItem(LS)) || defaultBoard(); }
  catch(e){ board = defaultBoard(); }
  if(!board.columns||!Array.isArray(board.columns)) board.columns=DEFAULT_COLS.slice();
  if(board.scratch===undefined) board.scratch='';
  document.getElementById('scratch').value=board.scratch||'';
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
    col.cards.forEach(cd=>cards.appendChild(cardEl(cd,col)));
    const empty=document.createElement('div'); empty.className='colempty';
    empty.style.display=col.cards.length?'none':'block'; empty.textContent='empty';
    const add=document.createElement('button'); add.className='addcard'; add.textContent='+ add card';
    add.onclick=()=>{col.cards.push({id:uid('k'),text:''});scheduleSave();render();};
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
  const dots=document.createElement('span'); dots.style.display='flex'; dots.style.gap='.25rem';
  COLORS.forEach(c=>{
    const d=document.createElement('button'); d.className='mini'; d.style.width='15px';d.style.height='15px';d.style.borderRadius='50%';
    d.style.border='1px solid rgba(0,0,0,.15)';
    d.style.background={x:'#fff3a3',pink:'#ffc9d8',blue:'#cfe5ff',green:'#d4f2c8',orange:'#ffe0b3'}[c];
    d.style.outline=(cd.color===c)?'2px solid #333':'';
    d.onclick=()=>{cd.color=c;scheduleSave();render();};
    dots.appendChild(d);
  });
  meta.append(dots);
  const del=document.createElement('button'); del.className='mini'; del.textContent='✕';
  del.onclick=()=>{col.cards=col.cards.filter(x=>x!==cd);scheduleSave();render();};
  meta.appendChild(del);
  div.append(ta,meta); return div;
}

document.getElementById('scratch').addEventListener('input',scheduleSave);
loadBoard();
