const DEMO_KEY = 'clinicflow-demo-v1'

function nowPlus(minutes) {
  const d = new Date(Date.now() + minutes * 60 * 1000)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function defaultState() {
  return {
    role: 'patient',
    activeTabs: { patient: 'book', reception: 'queue', doctor: 'shift' },
    booking: { specialty: 'Терапевт', doctor: 'Петрова А.В.', time: nowPlus(20) },
    intake: { reason: '', symptoms: [], allergies: '', meds: '', notes: '', savedAt: null },
    patient: { name: 'Иванов Иван', phone: '+7 (999) 123-45-67', birthYear: 1999 },
    queue: [
      { id: 'q-1', name: 'Иванов Иван', doctor: 'Петрова А.В.', cabinet: '214', time: nowPlus(20), status: 'scheduled', etaMin: 28 },
      { id: 'q-2', name: 'Сидорова Мария', doctor: 'Петрова А.В.', cabinet: '214', time: nowPlus(0), status: 'in_visit', etaMin: 0 },
      { id: 'q-3', name: 'Кузнецов Павел', doctor: 'Петрова А.В.', cabinet: '214', time: nowPlus(-20), status: 'waiting', etaMin: 10 },
    ],
    currentVisitId: 'q-2',
    visit: { summary: '', plan: '', finishedAt: null },
  }
}

let state = loadState()

function loadState() {
  try {
    const raw = localStorage.getItem(DEMO_KEY)
    if (!raw) return defaultState()
    return { ...defaultState(), ...JSON.parse(raw) }
  } catch {
    return defaultState()
  }
}

function saveState() {
  localStorage.setItem(DEMO_KEY, JSON.stringify(state))
}

function resetState() {
  state = defaultState()
  saveState()
  render()
}

function $(sel, root = document) { return root.querySelector(sel) }
function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)) }

function setRole(role) { state.role = role; saveState(); render() }
function setTab(screen, tab) { state.activeTabs[screen] = tab; saveState(); render() }

function statusPill(status) {
  const map = {
    scheduled: { label: 'Запланирован', cls: 'pill pill--info' },
    checked_in: { label: 'Пришёл', cls: 'pill pill--good' },
    waiting: { label: 'Ожидает', cls: 'pill pill--warn' },
    next: { label: 'Следующий', cls: 'pill pill--warn' },
    in_visit: { label: 'В кабинете', cls: 'pill pill--info' },
    done: { label: 'Завершён', cls: 'pill pill--good' },
    no_show: { label: 'Не явился', cls: 'pill pill--bad' },
    late: { label: 'Опаздывает', cls: 'pill pill--bad' },
  }
  return map[status] ?? { label: status, cls: 'pill' }
}

function nextCandidate() {
  const order = ['checked_in', 'waiting', 'scheduled', 'late']
  for (const s of order) {
    const found = state.queue.find((q) => q.status === s)
    if (found) return found
  }
  return null
}

function currentVisit() {
  return state.queue.find((q) => q.status === 'in_visit') || state.queue.find((q) => q.id === state.currentVisitId) || null
}

function getPatientQueueItem() {
  return state.queue.find((q) => q.name === state.patient.name) || null
}

function upsertPatientQueue(patch) {
  const i = state.queue.findIndex((q) => q.name === state.patient.name)
  if (i >= 0) state.queue[i] = { ...state.queue[i], ...patch }
  else state.queue.unshift({ id: `q-${Date.now()}`, name: state.patient.name, doctor: state.booking.doctor, cabinet: '214', time: state.booking.time, status: 'scheduled', etaMin: 18, ...patch })
}

function renderRoleChips() {
  $all('[data-role]').forEach((b) => b.classList.toggle('chip--active', b.getAttribute('data-role') === state.role))
}

function renderScreens() {
  ;['patient', 'reception', 'doctor'].forEach((s) => {
    const el = $(`[data-screen="${s}"]`)
    if (el) el.hidden = s !== state.role
  })
}

