# Doorbin Visuals — CPMS
## Module-wise Workflow Documentation (Complete Process Flows)

Aa document ma dareke module nu **business process workflow** alag alag aapyu che — step-by-step flow, status transitions, kon (which role) shu kare, kya point par automation chale, ane related API kya che.

---

# 1. USER ONBOARDING WORKFLOW

**Kon start kare:** Director

```
Director Login
   ↓
Director → "Add User" (Users module)
   ↓
Fill: Name, Email, Phone, Role, Department, Designation, Shift Timing
   ↓
System generates temporary password + sends welcome email (optional automation)
   ↓
New User status = "Active"
   ↓
User logs in first time → forced to change password
   ↓
User profile now visible in: Department, Resource Allocation, Attendance, Dashboard (role-specific)
```

**Status states:** `Active` → `Inactive` (Director can deactivate, not hard-delete, to preserve history)

**Related APIs:**
`POST /api/users` → `POST /api/auth/login` → `PUT /api/auth/change-password`

**Automation:**
- New user auto-added to their Department's team list
- New user auto-gets default dashboard based on role
- ActivityLog auto-entry: `USER_CREATED`

---

# 2. DEPARTMENT SETUP WORKFLOW

**Kon start kare:** Director

```
Director → "Add Department"
   ↓
Fill: Department Name, Parent Department (optional, for hierarchy), Head (select User)
   ↓
Department created
   ↓
Director/HR assigns Users to this Department (via User edit or Department → Team Assignment)
   ↓
Department now appears in: Reports (Department-wise), Resource Allocation, Dashboards
```

**Related APIs:** `POST /api/departments` → `PUT /api/users/:id` (assign department)

---

# 3. PROJECT LIFECYCLE WORKFLOW (Full — Creation to Completion)

**Kon start kare:** Director or Production Manager

```
STEP 1: Project Creation
Production Manager / Director → "Create Project"
   ↓
Fill: Project Name, Category (Architecture/Interior/Animation), Type, Client,
      Priority, Budget, Start Date, End Date, Assign Team
   ↓
Project status = "Pending Approval"
   ↓
STEP 2: Approval
Director reviews project → Approve / Reject
   ↓
If Approved → status = "Approved" → auto moves to "In Progress" once first stage starts
If Rejected → status = "Rejected" → Production Manager notified, can edit & resubmit
   ↓
STEP 3: Workflow Stage Setup
Production Manager creates Stages (per project category — Architecture/Interior/Animation
has predefined stage templates, but customizable)
   e.g. Architecture: Scene Preparation → Sketch Development → Final Rendering
   ↓
STEP 4: Task Creation under each Stage
Production Manager (or Artist for own task) creates Tasks under Stage/Sub-stage
   ↓
STEP 5: Task Assignment
Production Manager assigns Task to Artist (based on Resource Availability check)
   ↓
STEP 6: Task Execution (see Task Workflow — Section 4)
   ↓
STEP 7: Stage Completion
When all tasks in a Stage = "Completed" → Stage auto-marked "Completed" (AUTOMATION)
   ↓
STEP 8: Approval Checkpoint (if configured)
Director/PM approves Stage before next stage unlocks
   ↓
STEP 9: Project Progress Auto-Update
Every stage completion → Project progressPercent recalculated (AUTOMATION)
   ↓
STEP 10: Final Stage Completion → Project status = "Completed"
   ↓
STEP 11: Project Completion triggers:
   - Final invoice generation reminder (Finance)
   - Client statement update
   - Project moves to "Completed Projects" report
```

**Status flow:** `pending_approval → approved → in_progress → (on_hold) → completed`  |  branch: `rejected`

**Related APIs:**
```
POST /api/projects → PATCH /api/projects/:id/approve → POST /stages → POST /tasks
→ PATCH /tasks/:id/status → (auto) stage/project progress recalculation
```

**Automation at each step:**
- Auto stage completion when all child tasks done
- Auto project progress % recalculation
- Auto delay flag if `endDate` crosses without completion
- Auto notification to Director when project ready for approval
- Auto notification to Client-facing team (BD) when project completed

---

# 4. TASK & SUB-TASK WORKFLOW

**Kon start kare:** Production Manager (assign) or Artist (self-add)

