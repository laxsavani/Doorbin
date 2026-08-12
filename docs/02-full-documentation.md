# Doorbin Visuals — Collaborative Project Management System
## Full Backend Documentation v2 (Node.js + Express.js + MongoDB)
### (Attendance System + Full Automation Engine + Detailed APIs)

---

# PART A — DEVELOPMENT ORDER (Sauthi Pehla Shu Karvu)

Backend-only, aa exact sequence ma develop karo. Dareke phase pachla phase par depend kare che:

| # | Phase | Output |
|---|---|---|
| 1 | Project Setup + DB Connection + Folder Architecture | Base ready |
| 2 | Authentication (JWT) + RBAC Middleware | Login working, roles secure |
| 3 | User Management (Director) | Employees create thay |
| 4 | Department Management | Users department ma map thay |
| 5 | Client Management | Clients create thay |
| 6 | Project Management (Create/Update/Delete/Approve/Reject) | Core module |
| 7 | Project Workflow — Stage & Sub-stage | Project andar stages |
| 8 | Task & Subtask Management | Stage andar tasks |
| 9 | **Attendance & Leave System (full auto-calc)** | HR core |
| 10 | Resource Allocation & Artist Availability | Task assign na pela availability |
| 11 | Calendar, Timeline & Gantt (derived views) | Visual scheduling |
| 12 | Finance (Quotation → Invoice → Payment) | Money tracking |
| 13 | Business Development / CRM (Enquiry → Project) | Sales pipeline |
| 14 | Dashboard APIs (role-wise aggregation) | KPI summary |
| 15 | Reports + Export (Excel/PDF/CSV) | Download reports |
| 16 | Automation Engine + Cron Jobs (details in Part D) | Auto-calculations |
| 17 | Activity Log / Audit Trail | Tracking who changed what |
| 18 | Notifications | Alerts (deadline, delay, leave approval etc.) |
| 19 | File Upload (Multer) | Attachments |
| 20 | Testing + Postman/Swagger Docs + Deployment | Go live |

**MVP Priority (pehla sprint ma pura karo):** Phase 1 → 9 (Auth se Attendance sudhi) — kem ke aa badha j modules na foundation che ane HR/Director na roj na kaam mate zaruri che.

---

# PART B — TECH STACK & PROJECT SETUP

```bash
npm init -y
npm install express mongoose dotenv bcryptjs jsonwebtoken cors helmet morgan
npm install joi multer node-cron exceljs pdfkit json2csv
npm install --save-dev nodemon
```

## Folder Structure
```
doorbin-cpms-backend/
├── src/
│   ├── config/          (db.js, env.js)
│   ├── models/          (all mongoose schemas)
│   ├── controllers/     (business logic)
│   ├── routes/          (express routers)
│   ├── middlewares/     (auth, role, error, upload, validate)
│   ├── utils/           (helpers, calculators, exporters)
│   ├── jobs/            (cron jobs — automation engine)
│   ├── app.js
│   └── server.js
├── .env
└── package.json
```

## Standard API Response Format (use everywhere)
```json
// Success
{ "success": true, "message": "Project created successfully", "data": {} }

// Error
{ "success": false, "message": "Access denied", "error": "ROLE_NOT_ALLOWED" }
```

---

# PART C — ROLE & PERMISSION MATRIX (Final, based on tamara requirement)