function renderTabs() {
  const panel = $(`[data-screen="${state.role}"]`)
  if (!panel) return
  const active = state.activeTabs[state.role]
  $all('[data-tab]', panel).forEach((t) => t.classList.toggle('tab--active', t.getAttribute('data-tab') === active))
  $all('[data-view]', panel).forEach((v) => v.classList.toggle('view--active', v.getAttribute('data-view') === active))
}

function renderSlots() {
  const slotsEl = $('#slots')
  if (!slotsEl) return
  const times = [nowPlus(20), nowPlus(40), nowPlus(60)]
  slotsEl.innerHTML = times.map((t) => `<button class="slot${t === state.booking.time ? ' slot--on' : ''}" type="button" data-slot="${t}">${t}</button>`).join('')
  $all('[data-slot]', slotsEl).forEach((b) => b.addEventListener('click', () => { state.booking.time = b.getAttribute('data-slot'); saveState(); render() }))
}

function renderSymptoms() {
  const el = $('#symptoms')
  if (!el) return
  const all = ['Температура', 'Кашель', 'Боль в горле', 'Слабость', 'Одышка', 'Боль в груди', 'Головная боль']
  el.innerHTML = all.map((s) => `<div class="chip2${state.intake.symptoms.includes(s) ? ' chip2--on' : ''}" data-sym="${s}">${s}</div>`).join('')
  $all('[data-sym]', el).forEach((c) => c.addEventListener('click', () => {
    const s = c.getAttribute('data-sym')
    const has = state.intake.symptoms.includes(s)
    state.intake.symptoms = has ? state.intake.symptoms.filter((x) => x !== s) : [...state.intake.symptoms, s]
    saveState()
    render()
  }))
}

function renderPatientQueue() {
  const card = $('#patientQueueCard')
  if (!card) return
  const item = getPatientQueueItem()
  if (!item) { card.innerHTML = '<div class="rowItem__name">Запись не найдена</div><div class="rowItem__meta">Сначала нажми “Записаться”.</div>'; return }
  const pill = statusPill(item.status)
  const eta = item.status === 'in_visit' ? 'Сейчас идёт приём' : item.etaMin ? `Примерно ${item.etaMin}–${item.etaMin + 6} мин` : '—'
  card.innerHTML = `<div class="row" style="justify-content:space-between;"><div><div class="rowItem__name">${item.doctor} · каб. ${item.cabinet}</div><div class="rowItem__meta">Время записи: ${item.time}</div></div><div class="${pill.cls}">${pill.label}</div></div><div class="rowItem__meta" style="margin-top:10px;">Оценка ожидания: <b style="color:rgba(255,255,255,.9)">${eta}</b></div>${item.status === 'next' ? '<div class="badge" style="margin-top:10px;">Вы следующий</div>' : ''}`
}

function renderReceptionQueue() {
  const table = $('#receptionTable')
  if (!table) return
  table.innerHTML = state.queue.slice().sort((a, b) => a.time.localeCompare(b.time)).map((q) => {
    const pill = statusPill(q.status)
    return `<div class="rowItem"><div><div class="rowItem__name">${q.name}</div><div class="rowItem__meta">${q.doctor} · каб. ${q.cabinet} · ${q.time}</div></div><div class="${pill.cls}">${pill.label}</div><div class="rowItem__meta">${q.etaMin ? `ETA: ~${q.etaMin} мин` : ''}</div><div class="rowItem__actions"><button class="btn btn--secondary" data-act="checkin" data-id="${q.id}" type="button">Пришёл</button><button class="btn btn--secondary" data-act="next" data-id="${q.id}" type="button">Следующий</button><button class="btn btn--secondary" data-act="noshow" data-id="${q.id}" type="button">Не явился</button></div></div>`
  }).join('') || '<div class="muted">Очередь пуста</div>'

  $all('[data-act]', table).forEach((b) => b.addEventListener('click', () => {
    const id = b.getAttribute('data-id')
    const act = b.getAttribute('data-act')
    const i = state.queue.findIndex((x) => x.id === id)
    if (i < 0) return
    if (act === 'checkin') state.queue[i].status = 'checked_in'
    if (act === 'next') { state.queue = state.queue.map((x) => (x.status === 'next' ? { ...x, status: 'waiting' } : x)); state.queue[i].status = 'next'; state.queue[i].etaMin = 3 }
    if (act === 'noshow') state.queue[i].status = 'no_show'
    saveState(); render()
  }))
}

