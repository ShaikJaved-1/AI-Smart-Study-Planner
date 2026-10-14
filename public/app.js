/* Smart Study Planner - frontend. One script for every page; the page is chosen by <body data-page="..."> */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const page = document.body.dataset.page;
  const PRIORITIES = ['Low', 'Medium', 'High'];
  const STATUSES = ['Pending', 'In Progress', 'Completed'];

  /* ---------- helpers ---------- */
  const esc = (v) => String(v === null || v === undefined ? '' : v)
    .replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const token = () => localStorage.getItem('token');
  const currentUser = () => { try { return JSON.parse(localStorage.getItem('user')); } catch (e) { return null; } };
  const clearSession = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); };
  const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const groupBy = (rows, key) => rows.reduce((m, r) => { (m[r[key]] = m[r[key]] || []).push(r); return m; }, {});
  const qs = (obj) => {
    const p = new URLSearchParams();
    Object.entries(obj).forEach(([k, v]) => { if (v !== '' && v !== null && v !== undefined) p.set(k, v); });
    const s = p.toString();
    return s ? `?${s}` : '';
  };

  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const today = () => fmt(new Date());
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return fmt(d); };
  const mondayOf = (s) => addDays(s, -((parse(s).getDay() + 6) % 7));
  const hhmm = (t) => String(t).slice(0, 5);
  const hrs = (n) => `${Math.round(Number(n) * 10) / 10}h`;
  const niceDate = (s) => parse(s).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const badge = (v, cls) => `<span class="badge b-${esc(cls || String(v).toLowerCase().replace(/\s+/g, '-'))}">${esc(v)}</span>`;

  let toastTimer;
  function toast(msg, isError) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.className = `toast${isError ? ' error' : ''}`;
    el.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.style.display = 'none'; }, 3500);
  }

  async function api(path, { method = 'GET', body, auth = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token()) headers.Authorization = `Bearer ${token()}`;
    const res = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    let json = {};
    try { json = await res.json(); } catch (e) { /* non-JSON response */ }
    if (res.status === 401 && auth) { clearSession(); location.href = 'login.html'; throw new Error(json.message || 'Session expired'); }
    if (!res.ok || json.success === false) throw new Error(json.message || 'Request failed');
    return json.data;
  }

  /* ---------- reusable UI pieces ---------- */
  function fieldHtml(f, value) {
    const val = value === undefined || value === null ? (f.default === undefined ? '' : f.default) : value;
    const name = esc(f.name);
    let input;
    if (f.type === 'select') {
      input = `<select name="${name}">${(f.options || []).map((o) => {
        const [v, l] = Array.isArray(o) ? o : [o, o];
        return `<option value="${esc(v)}"${String(v) === String(val) ? ' selected' : ''}>${esc(l)}</option>`;
      }).join('')}</select>`;
    } else if (f.type === 'textarea') {
      input = `<textarea name="${name}" rows="3">${esc(val)}</textarea>`;
    } else {
      input = `<input type="${esc(f.type || 'text')}" name="${name}" value="${esc(val)}"${f.step ? ` step="${esc(f.step)}"` : ''}${f.min ? ` min="${esc(f.min)}"` : ''}>`;
    }
    return `<label>${esc(f.label)}${input}</label>`;
  }

  function openForm({ title, fields, values = {}, submitLabel = 'Save changes', onSubmit }) {
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <h2>${esc(title)}</h2><form novalidate>${fields.map((f) => fieldHtml(f, values[f.name])).join('')}
      <div class="form-error"></div><div class="modal-actions"><button type="button" class="btn" data-close>Cancel</button>
      <button class="btn primary" type="submit">${esc(submitLabel)}</button></div></form></div></div>`;
    const close = () => { root.innerHTML = ''; };
    const form = $('form', root);
    $('[data-close]', root).onclick = close;
    $('.modal-backdrop', root).addEventListener('mousedown', (e) => { if (e.target.classList.contains('modal-backdrop')) close(); });
    form.onsubmit = async (e) => {
      e.preventDefault();
      const btn = $('button[type=submit]', form);
      btn.disabled = true;
      try { await onSubmit(Object.fromEntries(new FormData(form).entries())); close(); }
      catch (err) { $('.form-error', form).textContent = err.message; btn.disabled = false; }
    };
    const first = $('input, select, textarea', form);
    if (first) first.focus();
  }

  function tableHtml(cols, rows, emptyMsg = 'Nothing here yet.') {
    const head = cols.map((c) => `<th>${esc(c.label)}</th>`).join('');
    const body = rows.length
      ? rows.map((r) => `<tr>${cols.map((c) => `<td class="${c.actions ? 'actions' : ''}" data-label="${esc(c.label)}">${c.html ? c.html(r) : esc(c.value(r))}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${cols.length}" class="empty">${esc(emptyMsg)}</td></tr>`;
    return `<div class="table-wrap"><table class="stack"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  const stat = (label, value, sub) => `<div class="card stat"><div class="value">${esc(value)}</div><div class="label">${esc(label)}</div>${sub ? `<div class="small muted">${esc(sub)}</div>` : ''}</div>`;
  const subjectOptions = (subjects, withAll) => [...(withAll ? [['', 'All subjects']] : []), ...subjects.map((s) => [s.subject_id, s.subject_name])];
  const selectFilter = (id, label, options) => `<label>${esc(label)}<select id="${id}">${options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}">${esc(l)}</option>`; }).join('')}</select></label>`;

  function subjectBarsHtml(list) {
    if (!list.length) return '<p class="empty">Add subjects and generate a plan to see progress.</p>';
    return list.map((s) => `<div class="subject-row"><div class="top"><span>${esc(s.subject_name)}</span>
      <span class="muted small">${hrs(s.completed_hours)} of ${hrs(s.planned_hours)} (${s.percentage}%)</span></div>
      <div class="bar"><span style="width:${s.percentage}%"></span></div></div>`).join('');
  }

  function chartHtml(days) {
    const max = Math.max(1, ...days.map((d) => d.planned));
    return `<div class="chart">${days.map((d) => `<div class="col"><div class="pair">
      <div class="b1" style="height:${(d.planned / max) * 100}%" title="Planned ${hrs(d.planned)}"></div>
      <div class="b2" style="height:${(d.completed / max) * 100}%" title="Completed ${hrs(d.completed)}"></div></div>
      ${esc(parse(d.date).toLocaleDateString(undefined, { weekday: 'short' }))}</div>`).join('')}</div>
      <div class="legend"><span>Grey: planned hours</span><span>Blue: completed hours</span></div>`;
  }

  const sessionButtons = (i) => {
    if (!i.progress_id) return '';
    if (i.status === 'Planned') return `<button class="btn small" data-session="Completed" data-id="${i.progress_id}">Mark done</button>`;
    if (i.status === 'Completed') return `<button class="btn small ghost" data-session="Planned" data-id="${i.progress_id}">Undo</button>`;
    return '';
  };
  // One click handler per container for the "Mark done" / "Undo" buttons (safe to call again after re-rendering).
  function bindSessionActions(container, reload) {
    container.sessionReload = reload;
    if (container.sessionBound) return;
    container.sessionBound = true;
    container.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-session]');
      if (!b) return;
      b.disabled = true;
      try { await api(`/progress/${b.dataset.id}`, { method: 'PUT', body: { status: b.dataset.session } }); toast('Session updated'); await container.sessionReload(); }
      catch (err) { toast(err.message, true); b.disabled = false; }
    });
  }

  async function runPlanner(kind) {
    const r = await api(`/planner/${kind}`, { method: 'POST' });
    toast(`${kind === 'generate' ? 'Plan generated' : 'Plan rescheduled'}: ${r.sessions_created} sessions, ${hrs(r.planned_hours)}`);
    return r;
  }
  function plannerNotice(r) {
    const un = r.unscheduled || [];
    return `<div class="notice${un.length ? ' warn' : ''}"><strong>${r.sessions_created} sessions planned (${hrs(r.planned_hours)})</strong>
      using ${hrs(r.settings.dailyHours)} per day${r.settings.weeklyHours ? ` and ${hrs(r.settings.weeklyHours)} per week` : ''}, starting at ${esc(r.settings.dayStartTime)}.
      ${r.missed_sessions ? ` ${r.missed_sessions} earlier session(s) were missed and their hours were planned again.` : ''}
      ${un.length ? `<ul>${un.map((u) => `<li>${esc(u.title)}: ${hrs(u.hours)} could not be scheduled. ${esc(u.reason)}</li>`).join('')}</ul>` : ''}</div>`;
  }

  /* ---------- calendar ---------- */
  function calendarHtml(ym, data, clickable) {
    const first = new Date(ym.y, ym.m, 1);
    const start = addDays(fmt(first), -((first.getDay() + 6) % 7));
    const title = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    let cells = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => `<div class="dow">${d}</div>`).join('');
    for (let i = 0; i < 42; i++) {
      const date = addDays(start, i);
      const dd = parse(date);
      const cls = ['day'];
      if (dd.getMonth() !== ym.m) cls.push('other');
      if (date === today()) cls.push('today');
      const s = (data.sessions[date] || []).filter((x) => x.status !== 'Missed');
      const a = (data.assignments[date] || []).filter((x) => x.status !== 'Completed');
      const e = data.exams[date] || [];
      const total = s.reduce((sum, x) => sum + Number(x.duration_hours), 0);
      const tags = (s.length ? `<span class="tag s">${s.length} session${s.length > 1 ? 's' : ''}, ${hrs(total)}</span>` : '')
        + a.slice(0, 1).map((x) => `<span class="tag a">Due: ${esc(x.title)}</span>`).join('')
        + e.slice(0, 1).map((x) => `<span class="tag e">Exam: ${esc(x.exam_name)}</span>`).join('');
      const inner = `${dd.getDate()}${tags}`;
      cells += clickable
        ? `<button type="button" class="${cls.join(' ')}" data-date="${date}">${inner}</button>`
        : `<div class="${cls.join(' ')}">${inner}</div>`;
    }
    return `<div class="cal-head"><button class="btn small" data-cal="prev">Previous</button><strong>${esc(title)}</strong>
      <span><button class="btn small" data-cal="today">Today</button> <button class="btn small" data-cal="next">Next</button></span></div>
      <div class="cal">${cells}</div>
      <div class="legend"><span>Blue: study sessions</span><span>Orange: assignment deadlines</span><span>Red: exams</span></div>`;
  }
  async function loadCalendarData(ym) {
    const first = new Date(ym.y, ym.m, 1);
    const from = addDays(fmt(first), -((first.getDay() + 6) % 7));
    const to = addDays(from, 41);
    const [items, assignments, exams] = await Promise.all([
      api(`/planner${qs({ from, to })}`), api(`/assignments${qs({ from, to })}`), api(`/exams${qs({ from, to })}`)
    ]);
    return { sessions: groupBy(items.items, 'session_date'), assignments: groupBy(assignments, 'deadline'), exams: groupBy(exams, 'exam_date') };
  }
  const shiftMonth = (ym, delta) => { const d = new Date(ym.y, ym.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; };
  const thisMonth = () => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; };

  /* ---------- page shell (sidebar, top bar, notifications, theme) ---------- */
  function buildShell() {
    const user = currentUser();
    const nav = user.role === 'admin'
      ? [['admin', 'Admin panel'], ['profile', 'Profile']]
      : [['dashboard', 'Dashboard'], ['subjects', 'Subjects and topics'], ['assignments', 'Assignments'], ['exams', 'Exams'],
        ['planner', 'Study planner'], ['progress', 'Progress'], ['reports', 'Reports'], ['profile', 'Profile']];
    $('#sidebar').innerHTML = `<div class="brand">Smart Study Planner</div><nav>${nav.map(([p, l]) => `<a href="${p}.html"${p === page ? ' class="active" aria-current="page"' : ''}>${l}</a>`).join('')}</nav>`;
    const dark = document.documentElement.dataset.theme === 'dark';
    $('#topbar').innerHTML = `<button class="btn small menu-btn" id="menu-btn">Menu</button><h1>${esc(document.body.dataset.title)}</h1>
      <button class="btn small" id="theme-btn">${dark ? 'Light mode' : 'Dark mode'}</button>
      <button class="btn small bell" id="bell-btn">Notifications<span class="count" id="bell-count" hidden></span></button>
      <span class="muted small">${esc(user.name)}</span><button class="btn small" id="logout-btn">Log out</button>
      <div class="dropdown" id="note-panel"></div>`;

    $('#menu-btn').onclick = () => $('#sidebar').classList.toggle('open');
    $('#theme-btn').onclick = () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('theme', next);
      $('#theme-btn').textContent = next === 'dark' ? 'Light mode' : 'Dark mode';
    };
    $('#logout-btn').onclick = async () => {
      try { await api('/auth/logout', { method: 'POST' }); } catch (e) { /* ignore */ }
      clearSession();
      location.href = 'login.html';
    };
    $('#bell-btn').onclick = (e) => { e.stopPropagation(); $('#note-panel').classList.toggle('open'); };
    document.addEventListener('click', (e) => { if (!e.target.closest('#note-panel')) $('#note-panel').classList.remove('open'); });
    loadNotifications();
  }

  async function loadNotifications() {
    try {
      const { unread_count: unread, notifications } = await api('/notifications');
      const count = $('#bell-count');
      count.hidden = !unread;
      count.textContent = unread;
      $('#note-panel').innerHTML = `<div class="row-actions" style="justify-content:space-between"><strong>Notifications</strong>
        <button class="btn small" id="read-all">Mark all read</button></div>
        ${notifications.length ? notifications.map((n) => `<div class="note-item${n.is_read ? '' : ' unread'}" data-note="${n.notification_id}">${esc(n.message)}
          <div class="small muted">${esc(String(n.created_at).slice(0, 16))}</div></div>`).join('') : '<p class="empty">No notifications yet.</p>'}`;
      $('#read-all').onclick = async () => { await api('/notifications/read-all', { method: 'PUT' }); loadNotifications(); };
      $('#note-panel').querySelectorAll('[data-note]').forEach((el) => {
        el.onclick = async () => { await api(`/notifications/${el.dataset.note}/read`, { method: 'PUT' }); loadNotifications(); };
      });
    } catch (e) { /* the bell is optional */ }
  }

  /* ---------- pages ---------- */
  const pages = {};

  pages.dashboard = async (content) => {
    const d = await api('/reports/dashboard');
    const user = currentUser();
    let ym = thisMonth();
    const overdue = (a) => a.deadline < today() && a.status !== 'Completed';

    content.innerHTML = `
      <div class="card" style="margin-bottom:16px"><h2>Welcome back, ${esc(user.name)}</h2>
        <p class="muted">${esc(parse(today()).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}.
        ${d.today_sessions.length ? `You have ${d.today_sessions.length} study session(s) today.` : 'No study sessions are planned for today.'}</p>
        <div class="row-actions"><a class="btn primary" href="assignments.html?new=1">Add assignment</a><a class="btn" href="exams.html?new=1">Add exam</a>
        <button class="btn" id="gen">Generate study plan</button><a class="btn" href="planner.html">Open planner</a></div></div>
      <div class="grid stats">
        ${stat('Subjects', d.totals.subjects)}${stat('Assignments', d.totals.assignments, `${d.assignments.completed} completed`)}
        ${stat('Upcoming exams', d.totals.upcoming_exams)}${stat('Pending tasks', d.assignments.pending)}
        ${stat('Study hours done', hrs(d.hours.completed), `of ${hrs(d.hours.planned)} planned`)}${stat('Completion', `${d.completion_percentage}%`)}</div>
      <div class="grid two">
        <div class="card"><h2>Today's schedule</h2><div id="today">${d.today_sessions.length ? `<ul class="list">${d.today_sessions.map((i) => `
          <li><div><strong>${hhmm(i.start_time)}-${hhmm(i.end_time)}</strong> ${esc(i.title)}<div class="small muted">${esc(i.subject_name)}</div></div>
          <div class="row-actions">${badge(i.status)}${sessionButtons(i)}</div></li>`).join('')}</ul>` : '<p class="empty">Nothing scheduled today. Generate a plan to fill your week.</p>'}</div></div>
        <div class="card"><h2>Notifications</h2>${d.notifications.length ? `<ul class="list">${d.notifications.map((n) => `<li><span>${esc(n.message)}</span></li>`).join('')}</ul>` : '<p class="empty">You are all caught up.</p>'}</div>
      </div>
      <div class="grid two">
        <div class="card"><h2>Upcoming assignments <a class="small" href="assignments.html">View all</a></h2>${d.upcoming_assignments.length ? `<ul class="list">${d.upcoming_assignments.map((a) => `
          <li><div>${esc(a.title)}<div class="small muted">${esc(a.subject_name)}, due ${esc(niceDate(a.deadline))}</div></div>
          <div>${overdue(a) ? badge('Overdue') : ''} ${badge(a.priority)}</div></li>`).join('')}</ul>` : '<p class="empty">No open assignments.</p>'}</div>
        <div class="card"><h2>Upcoming exams <a class="small" href="exams.html">View all</a></h2>${d.upcoming_exams.length ? `<ul class="list">${d.upcoming_exams.map((e) => `
          <li><div>${esc(e.exam_name)}<div class="small muted">${esc(e.subject_name)}, ${esc(niceDate(e.exam_date))}</div></div><div>${badge(e.priority)}</div></li>`).join('')}</ul>` : '<p class="empty">No upcoming exams.</p>'}</div>
      </div>
      <div class="grid two">
        <div class="card"><h2>Progress by subject</h2>${subjectBarsHtml(d.subject_progress)}</div>
        <div class="card"><h2>Study hours, last 7 days</h2>${chartHtml(d.last7_days)}</div>
      </div>
      <div class="card"><h2>Calendar</h2><div id="calendar"></div></div>`;

    const drawCalendar = async () => { $('#calendar').innerHTML = calendarHtml(ym, await loadCalendarData(ym), false); };
    $('#calendar').onclick = (e) => {
      const b = e.target.closest('[data-cal]');
      if (!b) return;
      ym = b.dataset.cal === 'today' ? thisMonth() : shiftMonth(ym, b.dataset.cal === 'next' ? 1 : -1);
      drawCalendar();
    };
    $('#gen').onclick = async () => { try { await runPlanner('generate'); pages.dashboard(content); } catch (err) { toast(err.message, true); } };
    bindSessionActions(content, () => pages.dashboard(content));
    drawCalendar();
  };

  pages.subjects = async (content) => {
    content.innerHTML = `
      <div class="card" style="margin-bottom:16px"><div class="page-head"><h2>Subjects</h2><button class="btn primary" id="add-subject">Add subject</button></div><div id="subjects"></div></div>
      <div class="card"><div class="page-head"><h2>Topics</h2><div class="row-actions"><div class="filters" style="margin:0"><label>Subject<select id="topic-filter"></select></label></div>
      <button class="btn primary" id="add-topic">Add topic</button></div></div><div id="topics"></div></div>`;
    let subjects = [];
    const subjectFields = [
      { name: 'subject_name', label: 'Subject name' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'priority', label: 'Priority', type: 'select', options: PRIORITIES, default: 'Medium' }
    ];
    const topicFields = () => [
      { name: 'subject_id', label: 'Subject', type: 'select', options: subjectOptions(subjects) },
      { name: 'topic_name', label: 'Topic name' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'status', label: 'Status', type: 'select', options: ['Not Started', 'In Progress', 'Completed'] }
    ];

    async function loadSubjects() {
      subjects = await api('/subjects');
      $('#topic-filter').innerHTML = subjectOptions(subjects, true).map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
      $('#subjects').innerHTML = tableHtml([
        { label: 'Subject', html: (s) => `<strong>${esc(s.subject_name)}</strong><div class="small muted">${esc(s.description || '')}</div>` },
        { label: 'Priority', html: (s) => badge(s.priority) },
        { label: 'Topics', value: (s) => s.topic_count },
        { label: 'Assignments', value: (s) => s.assignment_count },
        { label: 'Actions', actions: true, html: (s) => `<button class="btn small" data-act="edit-subject" data-id="${s.subject_id}">Edit</button>
          <button class="btn small danger" data-act="del-subject" data-id="${s.subject_id}">Delete</button>` }
      ], subjects, 'No subjects yet. Add your first subject to get started.');
      await loadTopics();
    }
    async function loadTopics() {
      const topics = await api(`/topics${qs({ subject_id: $('#topic-filter').value })}`);
      $('#topics').innerHTML = tableHtml([
        { label: 'Topic', html: (t) => `<strong>${esc(t.topic_name)}</strong><div class="small muted">${esc(t.description || '')}</div>` },
        { label: 'Subject', value: (t) => t.subject_name },
        { label: 'Status', html: (t) => badge(t.status) },
        { label: 'Actions', actions: true, html: (t) => `<button class="btn small" data-act="edit-topic" data-id="${t.topic_id}">Edit</button>
          <button class="btn small danger" data-act="del-topic" data-id="${t.topic_id}">Delete</button>` }
      ], topics, 'No topics found.');
      content.topics = topics;
    }

    $('#topic-filter').onchange = loadTopics;
    $('#add-subject').onclick = () => openForm({ title: 'Add subject', fields: subjectFields, submitLabel: 'Add subject',
      onSubmit: async (v) => { await api('/subjects', { method: 'POST', body: v }); toast('Subject added'); await loadSubjects(); } });
    $('#add-topic').onclick = () => {
      if (!subjects.length) return toast('Add a subject first', true);
      openForm({ title: 'Add topic', fields: topicFields(), submitLabel: 'Add topic',
        onSubmit: async (v) => { await api('/topics', { method: 'POST', body: v }); toast('Topic added'); await loadTopics(); } });
    };
    content.onclick = async (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const id = Number(b.dataset.id);
      try {
        if (b.dataset.act === 'edit-subject') {
          const s = subjects.find((x) => x.subject_id === id);
          openForm({ title: 'Edit subject', fields: subjectFields, values: s,
            onSubmit: async (v) => { await api(`/subjects/${id}`, { method: 'PUT', body: v }); toast('Subject updated'); await loadSubjects(); } });
        } else if (b.dataset.act === 'del-subject') {
          if (!confirm('Delete this subject? Its topics, assignments, exams and study sessions are deleted too.')) return;
          await api(`/subjects/${id}`, { method: 'DELETE' }); toast('Subject deleted'); await loadSubjects();
        } else if (b.dataset.act === 'edit-topic') {
          const t = content.topics.find((x) => x.topic_id === id);
          openForm({ title: 'Edit topic', fields: topicFields(), values: t,
            onSubmit: async (v) => { await api(`/topics/${id}`, { method: 'PUT', body: v }); toast('Topic updated'); await loadTopics(); } });
        } else if (b.dataset.act === 'del-topic') {
          if (!confirm('Delete this topic?')) return;
          await api(`/topics/${id}`, { method: 'DELETE' }); toast('Topic deleted'); await loadTopics();
        }
      } catch (err) { toast(err.message, true); }
    };
    await loadSubjects();
  };

  // Shared by the assignments and exams pages
  async function crudPage(content, cfg) {
    const subjects = await api('/subjects');
    let rows = [];
    content.innerHTML = `<div class="page-head"><h2>${cfg.title}</h2><button class="btn primary" id="add">${cfg.addLabel}</button></div>
      <div class="card"><div class="filters" id="filters">
        <label>Search<input type="search" id="f-q" placeholder="${cfg.searchHint}"></label>
        ${selectFilter('f-subject', 'Subject', subjectOptions(subjects, true))}
        ${cfg.statusFilter ? selectFilter('f-status', 'Status', [['', 'All statuses'], ...STATUSES]) : ''}
        ${selectFilter('f-priority', 'Priority', [['', 'All priorities'], ...PRIORITIES])}
        <label>From<input type="date" id="f-from"></label><label>To<input type="date" id="f-to"></label></div>
        <div id="list"></div></div>`;
    const val = (id) => ($(id) ? $(id).value : '');
    async function load() {
      rows = await api(`${cfg.path}${qs({ q: val('#f-q'), subject_id: val('#f-subject'), status: val('#f-status'), priority: val('#f-priority'), from: val('#f-from'), to: val('#f-to') })}`);
      $('#list').innerHTML = tableHtml([...cfg.columns, { label: 'Actions', actions: true, html: (r) => `
        <button class="btn small" data-act="edit" data-id="${r[cfg.idKey]}">Edit</button>
        <button class="btn small danger" data-act="del" data-id="${r[cfg.idKey]}">Delete</button>` }], rows, cfg.empty);
    }
    const form = (title, values, onSubmit) => {
      if (!subjects.length) return toast('Add a subject first', true);
      openForm({ title, fields: cfg.fields(subjects), values, onSubmit });
    };
    $('#filters').addEventListener('input', debounce(load));
    $('#add').onclick = () => form(cfg.addLabel, {}, async (v) => { await api(cfg.path, { method: 'POST', body: v }); toast(`${cfg.noun} added`); await load(); });
    content.onclick = async (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const id = Number(b.dataset.id);
      try {
        if (b.dataset.act === 'edit') {
          form(`Edit ${cfg.noun.toLowerCase()}`, rows.find((r) => r[cfg.idKey] === id), async (v) => {
            await api(`${cfg.path}/${id}`, { method: 'PUT', body: v }); toast(`${cfg.noun} updated. Your study plan was refreshed.`); await load();
          });
        } else if (confirm(`Delete this ${cfg.noun.toLowerCase()}?`)) {
          await api(`${cfg.path}/${id}`, { method: 'DELETE' }); toast(`${cfg.noun} deleted`); await load();
        }
      } catch (err) { toast(err.message, true); }
    };
    await load();
    if (new URLSearchParams(location.search).get('new')) $('#add').click();
  }

  pages.assignments = (content) => crudPage(content, {
    title: 'Assignments', noun: 'Assignment', addLabel: 'Add assignment', path: '/assignments', idKey: 'assignment_id',
    searchHint: 'Title or description', statusFilter: true, empty: 'No assignments match. Add one to start planning.',
    columns: [
      { label: 'Title', html: (a) => `<strong>${esc(a.title)}</strong>` },
      { label: 'Subject', value: (a) => a.subject_name },
      { label: 'Deadline', html: (a) => `${esc(a.deadline)} ${a.deadline < today() && a.status !== 'Completed' ? badge('Overdue') : ''}` },
      { label: 'Priority', html: (a) => badge(a.priority) },
      { label: 'Hours', value: (a) => a.estimated_hours },
      { label: 'Status', html: (a) => badge(a.status) }
    ],
    fields: (subjects) => [
      { name: 'subject_id', label: 'Subject', type: 'select', options: subjectOptions(subjects) },
      { name: 'title', label: 'Title' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'deadline', label: 'Deadline', type: 'date' },
      { name: 'priority', label: 'Priority', type: 'select', options: PRIORITIES, default: 'Medium' },
      { name: 'estimated_hours', label: 'Estimated hours', type: 'number', step: '0.5', min: '0.5' },
      { name: 'status', label: 'Status', type: 'select', options: STATUSES }
    ]
  });

  pages.exams = (content) => crudPage(content, {
    title: 'Exams', noun: 'Exam', addLabel: 'Add exam', path: '/exams', idKey: 'exam_id',
    searchHint: 'Exam name', statusFilter: false, empty: 'No exams match. Add an exam to plan your revision.',
    columns: [
      { label: 'Exam', html: (e) => `<strong>${esc(e.exam_name)}</strong>` },
      { label: 'Subject', value: (e) => e.subject_name },
      { label: 'Date', html: (e) => `${esc(e.exam_date)} ${e.exam_date < today() ? badge('Past') : ''}` },
      { label: 'Priority', html: (e) => badge(e.priority) },
      { label: 'Preparation hours', value: (e) => e.preparation_hours }
    ],
    fields: (subjects) => [
      { name: 'subject_id', label: 'Subject', type: 'select', options: subjectOptions(subjects) },
      { name: 'exam_name', label: 'Exam name' },
      { name: 'exam_date', label: 'Exam date', type: 'date' },
      { name: 'priority', label: 'Priority', type: 'select', options: PRIORITIES, default: 'Medium' },
      { name: 'preparation_hours', label: 'Preparation hours', type: 'number', step: '0.5', min: '0.5' }
    ]
  });

  pages.planner = async (content) => {
    const subjects = await api('/subjects');
    const state = { view: 'week', date: today(), ym: thisMonth() };
    content.innerHTML = `
            <div class="page-head"><h2>Study planner</h2><div class="row-actions"><button class="btn primary" id="gen">Generate plan</button><button class="btn" id="resched">Reschedule</button><button class="btn" id="download-pdf">Download Timetable PDF</button></div></div>
      <div id="plan-notice"></div>
      <div class="card"><div class="filters">
        <div class="tabs" id="views"><button class="btn" data-view="day">Day</button><button class="btn" data-view="week">Week</button><button class="btn" data-view="month">Month</button></div>
        <div class="row-actions"><button class="btn small" data-nav="-1">Previous</button><button class="btn small" data-nav="0">Today</button><button class="btn small" data-nav="1">Next</button></div>
        ${selectFilter('f-status', 'Status', [['', 'All statuses'], 'Planned', 'Completed', 'Missed'])}${selectFilter('f-subject', 'Subject', subjectOptions(subjects, true))}</div>
        <h3 id="range-title"></h3><div id="plan-view"></div></div>
      <div class="card" style="margin-top:16px"><div class="page-head"><h2>Study goals</h2><button class="btn small primary" id="add-goal">Add goal</button></div>
        <div id="goals"></div><p class="small muted">The planner uses your latest daily goal (2 hours if none is set) and your latest weekly goal as limits.</p></div>`;

    const sessionHtml = (i) => `<div class="session ${esc(i.status.toLowerCase())}"><strong>${hhmm(i.start_time)}-${hhmm(i.end_time)}</strong>
      <div>${esc(i.title)}</div><div class="time">${esc(i.subject_name)}, ${hrs(i.duration_hours)}</div>
      <div class="row-actions">${badge(i.status)}${sessionButtons(i)}</div></div>`;

    async function render() {
      $('#views').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.view === state.view));
      const view = $('#plan-view');
      const filters = { status: $('#f-status').value, subject_id: $('#f-subject').value };
      if (state.view === 'month') {
        $('#range-title').textContent = new Date(state.ym.y, state.ym.m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
        view.innerHTML = calendarHtml(state.ym, await loadCalendarData(state.ym), true);
        return;
      }
      const from = state.view === 'day' ? state.date : mondayOf(state.date);
      const to = state.view === 'day' ? state.date : addDays(from, 6);
      const data = await api(`/planner${qs({ from, to, ...filters })}`);
      $('#range-title').innerHTML = `${esc(state.view === 'day' ? niceDate(from) : `${niceDate(from)} to ${niceDate(to)}`)}
        <span class="muted small"> Planned ${hrs(data.summary.planned_hours)}, completed ${hrs(data.summary.completed_hours)}, missed sessions ${data.summary.missed_sessions}</span>`;
      const byDate = groupBy(data.items, 'session_date');
      if (state.view === 'day') {
        view.innerHTML = data.items.length ? data.items.map(sessionHtml).join('') : '<p class="empty">No study sessions on this day. Generate a plan or pick another day.</p>';
      } else {
        const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
        view.innerHTML = `<div class="week">${days.map((d) => `<div class="col"><h3>${esc(niceDate(d))}</h3>${(byDate[d] || []).map(sessionHtml).join('') || '<span class="muted small">Free</span>'}</div>`).join('')}</div>`;
      }
    }
    async function loadGoals() {
      const goals = await api('/goals');
      $('#goals').innerHTML = tableHtml([
        { label: 'Type', value: (g) => g.goal_type }, { label: 'Subject', value: (g) => g.subject_name || 'All' },
        { label: 'Target hours', value: (g) => g.target_hours },
        { label: 'Actions', actions: true, html: (g) => `<button class="btn small" data-goal="edit" data-id="${g.goal_id}">Edit</button> <button class="btn small danger" data-goal="del" data-id="${g.goal_id}">Delete</button>` }
      ], goals, 'No goals yet. The planner will use 2 study hours per day.');
      content.goals = goals;
    }
    const goalFields = [
      { name: 'goal_type', label: 'Goal type', type: 'select', options: [['daily', 'Daily study hours'], ['weekly', 'Weekly study hours'], ['subject', 'Subject goal']] },
      { name: 'subject_id', label: 'Subject (subject goals only)', type: 'select', options: subjectOptions(subjects) },
      { name: 'target_hours', label: 'Target hours', type: 'number', step: '0.5', min: '0.5' }
    ];

    
