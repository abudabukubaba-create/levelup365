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
  dayXp: 0,
  dayFinalized: null,
  dailyGoalXP: 100
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

function calculateDailyXP() {
  const tasks = Array.isArray(state.tasks) ? state.tasks : [];
  const earned = tasks.reduce((sum, task) => {
    return sum + (task.done ? (Number(task.xpValue) || taskXP(task.text)) : 0);
  }, 0);

  const bonus = tasks.length > 0 && tasks.every(task => task.done) ? 20 : 0;
  return earned + bonus;
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
    xpEarned: state.dayFinalized
      ? (Number(state.dayXp) || 0)
      : calculateDailyXP(),
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



function renderAdvancedStats() {
  const panelId = 'advancedStats';
  let panel = document.getElementById(panelId);

  if (!panel) {
    panel = document.createElement('section');
    panel.id = panelId;
    panel.className = 'advanced-stats';
    const weekly = document.getElementById('weeklyStats');
    if (weekly) weekly.insertAdjacentElement('afterend', panel);
    else {
      const taskList = document.getElementById('taskList');
      if (!taskList) return;
      taskList.insertAdjacentElement('beforebegin', panel);
    }
  }

  const dateKey = d => [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0')
  ].join('-');

  const currentDate = state.date || dateKey(new Date());

  function readDay(key) {
    if (key === currentDate) {
      const tasks = Array.isArray(state.tasks) ? state.tasks : [];
      const done = tasks.filter(t => t.done).length;
      return {
        done,
        total: tasks.length,
        xp: Number(state.dayFinalized ? state.dayXp : calculateDailyXP()) || 0
      };
    }

    const r = state.days && state.days[key];
    if (!r) return null;
    return {
      done: Math.max(0, Number(r.done) || 0),
      total: Math.max(0, Number(r.total) || 0),
      xp: Math.max(0, Number(r.xpEarned) || 0)
    };
  }

  const last30 = [];
  const todayDate = new Date(currentDate + 'T12:00:00');

  for (let i = 29; i >= 0; i--) {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - i);
    const key = dateKey(d);
    const record = readDay(key);

    last30.push({
      key,
      label: String(d.getDate()),
      xp: record ? record.xp : 0,
      done: record ? record.done : 0,
      total: record ? record.total : 0,
      exists: Boolean(record)
    });
  }

  const xp30 = last30.reduce((sum, d) => sum + d.xp, 0);
  const done30 = last30.reduce((sum, d) => sum + d.done, 0);
  const total30 = last30.reduce((sum, d) => sum + d.total, 0);
  const efficiency = total30 ? Math.round(done30 / total30 * 100) : 0;

  const recordedDays = Object.keys(state.days || {});
  if (!recordedDays.includes(currentDate)) recordedDays.push(currentDate);

  let bestDay = null;
  const allDays = recordedDays.map(key => {
    const r = readDay(key);
    return { key, ...(r || { done: 0, total: 0, xp: 0 }) };
  }).sort((a, b) => a.key.localeCompare(b.key));

  for (const d of allDays) {
    if (d.xp > 0 && (!bestDay || d.xp > bestDay.xp)) bestDay = d;
  }

  let longestStreak = 0;
  let streak = 0;
  let previousDate = null;

  for (const d of allDays) {
    const active = d.done > 0;
    if (!active) {
      streak = 0;
      previousDate = null;
      continue;
    }

    const date = new Date(d.key + 'T12:00:00');
    if (previousDate) {
      const gap = Math.round((date - previousDate) / 86400000);
      streak = gap === 1 ? streak + 1 : 1;
    } else {
      streak = 1;
    }

    previousDate = date;
    longestStreak = Math.max(longestStreak, streak);
  }

  const maxBar = Math.max(1, ...last30.map(d => d.xp));

  panel.innerHTML = `
    <div class="advanced-heading">
      <div>
        <span class="weekly-kicker">DEEP PROGRESS</span>
        <h3>30 kunlik tahlil</h3>
      </div>
      <span class="weekly-badge">30 KUN</span>
    </div>

    <div class="advanced-metrics">
      <div class="advanced-metric">
        <span>Yig‘ilgan XP</span>
        <strong>${xp30}</strong>
        <small>oxirgi 30 kun</small>
      </div>
      <div class="advanced-metric">
        <span>Samaradorlik</span>
        <strong>${efficiency}%</strong>
        <small>${done30}/${total30} vazifa</small>
      </div>
      <div class="advanced-metric">
        <span>Eng uzun streak</span>
        <strong>${longestStreak}</strong>
        <small>kunlik rekord</small>
      </div>
    </div>

    <div class="advanced-chart-title">
      <strong>Kunlik XP</strong>
      <span>Oxirgi 30 kun</span>
    </div>
    <div class="month-bars">
      ${last30.map(d => {
        const height = d.xp > 0 ? Math.max(5, Math.round(d.xp / maxBar * 100)) : 2;
        return `
          <div class="month-day ${d.xp > 0 ? 'has-xp' : ''}"
               title="${d.key}: ${d.xp} XP">
            <div class="month-bar-track">
              <div class="month-bar-fill" style="height:${height}%"></div>
            </div>
            <span>${d.label}</span>
          </div>`;
      }).join('')}
    </div>

    <div class="record-card">
      <span class="record-icon">🏆</span>
      <div>
        <small>ENG YUQORI KUNLIK XP</small>
        <strong>${bestDay ? bestDay.xp + ' XP' : 'Hali rekord yo‘q'}</strong>
        <p>${bestDay ? bestDay.key : 'Vazifalarni bajarishni boshlagin.'}</p>
      </div>
    </div>

    <p class="advanced-note">
      Hisobot mavjud kunlik tarix asosida hisoblanadi.
      Saqlanmagan eski kunlar statistikaga kiritilmaydi.
    </p>
  `;
}

