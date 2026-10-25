const $ = s => document.querySelector(s);

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

let state = {
  date: '',
  tasks: [],
  xp: 0,
  streak: 0,
  days: {},
  words: [],
  weight: '',
  notes: '',
  dayXp: 0
};

let toastTimer;

function toast(msg) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[c]));
}

function getDoneCount(tasks = state.tasks) {
  return tasks.filter(t => t.done).length;
}

function taskXP(text) {
  const s = String(text).toLowerCase();

  if (/45 daqiqa.*(stomatolog|o'qish|o‘qish|diqqat)/.test(s)) return 15;
  if (/jismoniy mashg|mashq|turnik|sakrash/.test(s)) return 15;
  if (/ingliz.*10 ta so'z|ingliz.*10 ta so‘/.test(s)) return 10;

  return 10;
}

function ensureDays() {
  if (!state.days || typeof state.days !== 'object' || Array.isArray(state.days)) {
    state.days = {};
  }
}

function archiveCurrentDay() {
  if (!state.date) return;

  ensureDays();

  const tasks = Array.isArray(state.tasks) ? state.tasks : [];
  const done = getDoneCount(tasks);

  state.days[state.date] = {
    tasks: tasks.map(t => ({ text: String(t.text), done: Boolean(t.done) })),
    done,
    total: tasks.length,
    xpEarned: Number.isFinite(Number(state.dayXp))
      ? Number(state.dayXp)
      : done * 10,
    notes: state.notes || '',
    weight: state.weight || ''
  };
}

function calculateStreak() {
  ensureDays();

  const active = date => {
    const d = state.days[date];
    return Boolean(d && Number(d.done) > 0);
  };

  let cursor = new Date(today() + 'T12:00:00');
  if (!active(today())) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let count = 0;

  for (let i = 0; i < 366; i++) {
    const key = [
      cursor.getFullYear(),
      String(cursor.getMonth() + 1).padStart(2, '0'),
      String(cursor.getDate()).padStart(2, '0')
    ].join('-');

    if (!active(key)) break;

    count++;
    cursor.setDate(cursor.getDate() - 1);
  }

  state.streak = count;
}

async function persist(message = 'Saqlandi ✓') {
  try {
    archiveCurrentDay();
    calculateStreak();

    const r = await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    });

    if (!r.ok) throw Error('save');

    const el = $('#saveStatus');
    if (el) el.textContent = message;
  } catch (e) {
    const el = $('#saveStatus');
    if (el) el.textContent = 'Saqlashda xato. Serverni tekshir.';
    toast('Saqlash amalga oshmadi');
  }
}

function getLastSevenDays() {
  ensureDays();

  const list = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today() + 'T12:00:00');
    d.setDate(d.getDate() - i);

    const key = [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0')
    ].join('-');

    let record = state.days[key];

    // Bugungi natija eng yangi joriy vazifalardan olinadi.
    if (key === state.date) {
      const done = getDoneCount();
      record = {
        done,
        total: state.tasks.length,
        xpEarned: Number(state.dayXp) || 0
      };
    }

    list.push({
      key,
      label: d.toLocaleDateString('uz-UZ', { weekday: 'short' }),
      done: record ? Number(record.done) || 0 : 0,
      total: record ? Number(record.total) || 0 : 0,
      xp: record ? Number(record.xpEarned) || 0 : 0
    });
  }

  return list;
}

