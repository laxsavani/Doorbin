# Doorbin Visuals — Collaborative Project Management System
## Backend Development Plan (Node.js + Express.js + MongoDB)

---

## 0. Sauthi Pehla Shu Develop Karvu — Development Order (Roadmap)

Backend-first approach ma niche na order ma develop karvu best rahese. Dareke phase pachla phase par depend kare che, etle aa sequence follow karo:

| Phase | Module | Kem pehla? |
|---|---|---|
| **1** | Project Setup + DB Connection + Base Architecture | Foundation vagar kai nai thay |
| **2** | Authentication & Authorization (JWT + RBAC) | Badha modules aa vagar secure nai thay |
| **3** | User Management (Director controls) | Roles create thay pachi j baki users create thai sake |
| **4** | Department Management | Users ne department maa map karva pade |
| **5** | Client Management | Project banavta pela client hovo joiye |
| **6** | Project Management (Create/Update/Delete/Approve) | Core module — badhu aa par based che |
| **7** | Project Workflow (Stages & Sub-stages) | Project andar stages joiye |
| **8** | Task Management (Task + Subtask) | Stage andar tasks aave |
| **9** | Resource Allocation & Artist Availability | Task assign karta pehla artist availability joiye |
| **10** | Calendar, Timeline & Gantt Chart APIs | Task/Project data par based calculated views |
| **11** | Finance Management (Quotation/Invoice/Payment) | Project win thaya pachi finance start thay |
| **12** | HR Management (Attendance/Leave) | Employee master pehla thi hovo joiye (Phase 3) |
| **13** | Business Development (CRM - Enquiry → Project) | Enquiry se project conversion, project module joiye |
| **14** | Dashboard APIs (role-wise) | Badha modules na data par based |
| **15** | Reports & Analytics + Export (Excel/PDF/CSV) | Sauthi last — badha data aggregate thai etle |
| **16** | Notifications + Activity Logs + Audit Trail | Cross-cutting — parallel maa add thai sake |
| **17** | File Upload (Attachments) | Task/Project/HR badha ma vapras — utility module |

**Recommendation:** Phase 1–8 pehla ek sprint ma pura karo (ei "MVP core" che). Pachi Phase 9–13 baki roles maate. Phase 14–17 last polish.

---

## 1. Tech Stack

- **Runtime:** Node.js (v18+)
- **Framework:** Express.js
- **Database:** MongoDB (Mongoose ODM)
- **Auth:** JWT (access + refresh token) + bcrypt for password hashing
- **File Upload:** Multer (+ optional S3/Cloudinary)
- **Validation:** Joi / express-validator
- **Reports Export:** exceljs (Excel), pdfkit / puppeteer (PDF), json2csv (CSV)
- **Scheduling (auto-calc jobs):** node-cron
- **Logging:** winston / morgan
- **Environment Config:** dotenv

---

## 2. Backend Folder Structure