| Module | Director | Production Manager | Artist | HR | BD Manager |
|---|:---:|:---:|:---:|:---:|:---:|
| User CRUD | ✅ Full | ❌ | ❌ | ❌ | ❌ |
| Department CRUD | ✅ Full | ❌ | ❌ | ❌ | ❌ |
| Project Create/Update/Delete | ✅ Full | ✅ Create/Update only | ❌ | ❌ | ❌ |
| Project Approve/Reject | ✅ | ❌ | ❌ | ❌ | ❌ |
| Stage Create | ✅ | ✅ | ❌ | ❌ | ❌ |
| Task Create/Assign | ✅ | ✅ | ✅ (own only) | ❌ | ❌ |
| Task Update/Status/Upload/Notes | ✅ | ✅ | ✅ (own only) | ❌ | ❌ |
| Resource Allocation | ✅ Full | ✅ Full | 🔸 View own | ✅ View only | ❌ |
| Finance Insert/Update/Delete | ✅ Full | ❌ | ❌ | ❌ | ✅ (Quotation/Client billing) |
| HR — Employee/Team Manage | ✅ Full | ❌ | ❌ | ✅ Full | ❌ |
| Attendance — mark/edit particular day | ✅ | ❌ | ❌ | ✅ | ❌ |
| Attendance — view own | ✅ | ✅ | ✅ | ✅ | ✅ |
| Business Development (CRM) | ✅ Full | ❌ | ❌ | ❌ | ✅ Full |
| Reports (view + Excel/PDF/CSV) | ✅ All | ✅ Project/Productivity | ❌ | ✅ HR only | ✅ Client/Sales only |
| Dashboard | ✅ Director | ✅ PM | ✅ Artist | ✅ HR | ✅ BD |
| Settings/System Config | ✅ Full | ❌ | ❌ | ❌ | ❌ |
| Calendar view | ✅ All events | ✅ Project events | ✅ Own tasks | ✅ Leave/Attendance | ✅ Own meetings/followups |
| Timeline/Gantt | ✅ All | ✅ All | 🔸 Own project (view) | ❌ | ❌ |
| Project Delete | ✅ Only | ❌ | ❌ | ❌ | ❌ |

🔒 **Hard restrictions (middleware level enforce karvana):**
- Artist → Finance & HR routes par 403 always
- HR → Finance routes par 403 always
- BD Manager → HR routes par 403 always (Finance ma limited access j)

---

# PART D — ATTENDANCE SYSTEM (Full Detail — Clock In/Out + Auto Average)

Tame kahyu — attendance nu data **ek j jagya (single source)** ma store thavu joiye, ane check-in/check-out par thi working hours automatic calculate thai ne average time pan automatic nikadvo joiye. Niche full design che.

## D.1 Attendance Model (`models/Attendance.js`)

```js
const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },              // e.g. 2026-08-12 (only date, no time)
  clockIn: { type: Date },                            // full datetime e.g. 2026-08-12T09:00:00
  clockOut: { type: Date },                           // full datetime e.g. 2026-08-12T18:10:00
  workingHours: { type: Number, default: 0 },         // AUTO-CALCULATED (in hours, decimal)
  status: {
    type: String,
    enum: ['present', 'absent', 'half_day', 'on_leave', 'holiday', 'week_off'],
    default: 'present'
  },
  isLate: { type: Boolean, default: false },           // AUTO-CALCULATED (vs shift start time)
  isEarlyLeave: { type: Boolean, default: false },      // AUTO-CALCULATED
  markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // HR/Director if manually edited
  editedManually: { type: Boolean, default: false },
  remarks: String,
  source: { type: String, enum: ['biometric', 'app', 'manual_entry'], default: 'manual_entry' }
}, { timestamps: true });

// One record per employee per date — prevents duplicate punches for same day
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
```

## D.2 Auto-Calculation Logic (`utils/attendanceCalc.js`)

Aa function **every clock-in/clock-out par automatically chale**, developer manually kai calculate na kare:

```js
const SHIFT_START = "09:00";   // configurable from Settings module
const SHIFT_END   = "18:00";

function calculateWorkingHours(clockIn, clockOut) {
  if (!clockIn || !clockOut) return 0;
  const diffMs = new Date(clockOut) - new Date(clockIn);
  const hours = diffMs / (1000 * 60 * 60);
  return Math.round(hours * 100) / 100;   // 2 decimal precision e.g. 8.25 hrs
}

function checkLateArrival(clockIn, shiftStart = SHIFT_START) {
  const clockInTime = new Date(clockIn).toTimeString().slice(0,5);
  return clockInTime > shiftStart;
}

function checkEarlyLeave(clockOut, shiftEnd = SHIFT_END) {
  const clockOutTime = new Date(clockOut).toTimeString().slice(0,5);
  return clockOutTime < shiftEnd;
}

module.exports = { calculateWorkingHours, checkLateArrival, checkEarlyLeave };
```