```
Task Creation
   ↓
status = "Pending"
   ↓
Assigned to Artist → status = "Assigned"
   ↓ (Notification sent to Artist automatically)
Artist starts work → status = "In Progress"
   ↓
Artist uploads file(s) + adds notes/comments
   ↓
Artist marks → status = "Under Review" (Submit Work)
   ↓
Reviewer (PM/Director) reviews:
   ├── Approve → status = "Approved" → "Completed"
   └── Needs changes → status = "Revision Required" → back to Artist "In Progress"
   ↓
Task Completed → triggers Stage completion check (AUTOMATION)
```

**Full status list:** `pending → assigned → in_progress → under_review → revision_required (loop) → completed → approved`
**Alt state:** `cancelled` (PM/Director only)

**Related APIs:**
```
POST /api/tasks → PATCH /api/tasks/:id/status → POST /api/tasks/:id/upload
→ POST /api/tasks/:id/comments → GET /api/tasks/:id/history
```

**Automation:**
- Working days auto-calculated from start/end date (excludes weekends/holidays)
- Task delay auto-flagged if `endDate` passed and not completed
- Every status change → auto-logged in Task `history[]` array
- Reviewer auto-notified when task moves to "Under Review"
- Artist auto-notified when task moved to "Revision Required"

---

# 5. ATTENDANCE WORKFLOW (Daily Cycle)

**Kon involve thay:** All Employees (self), HR/Director (corrections)

```
Employee reaches office/logs in →  "Clock In" (app button or biometric sync)
   ↓
System records clockIn = current timestamp
   ↓ (AUTOMATION) System checks: clockIn time > shift start (09:00)?
   → If yes: isLate = true
   ↓
Employee works through the day
   ↓
Employee "Clock Out" at end of day
   ↓
System records clockOut = current timestamp
   ↓ (AUTOMATION) workingHours = clockOut - clockIn (calculated instantly)
   ↓ (AUTOMATION) System checks: clockOut time < shift end (18:00)?
   → If yes: isEarlyLeave = true
   ↓
Record saved as single Attendance document for that date, status = "Present"
```

**Exception Flow — Missed Punch / Correction:**
```
Employee forgets to clock-in/out OR data is wrong
   ↓
HR/Director opens Attendance module → selects Employee + Date
   ↓
Manually edits clockIn / clockOut / status
   ↓
System sets editedManually = true, markedBy = HR/Director's ID
   ↓ (AUTOMATION) workingHours recalculated automatically on save
```

**Exception Flow — No Punch at all (End of Day):**
```
Daily Cron Job (11:59 PM) runs:
   ↓
For each active employee → check if Attendance record exists for today
   ↓
If NOT exists AND not on approved Leave AND not a Holiday
   → Auto-create record with status = "Absent"
```

**Monthly/Weekly Reporting Flow:**
```
HR/Director → Attendance Reports → select Employee + Date Range
   ↓
System aggregates: Total Present, Absent, Half-day, Leave days
   ↓ (AUTOMATION) Calculates: Average Clock-In time, Average Clock-Out time,
     Average Working Hours (via aggregation pipeline — see Part D.3 of main doc)
   ↓
HR/Director → Export → Excel / PDF / CSV
```

**Related APIs:**
```
POST /api/attendance/clock-in → POST /api/attendance/clock-out
→ PUT /api/attendance/:id (manual edit) → GET /api/attendance/average
→ GET /api/attendance/summary/:employeeId → GET /api/attendance/export
```

---

# 6. LEAVE WORKFLOW

**Kon start kare:** Any Employee (self-apply)

```
Employee → "Apply Leave" → Leave Type, From Date, To Date, Reason
   ↓
status = "Pending"
   ↓ (Automation) Notification sent to HR + Director
   ↓
HR/Director reviews:
   ├── Approve → status = "Approved"
   │        ↓ (AUTOMATION) Attendance auto-created/updated for those dates
   │              with status = "On Leave" (no manual attendance entry needed)
   │        ↓ (AUTOMATION) Calendar event auto-created (visible to team)
   │
   └── Reject → status = "Rejected" → Employee notified with reason
```

**Related APIs:**
```
POST /api/leaves → PATCH /api/leaves/:id/approve → PATCH /api/leaves/:id/reject
```

**Holiday Sub-flow:**
```
HR/Director → Add Holiday (Name, Date, Optional/Mandatory)
   ↓ (AUTOMATION) On that date, all employees' attendance auto-marked "Holiday"
     — no clock-in required, auto-absent cron skips holidays
```

---

# 7. RESOURCE ALLOCATION WORKFLOW