```
doorbin-cpms-backend/
│
├── src/
│   ├── config/
│   │   ├── db.js                 # MongoDB connection
│   │   └── env.js
│   │
│   ├── models/
│   │   ├── User.js
│   │   ├── Department.js
│   │   ├── Client.js
│   │   ├── Project.js
│   │   ├── Stage.js
│   │   ├── SubStage.js
│   │   ├── Task.js
│   │   ├── Attendance.js
│   │   ├── Leave.js
│   │   ├── Holiday.js
│   │   ├── Enquiry.js
│   │   ├── ActivityLog.js
│   │   ├── Quotation.js
│   │   ├── Invoice.js
│   │   ├── Payment.js
│   │   ├── Notification.js
│   │   └── CalendarEvent.js
│   │
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── user.controller.js
│   │   ├── department.controller.js
│   │   ├── client.controller.js
│   │   ├── project.controller.js
│   │   ├── stage.controller.js
│   │   ├── task.controller.js
│   │   ├── resource.controller.js
│   │   ├── calendar.controller.js
│   │   ├── finance.controller.js
│   │   ├── hr.controller.js
│   │   ├── attendance.controller.js
│   │   ├── crm.controller.js
│   │   ├── dashboard.controller.js
│   │   └── report.controller.js
│   │
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── user.routes.js
│   │   ├── department.routes.js
│   │   ├── client.routes.js
│   │   ├── project.routes.js
│   │   ├── stage.routes.js
│   │   ├── task.routes.js
│   │   ├── resource.routes.js
│   │   ├── calendar.routes.js
│   │   ├── finance.routes.js
│   │   ├── hr.routes.js
│   │   ├── attendance.routes.js
│   │   ├── crm.routes.js
│   │   ├── dashboard.routes.js
│   │   ├── report.routes.js
│   │   └── index.js               # combines all routes
│   │
│   ├── middlewares/
│   │   ├── auth.middleware.js      # verifies JWT
│   │   ├── role.middleware.js      # RBAC — checks role/permission
│   │   ├── error.middleware.js
│   │   ├── upload.middleware.js    # multer config
│   │   └── validate.middleware.js
│   │
│   ├── utils/
│   │   ├── generateToken.js
│   │   ├── calculateWorkingDays.js
│   │   ├── autoCalcEngine.js       # progress %, delays, variance
│   │   ├── exportExcel.js
│   │   ├── exportPDF.js
│   │   ├── exportCSV.js
│   │   └── apiResponse.js
│   │
│   ├── jobs/
│   │   └── dailyRecalc.job.js      # cron: recalc progress/delay daily
│   │
│   ├── app.js
│   └── server.js
│
├── .env
├── package.json
└── README.md
```

---

## 3. Role & Permission Matrix (Backend RBAC Design)

Prati role ne DB ma ek `role` field (enum) tarike store karisu: `director`, `production_manager`, `artist`, `hr`, `bd_manager`. Custom roles/permission templates future scope maate `Permission` collection banavi sakay (Director "System Configuration" ma custom roles banave).

| Module | Director | Production Manager | Artist | HR | BD Manager |
|---|:---:|:---:|:---:|:---:|:---:|
| User Add/Update/Delete | ✅ Full | ❌ | ❌ | ❌ | ❌ |
| Department Add/Update/Delete | ✅ Full | ❌ | ❌ | ❌ | ❌ |
| Project Create/Update/Delete | ✅ Full | ✅ Create/Update (no delete) | ❌ | ❌ | ❌ |
| Project Approve/Reject | ✅ | ❌ | ❌ | ❌ | ❌ |
| Stage/Task Create | ✅ | ✅ | ✅ (own task only) | ❌ | ❌ |
| Task Update | ✅ | ✅ | ✅ (own task only) | ❌ | ❌ |
| Resource Allocation | ✅ | ✅ | ❌ (view own only) | ✅ (view availability) | ❌ |
| Finance (Insert/Update/Delete) | ✅ Full | ❌ | ❌ | ❌ | ✅ (limited — quotations/client billing) |
| HR — Employee/Team/Attendance Manage | ✅ Full | ❌ | ❌ | ✅ Full | ❌ |
| Attendance — mark/update specific day | ✅ | ❌ | ❌ | ✅ | ❌ |
| Business Development (CRM) | ✅ Full | ❌ | ❌ | ❌ | ✅ Full |
| Reports View/Download (Excel/PDF/CSV) | ✅ All reports | ✅ Project/Productivity reports | ❌ | ✅ HR reports only | ✅ Client/Sales reports only |
| Dashboard | ✅ Director dashboard | ✅ PM dashboard | ✅ Artist dashboard | ✅ HR dashboard | ✅ BD dashboard |
| Settings / System Configuration | ✅ Full | ❌ | ❌ | ❌ | ❌ |
| Calendar (view) | ✅ All events | ✅ Project events | ✅ Own task events | ✅ Leave/HR events | ✅ Meetings/Follow-ups (own) |
| Timeline & Gantt Chart | ✅ All | ✅ All | ✅ Own project only (view) | ❌ | ❌ |
| Delete Projects | ✅ | ❌ | ❌ | ❌ | ❌ |

**Note:** Artist ne "Cannot access Finance", "Cannot access HR", "Cannot delete projects" — restrictions middleware level par enforce thase.

---

## 4. Database Schema (MongoDB / Mongoose Models)