function renderWeeklyStats() {
  const records = getLastSevenDays();

  const completed = records.reduce((n, d) => n + d.done, 0);
  const total = records.reduce((n, d) => n + d.total, 0);
  const xp = records.reduce((n, d) => n + d.xp, 0);
  const activeDays = records.filter(d => d.done > 0).length;
  const percent = total ? Math.round(completed / total * 100) : 0;

  let panel = $('#weeklyStats');

  if (!panel) {
    const taskList = $('#taskList');
    if (!taskList) return;

    panel = document.createElement('section');
    panel.id = 'weeklyStats';
    panel.className = 'weekly-stats';
    taskList.insertAdjacentElement('beforebegin', panel);
  }

  panel.innerHTML = `
    <div class="weekly-heading">
      <div>
        <span class="weekly-kicker">YOUR PROGRESS</span>
        <h3>Haftalik natijalar</h3>
      </div>
      <span class="weekly-badge">${activeDays}/7 kun</span>
    </div>

    <div class="weekly-metrics">
      <div class="weekly-metric">
        <span>Bajarilgan</span>
        <strong>${completed}</strong>
        <small>ta vazifa</small>
      </div>
      <div class="weekly-metric">
        <span>Yig‘ilgan</span>
        <strong>${xp}</strong>
        <small>XP</small>
      </div>
      <div class="weekly-metric">
        <span>Natija</span>
        <strong>${percent}%</strong>
        <small>bajarilish</small>
      </div>
    </div>

    <div class="week-bars">
      ${records.map(d => {
        const height = d.total ? Math.max(5, Math.round(d.done / d.total * 100)) : 3;
        return `
          <div class="week-day" title="${d.key}: ${d.done}/${d.total} vazifa">
            <div class="week-bar-track">
              <div class="week-bar-fill" style="height:${height}%"></div>
            </div>
            <span>${escapeHTML(d.label)}</span>
          </div>`;
      }).join('')}
    </div>

    <p class="weekly-footnote">
      Tarix bugundan boshlab yig‘iladi. Oldingi kunlar uchun mavjud bo‘lmagan statistikani qayta tiklab bo‘lmaydi.
    </p>
  `;
}

function render() {
  const tasks = state.tasks;
  const done = getDoneCount();
  const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;

  $('#xp').textContent = state.xp;
  $('#percent').textContent = pct + '%';
  $('#streak').innerHTML = `${state.streak || 0} <i>kun</i>`;

  const level = Math.floor(state.xp / 100) + 1;
  $('#level').textContent = String(level).padStart(2, '0');

  const ranks = [
    'BEGINNER', 'DISCIPLINED', 'CONSISTENT',
    'FOCUSED', 'STRONG MIND', 'ADVANCED', 'ELITE'
  ];

  $('#rank').textContent = ranks[Math.min(level - 1, ranks.length - 1)];
  $('#ring').style.background =
    `radial-gradient(circle,#151b15 57%,transparent 59%),conic-gradient(var(--accent) ${(state.xp % 100) * 3.6}deg,#394333 0deg)`;

  $('#taskCount').textContent = `${done} / ${tasks.length}`;
  $('#progressBar').style.width = pct + '%';

  $('#taskList').innerHTML = tasks.map((t, i) => `
    <div class="task ${t.done ? 'done' : ''}">
      <button class="check" data-toggle="${i}" aria-label="Vazifani belgilash">${t.done ? '✓' : ''}</button>
      <span class="task-text">${escapeHTML(t.text)}</span>
      <span class="task-xp">${t.done ? '+' + (t.xpValue || taskXP(t.text)) : (t.xpValue || taskXP(t.text)) + ' XP'}</span>
      <button class="delete" data-delete="${i}" aria-label="O‘chirish">×</button>
    </div>
  `).join('');

  $('#notes').value = state.notes || '';
  $('#weight').value = state.weight || '';

  renderWeeklyStats();
}

function addTask(text) {
  text = text.trim();
  if (!text) return;

  if (state.tasks.some(t => t.text.toLowerCase() === text.toLowerCase())) {
    toast('Bu vazifa ro‘yxatda bor');
    return;
  }

  state.tasks.push({
    text,
    done: false,
    xpValue: taskXP(text),
    xpClaimed: false
  });
  render();
  persist();
  toast('Vazifa qo‘shildi');
}

$('#taskForm').addEventListener('submit', e => {
  e.preventDefault();
  addTask($('#taskInput').value);
  $('#taskInput').value = '';
});