**Flow:** Employee clock-out mare tyare backend controller `calculateWorkingHours()` call kare → `workingHours`, `isLate`, `isEarlyLeave` fields automatic save thay. Manual calculation ni jarur nathi.

## D.3 Average Time Calculation (Monthly/Weekly/Custom Range)

Tame example aapyu — "clock in 9 vage, clock out 10 vage to average time show karvanu" — matlab **average clock-in time, average clock-out time, ane average working hours** ek employee na (ke badha employees na) ek period (week/month) mate nikadvana. Aa **MongoDB Aggregation Pipeline** thi thay:

```js
// controllers/attendance.controller.js
exports.getAverageAttendance = async (req, res) => {
  const { employeeId, fromDate, toDate } = req.query;

  const result = await Attendance.aggregate([
    {
      $match: {
        employee: new mongoose.Types.ObjectId(employeeId),
        date: { $gte: new Date(fromDate), $lte: new Date(toDate) },
        status: 'present',
        clockIn: { $ne: null },
        clockOut: { $ne: null }
      }
    },
    {
      $project: {
        clockInMinutes: {
          $add: [
            { $multiply: [{ $hour: "$clockIn" }, 60] },
            { $minute: "$clockIn" }
          ]
        },
        clockOutMinutes: {
          $add: [
            { $multiply: [{ $hour: "$clockOut" }, 60] },
            { $minute: "$clockOut" }
          ]
        },
        workingHours: 1
      }
    },
    {
      $group: {
        _id: null,
        avgClockInMinutes: { $avg: "$clockInMinutes" },
        avgClockOutMinutes: { $avg: "$clockOutMinutes" },
        avgWorkingHours: { $avg: "$workingHours" },
        totalDaysPresent: { $sum: 1 }
      }
    }
  ]);

  if (!result.length) return res.json({ success: true, data: null });

  const toTimeString = (mins) => {
    const h = Math.floor(mins / 60).toString().padStart(2, '0');
    const m = Math.round(mins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  res.json({
    success: true,
    data: {
      averageClockIn: toTimeString(result[0].avgClockInMinutes),   // e.g. "09:15"
      averageClockOut: toTimeString(result[0].avgClockOutMinutes), // e.g. "18:05"
      averageWorkingHours: Math.round(result[0].avgWorkingHours * 100) / 100,
      totalDaysPresent: result[0].totalDaysPresent
    }
  });
};
```

**Result example (jevu tame kahyu):** Employee A ne 20 din maathi 10 din 9:00 clock-in ane 10 din 9:30 clock-in kayu hoy, to `averageClockIn` = **09:15** automatic aavse. Same logic clock-out ane working hours mate.

## D.4 Attendance APIs

| Method | Endpoint | Role | Detail |
|---|---|---|---|
| POST | `/api/attendance/clock-in` | All employees | `{ employeeId }` → auto `clockIn = now()`, checks `isLate` |
| POST | `/api/attendance/clock-out` | All employees | auto `clockOut = now()` → triggers `calculateWorkingHours()` |
| GET | `/api/attendance` | Director, HR | Filter by date/department/employee |
| GET | `/api/attendance/:employeeId` | Self, HR, Director | Own record + history |
| PUT | `/api/attendance/:id` | HR, Director | **Edit particular day** (manual correction) — sets `editedManually: true` |
| GET | `/api/attendance/average?employeeId=&fromDate=&toDate=` | Self, HR, Director | Returns avg clock-in/out/hours (Section D.3) |
| GET | `/api/attendance/summary/:employeeId?month=&year=` | Self, HR, Director | Present/Absent/Half-day/Leave counts + total hours |
| GET | `/api/attendance/team-summary?department=&date=` | HR, Director | Daily team-wide present/absent grid |
| GET | `/api/attendance/export?type=excel\|pdf\|csv` | HR, Director | Download attendance report |

