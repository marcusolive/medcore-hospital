# MedCore HIS: functional specification

Version 1.0 · November 2026 · Author: Marcus Oliveira

## 1. Goal

Give hospital operations staff one console to see capacity, move patients through the emergency department and inpatient beds, run the outpatient clinic and keep critical medicines in stock, while protecting patient privacy by default.

## 2. Users

| Persona | Needs |
|---|---|
| Bed manager / house supervisor | See occupancy per unit, free beds and cleaning delays; admit and discharge quickly |
| ER charge nurse | Keep the triage queue ordered by clinical priority and call the next patient |
| Physician / ward nurse | Open a patient chart with vitals, allergies and active medications |
| Clinic receptionist | Manage the day schedule, check patients in, book free slots |
| Pharmacist | Track stock against par levels and raise purchase orders before items run out |
| Privacy officer (DPO) | Control name masking, data export, session timeout and review the audit log |

## 3. Scope

In scope for this demo: the seven screens below, client-side simulation of admissions, discharges, triage, appointments and purchase orders, and an in-memory audit log.
Out of scope: authentication, real clinical data, integrations (FHIR, LIS, ERP), persistence after reload.

## 4. Functional requirements

| ID | Requirement |
|---|---|
| FR-01 | The overview shows bed occupancy, ER patients waiting, average ER wait and surgeries today, each with a trend versus yesterday and a sparkline. |
| FR-02 | The admissions vs discharges chart switches between 7, 14 and 30 days and shows both series in a hover tooltip. |
| FR-03 | Occupancy by unit (ICU, Ward A, Ward B, Pediatrics, Maternity) is colored blue below 80%, orange from 80% and red from 90%. |
| FR-04 | Live alerts (critical lab result, bed cleaning delay, early warning score, low stock) can be acknowledged; new alerts arrive periodically. |
| FR-05 | The bed board shows every bed as a tile colored by status (Occupied, Available, Cleaning, Reserved), with counts per status and a unit filter. |
| FR-06 | Clicking an occupied bed shows the patient (initials only when masking is on) and allows discharge; the bed moves to Cleaning and becomes Available when cleaning ends. |
| FR-07 | Clicking an available or reserved bed allows assigning a patient from the ER queue or an elective admission, which creates a new MRN; units closed to admissions reject the assignment. |
| FR-08 | Every bed action updates the KPIs, unit occupancy, sidebar counters and shows a confirmation toast. |
| FR-09 | The ER queue is sorted by triage priority (Red, Orange, Yellow, Green, Blue) and then by longest wait; waits above the priority target are highlighted. |
| FR-10 | "Call next patient" removes the top of the queue and shows the patient and exam room in "Now serving". |
| FR-11 | A new triage requires name, complaint and priority; the patient enters the queue at the position given by the priority. |
| FR-12 | The patients table filters by text, unit, status and physician, sorts by any column and paginates. |
| FR-13 | The patient chart shows vitals with out-of-range values in red, a 24 h heart rate chart, allergies and active medications. |
| FR-14 | The clinic schedule shows each doctor's day as a timeline with Confirmed, Checked-in, Completed and No-show statuses and a "now" marker. |
| FR-15 | Booking an appointment only offers free future slots of the chosen doctor. |
| FR-16 | Pharmacy items are "Low" at or below the minimum and "Critical" at or below half of it; a reorder creates a purchase order and restocks the item when received. |
| FR-17 | Settings allow opening or closing units to admissions, toggling privacy controls and choosing a session timeout. |
| FR-18 | Global search (shortcut `/`, then Enter) opens the chart of a patient matching an MRN, part of an MRN, a name or masked initials. |

## 5. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-01 | No external dependencies besides web fonts; loads as static files. |
| NFR-02 | Usable from 360 px wide screens; navigation collapses into a menu below 860 px. |
| NFR-03 | Dialogs are reachable by keyboard and close with `Esc`; icon buttons and bed tiles have `aria-label`; switches expose `role="switch"` and `aria-checked`. |
| NFR-04 | Sample data is deterministic (seeded) so screenshots and tests are repeatable. |
| NFR-05 | Privacy by default (LGPD art. 46 and HIPAA minimum necessary): patient names are masked to initials on every screen unless the user turns masking off. |
| NFR-06 | Every chart view, admission, discharge and settings change is written to an audit log with user, time and record (HIPAA audit controls, LGPD accountability). Settings changes are always logged. |
| NFR-07 | The session locks after the configured inactivity timeout (5, 15 or 30 minutes). |
| NFR-08 | Exports are de-identified unless identifiable export is explicitly enabled; production would add encryption in transit and at rest, role-based access per unit and data retention rules. |
| NFR-09 | All people and records are fictional; no real patient data is ever loaded into the demo. |

## 6. User stories and acceptance criteria

**US-01 Discharge and turn over a bed**
As a bed manager, I want to discharge a patient and see the bed cleaned so I can admit the next one.
- Given an occupied bed, when I choose "Discharge", then the bed turns to Cleaning, occupancy drops and a toast confirms it.
- Given the bed is cleaning, when cleaning finishes or I choose "Mark as clean", then the bed becomes Available.

**US-02 Admit from the ER**
As a bed manager, I want to assign an ER patient to a free bed.
- Given an available bed in a unit accepting admissions, when I assign the first ER patient, then the patient gets an MRN, leaves the ER queue and the bed turns Occupied.
- Given the unit is closed to admissions, when I try to assign, then the dialog stays open and a toast explains why.

**US-03 Triage priority**
As an ER charge nurse, I want the most urgent patient called first.
- Given patients with different priorities, when I click "Call next patient", then the highest priority patient with the longest wait is removed and shown in "Now serving".

**US-04 Privacy by default**
As a privacy officer, I want names hidden unless needed.
- Given masking is on, then every screen shows initials such as "J. S.".
- Given I open a chart with the audit log on, then an entry with my user, time and MRN appears in the audit log.

**US-05 Avoid stock-outs**
As a pharmacist, I want to reorder low items in one step.
- Given items below minimum, when I click "Reorder all low items", then each gets a purchase order and the status changes to "On order".

## 7. Data model (simplified)

```
Unit         { name, code, beds, floor, ratio, accepting }
Bed          { id, unit, status: Occupied|Available|Cleaning|Reserved, mrn?, since? }
Patient      { mrn, first, last, age, sex, unit, bed, physician, status, diagnosis, allergies[], meds[], vitals, hr[24] }
ErEntry      { id, first, last, age, priority: Red|Orange|Yellow|Green|Blue, complaint, wait, arrival, hr, spo2 }
Appointment  { id, doctor, time, first, last, type, status: Confirmed|Checked-in|Completed|No-show }
StockItem    { sku, name, form, category, location, stock, par, min, perDay, onOrder, controlled }
AuditEntry   { time, user, action, target }
```

## 8. Production architecture (reference)

```
Browser ──> API gateway (SSO + MFA) ──> Clinical API (.NET) ──> PostgreSQL (encrypted)
                    │                        │
                    │                        ├──> FHIR server (Patient, Encounter, Location, Observation)
                    │                        ├──> Lab system (critical results) ──> Alerts
                    │                        └──> Pharmacy ERP (stock, purchase orders)
                    └──> ADT event stream ──> Bed board and census
                                   └──> Audit log (append-only) ──> DPO reports
```