### 4.1 User
```js
{
  name: String,
  email: { type: String, unique: true },
  phone: String,
  password: { type: String, select: false }, // bcrypt hashed
  role: { type: String, enum: ['director','production_manager','artist','hr','bd_manager'] },
  department: { type: ObjectId, ref: 'Department' },
  designation: String,
  profileImage: String,
  skills: [String],           // for skill-based task assignment
  isActive: { type: Boolean, default: true },
  lastLogin: Date,
  twoFactorEnabled: { type: Boolean, default: false },
  createdBy: { type: ObjectId, ref: 'User' },
  timestamps: true
}
```

### 4.2 Department
```js
{
  name: String,
  parentDepartment: { type: ObjectId, ref: 'Department' }, // hierarchy
  head: { type: ObjectId, ref: 'User' },
  description: String,
  timestamps: true
}
```

### 4.3 Client
```js
{
  companyName: String,
  clientName: String,
  email: String,
  phone: String,
  address: String,
  gstDetails: String,
  industry: String,
  contacts: [{ name: String, role: String, email: String, phone: String }],
  notes: String,
  timestamps: true
}
```

### 4.4 Project
```js
{
  projectName: String,
  category: { type: String, enum: ['architecture','interior_design','animation'] },
  type: String,          // Residential/Commercial/Office/Factory/Villa/Township etc.
  client: { type: ObjectId, ref: 'Client' },
  architect: String,
  buildingOwner: String,
  developer: String,      // for animation billing
  priority: { type: String, enum: ['low','medium','high','urgent'] },
  budget: Number,
  startDate: Date,
  endDate: Date,
  assignedTeam: [{ type: ObjectId, ref: 'User' }],
  productionManager: { type: ObjectId, ref: 'User' },
  status: { type: String, enum: ['pending_approval','approved','rejected','in_progress','on_hold','completed','cancelled'] },
  approvedBy: { type: ObjectId, ref: 'User' },
  approvalDate: Date,
  progressPercent: { type: Number, default: 0 },   // auto-calculated
  isDelayed: { type: Boolean, default: false },     // auto-calculated
  attachments: [String],
  createdBy: { type: ObjectId, ref: 'User' },
  timestamps: true
}
```

### 4.5 Stage
```js
{
  project: { type: ObjectId, ref: 'Project' },
  name: String,            // e.g. "Scene Preparation"
  order: Number,
  dependsOn: { type: ObjectId, ref: 'Stage' },
  completionPercent: { type: Number, default: 0 },
  approvalRequired: { type: Boolean, default: true },
  status: { type: String, enum: ['pending','in_progress','under_review','approved','completed'] },
  timestamps: true
}
```

### 4.6 SubStage (optional nested, or embed inside Stage)
```js
{
  stage: { type: ObjectId, ref: 'Stage' },
  name: String,             // e.g. "Building", "Site Development"
  order: Number,
  status: String,
  timestamps: true
}
```

### 4.7 Task
```js
{
  project: { type: ObjectId, ref: 'Project' },
  stage: { type: ObjectId, ref: 'Stage' },
  subStage: { type: ObjectId, ref: 'SubStage' },
  parentTask: { type: ObjectId, ref: 'Task' }, // for subtasks
  taskName: String,
  assignee: { type: ObjectId, ref: 'User' },
  reviewer: { type: ObjectId, ref: 'User' },
  priority: { type: String, enum: ['low','medium','high'] },
  status: {
    type: String,
    enum: ['pending','assigned','in_progress','under_review','revision_required','completed','approved','cancelled']
  },
  startDate: Date,
  endDate: Date,
  estimatedHours: Number,
  actualHours: Number,
  workingDays: Number,        // auto-calculated
  dependencies: [{ type: ObjectId, ref: 'Task' }],
  comments: [{ user: ObjectId, text: String, createdAt: Date }],
  attachments: [String],
  history: [{ field: String, oldValue: String, newValue: String, changedBy: ObjectId, changedAt: Date }],
  timestamps: true
}
```

### 4.8 Attendance
```js
{
  employee: { type: ObjectId, ref: 'User' },
  date: Date,
  status: { type: String, enum: ['present','absent','half_day','leave','holiday'] },
  checkIn: String,
  checkOut: String,
  markedBy: { type: ObjectId, ref: 'User' },   // HR/Director who edited that day
  remarks: String,
  timestamps: true
}
```