## D.5 Automation in Attendance
1. **Auto working hours** — clock-out par instantly calculate (D.2)
2. **Auto late/early-leave flag** — shift time thi compare thai automatic set
3. **Auto absent marking** — daily cron job (raat na 11:59) je employee e clock-in nathi karyu ane leave/holiday nathi, tene `status: 'absent'` automatic mark kare
4. **Auto holiday sync** — `Holiday` collection ma je date hoy tya automatic `status: 'holiday'` set thay, employee ne clock-in ni jarur nai
5. **Auto leave sync** — Leave approve thay etle e dates par attendance automatic `status: 'on_leave'` create/update thay (manual attendance entry ni jarur nathi)

---

# PART E — FULL AUTOMATION ENGINE (Badha Modules Ma)

Tame kahyu "je module maa automatic karvani jarur lage tya badhu automatic karvanu" — niche complete list che, dareke automation cron job (`node-cron`) athva event-trigger thi thase.

| # | Automation | Module | Trigger Type | Logic |
|---|---|---|---|---|
| 1 | Working hours calculation | Attendance | Event (on clock-out) | `calculateWorkingHours()` |
| 2 | Late/Early-leave flag | Attendance | Event (on clock-in/out) | Compare vs shift time |
| 3 | Auto absent marking | Attendance | Cron (daily 11:59 PM) | No clock-in + no leave/holiday → absent |
| 4 | Leave → Attendance sync | Attendance | Event (on leave approve) | Auto mark `on_leave` for date range |
| 5 | Task working days calculation | Task | Event (on start/end date set) | Exclude weekends + holidays |
| 6 | Task delay detection | Task | Cron (daily) | `endDate < today && status != completed` → `isDelayed = true` |
| 7 | Stage completion % | Stage | Event (on task status change) | `(completed tasks / total tasks) * 100` |
| 8 | Project progress % | Project | Event (on stage % change) | Weighted avg of all stages |
| 9 | Project delay detection | Project | Cron (daily) | Compare planned vs actual end date |
| 10 | Timeline variance | Project | Cron (daily) | `actualDuration - plannedDuration` |
| 11 | Gantt chart data refresh | Project/Task | Event (on any task/stage change) | Recompute chart JSON |
| 12 | Resource over-allocation alert | Resource | Event (on task assign) | If artist's daily allocated hours > capacity → flag + notify PM |
| 13 | Invoice due-reminder | Finance | Cron (daily) | `dueDate` nearing/passed → notify Director/BD |
| 14 | Outstanding dues calculation | Finance | Event (on payment insert) | `invoiceAmount - totalPaid` |
| 15 | Revenue realization % | Finance | Cron (daily/monthly) | `totalPaid / totalQuoted * 100` |
| 16 | Enquiry follow-up reminder | CRM | Cron (daily) | `followUpDate == today` → notify BD Manager |
| 17 | Lead-to-project conversion tracking | CRM | Event (on enquiry status = won) | Auto-suggest "Convert to Project" |
| 18 | Notification generation | Cross-module | Event (multiple triggers) | Deadline near, task assigned, leave approved, payment due, etc. |
| 19 | Activity log entry | Cross-module | Event (on every create/update/delete) | Auto-insert into `ActivityLog` collection |
| 20 | Dashboard KPI cache refresh | Dashboard | Cron (every 15 min or on-demand) | Precompute heavy aggregation for faster load |

## E.1 Cron Job File Structure (`jobs/`)
```
jobs/
├── autoMarkAbsent.job.js        // runs daily 23:59
├── recalcTaskDelay.job.js       // runs daily 00:30
├── recalcProjectProgress.job.js // runs daily 01:00
├── invoiceReminder.job.js       // runs daily 09:00
├── enquiryFollowupReminder.job.js // runs daily 09:00
└── index.js                     // registers all cron schedules on server start
```