document.addEventListener('click', e => {
  const toggle = e.target.closest('[data-toggle]');
  const del = e.target.closest('[data-delete]');
  const quick = e.target.closest('[data-add]');

  if (toggle) {
    const t = state.tasks[Number(toggle.dataset.toggle)];

    if (t) {
      const wasDone = t.done;
      const value = Number(t.xpValue) || taskXP(t.text);

      t.xpValue = value;
      t.done = !wasDone;

      let earned = 0;

      // Har bir vazifa uchun XP faqat bir marta beriladi.
      if (t.done && !t.xpClaimed) {
        t.xpClaimed = true;
        state.xp = Math.max(0, Number(state.xp) || 0) + value;
        state.dayXp = Math.max(0, Number(state.dayXp) || 0) + value;
        earned += value;
      }

      // Kunlik bonus faqat bir marta beriladi.
      if (
        state.tasks.length > 0 &&
        state.tasks.every(task => task.done) &&
        !state.dailyBonusClaimed
      ) {
        state.dailyBonusClaimed = true;
        state.xp = Math.max(0, Number(state.xp) || 0) + 20;
        state.dayXp = Math.max(0, Number(state.dayXp) || 0) + 20;
        earned += 20;
      }

      render();
      persist();

      if (earned > 0) {
        toast('Vazifa bajarildi · +' + earned + ' XP');
      } else if (!t.done) {
        toast('Vazifa qayta ochildi');
      } else {
        toast('Bu vazifa uchun XP oldin berilgan');
      }
    }
  }

  if (del) {
    state.tasks.splice(Number(del.dataset.delete), 1);
    render();
    persist('Vazifa o‘chirildi');
  }

  if (quick) addTask(quick.dataset.add);
});

$('#saveNotes').addEventListener('click', () => {
  state.notes = $('#notes').value;
  state.weight = $('#weight').value;
  render();
  persist('Hisoboting saqlandi ✓');
  toast('Hisobot saqlandi');
});

async function init() {
  const d = new Date();

  $('#today').textContent = d.toLocaleDateString('uz-UZ', {
    day: 'numeric',
    month: 'short',
    weekday: 'short'
  }).toUpperCase();

  try {
    const r = await fetch('/api/state');

    if (r.ok) {
      const saved = await r.json();
      state = { ...state, ...saved };
    }
  } catch (e) {
    toast('Server bilan bog‘lanib bo‘lmadi');
  }

  ensureDays();

  // Eski ma'lumotlarni yangi XP maydonlariga moslashtirish.
  // Avvalgi XP kamaytirilmaydi va qayta berilmaydi.
  state.tasks = (Array.isArray(state.tasks) ? state.tasks : []).map(t => {
    const task = { ...t };
    task.xpValue = Number(task.xpValue) || taskXP(task.text || '');
    if (task.xpClaimed === undefined) {
      task.xpClaimed = Boolean(task.done);
    }
    return task;
  });

  const day = today();

  if (state.date !== day) {
    // Eski kunni yangi kun boshlanishidan oldin tarixga yozamiz.
    archiveCurrentDay();

    state.date = day;
    state.tasks = [
      'Ertalabgi asosiy mavzuni chuqur o‘rganish',
      'Ingliz tilidan 10 ta so‘z yodlash',
      'O‘rgangan mavzuni kitobsiz tushuntirish',
      'Kechki takrorlashni bajarish',
      'Ertangi kun uchun reja tuzish'
    ].map(text => ({ text, done: false }));

    state.dayXp = 0;
    state.dailyBonusClaimed = false;
    state.notes = '';
  } else if (!Number.isFinite(Number(state.dayXp))) {
    state.dayXp = getDoneCount() * 10;
  }

  archiveCurrentDay();
  calculateStreak();
  render();
  await persist('Ma’lumotlar saqlandi ✓');
}

init();