**Kon involve thay:** Production Manager (allocate), Director (view), HR (view availability)

```
PM wants to assign a new Task to an Artist
   ↓
PM opens "Resource Allocation" → views Artist Availability Calendar
   ↓ (System shows, per artist, per day):
   - Current allocated hours vs capacity
   - Any approved Leave (blocks allocation automatically)
   - Existing task load
   ↓
PM selects Artist with available capacity → assigns Task
   ↓ (AUTOMATION) System checks: does this allocation exceed daily capacity?
   ├── If yes → "Over-allocation Alert" shown, PM can override or reassign
   └── If no → allocation confirmed
   ↓
Artist's Resource Utilization % auto-updates on Dashboard/Reports
```

**Related APIs:**
```
GET /api/resources/availability → POST /api/resources/allocate
→ GET /api/resources/utilization
```

**Automation:**
- Leave conflict auto-detection (blocks allocation on leave days)
- Over-allocation auto-alert to PM/Director
- Forecast allocation for upcoming projects (based on planned start dates)

---

# 8. BUSINESS DEVELOPMENT / CRM WORKFLOW (Enquiry → Project)

**Kon start kare:** Business Development Manager

```
STEP 1: New Enquiry
BD Manager → "Add Enquiry" → Client Name, Architect, Project Name/Type,
                              Estimated Value, Source, Follow-up Date, Priority, Category
   ↓
Enquiry stage = "New"
   ↓
STEP 2: Qualification
BD Manager reviews/qualifies lead → stage = "Qualification"
   ↓
STEP 3: Meeting
BD Manager schedules meeting (auto-added to Calendar, visible on BD's calendar)
   ↓ stage = "Meeting" → Activity Log entry added (meeting notes)
   ↓
STEP 4: Proposal
BD Manager sends proposal → stage = "Proposal"
   ↓ (may link to Finance → create Quotation)
   ↓
STEP 5: Negotiation
Back-and-forth with client → stage = "Negotiation" → Activity Log tracks calls/emails
   ↓
STEP 6: Won / Lost
   ├── WON → stage = "Won"
   │      ↓ (AUTOMATION) System prompts "Convert to Project"
   │      ↓ BD Manager/Director clicks Convert → new Project auto-created
   │        with Client, Project Name, Type pre-filled from Enquiry
   │      ↓ Enquiry.convertedProject = new Project ID (linked for traceability)
   │      ↓ Enquiry now appears in "Lead Conversion" report
   │
   └── LOST → stage = "Lost"
          ↓ Reason logged → appears in "Lost Opportunities" report
```

**Follow-up Reminder Sub-flow:**
```
Daily Cron Job checks all open Enquiries
   ↓
If followUpDate == today → Notification sent to assigned BD Manager
   ↓ Also shown on BD Manager's Calendar automatically
```

**Related APIs:**
```
POST /api/crm/enquiries → PATCH /api/crm/enquiries/:id/stage
→ POST /api/crm/enquiries/:id/activity → POST /api/crm/enquiries/:id/convert
→ GET /api/crm/pipeline
```

---

# 9. FINANCE WORKFLOW (Quotation → Invoice → Payment → Outstanding)

**Kon involve thay:** Director (full), BD Manager (limited — quotations/client billing)

```
STEP 1: Quotation
Director/BD Manager → Create Quotation (linked to Project/Client, Amount)
   ↓ status = "Sent"
   ↓ Client accepts (manually updated) → status = "Accepted"
   ↓
STEP 2: Invoice Generation
Director creates Invoice (based on Quotation or milestone billing)
   ↓ status = "Unpaid", dueDate set
   ↓ (AUTOMATION) Due-date reminder cron checks daily,
      notifies Director/BD when due date near/passed
   ↓
STEP 3: Payment Recording
Director records Payment received (partial or full) against Invoice
   ↓ (AUTOMATION) System recalculates:
      - Invoice status: "Unpaid" → "Partial" → "Paid" (based on amountPaid vs invoice amount)
      - Outstanding Dues = invoiceAmount - totalPaid
      - Client Statement auto-updated
      - Revenue Realization % recalculated (totalPaid / totalQuoted)
   ↓
STEP 4: Reporting
Director/BD Manager → Finance Reports → Cashflow (Monthly/Quarterly/Annual),
                       Outstanding Summary, Revenue by Project Type
   ↓ Export Excel/PDF/CSV
```