### 4.9 Leave
```js
{
  employee: { type: ObjectId, ref: 'User' },
  leaveType: String,
  fromDate: Date,
  toDate: Date,
  reason: String,
  status: { type: String, enum: ['pending','approved','rejected'] },
  approvedBy: { type: ObjectId, ref: 'User' },
  timestamps: true
}
```

### 4.10 Enquiry (CRM)
```js
{
  clientName: String,
  architectName: String,
  projectName: String,
  projectType: String,
  estimatedValue: Number,
  source: String,
  assignedExecutive: { type: ObjectId, ref: 'User' },
  followUpDate: Date,
  priority: String,
  clientCategory: { type: String, enum: ['aspirational','regulation','red_flag'] },
  stage: { type: String, enum: ['new','qualification','meeting','proposal','negotiation','won','lost'] },
  activityLog: [{ type: String, note: String, date: Date, by: ObjectId }], // calls/emails/meetings/notes
  convertedProject: { type: ObjectId, ref: 'Project' },
  notes: String,
  timestamps: true
}
```

### 4.11 Quotation / Invoice / Payment (Finance)
```js
// Quotation
{ project: ObjectId, client: ObjectId, quotedAmount: Number, date: Date, status: String, createdBy: ObjectId }

// Invoice
{ project: ObjectId, client: ObjectId, invoiceNumber: String, amount: Number, dueDate: Date, status: ['unpaid','partial','paid'] }

// Payment
{ invoice: ObjectId, project: ObjectId, client: ObjectId, amountPaid: Number, paymentDate: Date, mode: String, recordedBy: ObjectId }
```

### 4.12 CalendarEvent
```js
{
  title: String,
  type: { type: String, enum: ['meeting','followup','deadline','holiday','leave'] },
  relatedTo: { type: String, enum: ['project','task','enquiry','client'] },
  refId: ObjectId,
  date: Date,
  createdBy: { type: ObjectId, ref: 'User' },
  visibleTo: [{ type: ObjectId, ref: 'User' }]
}
```

### 4.13 ActivityLog / Audit Trail
```js
{
  user: ObjectId,
  action: String,       // "PROJECT_CREATED", "TASK_STATUS_CHANGED" etc.
  module: String,
  refId: ObjectId,
  details: Object,
  ipAddress: String,
  timestamp: Date
}
```

---

## 5. API Endpoints (Module-wise)

### 5.1 Authentication
| Method | Endpoint | Role |
|---|---|---|
| POST | `/api/auth/login` | Public |
| POST | `/api/auth/logout` | All (authenticated) |
| POST | `/api/auth/refresh-token` | All |
| POST | `/api/auth/forgot-password` | Public |
| POST | `/api/auth/reset-password/:token` | Public |
| GET | `/api/auth/me` | All |

### 5.2 User Management (Director only)
| Method | Endpoint | Role |
|---|---|---|
| GET | `/api/users` | Director, HR (view) |
| GET | `/api/users/:id` | Director, HR |
| POST | `/api/users` | Director |
| PUT | `/api/users/:id` | Director |
| DELETE | `/api/users/:id` | Director |
| PATCH | `/api/users/:id/status` | Director (activate/deactivate) |

### 5.3 Department Management (Director only)
| Method | Endpoint | Role |
|---|---|---|
| GET | `/api/departments` | All (read) |
| POST | `/api/departments` | Director |
| PUT | `/api/departments/:id` | Director |
| DELETE | `/api/departments/:id` | Director |

### 5.4 Client Management
| Method | Endpoint | Role |
|---|---|---|
| GET | `/api/clients` | Director, BD Manager |
| GET | `/api/clients/:id` | Director, BD Manager |
| POST | `/api/clients` | Director, BD Manager |
| PUT | `/api/clients/:id` | Director, BD Manager |
| DELETE | `/api/clients/:id` | Director |
| GET | `/api/clients/:id/statements` | Director, BD Manager |

