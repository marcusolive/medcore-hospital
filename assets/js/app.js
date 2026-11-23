(() => {
  const { $, $$, icon, fmt } = Kit;
  const nav = Kit.shell();
  const labels30 = Data.days(30);
  const settings = { mask: true, audit: true, breakGlass: true, exportId: false, timeout: 15 };
  const BED_STATES = ['Occupied', 'Available', 'Cleaning', 'Reserved'];
  const STATUS = {
    Critical: 'bad', Stable: 'ok', Observation: 'info', 'Discharge planned': 'warn', Discharged: 'mute',
    Confirmed: 'info', 'Checked-in': 'ok', 'No-show': 'bad', Completed: 'mute',
    'In stock': 'ok', Low: 'warn', 'On order': 'info'
  };

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const badge = s => `<span class="badge dot ${STATUS[s] || 'mute'}">${s}</span>`;
  const slug = s => s.toLowerCase().replace(/\s+/g, '-');
  const clock = () => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const name = p => esc(settings.mask ? `${p.first[0]}. ${p.last[0]}.` : `${p.first} ${p.last}`);
  const initials = p => esc(`${p.first[0]}${p.last[0]}`);
  const byMrn = mrn => Data.patients.find(p => p.mrn === mrn);
  const unitOf = n => Data.UNITS.find(u => u.name === n);
  const tri = lvl => Data.TRIAGE.find(t => t.level === lvl);
  const rank = lvl => Data.TRIAGE.findIndex(t => t.level === lvl);
  const triPill = lvl => `<span class="tri ${lvl}" style="--c:${tri(lvl).color}">${lvl}</span>`;
  const inHouse = () => Data.patients.filter(p => p.status !== 'Discharged');
  const audit = (action, target, force) => { if (settings.audit || force) Data.audit.unshift({ time: clock(), user: 'M. Oliveira', action, target }); };
  const later = fn => setTimeout(fn, 0);

  $$('[data-go]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); nav.go(b.dataset.go); }));
  $('#unitCount').textContent = Data.UNITS.length;

  const occupancy = (beds = Data.beds) => beds.filter(b => b.status === 'Occupied').length / beds.length * 100;
  const avgWait = () => Data.er.length ? Data.er.reduce((a, e) => a + e.wait, 0) / Data.er.length : 0;

  function renderKpis(animate = true) {
    const occ = occupancy(), wait = avgWait(), s = Data.surgeries;
    const kpis = [
      { label: 'Bed occupancy', value: occ, f: v => fmt.pct(v), d: occ - Data.occTrend.at(-2), du: ' pts', dp: 1, invert: true, data: [...Data.occTrend.slice(0, -1), occ], icon: 'bed' },
      { label: 'ER patients waiting', value: Data.er.length, f: v => fmt.num(v), d: Data.er.length - Data.erTrend.at(-2), du: '', dp: 0, invert: true, data: [...Data.erTrend.slice(0, -1), Data.er.length], icon: 'users' },
      { label: 'Avg ER wait', value: wait, f: v => `${Math.round(v)} min`, d: wait - Data.waitTrend.at(-2), du: ' min', dp: 0, invert: true, data: [...Data.waitTrend.slice(0, -1), wait], icon: 'clock' },
      { label: 'Surgeries today', value: s.today, f: v => fmt.num(v), d: s.today - Data.surgTrend.at(-2), du: '', dp: 0, data: Data.surgTrend, icon: 'heart' }
    ];
    $('#kpis').innerHTML = kpis.map((k, i) => {
      const flat = Math.abs(k.d) < 0.05;
      const good = (k.d >= 0) !== !!k.invert;
      const delta = flat ? 'No change vs yesterday' : `${k.d > 0 ? '▲' : '▼'} ${Math.abs(k.d).toFixed(k.dp)}${k.du} vs yesterday`;
      return `<div class="card kpi"><div class="lbl">${icon(k.icon)}${k.label}</div><div class="val" id="kv${i}">${animate ? 0 : k.f(k.value)}</div><div class="delta ${flat ? '' : good ? 'up' : 'down'}">${delta}</div><div class="spark" id="ks${i}"></div></div>`;
    }).join('');
    kpis.forEach((k, i) => { if (animate) Kit.countUp($(`#kv${i}`), k.value, k.f); Kit.spark($(`#ks${i}`), k.data, 'var(--brand)'); });
  }

  let range = 30;
  function drawCensus() {
    Kit.line($('#censusChart'), {
      labels: labels30.slice(-range),
      series: [
        { name: 'Admissions', color: '#0b7bdc', data: Data.admissions30.slice(-range) },
        { name: 'Discharges', color: '#12b5cb', data: Data.discharges30.slice(-range), dashed: true }
      ]
    });
  }
  $$('#range button').forEach(b => b.addEventListener('click', () => { $$('#range button').forEach(x => x.classList.toggle('on', x === b)); range = Number(b.dataset.r); drawCensus(); }));

  function drawUnits() {
    const vals = Data.UNITS.map(u => occupancy(Data.beds.filter(b => b.unit === u.name)));
    Kit.bars($('#unitBars'), {
      labels: Data.UNITS.map(u => u.short), data: vals, height: 230,
      colors: vals.map(v => v >= 90 ? '#d93025' : v >= 80 ? '#e37400' : '#0b7bdc'),
      format: v => `${v.toFixed(0)}%`
    });
  }

  const ago = at => { const m = Math.round((Date.now() - at) / 60000); return m < 1 ? 'just now' : `${m} min ago`; };
  Data.alerts.forEach(a => { a.at = Date.now() - parseInt(a.time, 10) * 60000; });
  function renderAlerts(fresh) {
    $('#alertCount').textContent = `${Data.alerts.length} active`;
    $('#bellBtn .dot').style.display = Data.alerts.length ? '' : 'none';
    $('#alerts').innerHTML = Data.alerts.length ? Data.alerts.map((a, i) => `<div class="li ${fresh && i === 0 ? 'alert-new' : ''}"><span class="ic ${a.level}">${icon(a.icon)}</span><div class="grow"><b>${a.title}</b><small>${a.text}</small></div><span class="meta">${ago(a.at)}</span><button class="icon-btn" data-ack="${i}" aria-label="Acknowledge alert: ${a.title}">${icon('check')}</button></div>`).join('') : '<p class="empty">No active alerts. All clear.</p>';
  }
  $('#alerts').addEventListener('click', e => {
    const b = e.target.closest('[data-ack]');
    if (!b) return;
    const [a] = Data.alerts.splice(Number(b.dataset.ack), 1);
    audit('Acknowledged alert', a.title);
    renderAlerts();
    Kit.toast(`Alert acknowledged: ${a.title}`);
  });
  let poolIdx = 0;
  setInterval(() => {
    const t = Data.alertPool[poolIdx++ % Data.alertPool.length];
    const list = inHouse();
    const p = list[Math.floor(Math.random() * list.length)];
    Data.alerts.unshift({ level: t.level, icon: t.icon, title: t.title, text: t.text(p), at: Date.now() });
    Data.alerts.splice(6);
    renderAlerts(true);
    $('#updated').textContent = clock();
  }, 25000);

  const THEATRES = [['OR 1', 'Cardiac', 4, 2], ['OR 2', 'Orthopedics', 3, 1], ['OR 3', 'General', 4, 2], ['OR 4', 'Neuro', 2, 1], ['OR 5', 'Obstetrics', 3, 1], ['OR 6', 'Urology', 2, 0]];
  function renderTheatres() {
    $('#theatres').innerHTML = THEATRES.map(t => `<div class="theatre"><div><b>${t[0]}</b><small>${t[1]}</small></div><div class="bar"><i class="done" style="width:0" data-w="${t[3] / t[2] * 100}"></i></div><span class="cnt">${t[3]}/${t[2]} done</span></div>`).join('') +
      `<p class="note">${icon('clock')}${Data.surgeries.done} of ${Data.surgeries.today} procedures completed across ${Data.surgeries.theatres} theatres. Next case starts in 25 min.</p>`;
    requestAnimationFrame(() => $$('#theatres [data-w]').forEach(b => { b.style.width = `${b.dataset.w}%`; }));
  }

  function badges() {
    $('#bedBadge').textContent = Data.beds.filter(b => b.status === 'Available').length;
    $('#erBadge').textContent = Data.er.length;
    $('#inHouse').textContent = inHouse().length;
  }

  let bedUnit = 'All';
  const bedLabel = b => {
    if (b.status === 'Occupied') { const p = byMrn(b.mrn); return settings.mask ? initials(p) : esc(p.last); }
    if (b.status === 'Cleaning') return `${b.since} min`;
    return b.status === 'Reserved' ? 'Hold' : 'Free';
  };
  function renderBeds(flash) {
    $('#bedFilter').innerHTML = ['All', ...Data.UNITS.map(u => u.name)].map(u => `<button data-u="${u}" class="${u === bedUnit ? 'on' : ''}" aria-pressed="${u === bedUnit}">${u}</button>`).join('');
    const scope = Data.beds.filter(b => bedUnit === 'All' || b.unit === bedUnit);
    $('#bedLegend').innerHTML = BED_STATES.map(s => `<span class="s-${slug(s)}"><i></i>${s} <b>${scope.filter(b => b.status === s).length}</b></span>`).join('');
    $('#bedGrid').innerHTML = Data.UNITS.filter(u => bedUnit === 'All' || u.name === bedUnit).map(u => {
      const beds = Data.beds.filter(b => b.unit === u.name);
      const pct = occupancy(beds);
      return `<div class="card unit-card"><h3><span>${u.name}<small>${u.floor}</small>${u.accepting ? '' : '<span class="badge warn closed">Closed to admissions</span>'}</span><small>${beds.filter(b => b.status === 'Occupied').length}/${beds.length} occupied · ${pct.toFixed(0)}%</small></h3>
        <div class="bar"><i style="width:${pct}%;background:${pct >= 90 ? 'var(--bad)' : pct >= 80 ? 'var(--warn)' : 'var(--brand)'}"></i></div>
        <div class="beds">${beds.map(b => `<button class="bed s-${slug(b.status)}" data-bed="${b.id}" aria-label="Bed ${b.id}, ${b.status}${b.mrn ? `, patient ${name(byMrn(b.mrn))}` : ''}"><span class="num">${b.id}</span><span class="who">${bedLabel(b)}</span></button>`).join('')}</div></div>`;
    }).join('');
    if (flash) $(`[data-bed="${flash}"]`)?.classList.add('flash');
  }
  $('#bedFilter').addEventListener('click', e => { const b = e.target.closest('[data-u]'); if (!b) return; bedUnit = b.dataset.u; renderBeds(); });
  $('#bedGrid').addEventListener('click', e => { const b = e.target.closest('[data-bed]'); if (b) openBed(b.dataset.bed); });

  function openBed(id) {
    const b = Data.beds.find(x => x.id === id);
    const unit = unitOf(b.unit);
    if (b.status === 'Occupied') {
      const p = byMrn(b.mrn);
      Kit.openModal({
        title: `Bed ${b.id} · ${b.unit}`,
        body: `<div class="pt-head"><div class="pt-av">${initials(p)}</div><div class="grow"><b>${name(p)}</b><small class="mono">${p.mrn}</small><small>${p.age} y · ${p.sex} · admitted ${p.admitted} (${p.los} d)</small></div>${badge(p.status)}</div>
          <div class="kv"><div><small>Diagnosis</small>${esc(p.diagnosis)}</div><div><small>Attending physician</small>${p.physician}</div><div><small>Allergies</small>${p.allergies.join(', ') || 'No known allergies'}</div><div><small>Expected discharge</small>${p.status === 'Discharge planned' ? 'Today' : 'Not set'}</div></div>`,
        actions: [{ label: 'Open chart', onClick: () => later(() => openChart(p)) }, { label: 'Discharge', primary: true, onClick: () => discharge(b, p) }]
      });
      return;
    }
    if (b.status === 'Cleaning') {
      Kit.openModal({
        title: `Bed ${b.id} · ${b.unit}`,
        body: `<p>Environmental services are cleaning this bed for <b>${b.since} min</b> (target 45 min).</p>${b.since > 45 ? '<p class="note">' + icon('alert') + 'Cleaning is over target. The housekeeping lead was notified.</p>' : ''}`,
        actions: [{ label: 'Cancel' }, { label: 'Mark as clean', primary: true, onClick: () => { b.status = 'Available'; delete b.since; audit('Bed marked clean', b.id); refreshAll(b.id); Kit.toast(`${b.id} is clean and available`); } }]
      });
      return;
    }
    const queue = sortedEr();
    Kit.openModal({
      title: `Assign bed ${b.id} · ${b.unit}`,
      body: `<form class="form" id="assignForm"><label>Patient<select name="src">${queue.map(e => `<option value="${e.id}">${e.id} · ${name(e)} · ${e.priority} · ${esc(e.complaint)}</option>`).join('')}<option value="elective">Elective admission (new MRN)</option></select></label></form>
        <p class="note">${icon(unit.accepting ? 'check' : 'alert')}${unit.accepting ? `${b.status === 'Reserved' ? 'Bed is reserved. ' : ''}${unit.name} is accepting admissions.` : `${unit.name} is closed to new admissions in Settings.`}</p>`,
      actions: [
        { label: b.status === 'Reserved' ? 'Release reservation' : 'Reserve bed', onClick: () => { b.status = b.status === 'Reserved' ? 'Available' : 'Reserved'; audit(`Bed ${b.status === 'Reserved' ? 'reserved' : 'released'}`, b.id); refreshAll(b.id); Kit.toast(`${b.id} is now ${b.status.toLowerCase()}`); } },
        { label: 'Assign patient', primary: true, onClick: m => { if (!unit.accepting) { Kit.toast(`${unit.name} is closed to admissions`); return false; } assign(b, $('select', m).value); } }
      ]
    });
  }

  function assign(b, src) {
    let p;
    if (src === 'elective') p = Data.makePatient(b.unit, b.id, { los: 0, status: 'Stable' });
    else {
      const e = Data.er.find(x => x.id === src);
      Data.er.splice(Data.er.indexOf(e), 1);
      p = Data.makePatient(b.unit, b.id, { first: e.first, last: e.last, age: e.age, diagnosis: e.complaint, los: 0, status: e.priority === 'Red' ? 'Critical' : 'Observation' });
    }
    Data.patients.unshift(p);
    b.status = 'Occupied'; b.mrn = p.mrn; delete b.since;
    audit('Admitted patient to bed', `${p.mrn} · ${b.id}`);
    refreshAll(b.id);
    Kit.toast(`${name(p)} admitted to ${b.id} (${p.mrn})`);
  }

  function discharge(b, p) {
    p.status = 'Discharged'; p.bed = '—';
    b.status = 'Cleaning'; b.since = 0; delete b.mrn;
    const token = b.token = Math.random();
    audit('Discharged patient', p.mrn);
    refreshAll(b.id);
    Kit.toast(`${name(p)} discharged. ${b.id} sent to cleaning`);
    setTimeout(() => {
      if (b.token !== token || b.status !== 'Cleaning') return;
      b.status = 'Available'; delete b.since;
      refreshAll(b.id);
      Kit.toast(`${b.id} is clean and available`);
    }, 9000);
  }

  const sortedEr = () => [...Data.er].sort((a, b) => rank(a.priority) - rank(b.priority) || b.wait - a.wait).map((e, i) => Object.assign(e, { pos: i + 1 }));
  let erTbl;
  function initEr() {
    erTbl = Kit.table($('#erTable'), {
      columns: [
        { key: 'pos', label: '#', num: true },
        { key: 'priority', label: 'Priority', render: triPill },
        { key: 'last', label: 'Patient', render: (v, r) => `<b>${name(r)}</b> <span class="mono" style="color:var(--muted)">${r.id}</span>` },
        { key: 'age', label: 'Age', num: true },
        { key: 'complaint', label: 'Complaint', render: esc },
        { key: 'wait', label: 'Waiting', num: true, render: (v, r) => v > tri(r.priority).target ? `<span class="over" title="Over triage target">${v} min</span>` : `${v} min` },
        { key: 'arrival', label: 'Arrived' }
      ],
      rows: sortedEr(), pageSize: 10,
      filters: [{ label: 'Priority', key: 'priority', options: Data.TRIAGE.map(t => t.level) }],
      onRow: openEr
    });
  }

  function renderEr() {
    erTbl.refresh(sortedEr());
    $('#triSummary').innerHTML = Data.TRIAGE.map(t => {
      const list = Data.er.filter(e => e.priority === t.level);
      const max = list.length ? Math.max(...list.map(e => e.wait)) : 0;
      return `<div class="tri-card" style="--c:${t.color}"><small>${t.level} · ${t.label}</small><div class="n">${list.length}</div><small>${list.length ? `Longest wait ${max} min` : 'No patients'}</small></div>`;
    }).join('');
    $('#targets').innerHTML = Data.TRIAGE.map(t => {
      const list = Data.er.filter(e => e.priority === t.level);
      const ok = list.length ? list.filter(e => e.wait <= t.target).length / list.length * 100 : 100;
      return `<div class="li">${triPill(t.level)}<div class="grow"><b>${t.label}</b><small>Target ${t.target ? `${t.target} min` : 'immediate'}</small></div><span class="badge ${ok >= 80 ? 'ok' : ok >= 50 ? 'warn' : 'bad'}">${ok.toFixed(0)}% on time</span></div>`;
    }).join('');
  }

  function openEr(e) {
    const t = tri(e.priority);
    Kit.openModal({
      title: `${e.id} · ${name(e)}`,
      body: `<div class="kv"><div><small>Priority</small>${triPill(e.priority)} ${t.label}</div><div><small>Chief complaint</small>${esc(e.complaint)}</div><div><small>Age</small>${e.age} y</div><div><small>Waiting</small>${e.wait} min · target ${t.target ? `${t.target} min` : 'immediate'}</div><div><small>Heart rate</small>${e.hr} bpm</div><div><small>SpO2</small>${e.spo2}%</div></div>
        <p class="note">${icon('clock')}Arrived at ${e.arrival}. Queue position ${e.pos}.</p>`,
      actions: [
        { label: 'Admit to bed', onClick: () => later(() => { bedUnit = 'All'; nav.go('beds'); renderBeds(); Kit.toast(`Pick an available bed to admit ${e.id}`); }) },
        { label: 'Call now', primary: true, onClick: () => callPatient(e) }
      ]
    });
  }

  let room = 2;
  function callPatient(e) {
    Data.er.splice(Data.er.indexOf(e), 1);
    room = room % 8 + 1;
    $('#serving').innerHTML = `<div class="serving"><small>Called at ${clock()}</small><div class="room">Exam room ${room}</div><div>${triPill(e.priority)} <b>${name(e)}</b> · ${e.id}</div><small>${esc(e.complaint)} · waited ${e.wait} min</small></div>`;
    audit('Called ER patient', e.id);
    refreshAll();
    Kit.toast(`Calling ${name(e)} (${e.priority}) to exam room ${room}`);
  }
  $('#callNext').addEventListener('click', () => {
    const next = sortedEr()[0];
    if (!next) { Kit.toast('The queue is empty'); return; }
    callPatient(next);
  });

  const openTriage = () => Kit.openModal({
    title: 'New triage',
    body: `<form class="form" id="triForm"><div class="kv">
        <label>First name<input name="first" placeholder="Fictional name" autocomplete="off"></label>
        <label>Last name<input name="last" autocomplete="off"></label>
        <label>Age<input name="age" type="number" min="0" max="120" value="40"></label>
        <label>Priority<select name="priority">${Data.TRIAGE.map(t => `<option value="${t.level}" ${t.level === 'Yellow' ? 'selected' : ''}>${t.level} · ${t.label} (${t.target ? `≤ ${t.target} min` : 'immediate'})</option>`).join('')}</select></label>
        <label>Heart rate (bpm)<input name="hr" type="number" min="20" max="250" value="88"></label>
        <label>SpO2 (%)<input name="spo2" type="number" min="50" max="100" value="97"></label></div>
        <label>Chief complaint<input name="complaint" placeholder="e.g. Chest pain for 2 hours" autocomplete="off"></label></form>`,
    actions: [{ label: 'Cancel' }, {
      label: 'Add to queue', primary: true, onClick: m => {
        const f = new FormData($('#triForm', m));
        const missing = ['first', 'last', 'complaint'].find(k => !String(f.get(k)).trim());
        if (missing) { $(`[name="${missing}"]`, m).focus(); return false; }
        const e = Data.makeEr(f.get('priority'), { first: f.get('first').trim(), last: f.get('last').trim(), age: Number(f.get('age')) || 1, complaint: f.get('complaint').trim(), wait: 0, hr: Number(f.get('hr')), spo2: Number(f.get('spo2')) });
        Data.er.push(e);
        audit('Triaged ER patient', e.id);
        refreshAll();
        nav.go('er');
        Kit.toast(`${e.id} added to the queue as ${e.priority}`);
      }
    }]
  });
  $$('[data-new-triage]').forEach(b => b.addEventListener('click', openTriage));

  let patTbl;
  function initPatients() {
    patTbl = Kit.table($('#patientsTable'), {
      columns: [
        { key: 'mrn', label: 'MRN', render: v => `<span class="mono">${v}</span>` },
        { key: 'full', label: 'Patient', render: (v, r) => `<b>${name(r)}</b>` },
        { key: 'age', label: 'Age', num: true },
        { key: 'unit', label: 'Unit' },
        { key: 'bed', label: 'Bed', render: v => `<span class="mono">${v}</span>` },
        { key: 'physician', label: 'Attending physician' },
        { key: 'status', label: 'Status', render: badge },
        { key: 'los', label: 'LOS', num: true, render: v => `${v} d` }
      ],
      rows: Data.patients, pageSize: 10,
      filters: [
        { label: 'Unit', key: 'unit', options: Data.UNITS.map(u => u.name) },
        { label: 'Status', key: 'status', options: ['Critical', 'Stable', 'Observation', 'Discharge planned', 'Discharged'] },
        { label: 'Physician', key: 'physician', options: Object.values(Data.PHYSICIANS).flat() }
      ],
      onRow: openChart
    });
  }

  function openChart(p) {
    audit('Opened chart', p.mrn);
    const hr = p.hr.at(-1), v = p.vitals;
    const hours = Array.from({ length: 24 }, (_, i) => `${String(new Date(Date.now() - (23 - i) * 3600000).getHours()).padStart(2, '0')}:00`);
    const m = Kit.openModal({
      title: `Patient chart · ${p.mrn}`,
      body: `<div class="pt-head"><div class="pt-av">${initials(p)}</div><div class="grow"><b>${name(p)}</b><small>${p.age} y · ${p.sex} · ${p.unit}${p.bed !== '—' ? ` · bed ${p.bed}` : ''}</small><small>${p.physician} · admitted ${p.admitted}</small></div>${badge(p.status)}</div>
        <div class="vitals">
          <div class="vital ${hr > 110 || hr < 50 ? 'alarm' : ''}"><small>${icon('heart')}Heart rate</small><b>${hr} <span>bpm</span></b></div>
          <div class="vital"><small>${icon('drop')}Blood pressure</small><b>${v.bp} <span>mmHg</span></b></div>
          <div class="vital ${v.spo2 < 92 ? 'alarm' : ''}"><small>${icon('spark')}SpO2</small><b>${v.spo2} <span>%</span></b></div>
          <div class="vital ${Number(v.temp) >= 38 ? 'alarm' : ''}"><small>${icon('thermo')}Temperature</small><b>${v.temp} <span>°C</span></b></div>
        </div>
        <div class="sub">Heart rate · last 24 h</div><div id="hrChart"></div>
        <div class="grid g2" style="gap:16px">
          <div><div class="sub">Allergies</div><div class="chips">${p.allergies.length ? p.allergies.map(a => `<span class="badge bad">${a}</span>`).join('') : '<span class="badge ok">No known allergies</span>'}</div>
            <div class="sub">Diagnosis</div><div>${esc(p.diagnosis)}</div></div>
          <div><div class="sub">Active medications</div><div class="medlist">${p.status === 'Discharged' ? '<div>None, patient discharged</div>' : p.meds.map(x => `<div>${icon('pill')}${x}</div>`).join('')}</div></div>
        </div>
        <p class="note">${icon('lock')}${settings.audit ? `Access recorded in the audit log at ${clock()}.` : 'Audit logging is turned off in Settings.'} Fictional record for demo purposes.</p>`,
      actions: [{ label: 'Print summary', onClick: () => Kit.toast(`Summary for ${p.mrn} sent to the unit printer`) }, { label: 'Close', primary: true }]
    });
    Kit.line($('#hrChart', m), { labels: hours, series: [{ name: 'Heart rate (bpm)', color: '#d93025', data: p.hr }], height: 170, format: x => `${Math.round(x)} bpm` });
  }

  let apptDoc = 'all';
  const docById = id => Data.CLINIC.find(d => d.id === id);
  $('#clinicNow').textContent = Data.CLINIC_NOW;
  $('#docFilter').innerHTML = `<option value="all">All doctors</option>${Data.CLINIC.map(d => `<option value="${d.id}">${d.name} · ${d.spec}</option>`).join('')}`;
  $('#docFilter').addEventListener('change', e => { apptDoc = e.target.value; renderAppts(); });

  function renderAppts() {
    const docs = Data.CLINIC.filter(d => apptDoc === 'all' || d.id === apptDoc);
    const list = Data.appointments.filter(a => docs.some(d => d.id === a.doctor));
    const count = s => list.filter(a => a.status === s).length;
    const past = list.filter(a => a.time < Data.CLINIC_NOW).length;
    const kpis = [
      ['Appointments today', list.length, 'calendar', `${Data.SLOTS.length * docs.length - list.length} free slots`],
      ['Checked-in', count('Checked-in'), 'check', `${count('Completed')} visits completed`],
      ['Confirmed upcoming', count('Confirmed'), 'clock', `after ${Data.CLINIC_NOW}`],
      ['No-show rate', past ? count('No-show') / past * 100 : 0, 'alert', `${count('No-show')} patients did not arrive`]
    ];
    $('#apptKpis').innerHTML = kpis.map((k, i) => `<div class="card kpi"><div class="lbl">${icon(k[2])}${k[0]}</div><div class="val">${i === 3 ? fmt.pct(k[1]) : fmt.num(k[1])}</div><small style="color:var(--muted)">${k[3]}</small></div>`).join('');
    $('#schedule').innerHTML = docs.map(d => {
      const mine = Data.appointments.filter(a => a.doctor === d.id);
      let nowShown = false;
      const rows = Data.SLOTS.map(t => {
        let line = '';
        if (!nowShown && t > Data.CLINIC_NOW) { nowShown = true; line = `<div class="now-line">Now ${Data.CLINIC_NOW}</div>`; }
        const a = mine.find(x => x.time === t);
        if (a) return `${line}<button class="slot st-${slug(a.status)}" data-appt="${a.id}" aria-label="${t}, ${name(a)}, ${a.type}, ${a.status}"><time>${t}</time><span class="who"><b>${name(a)}</b><small>${a.type}</small></span>${badge(a.status)}</button>`;
        const gone = t < Data.CLINIC_NOW;
        return `${line}<button class="slot free" data-free="${d.id}|${t}" ${gone ? 'disabled' : ''} aria-label="${gone ? `${t} not booked` : `Book ${t} with ${d.name}`}"><time>${t}</time><span>${gone ? 'Not booked' : 'Available · click to book'}</span><span></span></button>`;
      }).join('');
      return `<div class="card"><div class="doc-head"><div class="pt-av">${d.name.split(' ').slice(1).map(w => w[0]).join('')}</div><div class="grow"><b>${d.name}</b><small>${d.spec} · ${d.room} · ${mine.length} patients</small></div></div><div class="slots">${rows}</div></div>`;
    }).join('');
  }
  $('#schedule').addEventListener('click', e => {
    const a = e.target.closest('[data-appt]');
    if (a) { openAppt(Data.appointments.find(x => x.id === a.dataset.appt)); return; }
    const f = e.target.closest('[data-free]');
    if (f && !f.disabled) { const [doc, time] = f.dataset.free.split('|'); openBook(doc, time); }
  });

  function openAppt(a) {
    const d = docById(a.doctor);
    const set = s => () => { a.status = s; audit(`Appointment ${s.toLowerCase()}`, a.id); renderAppts(); Kit.toast(`${name(a)} at ${a.time} marked as ${s.toLowerCase()}`); };
    const actions = {
      Confirmed: [{ label: 'Mark no-show', onClick: set('No-show') }, { label: 'Check in', primary: true, onClick: set('Checked-in') }],
      'Checked-in': [{ label: 'Complete visit', primary: true, onClick: set('Completed') }],
      'No-show': [{ label: 'Restore', onClick: set('Confirmed') }, { label: 'Reschedule', primary: true, onClick: () => later(() => openBook(a.doctor, null, a)) }],
      Completed: [{ label: 'Close', primary: true }]
    }[a.status];
    Kit.openModal({
      title: `${a.time} · ${name(a)}`,
      body: `<div class="kv"><div><small>Doctor</small>${d.name}</div><div><small>Specialty</small>${d.spec} · ${d.room}</div><div><small>Visit type</small>${a.type}</div><div><small>Status</small>${badge(a.status)}</div><div><small>Appointment ID</small><span class="mono">${a.id}</span></div><div><small>Reminder</small>SMS sent yesterday</div></div>`,
      actions
    });
  }

  function openBook(docId = Data.CLINIC[0].id, time, pre = {}) {
    const free = id => Data.SLOTS.filter(t => t > Data.CLINIC_NOW && !Data.appointments.some(a => a.doctor === id && a.time === t));
    const opts = (id, sel) => free(id).map(t => `<option ${t === sel ? 'selected' : ''}>${t}</option>`).join('') || '<option value="">No free slots</option>';
    const m = Kit.openModal({
      title: 'Book appointment',
      body: `<form class="form" id="bookForm"><label>Doctor<select name="doctor">${Data.CLINIC.map(d => `<option value="${d.id}" ${d.id === docId ? 'selected' : ''}>${d.name} · ${d.spec}</option>`).join('')}</select></label>
        <div class="kv"><label>Time<select name="time">${opts(docId, time)}</select></label><label>Visit type<select name="type">${Data.VISITS.map(v => `<option>${v}</option>`).join('')}</select></label>
        <label>First name<input name="first" value="${esc(pre.first || '')}" placeholder="Fictional name" autocomplete="off"></label><label>Last name<input name="last" value="${esc(pre.last || '')}" autocomplete="off"></label></div></form>`,
      actions: [{ label: 'Cancel' }, {
        label: 'Book', primary: true, onClick: mm => {
          const f = new FormData($('#bookForm', mm));
          if (!f.get('time')) { Kit.toast('No free slots left for this doctor today'); return false; }
          const missing = ['first', 'last'].find(k => !String(f.get(k)).trim());
          if (missing) { $(`[name="${missing}"]`, mm).focus(); return false; }
          const a = { id: `AP-${7700 + Data.appointments.length + 50}`, doctor: f.get('doctor'), time: f.get('time'), first: f.get('first').trim(), last: f.get('last').trim(), type: f.get('type'), status: 'Confirmed' };
          Data.appointments.push(a);
          audit('Booked appointment', a.id);
          if (apptDoc !== 'all' && apptDoc !== a.doctor) { apptDoc = 'all'; $('#docFilter').value = 'all'; }
          renderAppts();
          nav.go('appointments');
          Kit.toast(`Booked ${name(a)} with ${docById(a.doctor).name} at ${a.time}`);
        }
      }]
    });
    $('[name="doctor"]', m).addEventListener('change', e => { $('[name="time"]', m).innerHTML = opts(e.target.value); });
  }
  $('#bookBtn').addEventListener('click', () => openBook(apptDoc === 'all' ? undefined : apptDoc));

  const stockStatus = m => m.onOrder ? 'On order' : m.stock <= m.min * 0.5 ? 'Critical' : m.stock <= m.min ? 'Low' : 'In stock';
  let stockTbl, poSeq = 4410;
  function renderStockKpis() {
    Data.stock.forEach(m => { m.status = stockStatus(m); });
    const c = s => Data.stock.filter(m => m.status === s).length;
    const k = [
      ['Items tracked', Data.stock.length, 'pill', `${new Set(Data.stock.map(m => m.location)).size} storage locations`],
      ['Below minimum', c('Low') + c('Critical'), 'alert', `${c('Critical')} critical`],
      ['Open purchase orders', c('On order'), 'truck', 'auto-received in this demo'],
      ['Controlled substances', Data.stock.filter(m => m.controlled).length, 'lock', 'double-signature dispensing']
    ];
    $('#stockKpis').innerHTML = k.map(x => `<div class="card kpi"><div class="lbl">${icon(x[2])}${x[0]}</div><div class="val">${fmt.num(x[1])}</div><small style="color:var(--muted)">${x[3]}</small></div>`).join('');
  }
  function initStock() {
    renderStockKpis();
    stockTbl = Kit.table($('#stockTable'), {
      columns: [
        { key: 'name', label: 'Medicine', render: (v, r) => `<b>${v}</b>${r.controlled ? '<span class="ctl">CONTROLLED</span>' : ''}<br><small style="color:var(--muted)">${r.form} · <span class="mono">${r.sku}</span></small>` },
        { key: 'category', label: 'Category' },
        { key: 'location', label: 'Location' },
        { key: 'stock', label: 'Stock vs par', render: (v, r) => { const pct = Math.min(100, v / r.par * 100); const col = r.status === 'Critical' ? 'var(--bad)' : r.status === 'Low' ? 'var(--warn)' : 'var(--brand)'; return `<div class="stock"><div class="bar" role="progressbar" aria-valuenow="${pct.toFixed(0)}" aria-valuemin="0" aria-valuemax="100" aria-label="${r.name} stock level"><i style="width:${pct}%;background:${col}"></i></div><span>${fmt.num(v)}/${fmt.num(r.par)}</span></div>`; } },
        { key: 'min', label: 'Min', num: true, render: v => fmt.num(v) },
        { key: 'perDay', label: 'Days of cover', num: true, render: (v, r) => `${(r.stock / v).toFixed(1)} d` },
        { key: 'status', label: 'Status', render: (v, r) => `${badge(v)}${r.onOrder ? ` <small style="color:var(--muted)">+${fmt.num(r.onOrder)}</small>` : ''}` },
        { key: 'sku', label: 'Action', render: (v, r) => r.onOrder ? `<span class="mono" style="color:var(--muted)">${r.po}</span>` : `<button class="btn sm" aria-label="Reorder ${r.name}">Reorder</button>` }
      ],
      rows: Data.stock, pageSize: 10,
      filters: [{ label: 'Category', key: 'category', options: [...new Set(Data.stock.map(m => m.category))] }, { label: 'Status', key: 'status', options: ['In stock', 'Low', 'Critical', 'On order'] }],
      onRow: openReorder
    });
    renderPharmacyPanels();
  }
  const refreshStock = () => { renderStockKpis(); stockTbl.refresh(Data.stock); };

  function renderPharmacyPanels() {
    const colors = ['#0b7bdc', '#12b5cb', '#7b4bd6', '#e37400', '#188038', '#d93025', '#9aa0a6'];
    const byCat = Object.entries(Data.stock.reduce((a, m) => ({ ...a, [m.category]: (a[m.category] || 0) + m.perDay }), {})).sort((a, b) => b[1] - a[1]);
    const items = [...byCat.slice(0, 6), ['Other', byCat.slice(6).reduce((a, b) => a + b[1], 0)]].filter(x => x[1] > 0);
    Kit.donut($('#dispDonut'), { items: items.map((x, i) => ({ label: x[0], value: x[1], color: colors[i] })), center: { value: fmt.num(items.reduce((a, b) => a + b[1], 0)), label: 'units today' } });
    $('#expiring').innerHTML = Data.stock.filter(m => m.expiring).sort((a, b) => a.expiring - b.expiring).map(m => `<div class="li"><span class="ic ${m.expiring <= 10 ? 'bad' : 'warn'}">${icon('clock')}</span><div class="grow"><b>${m.name} ${m.form}</b><small>Lot L${m.sku.slice(4)}-${m.expiring * 3} · ${m.location}</small></div><span class="badge ${m.expiring <= 10 ? 'bad' : 'warn'}">${m.expiring} days</span></div>`).join('') || '<p class="empty">Nothing expiring soon.</p>';
  }

  function openReorder(m) {
    if (m.onOrder) {
      Kit.openModal({ title: `${m.name} · ${m.po}`, body: `<p>Purchase order <b class="mono">${m.po}</b> for <b>${fmt.num(m.onOrder)}</b> units is in transit from the supplier.</p>`, actions: [{ label: 'Close', primary: true }] });
      return;
    }
    const suggested = Math.max(m.par - m.stock, Math.round(m.perDay * 3));
    Kit.openModal({
      title: `Reorder ${m.name}`,
      body: `<div class="kv" style="margin-bottom:16px"><div><small>Current stock</small><b>${fmt.num(m.stock)}</b></div><div><small>Par level</small><b>${fmt.num(m.par)}</b></div><div><small>Daily use</small><b>${m.perDay}</b></div><div><small>Days of cover</small><b>${(m.stock / m.perDay).toFixed(1)} d</b></div></div>
        <form class="form" id="poForm"><label>Quantity<input name="qty" type="number" min="1" value="${suggested}"></label><label>Supplier<select name="sup"><option>Northline Medical Supply</option><option>Apex Hospital Distribution</option><option>Regional Pharma Logistics</option></select></label></form>`,
      actions: [{ label: 'Cancel' }, {
        label: 'Create purchase order', primary: true, onClick: mm => {
          const q = Number(new FormData($('#poForm', mm)).get('qty'));
          if (!(q > 0)) { $('#poForm input', mm).focus(); return false; }
          placeOrder(m, q);
        }
      }]
    });
  }

  function placeOrder(m, q, quiet) {
    m.onOrder = q; m.po = `PO-${poSeq++}`;
    audit('Created purchase order', `${m.po} · ${m.name}`);
    refreshStock();
    if (!quiet) Kit.toast(`${m.po} created: ${fmt.num(q)} × ${m.name}`);
    setTimeout(() => {
      m.stock += m.onOrder; m.onOrder = 0;
      refreshStock();
      Kit.toast(`${m.po} received: ${m.name} restocked`);
    }, 7000 + Math.random() * 3000);
  }
  $('#reorderAll').addEventListener('click', () => {
    const low = Data.stock.filter(m => m.status === 'Low' || m.status === 'Critical');
    if (!low.length) { Kit.toast('No items below minimum'); return; }
    low.forEach(m => placeOrder(m, m.par - m.stock, true));
    Kit.toast(`${low.length} purchase orders created`);
  });

  const PRIVACY = [
    ['mask', 'Mask patient names', 'Show initials only (e.g. "J. S.") on every screen'],
    ['audit', 'Audit log of chart access', 'Record every chart view with user, time and record'],
    ['breakGlass', 'Break-the-glass for restricted records', 'Require a reason before opening restricted charts'],
    ['exportId', 'Allow identifiable data export', 'When off, exports are de-identified']
  ];
  const sw = (on, label, attr) => `<button class="switch ${on ? 'on' : ''}" role="switch" aria-checked="${on}" aria-label="${label}" ${attr}></button>`;
  function renderSettings() {
    $('#unitsCfg').innerHTML = Data.UNITS.map((u, i) => `<div class="li"><span class="ic">${icon('bed')}</span><div class="grow"><b>${u.name}</b><small>${u.beds} beds · ${u.floor} · nurse ratio ${u.ratio}</small></div>${sw(u.accepting, `${u.name} accepting admissions`, `data-unit="${i}"`)}</div>`).join('');
    $('#privacy').innerHTML = PRIVACY.map(p => `<div class="li"><div class="grow"><b>${p[1]}</b><small>${p[2]}</small></div>${sw(settings[p[0]], p[1], `data-key="${p[0]}"`)}</div>`).join('');
  }
  const renderAudit = () => {
    $('#auditLog').innerHTML = Data.audit.slice(0, 12).map(a => `<div class="li audit"><span class="mono">${a.time}</span><div class="grow"><b>${a.action}</b><small>${a.user}</small></div><span class="mono">${esc(a.target)}</span></div>`).join('') || '<p class="empty">No entries.</p>';
  };
  $('#settings').addEventListener('click', e => {
    const s = e.target.closest('.switch');
    if (!s) return;
    const on = !s.classList.contains('on');
    s.classList.toggle('on', on); s.setAttribute('aria-checked', on);
    if (s.dataset.unit) {
      const u = Data.UNITS[Number(s.dataset.unit)];
      u.accepting = on;
      audit('Unit admissions changed', `${u.name}: ${on ? 'open' : 'closed'}`, true);
      renderBeds();
      Kit.toast(`${u.name} ${on ? 'is accepting admissions' : 'is closed to new admissions'}`);
    } else {
      settings[s.dataset.key] = on;
      audit('Privacy setting changed', `${s.getAttribute('aria-label')}: ${on ? 'on' : 'off'}`, true);
      if (s.dataset.key === 'mask') { refreshAll(); renderAppts(); }
      Kit.toast(`${s.getAttribute('aria-label')}: ${on ? 'on' : 'off'}`);
    }
    renderAudit();
  });

  let idleTimer;
  const lock = () => Kit.openModal({
    title: 'Session locked',
    body: `<div class="lock">${icon('lock')}<p>The console was locked after ${settings.timeout} minutes of inactivity to protect patient data.</p><small style="color:var(--muted)">In production you would sign in again with SSO and MFA.</small></div>`,
    actions: [{ label: 'Unlock', primary: true, onClick: () => audit('Session unlocked', 'Console', true) }]
  });
  const resetIdle = () => { clearTimeout(idleTimer); idleTimer = setTimeout(lock, settings.timeout * 60000); };
  ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'].forEach(ev => document.addEventListener(ev, resetIdle, { passive: true }));
  $$('#timeout button').forEach(b => b.addEventListener('click', () => {
    $$('#timeout button').forEach(x => x.classList.toggle('on', x === b));
    settings.timeout = Number(b.dataset.t);
    audit('Session timeout changed', `${settings.timeout} min`, true);
    renderAudit(); resetIdle();
    Kit.toast(`Session timeout set to ${settings.timeout} minutes`);
  }));

  function refreshAll(flash) {
    renderKpis(false);
    drawUnits();
    renderBeds(flash);
    renderEr();
    patTbl.refresh(Data.patients);
    badges();
  }

  setInterval(() => {
    Data.er.forEach(e => { e.wait += 1; });
    Data.beds.filter(b => b.status === 'Cleaning').forEach(b => { b.since += 1; });
    renderKpis(false); renderBeds(); renderEr(); renderAlerts();
    $('#updated').textContent = clock();
  }, 60000);

  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  $('#q').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const raw = e.target.value.trim();
    if (!raw) return;
    const t = norm(raw);
    const p = Data.patients.find(x => norm(x.mrn) === t || norm(x.mrn) === `mrn${t}`)
      || (/\d{3,}/.test(t) && Data.patients.find(x => norm(x.mrn).includes(t)))
      || Data.patients.find(x => x.full.toLowerCase().includes(raw.toLowerCase()))
      || Data.patients.find(x => norm(`${x.first[0]}${x.last[0]}`) === t);
    if (!p) { Kit.toast(`No patient found for "${esc(raw)}"`); return; }
    e.target.value = ''; e.target.blur();
    nav.go('patients');
    openChart(p);
  });

  $('#bellBtn').addEventListener('click', () => { nav.go('overview'); later(() => $('#alerts').scrollIntoView({ behavior: 'smooth', block: 'center' })); });
  $('#helpBtn').addEventListener('click', () => Kit.openModal({
    title: 'Keyboard and tips',
    body: `<div class="list"><div class="li"><kbd class="mono">/</kbd><div class="grow"><b>Search patients</b><small>Type an MRN (e.g. ${Data.patients[0].mrn}) or a name, then press Enter</small></div></div>
      <div class="li"><kbd class="mono">Esc</kbd><div class="grow"><b>Close dialogs</b><small>Works on every modal</small></div></div>
      <div class="li"><span class="ic">${icon('bed')}</span><div class="grow"><b>Bed board</b><small>Click any bed to discharge, assign, reserve or finish cleaning</small></div></div>
      <div class="li"><span class="ic">${icon('shield')}</span><div class="grow"><b>Privacy</b><small>Names are masked by default. All data is fictional.</small></div></div></div>`,
    actions: [{ label: 'Got it', primary: true }]
  }));

  renderKpis(); drawCensus(); drawUnits(); renderAlerts(); renderTheatres();
  renderBeds(); initEr(); renderEr(); initPatients(); renderAppts(); initStock(); renderSettings(); renderAudit(); badges();
  $('#updated').textContent = clock();
  resetIdle();

  document.addEventListener('view', e => {
    if (e.detail === 'overview') { drawCensus(); drawUnits(); renderTheatres(); }
    if (e.detail === 'pharmacy') renderPharmacyPanels();
    if (e.detail === 'settings') renderAudit();
  });
})();