**Related APIs:**
```
POST /api/finance/quotations → POST /api/finance/invoices → POST /api/finance/payments
→ GET /api/finance/reports/outstanding → GET /api/finance/reports/cashflow
```

---

# 10. CALENDAR & NOTIFICATION WORKFLOW

**Aa ek cross-module system che — dareke module thi calendar/notification feed thay:**

```
Event Sources → Calendar:
  - Task deadlines (from Task module) → auto-appear on Artist's + PM's calendar
  - Project milestones (from Project module) → PM + Director calendar
  - Meetings (from CRM) → BD Manager's calendar (+ Director if included)
  - Follow-ups (from CRM) → BD Manager's calendar
  - Leave dates (from HR) → HR + Director calendar (team-wide view)
  - Holidays (from HR) → everyone's calendar

Event Sources → Notifications:
  - Task assigned → Artist notified
  - Task under review → Reviewer notified
  - Task revision required → Artist notified
  - Leave applied → HR + Director notified
  - Leave approved/rejected → Employee notified
  - Project pending approval → Director notified
  - Invoice due soon → Director/BD notified
  - Enquiry follow-up due → BD Manager notified
  - Resource over-allocation → PM notified
```

**Related APIs:**
```
GET /api/calendar → GET /api/notifications → PATCH /api/notifications/:id/read
```

**Automation:** Har notification-worthy event par, ek central `notify(userId, type, message, refId)` utility function call thay che je automatically Notification document banave — dareke controller ma manually notification-code lakhvani jarur nathi.

---

# 11. REPORTING WORKFLOW

```
User (role-based) → Reports Module → selects Report Type
   ↓
Selects Filters (Date Range, Project/Employee/Department, Status)
   ↓
System runs Aggregation Pipeline (pre-built per report type)
   ↓
Data shown on screen (table/chart)
   ↓
User clicks "Export" → selects format (Excel / PDF / CSV)
   ↓
Backend generates file (exceljs / pdfkit / json2csv) → returns download link
```

**Role-based Report Access (recap):**
- Director → All reports (Project, Finance, HR, Productivity, BD)
- Production Manager → Project + Productivity reports
- HR → HR reports only (Attendance, Leave, Performance)
- BD Manager → Client + Sales reports only
- Artist → No report access

**Related APIs:**
```
GET /api/reports/:type → GET /api/reports/export?type=excel|pdf|csv&report=...
```

---

# 12. PROJECT APPROVAL CHAIN (Summary — Who Approves What)

| Item | Raised By | Approved By | Auto-effect on Approval |
|---|---|---|---|
| New Project | Production Manager / Director | Director | Status → Approved, team notified |
| Stage Completion (if approval-required) | Production Manager | Director / PM | Next stage unlocks |
| Task (Under Review) | Artist | Reviewer (PM/Director) | Task → Completed/Approved |
| Leave Request | Employee | HR / Director | Attendance auto-marked "On Leave" |
| Enquiry → Project Conversion | BD Manager | Director (optional co-approval) | New Project record created |
| Quotation | BD Manager | Director | Moves to Invoice stage |

---

# 13. END-TO-END EXAMPLE (Full Cycle — Real Scenario Walkthrough)

```
1. BD Manager adds Enquiry for "XYZ Villa Interior" → follows up → Won
2. BD Manager converts Enquiry → Project auto-created ("Pending Approval")
3. Director approves Project
4. Production Manager creates Stages: First Draft → Revision Cycle
5. Production Manager creates Tasks under "First Draft" → assigns to Artist "Raj"
   (System checks Raj's availability first — no conflicts found)
6. Raj gets notified → clocks in daily (Attendance auto-tracked)
7. Raj works on Task → uploads files → submits for review
8. Production Manager reviews → approves → Task = Completed
9. All tasks in "First Draft" stage complete → Stage auto-marked Completed
10. Project progress % auto-updates (e.g., 50%)
11. "Revision Cycle" stage starts → same task cycle repeats
12. Final stage complete → Project = Completed
13. Director generates Invoice → Client pays → Payment recorded
14. Outstanding Dues auto-updates to ₹0 → Revenue Realization = 100%
15. Director views Dashboard → sees Project in "Completed Projects", Revenue updated
16. Director/BD downloads Client Report (PDF) for records
```

---

*Complete workflow documentation for Doorbin Visuals CPMS — every module's business process flow, status transitions, role responsibilities, and automation triggers, mapped to backend APIs.*