### 5.5 Project Management
| Method | Endpoint | Role |
|---|---|---|
| GET | `/api/projects` | All (scoped by role) |
| GET | `/api/projects/:id` | All (scoped) |
| POST | `/api/projects` | Director, Production Manager |
| PUT | `/api/projects/:id` | Director, Production Manager |
| DELETE | `/api/projects/:id` | Director only |
| PATCH | `/api/projects/:id/approve` | Director |
| PATCH | `/api/projects/:id/reject` | Director |
| GET | `/api/projects/:id/progress` | All |

### 5.6 Stage / Sub-stage
| Method | Endpoint | Role |
|---|---|---|
| GET | `/api/projects/:projectId/stages` | All |
| POST | `/api/projects/:projectId/stages` | Director, Production Manager |
| PUT | `/api/stages/:id` | Director, Production Manager |
| DELETE | `/api/stages/:id` | Director |
| PATCH | `/api/stages/:id/approve` | Director, Production Manager |

### 5.7 Task Management
| Method | Endpoint | Role |
|---|---|---|
| GET | `/api/tasks` | All (scoped — artist sees own only) |
| GET | `/api/tasks/:id` | All (scoped) |
| POST | `/api/tasks` | Director, Production Manager, Artist (own) |
| PUT | `/api/tasks/:id` | Director, Production Manager, Artist (own, limited fields) |
| DELETE | `/api/tasks/:id` | Director, Production Manager |
| PATCH | `/api/tasks/:id/status` | Assignee, Reviewer |
| POST | `/api/tasks/:id/upload` | Assignee |
| POST | `/api/tasks/:id/comments` | All assigned |
| GET | `/api/tasks/:id/history` | Director, Production Manager |

### 5.8 Resource Allocation
| Method | Endpoint | Role |
|---|---|---|
| GET | `/api/resources/availability` | Director, Production Manager, HR |
| GET | `/api/resources/utilization` | Director, Production Manager |
| GET | `/api/resources/allocation/:userId` | Director, Production Manager |
| POST | `/api/resources/allocate` | Director, Production Manager |

### 5.9 Calendar / Timeline / Gantt
| Method | Endpoint | Role |
|---|---|---|
| GET | `/api/calendar` | All (scoped: own events + shared) |
| POST | `/api/calendar/events` | Director, BD Manager (meetings/followups) |
| PUT | `/api/calendar/events/:id` | Owner, Director |
| DELETE | `/api/calendar/events/:id` | Owner, Director |
| GET | `/api/timeline/project/:projectId` | Director, Production Manager, Artist (own) |
| GET | `/api/timeline/artist/:userId` | Director, Production Manager, Artist (own) |
| GET | `/api/gantt/:projectId` | Director, Production Manager, Artist (view own) |

### 5.10 Finance Management
| Method | Endpoint | Role |
|---|---|---|
| GET | `/api/finance/quotations` | Director, BD Manager |
| POST | `/api/finance/quotations` | Director, BD Manager |
| PUT | `/api/finance/quotations/:id` | Director, BD Manager |
| DELETE | `/api/finance/quotations/:id` | Director |
| GET | `/api/finance/invoices` | Director, BD Manager |
| POST | `/api/finance/invoices` | Director |
| GET | `/api/finance/payments` | Director, BD Manager |
| POST | `/api/finance/payments` | Director |
| PUT | `/api/finance/payments/:id` | Director |
| DELETE | `/api/finance/payments/:id` | Director |
| GET | `/api/finance/reports/cashflow` | Director |
| GET | `/api/finance/reports/outstanding` | Director, BD Manager (client-wise only) |

### 5.11 HR Management
| Method | Endpoint | Role |
|---|---|---|
| GET | `/api/hr/employees` | Director, HR |
| GET | `/api/hr/employees/:id` | Director, HR |
| PUT | `/api/hr/employees/:id` | Director, HR |
| GET | `/api/hr/attendance` | Director, HR |
| POST | `/api/hr/attendance` | HR, Director |
| PUT | `/api/hr/attendance/:id` | HR, Director *(edit particular day)* |
| GET | `/api/hr/attendance/:employeeId/:date` | HR, Director |
| GET | `/api/hr/leaves` | Director, HR |
| POST | `/api/hr/leaves` | All (self-apply) |
| PATCH | `/api/hr/leaves/:id/approve` | HR, Director |
| PATCH | `/api/hr/leaves/:id/reject` | HR, Director |
| GET | `/api/hr/holidays` | All |
| POST | `/api/hr/holidays` | HR, Director |
| GET | `/api/hr/reports/attendance` | HR, Director |
| GET | `/api/hr/reports/performance` | HR, Director |

