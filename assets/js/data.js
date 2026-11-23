const Data = (() => {
  const rnd = Kit.rng(2026);
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const int = (a, b) => Math.floor(a + rnd() * (b - a + 1));
  const sample = (arr, n) => [...arr].sort(() => rnd() - 0.5).slice(0, n);
  const days = n => Array.from({ length: n }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (n - 1 - i));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  const UNITS = [
    { name: 'ICU', short: 'ICU', code: 'ICU', beds: 12, floor: 'Floor 5', ratio: '1:2', accepting: true },
    { name: 'Ward A', short: 'Ward A', code: 'WA', beds: 24, floor: 'Floor 3 · Internal medicine', ratio: '1:5', accepting: true },
    { name: 'Ward B', short: 'Ward B', code: 'WB', beds: 24, floor: 'Floor 3 · Surgical', ratio: '1:5', accepting: true },
    { name: 'Pediatrics', short: 'Peds', code: 'PED', beds: 16, floor: 'Floor 2', ratio: '1:4', accepting: true },
    { name: 'Maternity', short: 'Maternity', code: 'MAT', beds: 14, floor: 'Floor 2', ratio: '1:3', accepting: true }
  ];

  const PHYSICIANS = {
    ICU: ['Dr. Helena Vasquez', 'Dr. Jonas Lindqvist'],
    'Ward A': ['Dr. Rafael Okoye', 'Dr. Priya Nair'],
    'Ward B': ['Dr. Amara Castillo', 'Dr. Theo Gallagher'],
    Pediatrics: ['Dr. Mei Tanaka', 'Dr. Lucas Ferraz'],
    Maternity: ['Dr. Laura Brandt', 'Dr. Ines Duarte']
  };

  const FEMALE = ['Maria', 'Sofia', 'Ana', 'Emma', 'Olivia', 'Chloe', 'Isabel', 'Nora', 'Leah', 'Clara', 'Yara', 'Elena', 'Julia', 'Rosa', 'Lina', 'Alice'];
  const MALE = ['James', 'Liam', 'Noah', 'Lucas', 'Mateo', 'Ethan', 'Daniel', 'Gabriel', 'Samuel', 'Hugo', 'Omar', 'Victor', 'Caio', 'Felix', 'Arthur', 'Tomas'];
  const LAST = ['Silva', 'Moreno', 'Hart', 'Costa', 'Nguyen', 'Becker', 'Rossi', 'Patel', 'Okafor', 'Lindgren', 'Duarte', 'Kowalski', 'Ferreira', 'Hayes', 'Sato', 'Mendes', 'Larsen', 'Ibrahim', 'Romero', 'Novak', 'Almeida', 'Fischer', 'Quinn', 'Barros'];

  const DIAGNOSES = {
    ICU: ['Septic shock', 'Acute respiratory distress', 'Post-op cardiac surgery', 'Stroke monitoring', 'Diabetic ketoacidosis'],
    'Ward A': ['Community-acquired pneumonia', 'Heart failure exacerbation', 'COPD exacerbation', 'Cellulitis', 'Urinary tract infection'],
    'Ward B': ['Post-op appendectomy', 'Hip fracture repair', 'Cholecystectomy recovery', 'Bowel obstruction', 'Knee replacement'],
    Pediatrics: ['Bronchiolitis', 'Gastroenteritis', 'Asthma attack', 'Febrile seizure observation'],
    Maternity: ['Postpartum care', 'Cesarean recovery', 'Preterm labor monitoring', 'Pre-eclampsia observation']
  };

  const MEDS = {
    ICU: ['Norepinephrine 0.1 mcg/kg/min IV', 'Propofol 20 mg/h IV', 'Piperacillin-tazobactam 4.5 g IV q6h', 'Enoxaparin 40 mg SC daily', 'Pantoprazole 40 mg IV daily', 'Insulin infusion per protocol'],
    'Ward A': ['Ceftriaxone 1 g IV daily', 'Furosemide 40 mg IV bid', 'Salbutamol 2.5 mg neb q6h', 'Paracetamol 1 g PO q6h PRN', 'Enoxaparin 40 mg SC daily', 'Prednisone 40 mg PO daily'],
    'Ward B': ['Morphine 2 mg IV q4h PRN', 'Cefazolin 1 g IV q8h', 'Ondansetron 4 mg IV PRN', 'Paracetamol 1 g IV q6h', 'Enoxaparin 40 mg SC daily'],
    Pediatrics: ['Paracetamol 15 mg/kg PO q6h', 'Salbutamol 2.5 mg neb q4h', 'Oral rehydration solution', 'Amoxicillin 40 mg/kg/day PO', 'Ibuprofen 10 mg/kg PO PRN'],
    Maternity: ['Oxytocin 10 IU IM', 'Ibuprofen 400 mg PO q8h', 'Ferrous sulfate 325 mg PO daily', 'Prenatal vitamins PO daily', 'Paracetamol 1 g PO PRN']
  };

  const ALLERGIES = ['Penicillin', 'Latex', 'Sulfonamides', 'Iodinated contrast', 'Peanuts', 'Aspirin', 'Morphine'];

  let mrnSeq = 104200;
  const makePatient = (unit, bed, extra = {}) => {
    const ped = unit === 'Pediatrics', mat = unit === 'Maternity', icu = unit === 'ICU';
    const first = extra.first || pick(mat ? FEMALE : rnd() < 0.5 ? FEMALE : MALE);
    const last = extra.last || pick(LAST);
    const age = extra.age || (ped ? int(1, 16) : mat ? int(19, 42) : icu ? int(38, 89) : int(18, 92));
    const base = icu ? 94 : ped ? 102 : 76;
    const hr = Array.from({ length: 24 }, (_, i) => Math.round(base + Math.sin(i / 3 + rnd()) * (icu ? 12 : 6) + rnd() * 8));
    const los = extra.los ?? int(0, 9);
    const admitted = new Date(); admitted.setDate(admitted.getDate() - los);
    const status = extra.status || (icu ? pick(['Critical', 'Critical', 'Stable', 'Observation']) : pick(['Stable', 'Stable', 'Observation', 'Discharge planned']));
    mrnSeq += int(7, 61);
    return {
      mrn: `MRN-${mrnSeq}`,
      first, last, full: `${first} ${last}`,
      sex: FEMALE.includes(first) ? 'F' : 'M',
      age, unit, bed, status, los,
      admitted: admitted.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      physician: pick(PHYSICIANS[unit]),
      diagnosis: extra.diagnosis || pick(DIAGNOSES[unit]),
      allergies: sample(ALLERGIES, rnd() < 0.45 ? 0 : int(1, 2)),
      meds: sample(MEDS[unit], int(2, 4)),
      hr,
      vitals: {
        bp: `${int(102, 146)}/${int(60, 92)}`,
        spo2: icu ? int(89, 97) : int(94, 99),
        temp: (36.3 + rnd() * 1.9).toFixed(1),
        rr: icu ? int(18, 28) : int(12, 20)
      }
    };
  };

  const beds = [];
  const patients = [];
  UNITS.forEach(u => {
    for (let i = 1; i <= u.beds; i++) {
      const id = `${u.code}-${String(i).padStart(2, '0')}`;
      const r = rnd();
      const status = r < (u.name === 'ICU' ? 0.86 : 0.78) ? 'Occupied' : r < 0.87 ? 'Cleaning' : r < 0.93 ? 'Reserved' : 'Available';
      const bed = { id, unit: u.name, status };
      if (status === 'Occupied') { const p = makePatient(u.name, id); patients.push(p); bed.mrn = p.mrn; }
      if (status === 'Cleaning') bed.since = int(8, 40);
      beds.push(bed);
    }
  });
  Array.from({ length: 8 }, () => {
    const u = pick(UNITS).name;
    const p = makePatient(u, '—', { status: 'Discharged', los: int(1, 6) });
    patients.push(p);
  });

  const TRIAGE = [
    { level: 'Red', label: 'Immediate', target: 0, color: '#d93025' },
    { level: 'Orange', label: 'Very urgent', target: 10, color: '#f57c00' },
    { level: 'Yellow', label: 'Urgent', target: 60, color: '#f9ab00' },
    { level: 'Green', label: 'Standard', target: 120, color: '#188038' },
    { level: 'Blue', label: 'Non-urgent', target: 240, color: '#1a73e8' }
  ];
  const COMPLAINTS = {
    Red: ['Severe respiratory distress', 'Major trauma', 'Unresponsive, low pulse'],
    Orange: ['Chest pain', 'Stroke symptoms', 'Severe abdominal pain', 'High fever with confusion'],
    Yellow: ['Suspected fracture', 'Moderate asthma', 'Persistent vomiting', 'Head injury, alert'],
    Green: ['Ankle sprain', 'Minor laceration', 'Urinary symptoms', 'Ear pain', 'Back pain'],
    Blue: ['Prescription renewal', 'Mild rash', 'Cold symptoms']
  };
  const WAITS = { Red: [1, 5], Orange: [4, 22], Yellow: [18, 85], Green: [25, 150], Blue: [40, 210] };
  const order = ['Orange', 'Yellow', 'Green', 'Yellow', 'Red', 'Green', 'Blue', 'Yellow', 'Orange', 'Green', 'Yellow', 'Blue', 'Green', 'Orange'];
  let erSeq = 5310;
  const makeEr = (priority, extra = {}) => {
    const first = extra.first || pick([...FEMALE, ...MALE]);
    const wait = extra.wait ?? int(...WAITS[priority]);
    const arrived = new Date(Date.now() - wait * 60000);
    return {
      id: `ER-${erSeq++}`,
      first, last: extra.last || pick(LAST),
      age: extra.age || int(4, 88),
      priority,
      complaint: extra.complaint || pick(COMPLAINTS[priority]),
      wait,
      arrival: arrived.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      hr: extra.hr || int(68, 128),
      spo2: extra.spo2 || int(88, 99)
    };
  };
  const er = order.map(p => makeEr(p));

  const admissions30 = Array.from({ length: 30 }, (_, i) => Math.round(34 + Math.sin(i / 3.2) * 6 + (i % 7 === 0 ? -8 : 0) + rnd() * 7));
  const discharges30 = admissions30.map((v, i) => Math.round(v - 2 + Math.cos(i / 2.7) * 5 + rnd() * 5));
  const occTrend = [71.8, 72.9, 74.1, 75.3, 73.6, 72.8, 74.4, 76.2, 75.1, 73.9, 76.8, 75.7, 74.9, 0];
  const erTrend = [18, 15, 21, 17, 19, 23, 16, 14, 20, 22, 18, 17, 16, 0];
  const waitTrend = [62, 58, 71, 66, 54, 69, 73, 61, 57, 64, 68, 59, 63, 0];
  const surgTrend = [14, 16, 12, 17, 15, 9, 6, 15, 18, 16, 14, 17, 16, 18];
  const surgeries = { today: 18, done: 7, theatres: 6 };

  const icuPt = patients.find(p => p.unit === 'ICU');
  const wardPt = patients.find(p => p.unit === 'Ward A' && p.status !== 'Discharged');
  const slowBed = beds.find(b => b.status === 'Cleaning');
  slowBed.since = 74;
  const alerts = [
    { level: 'bad', icon: 'drop', title: 'Critical lab result', text: `Potassium 6.4 mmol/L · ${icuPt.mrn} · bed ${icuPt.bed}`, time: '2 min ago' },
    { level: 'warn', icon: 'bed', title: 'Bed cleaning delay', text: `${slowBed.id} in cleaning for 74 min (target 45 min)`, time: '6 min ago' },
    { level: 'bad', icon: 'heart', title: 'Early warning score 7', text: `${wardPt.mrn} · bed ${wardPt.bed} · rapid response notified`, time: '11 min ago' },
    { level: 'warn', icon: 'pill', title: 'Low stock', text: 'Ceftriaxone 1 g below minimum in central pharmacy', time: '25 min ago' },
    { level: 'info', icon: 'users', title: 'ER arrivals above forecast', text: 'Arrivals 30% above forecast for this hour', time: '32 min ago' }
  ];
  const alertPool = [
    { level: 'bad', icon: 'drop', title: 'Critical lab result', text: p => `Troponin I 2.8 ng/mL · ${p.mrn} · bed ${p.bed}` },
    { level: 'warn', icon: 'bed', title: 'Bed cleaning delay', text: () => `${pick(beds).id} cleaning exceeded 45 min target` },
    { level: 'bad', icon: 'thermo', title: 'Sepsis screen positive', text: p => `${p.mrn} · bed ${p.bed} · lactate 3.1 mmol/L` },
    { level: 'info', icon: 'swap', title: 'Transfer request', text: () => 'ER requests 1 ICU bed for incoming patient' },
    { level: 'warn', icon: 'clock', title: 'Medication overdue', text: p => `${p.mrn} · scheduled dose 30 min overdue` }
  ];

  const CLINIC = [
    { id: 'nair', name: 'Dr. Priya Nair', spec: 'Cardiology', room: 'Clinic 3' },
    { id: 'cole', name: 'Dr. Ethan Cole', spec: 'Orthopedics', room: 'Clinic 5' },
    { id: 'marin', name: 'Dr. Sofia Marin', spec: 'Dermatology', room: 'Clinic 7' },
    { id: 'mensah', name: 'Dr. Kwame Mensah', spec: 'Endocrinology', room: 'Clinic 2' }
  ];
  const SLOTS = Array.from({ length: 18 }, (_, i) => `${String(8 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
  const CLINIC_NOW = '10:45';
  const VISITS = ['Follow-up', 'New patient', 'Results review', 'Pre-op assessment', 'Procedure'];
  let apSeq = 7700;
  const appointments = [];
  CLINIC.forEach(d => SLOTS.forEach(t => {
    if (rnd() < 0.28) return;
    const r = rnd();
    const status = t < '10:00' ? (r < 0.82 ? 'Completed' : 'No-show') : t < CLINIC_NOW ? (r < 0.85 ? 'Checked-in' : 'No-show') : 'Confirmed';
    appointments.push({ id: `AP-${apSeq++}`, doctor: d.id, time: t, first: pick([...FEMALE, ...MALE]), last: pick(LAST), type: pick(VISITS), status });
  }));

  const stock = [
    { name: 'Ceftriaxone', form: '1 g vial', category: 'Antibiotic', location: 'Central pharmacy', stock: 38, par: 240, min: 60, perDay: 22 },
    { name: 'Amoxicillin', form: '500 mg capsule', category: 'Antibiotic', location: 'Central pharmacy', stock: 1240, par: 1500, min: 400, perDay: 85 },
    { name: 'Vancomycin', form: '1 g vial', category: 'Antibiotic', location: 'Central pharmacy', stock: 72, par: 120, min: 30, perDay: 6 },
    { name: 'Paracetamol', form: '1 g/100 mL IV', category: 'Analgesic', location: 'Central pharmacy', stock: 410, par: 600, min: 150, perDay: 48 },
    { name: 'Morphine', form: '10 mg/mL ampoule', category: 'Analgesic', location: 'Controlled cabinet', stock: 22, par: 80, min: 25, perDay: 5, controlled: true },
    { name: 'Heparin', form: '5,000 IU/mL vial', category: 'Anticoagulant', location: 'Central pharmacy', stock: 160, par: 200, min: 50, perDay: 14 },
    { name: 'Enoxaparin', form: '40 mg syringe', category: 'Anticoagulant', location: 'Ward A cabinet', stock: 95, par: 300, min: 90, perDay: 31 },
    { name: 'Insulin glargine', form: '100 IU/mL pen', category: 'Endocrine', location: 'Cold room', stock: 64, par: 90, min: 20, perDay: 4 },
    { name: 'Omeprazole', form: '40 mg IV vial', category: 'Gastrointestinal', location: 'Central pharmacy', stock: 210, par: 260, min: 60, perDay: 18 },
    { name: 'Ondansetron', form: '4 mg/2 mL ampoule', category: 'Gastrointestinal', location: 'Ward B cabinet', stock: 54, par: 180, min: 45, perDay: 16 },
    { name: 'Salbutamol', form: '2.5 mg nebule', category: 'Respiratory', location: 'Pediatrics cabinet', stock: 280, par: 320, min: 80, perDay: 26 },
    { name: 'Furosemide', form: '20 mg/2 mL ampoule', category: 'Cardiovascular', location: 'Central pharmacy', stock: 140, par: 200, min: 40, perDay: 12 },
    { name: 'Norepinephrine', form: '4 mg/4 mL ampoule', category: 'Cardiovascular', location: 'ICU cabinet', stock: 9, par: 60, min: 18, perDay: 7 },
    { name: 'Midazolam', form: '5 mg/mL ampoule', category: 'Sedation', location: 'Controlled cabinet', stock: 46, par: 70, min: 20, perDay: 6, controlled: true },
    { name: 'Propofol', form: '1% 50 mL vial', category: 'Sedation', location: 'ICU cabinet', stock: 33, par: 80, min: 24, perDay: 9 },
    { name: 'Sodium chloride 0.9%', form: '1 L bag', category: 'Fluids', location: 'Central store', stock: 920, par: 1200, min: 300, perDay: 140 },
    { name: 'Oxytocin', form: '10 IU/mL ampoule', category: 'Obstetric', location: 'Maternity cabinet', stock: 58, par: 90, min: 20, perDay: 5 }
  ].map((m, i) => ({ ...m, sku: `SKU-${3100 + i * 7}`, onOrder: 0, expiring: i % 5 === 2 ? int(4, 28) : 0 }));

  const audit = [
    { time: '08:02', user: 'N. Rocha (RN)', action: 'Opened chart', target: patients[3].mrn },
    { time: '08:15', user: 'Dr. H. Vasquez', action: 'Updated medication order', target: patients[0].mrn },
    { time: '09:41', user: 'Pharmacy bot', action: 'Stock count synced', target: 'Central pharmacy' },
    { time: '10:07', user: 'M. Oliveira', action: 'Exported de-identified census', target: 'All units' }
  ];

  return { days, UNITS, PHYSICIANS, beds, patients, makePatient, TRIAGE, COMPLAINTS, er, makeEr, admissions30, discharges30, occTrend, erTrend, waitTrend, surgTrend, surgeries, alerts, alertPool, CLINIC, SLOTS, CLINIC_NOW, VISITS, appointments, stock, audit };
})();