let calendarViewDate = new Date();
let selectedCalendarDate = '';

function calendarDateKey(d) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0')
  ].join('-');
}

function calendarRecord(key) {
  if (key === state.date) {
    const tasks = Array.isArray(state.tasks) ? state.tasks : [];
    return {
      tasks: tasks.map(t => ({
        text: String(t.text || ''),
        done: Boolean(t.done)
      })),
      done: getDoneCount(tasks),
      total: tasks.length,
      xpEarned: state.dayFinalized
        ? (Number(state.dayXp) || 0)
        : calculateDailyXP()
    };
  }
  return state.days && state.days[key] ? state.days[key] : null;
}

function renderCalendar() {
  const grid = document.querySelector('#calendarGrid');
  const label = document.querySelector('#calendarMonthLabel');
  const detail = document.querySelector('#calendarDetail');
  if (!grid || !label || !detail) return;

  if (!selectedCalendarDate) selectedCalendarDate = state.date || today();

  const year = calendarViewDate.getFullYear();
  const month = calendarViewDate.getMonth();

  label.textContent = calendarViewDate.toLocaleDateString('uz-UZ', {
    month: 'long',
    year: 'numeric'
  });

  const first = new Date(year, month, 1, 12);
  const offset = (first.getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  let cells = '';

  for (let i = 0; i < offset; i++) {
    cells += '<span class="calendar-empty"></span>';
  }

  for (let day = 1; day <= count; day++) {
    const key = calendarDateKey(new Date(year, month, day, 12));
    const record = calendarRecord(key);
    const done = record ? Number(record.done) || 0 : 0;
    const total = record ? Number(record.total) || 0 : 0;
    let classes = 'calendar-day';

    if (done > 0) classes += ' has-activity';
    if (total > 0 && done >= total) classes += ' all-done';
    if (key === selectedCalendarDate) classes += ' selected';
    if (key === (state.date || today())) classes += ' is-today';

    cells += `<button type="button" class="${classes}"
      data-calendar-day="${key}">${day}</button>`;
  }

  grid.innerHTML = cells;

  const record = calendarRecord(selectedCalendarDate);
  const readable = new Date(selectedCalendarDate + 'T12:00:00')
    .toLocaleDateString('uz-UZ', {
      day: 'numeric', month: 'long', year: 'numeric'
    });

  if (!record) {
    detail.innerHTML =
      `<strong>${readable}</strong>
       <p>Bu kun uchun saqlangan natija topilmadi.</p>`;
    return;
  }

  const tasks = Array.isArray(record.tasks) ? record.tasks : [];
  const done = Number(record.done) || 0;
  const total = Number(record.total) || tasks.length;
  const xp = Number(record.xpEarned) || 0;

  const taskHTML = tasks.map(t =>
    `<li class="${t.done ? 'task-is-done' : ''}">
      ${t.done ? '✓' : '○'} ${escapeHTML(t.text || 'Vazifa')}
    </li>`
  ).join('');

  detail.innerHTML = `
    <div class="calendar-detail-head">
      <strong>${readable}</strong>
      <span class="calendar-xp">+${xp} XP</span>
    </div>
    <p>${done}/${total} vazifa bajarilgan ·
      ${total ? Math.round(done / total * 100) : 0}%</p>
    <ul class="calendar-task-list">${taskHTML}</ul>`;
}

document.addEventListener('click', e => {
  if (e.target.closest('#calendarPrev')) {
    calendarViewDate = new Date(
      calendarViewDate.getFullYear(),
      calendarViewDate.getMonth() - 1, 1, 12
    );
    renderCalendar();
  } else if (e.target.closest('#calendarNext')) {
    calendarViewDate = new Date(
      calendarViewDate.getFullYear(),
      calendarViewDate.getMonth() + 1, 1, 12
    );
    renderCalendar();
  } else {
    const day = e.target.closest('[data-calendar-day]');
    if (day) {
      selectedCalendarDate = day.dataset.calendarDay;
      renderCalendar();
    }
  }
});

function render() {
  const tasks = state.tasks;
  const done = getDoneCount();
  const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;

  $('#xp').textContent = state.xp;
  $('#dayXp').textContent = Number(state.dayXp) || 0;

  const goal = Math.max(1, Number(state.dailyGoalXP) || 100);
  const earnedToday = Math.max(0, Number(state.dayXp) || 0);
  const goalPercent = Math.min(100, Math.round(earnedToday / goal * 100));

  $('#goalProgress').textContent = goalPercent;
  $('#goalBar').style.width = goalPercent + '%';
  $('#goalLabel').textContent =
    `Maqsad: ${goal} XP · ${Math.min(earnedToday, goal)} / ${goal} XP`;
  $('#finalizeDay').disabled = Boolean(state.dayFinalized);
  $('#finalizeDay').textContent = state.dayFinalized
    ? 'Kun yakunlandi ✓'
    : 'Kunni yakunlash ✓';
  $('#dayFinalizeStatus').textContent = state.dayFinalized
    ? 'Natija saqlandi. Vazifalar yopildi.'
    : 'XP kun yakunlanganda jami hisobga qo‘shiladi.';
  $('#percent').textContent = pct + '%';
  $('#streak').innerHTML = `${state.streak || 0} <i>kun</i>`;

  const totalXP = Math.max(0, Number(state.xp) || 0);
  let level = 1;

  while (
    level < 100 &&
    totalXP >= (100 * level * (level + 1)) / 2
  ) {
    level++;
  }

  const levelStartXP = (100 * (level - 1) * level) / 2;
  const neededXP = level < 100 ? 100 * level : 0;
  const nextLevelXP = level < 100
    ? levelStartXP + neededXP
    : levelStartXP;

  const levelProgressPct = level < 100
    ? Math.min(100, Math.max(0,
        Math.floor((totalXP - levelStartXP) / neededXP * 100)))
    : 100;

  $('#level').textContent = String(level).padStart(2, '0');

  const ranks = [
    { max: 5, name: 'BEGINNER' },
    { max: 10, name: 'DISCIPLINED' },
    { max: 20, name: 'CONSISTENT' },
    { max: 35, name: 'FOCUSED' },
    { max: 50, name: 'STRONG MIND' },
    { max: 75, name: 'ADVANCED' },
    { max: 100, name: 'ELITE' }
  ];

  $('#rank').textContent =
    ranks.find(rank => level <= rank.max).name;

  $('#ring').style.background =
    `radial-gradient(circle,#151b15 57%,transparent 59%),conic-gradient(var(--accent) ${levelProgressPct * 3.6}deg,#394333 0deg)`;

  $('#levelProgressTitle').textContent = level < 100
    ? `LEVEL ${String(level + 1).padStart(2, '0')} GA YO'L`
    : 'MAX LEVEL';

  $('#levelProgressPct').textContent = `${levelProgressPct}%`;
  $('#levelProgressBar').style.width = `${levelProgressPct}%`;

  $('#levelProgressText').textContent = level < 100
    ? `${totalXP - levelStartXP} / ${neededXP} XP · Yana ${Math.max(0, nextLevelXP - totalXP)} XP kerak`
    : `ELITE BOSQICHI · ${totalXP} XP`;

  $('#taskCount').textContent = `${done} / ${tasks.length}`;
  $('#progressBar').style.width = pct + '%';

  $('#taskList').innerHTML = tasks.map((t, i) => `
    <div class="task ${t.done ? 'done' : ''}">
      <button class="check" data-toggle="${i}" aria-label="Vazifani belgilash">${t.done ? '✓' : ''}</button>
      <span class="task-text">${escapeHTML(t.text)}</span>
      <span class="task-xp">${t.done ? '+' + (t.xpValue || taskXP(t.text)) : (t.xpValue || taskXP(t.text)) + ' XP'}</span>
      <button class="edit-task" data-edit="${i}" aria-label="Tahrirlash">✎</button>
      <button class="delete" data-delete="${i}" aria-label="O‘chirish">×</button>
    </div>
  `).join('');

  $('#notes').value = state.notes || '';
  $('#weight').value = state.weight || '';

  renderWeeklyStats();
  renderAdvancedStats();
  renderCalendar();
  organizeStatsSections();
}

function addTask(text) {
  if (state.dayFinalized) {
    toast('Kun yakunlangan. Yangi kunni kuting.');
    return;
  }

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
  const edit = e.target.closest('[data-edit]');
  const quick = e.target.closest('[data-add]');
  const finalize = e.target.closest('#finalizeDay');

  if (finalize) {
    if (state.dayFinalized) {
      toast('Bu kun avval yakunlangan');
      return;
    }

    state.dayXp = calculateDailyXP();
    state.xp = Math.max(0, Number(state.xp) || 0) + state.dayXp;
    state.dayFinalized = true;

    render();
    persist('Kun natijasi saqlandi ✓');
    toast('Kun yakunlandi · +' + state.dayXp + ' XP');
    return;
  }

  if ((toggle || del || edit || quick) && state.dayFinalized) {
    toast('Kun yakunlangan. Vazifalar yopildi.');
    return;
  }

  if (edit) {
    const index = Number(edit.dataset.edit);
    const task = state.tasks[index];

    if (!task) return;

    const newText = prompt("Vazifa nomi:", task.text);
    if (newText === null) return;

    const text = newText.trim();
    if (!text) {
      toast("Vazifa nomi bo‘sh bo‘lmasin");
      return;
    }

    const duplicate = state.tasks.some((t, i) =>
      i !== index && t.text.toLowerCase() === text.toLowerCase()
    );

    if (duplicate) {
      toast("Bunday vazifa ro‘yxatda bor");
      return;
    }

    const currentXP = Number(task.xpValue) || taskXP(task.text);
    const answer = prompt("Vazifa XP miqdori:", String(currentXP));

    if (answer === null) return;

    const xp = Number(answer);
    if (!Number.isFinite(xp) || xp < 1 || xp > 1000) {
      toast("XP 1 dan 1000 gacha bo‘lishi kerak");
      return;
    }

    task.text = text;
    task.xpValue = Math.round(xp);

    state.dayXp = calculateDailyXP();
    render();
    persist("Vazifa yangilandi ✓");
    toast("Vazifa tahrirlandi");
    return;
  }

  if (toggle) {
    const t = state.tasks[Number(toggle.dataset.toggle)];

    if (t) {
      t.done = !t.done;
      state.dayXp = calculateDailyXP();

      render();
      persist();

      toast(t.done ? 'Vazifa bajarildi' : 'Vazifa qayta ochildi');
    }
  }

  if (del) {
    state.tasks.splice(Number(del.dataset.delete), 1);
    state.dayXp = calculateDailyXP();
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

function dailyTasksFor(dateString) {
  const plans = [
    [
      'Gistologiyadan bir mavzuni chuqur o‘rganish',
      'Ingliz tilidan 10 ta so‘z yodlash',
      'O‘rgangan mavzuni kitobsiz tushuntirish',
      '30 daqiqa jismoniy mashq bajarish',
      'Bugungi mavzudan 10 ta test ishlash'
    ],
    [
      'Anatomiyadan bir mavzuni takrorlash',
      'Ingliz tilidan 10 ta so‘z yodlash',
      'O‘tgan mavzudan 5 ta savolga javob berish',
      'Stomatologiyaga oid 20 daqiqa material o‘rganish',
      'Ertangi dars uchun kerakli narsalarni tayyorlash'
    ],
    [
      'Fiziologiyadan bir mavzuni tushunib o‘rganish',
      'Ingliz tilidan 10 ta so‘z yodlash',
      'Mavzuning qisqa konspektini yozish',
      '30 daqiqa jismoniy mashq bajarish',
      'Bugungi bilimni 10 daqiqa takrorlash'
    ],
    [
      'Biokimyodan bir mavzuni o‘rganish',
      'Ingliz tilidan 10 ta so‘z yodlash',
      'Kitobni yopib, mavzuni ovoz chiqarib tushuntirish',
      'Oldingi mavzudan 10 ta test ishlash',
      'Kun davomida o‘rgangan 3 ta muhim narsani yozish'
    ],
    [
      'Og‘iz bo‘shlig‘i anatomiyasini takrorlash',
      'Ingliz tilidan 10 ta so‘z yodlash',
      'Gistologiyadan rasmlar orqali o‘zini tekshirish',
      '30 daqiqa jismoniy mashq bajarish',
      'Keyingi hafta uchun o‘qish rejasini tuzish'
    ],
    [
      'Eng qiyin fan bo‘yicha 45 daqiqa shug‘ullanish',
      'Ingliz tilidan 10 ta so‘z yodlash',
      'Hafta davomida o‘rgangan mavzularni takrorlash',
      'Stomatologiyaga oid bitta yangi tushunchani o‘rganish',
      'Xatolarni ko‘rib chiqib, tuzatish'
    ],
    [
      'Haftadagi eng qiyin mavzuni qayta o‘rganish',
      'Ingliz tilidan 10 ta so‘z yodlash',
      'Bir mavzuni kitobsiz boshidan oxirigacha tushuntirish',
      'Yengil jismoniy mashq yoki sayr qilish',
      'Kelgusi kun uchun aniq reja yozish'
    ]
  ];

  const parts = dateString.split('-').map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  const dayIndex = Math.floor(
    (date - new Date(2026, 9, 26)) / 86400000
  );

  return plans[((dayIndex % plans.length) + plans.length) % plans.length];
}


function organizeStatsSections() {
  const calendar = document.querySelector('.calendar-panel');
  const weekly = document.querySelector('#weeklyStats');
  const advanced = document.querySelector('#advancedStats');

  if (!calendar) return;

  for (const section of [weekly, advanced]) {
    if (section) {
      section.classList.add('page-section');
      section.dataset.section = 'stats';
    }
  }

  if (advanced) calendar.insertAdjacentElement('afterend', advanced);
  if (weekly && advanced) advanced.insertAdjacentElement('afterend', weekly);
  else if (weekly) calendar.insertAdjacentElement('afterend', weekly);
}

function setupNavigation() {
  const navigation = document.querySelector('#mainNavigation');
  if (!navigation) return;

  navigation.addEventListener('click', event => {
    const button = event.target.closest('[data-page]');
    if (!button) return;

    const page = button.dataset.page;
    const sections = document.querySelectorAll('.page-section[data-section]');

    sections.forEach(section => {
      section.classList.toggle('active', section.dataset.section === page);
    });

    navigation.querySelectorAll('[data-page]').forEach(item => {
      const selected = item.dataset.page === page;
      item.classList.toggle('active', selected);
      item.setAttribute('aria-current', selected ? 'page' : 'false');
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

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

  // Eski tizimda task XP darhol jami hisobga qo'shilgan.
  // Shu sababli mavjud XP qayta qo'shilmasligi uchun
  // oldingi dayXp qiymati bor kunni yakunlangan deb olamiz.
  if (typeof state.dayFinalized !== 'boolean') {
    state.dayFinalized = (Number(state.dayXp) || 0) > 0;
  }

  const day = today();

  if (state.date !== day) {
    if (state.date && !state.dayFinalized) {
      state.dayXp = calculateDailyXP();
      state.xp = Math.max(0, Number(state.xp) || 0) + state.dayXp;
      state.dayFinalized = true;
    }

    archiveCurrentDay();

    state.date = day;
    if (state.resetXPOnNextDay) {
      state.xp = 0;
      state.resetXPOnNextDay = false;
    }

    state.tasks = dailyTasksFor(day).map(text => ({
      text,
      done: false,
      xpValue: taskXP(text),
      xpClaimed: false
    }));

    state.dayXp = 0;
    state.dayFinalized = false;
    state.dailyBonusClaimed = false;
    state.notes = '';
    state.weight = '';
  } else if (!Number.isFinite(Number(state.dayXp))) {
    state.dayXp = calculateDailyXP();
  }

  archiveCurrentDay();
  calculateStreak();
  render();
  await persist('Ma’lumotlar saqlandi ✓');
}

setupNavigation();
init();