### 5.12 Business Development (CRM)
| Method | Endpoint | Role |
|---|---|---|
| GET | `/api/crm/enquiries` | Director, BD Manager |
| POST | `/api/crm/enquiries` | BD Manager, Director |
| PUT | `/api/crm/enquiries/:id` | BD Manager, Director |
| PATCH | `/api/crm/enquiries/:id/stage` | BD Manager |
| POST | `/api/crm/enquiries/:id/convert` | BD Manager, Director (Enquiry → Project) |
| POST | `/api/crm/enquiries/:id/activity` | BD Manager (calls/emails/meetings/notes) |
| GET | `/api/crm/pipeline` | Director, BD Manager |
| GET | `/api/crm/reports/conversion` | Director, BD Manager |

### 5.13 Dashboard (role-specific aggregation)
| Method | Endpoint | Role |
|---|---|---|
| GET | `/api/dashboard/director` | Director |
| GET | `/api/dashboard/production-manager` | Production Manager |
| GET | `/api/dashboard/artist` | Artist |
| GET | `/api/dashboard/hr` | HR |
| GET | `/api/dashboard/bd` | BD Manager |

### 5.14 Reports & Export
| Method | Endpoint | Role |
|---|---|---|
| GET | `/api/reports/projects` | Director, Production Manager |
| GET | `/api/reports/employees` | Director, HR |
| GET | `/api/reports/finance` | Director, BD Manager (limited) |
| GET | `/api/reports/productivity` | Director, Production Manager |
| GET | `/api/reports/export?type=excel\|pdf\|csv&report=...` | Role-based per report |

### 5.15 Settings / System Configuration
| Method | Endpoint | Role |
|---|---|---|
| GET | `/api/settings` | Director |
| PUT | `/api/settings` | Director |
| GET | `/api/settings/roles` | Director |
| POST | `/api/settings/roles/custom` | Director |

---

## 6. Middleware Design

### 6.1 `auth.middleware.js`
- Verify JWT token from `Authorization: Bearer <token>` header
- Attach `req.user` (decoded payload: id, role, department)
- Return 401 if invalid/expired

### 6.2 `role.middleware.js`
```js
// usage example: router.post('/users', authenticate, authorize('director'), createUser)
const authorize = (...allowedRoles) => (req, res, next) => {
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  next();
};
```

### 6.3 Data-scoping (row-level restriction)
- Artist: task/project queries automatically filtered `{ assignee: req.user._id }` or `{ assignedTeam: req.user._id }`
- BD Manager: enquiry/client queries filtered by `{ assignedExecutive: req.user._id }` (unless Director)
- HR: cannot query Finance collections at all — blocked at route level itself

---

## 7. Auto Calculation Engine (`utils/autoCalcEngine.js`)

Backend logic implement karvani (as per doc requirement):
- `calculateWorkingDays(startDate, endDate, holidays[])` — excludes weekends & holidays
- `calculateStageProgress(stageId)` — % of tasks completed in a stage
- `calculateProjectProgress(projectId)` — weighted average of all stages
- `checkTaskDelay(task)` — compares endDate vs today if not completed
- `calculateTimelineVariance(planned, actual)`
- Run via **cron job** (`node-cron`) daily at midnight to recalculate delays/progress for all active projects, so dashboards stay fresh without heavy real-time computation.

---

## 8. Frontend Flow (Screen-wise, per role)

### 8.1 Common (All Roles)
1. Login screen → role-based redirect after auth
2. Sidebar menu (dynamically rendered based on role permissions from `/api/auth/me`)
3. Profile page (edit own profile, change password)
4. Notifications bell