```js
// jobs/index.js
const cron = require('node-cron');
require('./autoMarkAbsent.job');
require('./recalcTaskDelay.job');
require('./recalcProjectProgress.job');
require('./invoiceReminder.job');
require('./enquiryFollowupReminder.job');
```

```js
// jobs/autoMarkAbsent.job.js (example)
const cron = require('node-cron');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Holiday = require('../models/Holiday');

cron.schedule('59 23 * * *', async () => {
  const today = new Date().setHours(0,0,0,0);
  const isHoliday = await Holiday.findOne({ date: today });
  if (isHoliday) return;

  const employees = await User.find({ isActive: true });
  for (const emp of employees) {
    const exists = await Attendance.findOne({ employee: emp._id, date: today });
    if (!exists) {
      await Attendance.create({ employee: emp._id, date: today, status: 'absent' });
    }
  }
  console.log('Auto-absent marking completed:', new Date());
});
```

---

# PART F — DATABASE SCHEMA (All Models — Full Field List)

*(Attendance already covered in Part D)*

### User
```js
{
  name, email (unique), phone, password (hashed, select:false),
  role: enum['director','production_manager','artist','hr','bd_manager'],
  department: ObjectId(Department), designation, profileImage,
  skills: [String], shiftStartTime, shiftEndTime,
  isActive: Boolean, lastLogin, createdBy, timestamps
}
```

### Department
```js
{ name, parentDepartment: ObjectId(self-ref), head: ObjectId(User), description, timestamps }
```

### Client
```js
{
  companyName, clientName, email, phone, address, gstDetails, industry,
  contacts: [{ name, role, email, phone }], notes, timestamps
}
```

### Project
```js
{
  projectName, category: enum['architecture','interior_design','animation'],
  type, client: ObjectId(Client), architect, buildingOwner, developer,
  priority: enum['low','medium','high','urgent'], budget,
  startDate, endDate, assignedTeam: [ObjectId(User)],
  productionManager: ObjectId(User),
  status: enum['pending_approval','approved','rejected','in_progress','on_hold','completed','cancelled'],
  approvedBy, approvalDate,
  progressPercent: Number (AUTO), isDelayed: Boolean (AUTO),
  attachments: [String], createdBy, timestamps
}
```

### Stage / SubStage
```js
// Stage
{ project, name, order, dependsOn: ObjectId(self-ref), completionPercent (AUTO), status, timestamps }
// SubStage
{ stage, name, order, status, timestamps }
```

### Task
```js
{
  project, stage, subStage, parentTask,
  taskName, assignee, reviewer, priority,
  status: enum['pending','assigned','in_progress','under_review','revision_required','completed','approved','cancelled'],
  startDate, endDate, estimatedHours, actualHours,
  workingDays (AUTO), isDelayed (AUTO), dependencies: [ObjectId(Task)],
  comments: [{ user, text, createdAt }], attachments: [String],
  history: [{ field, oldValue, newValue, changedBy, changedAt }], timestamps
}
```

### Leave / Holiday
```js
// Leave
{ employee, leaveType, fromDate, toDate, reason, status: enum['pending','approved','rejected'], approvedBy, timestamps }
// Holiday
{ name, date, isOptional: Boolean, timestamps }
```

### Enquiry (CRM)
```js
{
  clientName, architectName, projectName, projectType, estimatedValue, source,
  assignedExecutive, followUpDate, priority,
  clientCategory: enum['aspirational','regulation','red_flag'],
  stage: enum['new','qualification','meeting','proposal','negotiation','won','lost'],
  activityLog: [{ type, note, date, by }],
  convertedProject: ObjectId(Project), notes, timestamps
}
```

### Finance (Quotation / Invoice / Payment)
```js
// Quotation
{ project, client, quotedAmount, date, status, createdBy, timestamps }
// Invoice
{ project, client, invoiceNumber, amount, dueDate, status: enum['unpaid','partial','paid'], timestamps }
// Payment
{ invoice, project, client, amountPaid, paymentDate, mode, recordedBy, timestamps }
```