function renderDoctorQueue() {
  const html = state.queue.filter((q) => q.status !== 'done' && q.status !== 'no_show').sort((a, b) => a.time.localeCompare(b.time)).map((q) => {
    const pill = statusPill(q.status)
    const isCurrent = q.id === (currentVisit()?.id || '')
    return `<div class="rowItem" style="grid-template-columns: 1.2fr 0.8fr 0.6fr;"><div><div class="rowItem__name">${q.name}${isCurrent ? ' <span class="badge" style="margin-left:6px;">сейчас</span>' : ''}</div><div class="rowItem__meta">${q.time} · каб. ${q.cabinet}</div></div><div class="${pill.cls}">${pill.label}</div><div class="rowItem__actions"><button class="btn btn--secondary" data-open="${q.id}" type="button">Открыть</button></div></div>`
  }).join('') || '<div class="muted">Нет пациентов</div>'

  const d = $('#doctorQueue')
  const m = $('#visitQueueMini')
  if (d) d.innerHTML = html
  if (m) m.innerHTML = html
  ;[d, m].forEach((root) => root && $all('[data-open]', root).forEach((b) => b.addEventListener('click', () => { state.currentVisitId = b.getAttribute('data-open'); state.activeTabs.doctor = 'visit'; saveState(); render() })))
}

function renderVisit() {
  const sum = $('#patientSummary')
  const alerts = $('#alerts')
  const visitItem = currentVisit() || nextCandidate()
  if (!sum || !alerts || !visitItem) return
  const pill = statusPill(visitItem.status)
  const intake = state.intake.savedAt ? state.intake : null
  sum.innerHTML = `<div class="row" style="justify-content:space-between;"><div><div class="rowItem__name">${visitItem.name}</div><div class="rowItem__meta">${state.patient.birthYear} г.р. · ${visitItem.doctor} · каб. ${visitItem.cabinet}</div></div><div class="${pill.cls}">${pill.label}</div></div>${intake ? `<div class="status" style="margin-top:10px;"><div class="pill pill--good">анкета заполнена</div><div class="rowItem__meta" style="margin-top:8px;"><b>Причина:</b> ${intake.reason || '—'}</div><div class="rowItem__meta" style="margin-top:6px;"><b>Симптомы:</b> ${intake.symptoms.length ? intake.symptoms.join(', ') : '—'}</div><div class="rowItem__meta" style="margin-top:6px;"><b>Аллергии:</b> ${intake.allergies || '—'}</div><div class="rowItem__meta" style="margin-top:6px;"><b>Лекарства:</b> ${intake.meds || '—'}</div></div>` : '<div class="hint" style="margin-top:10px;">Нет преданкеты — больше времени уйдёт на сбор данных.</div>'}`
  const list = []
  if ((state.intake.allergies || '').toLowerCase().includes('пениц')) list.push('<div class="pill pill--bad" style="display:block;margin-bottom:8px;">Аллергия: пенициллин</div>')
  if (!state.intake.savedAt) list.push('<div class="pill pill--info" style="display:block;">Нет преданкеты</div>')
  alerts.innerHTML = list.join('') || '<div class="pill pill--good">Нет критичных предупреждений</div>'
  if ($('#dSummary')) $('#dSummary').value = state.visit.summary
  if ($('#dPlan')) $('#dPlan').value = state.visit.plan
}

