const $ = s => document.querySelector(s);
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
let state = {date:'',tasks:[],xp:0,streak:0,days:{},words:[],weight:'',notes:''};
let toastTimer;
function toast(msg){
  const el=$('#toast');el.textContent=msg;el.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),1800);
}
function escapeHTML(s){
  return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
async function persist(message='Saqlandi ✓'){
  try{
    const r=await fetch('/api/state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(state)});
    if(!r.ok)throw Error('save');
    $('#saveStatus').textContent=message;
  }catch(e){
    $('#saveStatus').textContent='Saqlashda xato. Server ishlayotganini tekshir.';
    toast('Saqlash amalga oshmadi');
  }
}
function render(){
  const tasks=state.tasks;
  const done=tasks.filter(t=>t.done).length;
  const pct=tasks.length?Math.round(done/tasks.length*100):0;
  $('#xp').textContent=state.xp;
  $('#percent').textContent=pct+'%';
  $('#streak').innerHTML=`${state.streak||0} <i>kun</i>`;
  const level=Math.floor(state.xp/100)+1;
  $('#level').textContent=String(level).padStart(2,'0');
  const ranks=['BEGINNER','DISCIPLINED','CONSISTENT','FOCUSED','STRONG MIND','ADVANCED','ELITE'];
  $('#rank').textContent=ranks[Math.min(level-1,ranks.length-1)];
  $('#ring').style.background=`radial-gradient(circle,#151b15 57%,transparent 59%),conic-gradient(var(--accent) ${(state.xp%100)*3.6}deg,#394333 0deg)`;
  $('#taskCount').textContent=`${done} / ${tasks.length}`;
  $('#progressBar').style.width=pct+'%';
  $('#taskList').innerHTML=tasks.map((t,i)=>`
    <div class="task ${t.done?'done':''}">
      <button class="check" data-toggle="${i}" aria-label="Vazifani belgilash">${t.done?'✓':''}</button>
      <span class="task-text">${escapeHTML(t.text)}</span>
      <span class="task-xp">${t.done?'+10':'10 XP'}</span>
      <button class="delete" data-delete="${i}" aria-label="O'chirish">×</button>
    </div>`).join('');
  $('#notes').value=state.notes||'';
  $('#weight').value=state.weight||'';
}
function addTask(text){
  text=text.trim();
  if(!text)return;
  if(state.tasks.some(t=>t.text.toLowerCase()===text.toLowerCase())){
    toast('Bu vazifa ro‘yxatda bor');return;
  }
  state.tasks.push({text,done:false});
  persist();render();toast('Vazifa qo‘shildi');
}
$('#taskForm').addEventListener('submit',e=>{
  e.preventDefault();addTask($('#taskInput').value);$('#taskInput').value='';
});
document.addEventListener('click',e=>{
  const toggle=e.target.closest('[data-toggle]');
  const del=e.target.closest('[data-delete]');
  const quick=e.target.closest('[data-add]');
  if(toggle){
    const t=state.tasks[Number(toggle.dataset.toggle)];
    if(t){
      t.done=!t.done;
      state.xp=Math.max(0,state.xp+(t.done?10:-10));
      render();persist();toast(t.done?'Vazifa tugallandi · +10 XP':'Vazifa qayta ochildi');
    }
  }
  if(del){
    state.tasks.splice(Number(del.dataset.delete),1);render();persist('Vazifa o‘chirildi');
  }
  if(quick)addTask(quick.dataset.add);
});
$('#saveNotes').addEventListener('click',()=>{
  state.notes=$('#notes').value;
  state.weight=$('#weight').value;
  persist('Hisoboting saqlandi ✓');toast('Hisobot saqlandi');
});
async function init(){
  const d=new Date();
  $('#today').textContent=d.toLocaleDateString('uz-UZ',{day:'numeric',month:'short',weekday:'short'}).toUpperCase();
  try{
    const r=await fetch('/api/state');
    if(r.ok){
      const saved=await r.json();
      state={...state,...saved};
    }
  }catch(e){}
  const day=today();
  if(state.date!==day){
    state.date=day;
    state.tasks=[];
    state.notes='';
    state.days=state.days||{};
    const defaults=[
      'Ertalabgi asosiy mavzuni chuqur o‘rganish',
      'Ingliz tilidan 10 ta so‘z yodlash',
      'O‘rgangan mavzuni kitobsiz tushuntirish',
      'Kechki takrorlashni bajarish',
      'Ertangi kun uchun reja tuzish'
    ];
    state.tasks=defaults.map(text=>({text,done:false}));
    await persist('Yangi kun tayyor ✓');
  }
  render();
}
init();