### CalendarEvent / Notification / ActivityLog
```js
// CalendarEvent
{ title, type: enum['meeting','followup','deadline','holiday','leave'], relatedTo, refId, date, createdBy, visibleTo: [ObjectId(User)] }

// Notification
{ user, title, message, type, isRead: Boolean, refId, refModel, timestamps }

// ActivityLog
{ user, action, module, refId, details: Object, ipAddress, timestamp }
```

---

# PART G — FULL API LIST (All Modules, Consolidated)

### G.1 Auth
```
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh-token
POST   /api/auth/forgot-password
POST   /api/auth/reset-password/:token
GET    /api/auth/me
```

### G.2 User (Director only)
```
GET    /api/users
GET    /api/users/:id
POST   /api/users
PUT    /api/users/:id
DELETE /api/users/:id
PATCH  /api/users/:id/status
```

### G.3 Department (Director only)
```
GET    /api/departments
POST   /api/departments
PUT    /api/departments/:id
DELETE /api/departments/:id
```

### G.4 Client
```
GET    /api/clients
GET    /api/clients/:id
POST   /api/clients
PUT    /api/clients/:id
DELETE /api/clients/:id
GET    /api/clients/:id/statements
```

### G.5 Project
```
GET    /api/projects
GET    /api/projects/:id
POST   /api/projects
PUT    /api/projects/:id
DELETE /api/projects/:id             (Director only)
PATCH  /api/projects/:id/approve     (Director only)
PATCH  /api/projects/:id/reject      (Director only)
GET    /api/projects/:id/progress    (auto-calculated)
```

### G.6 Stage / Task
```
GET    /api/projects/:projectId/stages
POST   /api/projects/:projectId/stages
PUT    /api/stages/:id
DELETE /api/stages/:id
PATCH  /api/stages/:id/approve

GET    /api/tasks
GET    /api/tasks/:id
POST   /api/tasks
PUT    /api/tasks/:id
DELETE /api/tasks/:id
PATCH  /api/tasks/:id/status
POST   /api/tasks/:id/upload
POST   /api/tasks/:id/comments
GET    /api/tasks/:id/history
```

### G.7 Attendance & Leave (Full detail in Part D)
```
POST   /api/attendance/clock-in
POST   /api/attendance/clock-out
GET    /api/attendance
GET    /api/attendance/:employeeId
PUT    /api/attendance/:id                    (edit particular day)
GET    /api/attendance/average
GET    /api/attendance/summary/:employeeId
GET    /api/attendance/team-summary
GET    /api/attendance/export

GET    /api/leaves
POST   /api/leaves
PATCH  /api/leaves/:id/approve
PATCH  /api/leaves/:id/reject
GET    /api/holidays
POST   /api/holidays
```

### G.8 Resource / Calendar / Timeline / Gantt
```
GET    /api/resources/availability
GET    /api/resources/utilization
GET    /api/resources/allocation/:userId
POST   /api/resources/allocate

GET    /api/calendar
POST   /api/calendar/events
PUT    /api/calendar/events/:id
DELETE /api/calendar/events/:id

GET    /api/timeline/project/:projectId
GET    /api/timeline/artist/:userId
GET    /api/gantt/:projectId
```

### G.9 Finance
```
GET    /api/finance/quotations
POST   /api/finance/quotations
PUT    /api/finance/quotations/:id
DELETE /api/finance/quotations/:id
GET    /api/finance/invoices
POST   /api/finance/invoices
GET    /api/finance/payments
POST   /api/finance/payments
PUT    /api/finance/payments/:id
DELETE /api/finance/payments/:id
GET    /api/finance/reports/cashflow
GET    /api/finance/reports/outstanding
```