### 8.2 Director Flow
```
Login → Director Dashboard
  ├── Users (List → Add/Edit/Delete)
  ├── Departments (List → Add/Edit/Delete)
  ├── Projects (List → Create → Approve/Reject → Detail → Stages → Tasks)
  ├── Finance (Quotations → Invoices → Payments → Reports)
  ├── HR (Employees → Attendance → Leave Approvals → Reports)
  ├── Business Development (Enquiries → Pipeline → Reports)
  ├── Resource Allocation (Artist Availability Grid)
  ├── Calendar (Full studio calendar)
  ├── Timeline & Gantt (Project-wise / Artist-wise)
  ├── Reports (All modules, export Excel/PDF/CSV)
  └── Settings (System Config, Custom Roles)
```

### 8.3 Production Manager Flow
```
Login → PM Dashboard
  ├── Projects (Create/Edit — no delete)
  ├── Project Detail → Stages → Tasks (Create/Assign to Artist)
  ├── Timeline / Gantt Chart (drag-drop scheduling)
  ├── Resource Allocation (view + assign artists)
  ├── Reports (Project/Productivity — view only)
  └── Project Completion (mark stage/project complete)
```

### 8.4 Artist Flow
```
Login → Artist Dashboard (Today's Work, Assigned Tasks, Deadlines)
  ├── My Projects (view assigned only)
  ├── My Tasks (list → detail → update status/upload file/add notes)
  ├── My Calendar (own tasks + deadlines)
  └── My Timeline (own project progress, read-only)
```
*(No Finance/HR menu items rendered for Artist role at all)*

### 8.5 HR Flow
```
Login → HR Dashboard
  ├── Employees (List → Profile → Edit)
  ├── Team Database / Department Assignment
  ├── Attendance (Calendar grid → mark/edit particular day)
  ├── Leave Requests (Approve/Reject)
  ├── Resource Availability (view)
  └── HR Reports (Attendance/Leave/Performance — export Excel/PDF/CSV)
```

### 8.6 Business Development Manager Flow
```
Login → BD Dashboard
  ├── Enquiries (List → Add → Pipeline Kanban View: New→Qualification→Meeting→Proposal→Negotiation→Won/Lost)
  ├── Enquiry Detail → Activity Log (calls/emails/meetings/notes) → Convert to Project
  ├── Client Database (List → Add/Edit)
  ├── My Calendar (Meetings + Follow-ups)
  ├── Finance (limited: Quotations insert/update/delete, client billing)
  └── Client Reports (download)
```

---

## 9. Step-by-Step Backend Build Order (Practical Checklist)

1. `npm init` + install express, mongoose, dotenv, bcryptjs, jsonwebtoken, cors, helmet, morgan
2. Setup `db.js` — MongoDB connection (Atlas or local)
3. Build `User` model + Auth APIs (register-by-director, login, JWT, refresh token)
4. Build `auth.middleware.js` + `role.middleware.js` — test with a protected dummy route
5. Build Department CRUD → link to User
6. Build Client CRUD
7. Build Project CRUD + Approve/Reject workflow
8. Build Stage + Task models & CRUD (with role-based scoping)
9. Build Resource Allocation APIs (query tasks by user + date range → availability)
10. Build Calendar + Timeline + Gantt read-APIs (derived from Project/Task data)
11. Build Finance module (Quotation → Invoice → Payment) with Director/BD access
12. Build HR module (Employee, Attendance with per-day edit, Leave workflow)
13. Build CRM module (Enquiry pipeline + convert-to-project logic)
14. Build Dashboard aggregation APIs (role-wise `$match`/`$group` aggregation pipelines)
15. Build Reports module + Excel/PDF/CSV export utilities
16. Add Activity Log middleware (auto-log on create/update/delete across modules)
17. Add cron job for daily auto-recalculation (progress %, delays, variance)
18. Write Postman collection / Swagger docs for all APIs
19. Add input validation (Joi) on every POST/PUT route
20. Testing (unit + integration) → then move to frontend integration

---

## 10. Suggested `.env` variables

```
PORT=5000
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/doorbin_cpms
JWT_SECRET=your_secret_key
JWT_EXPIRE=1d
JWT_REFRESH_SECRET=your_refresh_secret
JWT_REFRESH_EXPIRE=7d
NODE_ENV=development
```

---

*Prepared as a technical build plan based on "Collaborative Project Management System — Doorbin Visuals" requirement document (NexAlliance).*