function bindOnce() {
  $all('[data-role]').forEach((b) => b.addEventListener('click', () => setRole(b.getAttribute('data-role'))))
  $all('.panel').forEach((p) => { const s = p.getAttribute('data-screen'); $all('[data-tab]', p).forEach((t) => t.addEventListener('click', () => setTab(s, t.getAttribute('data-tab')))) })
  $('#btnGoWork')?.addEventListener('click', () => { document.getElementById('workArea')?.scrollIntoView({ behavior: 'smooth' }) })
  $('#btnReset')?.addEventListener('click', resetState)

  $('#btnBook')?.addEventListener('click', () => { upsertPatientQueue({ doctor: state.booking.doctor, time: state.booking.time, status: 'scheduled', etaMin: 22 }); state.activeTabs.patient = 'intake'; saveState(); render() })
  $('#btnSaveIntake')?.addEventListener('click', () => {
    state.intake.reason = $('#fReason')?.value || ''
    state.intake.allergies = $('#fAllergies')?.value || ''
    state.intake.meds = $('#fMeds')?.value || ''
    state.intake.notes = $('#fNotes')?.value || ''
    state.intake.savedAt = Date.now()
    saveState(); $('#intakeSaved').hidden = false; render()
  })
  $('#btnCheckIn')?.addEventListener('click', () => { upsertPatientQueue({ status: 'checked_in', etaMin: 14 }); saveState(); render() })
  $('#btnLate')?.addEventListener('click', () => { upsertPatientQueue({ status: 'late', etaMin: 30 }); saveState(); render() })

  $('#btnReceptionCreate')?.addEventListener('click', () => {
    const name = ($('#rName')?.value || '').trim() || 'Новый пациент'
    const doctor = ($('#rDoctor')?.value || 'Петрова А.В.').split(' (')[0]
    const time = ($('#rTime')?.value || '').replace('Сегодня ', '') || nowPlus(60)
    state.queue.unshift({ id: `q-${Date.now()}`, name, doctor, cabinet: doctor.includes('Соколов') ? '112' : '214', time, status: 'scheduled', etaMin: 24 })
    saveState(); $('#receptionCreated').hidden = false; render()
  })

  $('#btnCallNext')?.addEventListener('click', () => {
    const cand = nextCandidate(); if (!cand) return
    state.queue = state.queue.map((x) => (x.status === 'next' ? { ...x, status: 'waiting' } : x))
    const i = state.queue.findIndex((x) => x.id === cand.id); if (i >= 0) state.queue[i].status = 'next'
    state.currentVisitId = cand.id; saveState(); render()
  })
  $('#btnOpenVisit')?.addEventListener('click', () => { state.activeTabs.doctor = 'visit'; saveState(); render() })
  $('#btnTemplateOrvi')?.addEventListener('click', () => { state.visit.summary = 'ОРВИ, лёгкое течение'; state.visit.plan = 'Питьевой режим; парацетамол при t>38.5; контроль 2–3 дня.'; saveState(); renderVisit() })
  $('#btnTemplatePressure')?.addEventListener('click', () => { state.visit.summary = 'Повышенное АД (под вопросом)'; state.visit.plan = 'Дневник давления 7 дней; ЭКГ; контроль.'; saveState(); renderVisit() })
  $('#btnFinishVisit')?.addEventListener('click', () => {
    state.visit.summary = $('#dSummary')?.value || state.visit.summary
    state.visit.plan = $('#dPlan')?.value || state.visit.plan
    const v = currentVisit(); if (v) { const i = state.queue.findIndex((x) => x.id === v.id); if (i >= 0) state.queue[i].status = 'done' }
    const cand = nextCandidate(); if (cand) { const i = state.queue.findIndex((x) => x.id === cand.id); if (i >= 0) state.queue[i].status = 'next' }
    saveState(); $('#visitFinished').hidden = false; render()
  })
}

function render() {
  renderRoleChips()
  renderScreens()
  renderTabs()
  renderSlots()
  renderSymptoms()
  renderPatientQueue()
  renderReceptionQueue()
  renderDoctorQueue()
  renderVisit()

  if ($('#pSpecialty')) $('#pSpecialty').value = state.booking.specialty
  if ($('#pDoctor')) $('#pDoctor').value = state.booking.doctor
  if ($('#fReason')) $('#fReason').value = state.intake.reason
  if ($('#fAllergies')) $('#fAllergies').value = state.intake.allergies
  if ($('#fMeds')) $('#fMeds').value = state.intake.meds
  if ($('#fNotes')) $('#fNotes').value = state.intake.notes
}

bindOnce()
render()