### G.10 HR (Employee/Team, separate from Attendance)
```
GET    /api/hr/employees
GET    /api/hr/employees/:id
PUT    /api/hr/employees/:id
GET    /api/hr/reports/attendance
GET    /api/hr/reports/performance
```

### G.11 CRM / Business Development
```
GET    /api/crm/enquiries
POST   /api/crm/enquiries
PUT    /api/crm/enquiries/:id
PATCH  /api/crm/enquiries/:id/stage
POST   /api/crm/enquiries/:id/convert
POST   /api/crm/enquiries/:id/activity
GET    /api/crm/pipeline
GET    /api/crm/reports/conversion
```

### G.12 Dashboard
```
GET    /api/dashboard/director
GET    /api/dashboard/production-manager
GET    /api/dashboard/artist
GET    /api/dashboard/hr
GET    /api/dashboard/bd
```

### G.13 Reports & Settings
```
GET    /api/reports/projects
GET    /api/reports/employees
GET    /api/reports/finance
GET    /api/reports/productivity
GET    /api/reports/export?type=excel|pdf|csv&report=...

GET    /api/settings
PUT    /api/settings
GET    /api/settings/roles
POST   /api/settings/roles/custom
```

---

# PART H — SAMPLE REQUEST/RESPONSE (Key APIs)

### H.1 Clock-In
```json
POST /api/attendance/clock-in
Headers: Authorization: Bearer <token>
Body: { }   // employeeId auto taken from req.user

Response:
{
  "success": true,
  "message": "Clocked in successfully",
  "data": {
    "employee": "66b1f...",
    "date": "2026-08-12",
    "clockIn": "2026-08-12T09:05:00.000Z",
    "isLate": true,
    "status": "present"
  }
}
```

### H.2 Clock-Out
```json
POST /api/attendance/clock-out
Response:
{
  "success": true,
  "message": "Clocked out successfully",
  "data": {
    "clockIn": "2026-08-12T09:05:00.000Z",
    "clockOut": "2026-08-12T18:10:00.000Z",
    "workingHours": 9.08,
    "isEarlyLeave": false
  }
}
```

### H.3 Task Status Update (triggers auto stage/project progress recalculation)
```json
PATCH /api/tasks/:id/status
Body: { "status": "completed" }

Response:
{
  "success": true,
  "message": "Task status updated",
  "data": { "task": {...}, "stageProgress": 62.5, "projectProgress": 41.2 }
}
```

---

# PART I — FRONTEND FLOW (Role-wise Screen Flow)

### I.1 Director
```
Login → Director Dashboard (KPIs: Total/Active/Delayed Projects, Revenue, Outstanding, Team Utilization)
 ├── Users → Add/Edit/Delete
 ├── Departments → Add/Edit/Delete
 ├── Projects → Create → Approve/Reject → Detail → Stages → Tasks
 ├── Finance → Quotations → Invoices → Payments → Reports
 ├── HR → Employees → Attendance Grid (edit particular day) → Leave Approvals → Reports
 ├── Business Development → Enquiries Pipeline → Reports
 ├── Resource Allocation → Availability Grid
 ├── Calendar → Full studio (meetings/followups/deadlines/leaves) live view
 ├── Timeline & Gantt → Project-wise / Artist-wise
 ├── Reports → All, export Excel/PDF/CSV
 └── Settings → System Config, Custom Roles, Shift Timings
```

### I.2 Production Manager
```
Login → PM Dashboard (Active Projects, Stage Progress, Team Workload, Delayed Tasks)
 ├── Projects → Create/Edit (no delete)
 ├── Project Detail → Stages → Tasks → Assign to Artist
 ├── Timeline/Gantt → drag-drop scheduling
 ├── Resource Allocation → assign artists (view availability)
 ├── Reports → Project/Productivity (view + download)
 └── Mark Stage/Project Completion
```

### I.3 Artist
```
Login → Artist Dashboard (Today's Work, Assigned Tasks, Pending Reviews, Deadlines)
 ├── My Projects (assigned only, read-only)
 ├── My Tasks → Add own task → Update status → Upload file (any format) → Submit work → Add notes
 ├── My Calendar → own tasks/deadlines auto-populated
 └── My Timeline → own project progress (read-only)
(No Finance/HR menu — hidden entirely at UI + blocked at API)
```