$('#download-pdf').onclick = async () => {
  try {
    const filters = {
      status: $('#f-status').value,
      subject_id: $('#f-subject').value
    };

    let from, to;

    if (state.view === 'day') {
      from = to = state.date;
    } else if (state.view === 'week') {
      from = mondayOf(state.date);
      to = addDays(from, 6);
    } else {
      from = `${state.ym.y}-${String(state.ym.m + 1).padStart(2, '0')}-01`;
      to = new Date(state.ym.y, state.ym.m + 1, 0)
        .toISOString().slice(0, 10);
    }

    const data = await api(`/planner${qs({ from, to, ...filters })}`);

    const rows = data.items.map((i) => `
      <tr>
        <td>${esc(i.session_date)}</td>
        <td>${esc(hhmm(i.start_time))} - ${esc(hhmm(i.end_time))}</td>
        <td>${esc(i.title)}</td>
        <td>${esc(i.subject_name)}</td>
        <td>${esc(hrs(i.duration_hours))}</td>
        <td>${esc(i.status)}</td>
      </tr>
    `).join('');

    const printWindow = window.open('', '_blank');

    if (!printWindow) {
      toast('Allow pop-ups to download the PDF.', true);
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Study Timetable</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #222; }
          h1 { color: #5145cd; }
          p { color: #555; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          th { background: #5145cd; color: white; }
          tr:nth-child(even) { background: #f4f4f8; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>My Study Timetable</h1>
        <p>Period: ${esc(from)} to ${esc(to)}</p>
        <table>
          <thead>
            <tr>
              <th>Date</th><th>Time</th><th>Study Topic</th>
              <th>Subject</th><th>Duration</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="6">No study sessions found.</td></tr>'}
          </tbody>
        </table>
        <script>
          window.onload = () => {
            window.print();
          };
        <\/script>
      </body>
      </html>
    `);

    printWindow.document.close();
  } catch (err) {
    toast(err.message, true);
  }
};


    const refresh = () => render().catch((err) => toast(err.message, true));
    content.addEventListener('click', async (e) => {
      const view = e.target.closest('[data-view]');
      const nav = e.target.closest('[data-nav]');
      const cal = e.target.closest('[data-cal]');
      const day = e.target.closest('[data-date]');
      const goal = e.target.closest('[data-goal]');
      if (view) { state.view = view.dataset.view; return refresh(); }
      if (nav) {
        const n = Number(nav.dataset.nav);
        if (state.view === 'month') state.ym = n === 0 ? thisMonth() : shiftMonth(state.ym, n);
        else state.date = n === 0 ? today() : addDays(state.date, n * (state.view === 'week' ? 7 : 1));
        return refresh();
      }
      if (cal) { state.ym = cal.dataset.cal === 'today' ? thisMonth() : shiftMonth(state.ym, cal.dataset.cal === 'next' ? 1 : -1); return refresh(); }
      if (day) { state.date = day.dataset.date; state.view = 'day'; return refresh(); }
      if (goal) {
        const id = Number(goal.dataset.id);
        try {
          if (goal.dataset.goal === 'del') {
            if (!confirm('Delete this goal?')) return;
            await api(`/goals/${id}`, { method: 'DELETE' }); toast('Goal deleted'); await loadGoals();
          } else {
            openForm({ title: 'Edit goal', fields: goalFields, values: content.goals.find((g) => g.goal_id === id),
              onSubmit: async (v) => { await api(`/goals/${id}`, { method: 'PUT', body: v }); toast('Goal updated'); await loadGoals(); } });
          }
        } catch (err) { toast(err.message, true); }
      }
    });
    bindSessionActions(content, render);
    $('#f-status').onchange = refresh;
    $('#f-subject').onchange = refresh;
    $('#add-goal').onclick = () => openForm({ title: 'Add study goal', fields: goalFields, submitLabel: 'Add goal',
      onSubmit: async (v) => { await api('/goals', { method: 'POST', body: v }); toast('Goal added'); await loadGoals(); } });
    const run = (kind) => async () => {
      try { const r = await runPlanner(kind); $('#plan-notice').innerHTML = plannerNotice(r); await render(); } catch (err) { toast(err.message, true); }
    };
    $('#gen').onclick = run('generate');
    $('#resched').onclick = run('reschedule');
    await Promise.all([render(), loadGoals()]);
  };

  pages.progress = async (content) => {
    const [subjects, report] = await Promise.all([api('/subjects'), api('/reports/progress')]);
    const o = report.overall;
    content.innerHTML = `
      <div class="grid stats">${stat('Completion', `${o.percentage}%`)}${stat('Hours completed', hrs(o.completed_hours), `of ${hrs(o.planned_hours)} planned`)}
        ${stat('Sessions completed', o.sessions_completed)}${stat('Sessions still planned', o.sessions_planned)}${stat('Sessions missed', o.sessions_missed)}</div>
      <div class="grid two"><div class="card"><h2>Progress by subject</h2>${subjectBarsHtml(report.subjects)}</div>
        <div class="card"><h2>Last 7 days</h2>${chartHtml(report.last7_days)}</div></div>
      <div class="card"><h2>Study sessions</h2><div class="filters" id="filters">
        ${selectFilter('f-status', 'Status', [['', 'All statuses'], 'Planned', 'Completed', 'Missed'])}${selectFilter('f-subject', 'Subject', subjectOptions(subjects, true))}
        <label>From<input type="date" id="f-from"></label><label>To<input type="date" id="f-to"></label></div><div id="list"></div></div>`;
    async function load() {
      const rows = await api(`/progress${qs({ status: $('#f-status').value, subject_id: $('#f-subject').value, from: $('#f-from').value, to: $('#f-to').value })}`);
      $('#list').innerHTML = tableHtml([
        { label: 'Date', value: (r) => r.session_date }, { label: 'Time', value: (r) => `${hhmm(r.start_time)}-${hhmm(r.end_time)}` },
        { label: 'Task', value: (r) => r.title }, { label: 'Subject', value: (r) => r.subject_name },
        { label: 'Hours', value: (r) => r.duration_hours }, { label: 'Status', html: (r) => badge(r.status) },
        { label: 'Actions', actions: true, html: (r) => sessionButtons(r) }
      ], rows, 'No sessions found. Generate a study plan first.');
    }
    $('#filters').addEventListener('input', debounce(load));
    bindSessionActions(content, () => pages.progress(content));
    await load();
  };

  pages.reports = async (content) => {
    const d = await api('/reports/dashboard');
    content.innerHTML = `
      <div class="grid stats">${stat('Total subjects', d.totals.subjects)}${stat('Total assignments', d.totals.assignments)}
        ${stat('Upcoming exams', d.totals.upcoming_exams)}${stat('Completed tasks', d.assignments.completed)}${stat('Pending tasks', d.assignments.pending)}
        ${stat('Study hours', hrs(d.hours.completed), `of ${hrs(d.hours.planned)} planned`)}${stat('Completion', `${d.completion_percentage}%`)}</div>
      <div class="grid two"><div class="card"><h2>Subject-wise progress</h2>${tableHtml([
        { label: 'Subject', value: (s) => s.subject_name }, { label: 'Assignments done', value: (s) => `${s.assignments_completed}/${s.assignments_total}` },
        { label: 'Hours', value: (s) => `${hrs(s.completed_hours)} / ${hrs(s.planned_hours)}` },
        { label: 'Progress', html: (s) => `<div class="bar"><span style="width:${s.percentage}%"></span></div><span class="small muted">${s.percentage}%</span>` }
      ], d.subject_progress, 'No subjects yet.')}</div>
      <div class="card"><h2>Study hours, last 7 days</h2>${chartHtml(d.last7_days)}</div></div>
      <div class="grid two"><div class="card"><h2>Upcoming exams</h2>${tableHtml([
        { label: 'Exam', value: (e) => e.exam_name }, { label: 'Subject', value: (e) => e.subject_name }, { label: 'Date', value: (e) => e.exam_date }, { label: 'Priority', html: (e) => badge(e.priority) }
      ], d.upcoming_exams, 'No upcoming exams.')}</div>
      <div class="card"><h2>Open assignments</h2>${tableHtml([
        { label: 'Title', value: (a) => a.title }, { label: 'Subject', value: (a) => a.subject_name }, { label: 'Deadline', value: (a) => a.deadline }, { label: 'Status', html: (a) => badge(a.status) }
      ], d.upcoming_assignments, 'No open assignments.')}</div></div>`;
  };

  pages.profile = async (content) => {
    const me = await api('/users/me');
    content.innerHTML = `<div class="grid two">
      <form class="card" id="profile-form" novalidate><h2>Your profile</h2>
        <label>Email<input type="email" value="${esc(me.email)}" disabled></label>
        ${[{ name: 'name', label: 'Full name' }, { name: 'phone', label: 'Phone' }, { name: 'institution', label: 'Institution' }, { name: 'course', label: 'Course' },
          { name: 'preferred_start_time', label: 'Preferred daily study start time', type: 'time' }].map((f) => fieldHtml(f, f.name === 'preferred_start_time' ? hhmm(me[f.name] || '17:00') : me[f.name])).join('')}
        <div class="form-error"></div><button class="btn primary" type="submit">Save profile</button></form>
      <form class="card" id="password-form" novalidate><h2>Change password</h2>
        <label>Current password<input type="password" name="current_password" autocomplete="current-password"></label>
        <label>New password (at least 8 characters)<input type="password" name="new_password" autocomplete="new-password"></label>
        <div class="form-error"></div><button class="btn primary" type="submit">Change password</button></form></div>`;
    const submit = (formId, path, message, after) => {
      const form = $(formId);
      form.onsubmit = async (e) => {
        e.preventDefault();
        $('.form-error', form).textContent = '';
        try { const r = await api(path, { method: 'PUT', body: Object.fromEntries(new FormData(form).entries()) }); toast(message); if (after) after(r); if (formId === '#password-form') form.reset(); }
        catch (err) { $('.form-error', form).textContent = err.message; }
      };
    };
    submit('#profile-form', '/users/me', 'Profile saved', (r) => {
      localStorage.setItem('user', JSON.stringify({ ...currentUser(), name: r.name }));
    });
    submit('#password-form', '/users/password', 'Password changed');
  };

  pages.admin = async (content) => {
    content.innerHTML = `<div class="tabs" id="tabs" style="margin-bottom:16px">${[['overview', 'Overview'], ['users', 'Students'], ['activity', 'Activity'], ['notify', 'Notifications']]
      .map(([k, l]) => `<button class="btn" data-tab="${k}">${l}</button>`).join('')}</div><div id="tab-body"></div>`;
    const tabs = {
      async overview(el) {
        const r = await api('/admin/reports');
        const t = r.totals;
        el.innerHTML = `<div class="grid stats">${stat('Students', t.students, `${t.active_students} active`)}${stat('Subjects', t.subjects)}${stat('Assignments', t.assignments, `${t.completed_assignments} completed`)}
          ${stat('Exams', t.exams)}${stat('Study sessions', t.sessions, `${t.completed_sessions} completed`)}${stat('Hours studied', hrs(t.completed_hours))}${stat('Session completion', `${t.completion_percentage}%`)}</div>
          <div class="grid two"><div class="card"><h2>Top students by hours studied</h2>${tableHtml([{ label: 'Student', value: (s) => s.name }, { label: 'Email', value: (s) => s.email }, { label: 'Hours', value: (s) => hrs(s.completed_hours) }], r.top_students, 'No data yet.')}</div>
          <div class="card"><h2>New students, last 7 days</h2>${tableHtml([{ label: 'Date', value: (s) => String(s.d).slice(0, 10) }, { label: 'Registrations', value: (s) => s.c }], r.signups_last_7_days, 'No new registrations.')}</div></div>`;
      },
      async users(el) {
        const users = await api('/admin/users');
        el.innerHTML = `<div class="card">${tableHtml([
          { label: 'Name', value: (u) => u.name }, { label: 'Email', value: (u) => u.email }, { label: 'Role', html: (u) => badge(u.role) },
          { label: 'Status', html: (u) => (u.is_active ? badge('Active', 'completed') : badge('Disabled', 'missed')) },
          { label: 'Subjects', value: (u) => u.subject_count }, { label: 'Assignments', value: (u) => u.assignment_count }, { label: 'Exams', value: (u) => u.exam_count },
          { label: 'Joined', value: (u) => String(u.created_at).slice(0, 10) },
          { label: 'Actions', actions: true, html: (u) => (u.role === 'student' ? `<button class="btn small ${u.is_active ? 'danger' : ''}" data-user="${u.user_id}" data-active="${u.is_active ? 0 : 1}">${u.is_active ? 'Disable' : 'Enable'}</button>` : '') }
        ], users, 'No users.')}</div>`;
      },
      async activity(el) {
        const rows = await api('/admin/activities');
        el.innerHTML = `<div class="card">${tableHtml([
          { label: 'Time', value: (r) => String(r.created_at).slice(0, 19) }, { label: 'User', value: (r) => (r.name ? `${r.name} (${r.email})` : 'Unknown') },
          { label: 'Action', value: (r) => r.action }, { label: 'IP', value: (r) => r.ip_address || '' }
        ], rows, 'No activity recorded yet.')}</div>`;
      },
      async notify(el) {
        const [users, sent] = await Promise.all([api('/admin/users'), api('/admin/notifications')]);
        el.innerHTML = `<div class="grid two"><form class="card" id="notify-form" novalidate><h2>Send a notification</h2>
          <label>Send to<select name="user_id"><option value="">All active students</option>${users.filter((u) => u.role === 'student').map((u) => `<option value="${u.user_id}">${esc(u.name)}</option>`).join('')}</select></label>
          <label>Message<textarea name="message" rows="3" maxlength="255"></textarea></label><div class="form-error"></div><button class="btn primary" type="submit">Send notification</button></form>
          <div class="card"><h2>Recently sent</h2>${tableHtml([{ label: 'Student', value: (n) => n.student_name }, { label: 'Message', value: (n) => n.message }, { label: 'Sent', value: (n) => String(n.created_at).slice(0, 16) }], sent, 'Nothing sent yet.')}</div></div>`;
        $('#notify-form').onsubmit = async (e) => {
          e.preventDefault();
          const form = e.target;
          try {
            const r = await api('/admin/notifications', { method: 'POST', body: Object.fromEntries(new FormData(form).entries()) });
            toast(`Sent to ${r.recipients} student(s)`); tabs.notify(el);
          } catch (err) { $('.form-error', form).textContent = err.message; }
        };
      }
    };
    let current = 'overview';
    const show = async (k) => {
      current = k;
      $('#tabs').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tab === k));
      try { await tabs[k]($('#tab-body')); } catch (err) { toast(err.message, true); }
    };
    $('#tabs').onclick = (e) => { const b = e.target.closest('[data-tab]'); if (b) show(b.dataset.tab); };
    content.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-user]');
      if (!b) return;
      try { await api(`/admin/users/${b.dataset.user}/status`, { method: 'PUT', body: { is_active: b.dataset.active === '1' } }); toast('Account updated'); show(current); }
      catch (err) { toast(err.message, true); }
    });
    show('overview');
  };

  /* ---------- start ---------- */
  if (page === 'login' || page === 'register') {
    $('#auth-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('button[type=submit]', e.target);
      btn.disabled = true;
      $('#form-error').textContent = '';
      try {
        const r = await api(page === 'login' ? '/auth/login' : '/auth/register', { method: 'POST', body: Object.fromEntries(new FormData(e.target).entries()), auth: false });
        localStorage.setItem('token', r.token);
        localStorage.setItem('user', JSON.stringify(r.user));
        location.href = r.user.role === 'admin' ? 'admin.html' : 'dashboard.html';
      } catch (err) { $('#form-error').textContent = err.message; btn.disabled = false; }
    });
    return;
  }
  if (page === 'index') { if (token()) location.href = 'dashboard.html'; return; }

  const user = currentUser();
  if (!token() || !user) { location.href = 'login.html'; return; }
  if (user.role === 'admin' && page !== 'admin' && page !== 'profile') { location.href = 'admin.html'; return; }
  if (user.role !== 'admin' && page === 'admin') { location.href = 'dashboard.html'; return; }
  buildShell();
  Promise.resolve(pages[page] && pages[page]($('#content'))).catch((err) => {
    $('#content').innerHTML = `<div class="notice warn">${esc(err.message)}</div>`;
  });
})();