### I.4 HR
```
Login → HR Dashboard (Attendance Today, Pending Leaves, Team Strength)
 ├── Employees → List → Full Profile View → Edit
 ├── Team Database → Department Assignment
 ├── Attendance → Calendar grid, clock-in/out log, Average time view, Edit particular day
 ├── Leave Requests → Approve/Reject
 ├── Resource Availability → view
 └── HR Reports → Attendance/Leave/Performance → Export Excel/PDF/CSV
```

### I.5 Business Development Manager
```
Login → BD Dashboard (New Enquiries, Meetings, Follow-ups, Conversion Rate)
 ├── Enquiries → List → Add → Kanban Pipeline (New→Qualification→Meeting→Proposal→Negotiation→Won/Lost)
 ├── Enquiry Detail → Activity Log (calls/emails/meetings/notes) → Convert to Project
 ├── Client Database → Add/Edit
 ├── My Calendar → Meetings + Follow-ups (auto shown)
 ├── Finance (limited) → Quotations Insert/Update/Delete, Client Billing
 └── Client Reports → Download
```

---

# PART J — MIDDLEWARE CODE (Auth + RBAC)

```js
// middlewares/auth.middleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user || !req.user.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid or inactive user' });
    }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
};
```

```js
// middlewares/role.middleware.js
exports.authorize = (...allowedRoles) => (req, res, next) => {
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Access denied for this role' });
  }
  next();
};

// Extra: block Artist from Finance/HR, HR from Finance, BD from HR — apply directly on routes:
// router.use('/api/finance', authenticate, authorize('director', 'bd_manager'), financeRoutes)
// router.use('/api/hr', authenticate, authorize('director', 'hr'), hrRoutes)
```

---

# PART K — STEP-BY-STEP BUILD CHECKLIST (Practical, Follow in Order)

1. Project init + `db.js` + `.env`
2. `User` model + Auth APIs (login, JWT, refresh) + `auth.middleware.js` + `role.middleware.js`
3. Department CRUD
4. Client CRUD
5. Project CRUD + Approve/Reject
6. Stage + Task models & CRUD (role-scoped queries)
7. **Attendance system full build:** clock-in/out APIs → `attendanceCalc.js` utility → average-time aggregation API → manual edit API (HR/Director) → auto-absent cron job
8. Leave + Holiday module (+ auto-sync attendance on leave approval)
9. Resource Allocation APIs (based on Task + Attendance/Leave data)
10. Calendar + Timeline + Gantt read-APIs
11. Finance module (Quotation → Invoice → Payment)
12. CRM module (Enquiry pipeline + convert-to-project)
13. Dashboard aggregation APIs (role-wise)
14. Reports module + Excel/PDF/CSV export utilities
15. Automation engine — set up all cron jobs (Part E table)
16. Activity Log auto-insert middleware (hook into every controller's create/update/delete)
17. Notification system (triggered from automation events)
18. File upload (Multer) config for tasks/attachments
19. Input validation (Joi) on all POST/PUT
20. Postman collection / Swagger documentation
21. Testing (unit + integration)
22. Deployment prep (PM2, environment configs, MongoDB Atlas)

---

# PART L — `.env` Sample

```
PORT=5000
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/doorbin_cpms
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=1d
JWT_REFRESH_SECRET=your_refresh_secret
JWT_REFRESH_EXPIRE=7d
DEFAULT_SHIFT_START=09:00
DEFAULT_SHIFT_END=18:00
NODE_ENV=development
```

---

*Full detailed backend build documentation for "Collaborative Project Management System — Doorbin Visuals", covering development order, RBAC, database schema, complete API list, attendance automation (clock-in/out + average time), full automation engine across modules, middleware, frontend flow, and step-by-step build checklist.*
