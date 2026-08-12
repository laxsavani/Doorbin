# DOORBIN VISUALS - MASTER API DIRECTORY & WORKING SPECIFICATION

This document provides a comprehensive, production-grade API reference and working specification for **every single API endpoint** in the **Doorbin Visuals - Collaborative Project Management System** codebase, including full CRUD capability, Attendance Automation Engine, Web Push Notifications, and Background Cron Scheduling.

---

## TABLE OF CONTENTS
1. [Overview & Architecture Principles](#1-overview--architecture-principles)
2. [Environment Setup & Swagger UI](#2-environment-setup--swagger-ui)
3. [Module 1 - Authentication & RBAC APIs](#3-module-1---authentication--rbac-apis)
4. [Module 1 - User & Role Management APIs](#4-module-1---user--role-management-apis)
5. [Module 2 - Organization & Department Management APIs](#5-module-2---organization--department-management-apis)
6. [Module 3 - Client Management APIs](#6-module-3---client-management-apis)
7. [Module 4 - Business Development (CRM) APIs](#7-module-4---business-development-crm-apis)
8. [Module 5 - Project Management (Core Workflow & Approval) APIs](#8-module-5---project-management-core-workflow--approval-apis)
9. [Module 6 - Stage & Task Management APIs](#9-module-6---stage--task-management-apis)
10. [Module 7 - Timeline, Gantt Chart, Critical Path (CPM) & Studio Calendar APIs](#10-module-7---timeline-gantt-chart-critical-path-cpm--studio-calendar-apis)
11. [Module 8 - Resource Allocation & Artist Availability APIs](#11-module-8---resource-allocation--artist-availability-apis)
12. [Module 9 - Finance Management APIs](#12-module-9---finance-management-apis)
13. [Module 10 - Attendance & Human Resource Management (HRM) APIs](#13-module-10---attendance--human-resource-management-hrm-apis)
14. [Module 11 - Web Push Notifications & System Alerts APIs](#14-module-11---web-push-notifications--system-alerts-apis)
15. [Module 12 - Dashboards APIs (Role-wise)](#15-module-12---dashboards-apis-role-wise)
16. [Module 13 - Reporting & Analytics APIs & Streaming Export](#16-module-13---reporting--analytics-apis--streaming-export)
17. [Automation Engine & Background Cron Jobs](#17-automation-engine--background-cron-jobs)
18. [Health, System & Activity Audit Log APIs](#18-health-system--activity-audit-log-apis)
19. [Summary Table of All System API Endpoints](#19-summary-table-of-all-system-api-endpoints)

---

## 1. OVERVIEW & ARCHITECTURE PRINCIPLES

- **Stack**: Node.js (v18+) + Express.js + MongoDB (Mongoose v8) + `web-push` + `exceljs` + `pdfkit` + `json2csv` + `node-cron` + `nodemailer`.
- **Authentication**: JWT Bearer Tokens (`Authorization: Bearer <token>`). Tokens do NOT contain passwords.
- **RBAC Matrix**: 5 Seeded System Roles (`Director`, `Production Manager`, `Artist`, `Human Resource`, `Business Development Manager`) plus dynamic Custom Roles support.
- **Attendance Single Source of Truth**: Unique compound index `{ employee: 1, date: 1 }` per employee per date. Automatically calculates working hours, late arrivals (`> 09:00`), early leaves (`< 18:00`), and computes monthly/weekly average clock-in/out times.
- **Web Push Notifications**: Standard VAPID web-push infrastructure supporting browser push subscriptions (`endpoint`, `keys: { p256dh, auth }`), automatic expired subscription cleanup (410/404 handling), and trigger helper.
- **Automation Engine**: `node-cron` jobs running daily for auto-absent marking, task delay recalculation, project progress cascading, invoice due notifications, and CRM follow-up alerts.
- **Complete CRUD Integration**: Full support for POST, GET, PUT/PATCH, and DELETE operations across all business collections with safety guards.
- **Date Format Standard**: `DD/MM/YYYY` formatted response helper strings, supporting seamless parsing of both `DD/MM/YYYY` and `YYYY-MM-DD` inputs.
- **Swagger Documentation**: Live interactive OpenAPI 3.0 UI hosted at `/api-docs`.

---

## 2. ENVIRONMENT SETUP & SWAGGER UI

### `.env` Setup
```env
PORT=5000
NODE_ENV=development

# Database URIs
MONGODB_URI=mongodb://127.0.0.1:27017/doorbin
MONGODB_URI_PROD=mongodb+srv://<user>:<pass>@cluster.mongodb.net/doorbin

# Security & Tokens
JWT_SECRET=your_jwt_secret_key
JWT_REFRESH_SECRET=your_refresh_secret_key
JWT_EXPIRE=1d
JWT_REFRESH_EXPIRE=7d

# Shift Timings
DEFAULT_SHIFT_START=09:00
DEFAULT_SHIFT_END=18:00

# Web Push VAPID Configuration
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_EMAIL=mailto:support@doorbinvisuals.com

# SMTP Mail Delivery (Optional / Ethereal Fallback)
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=test@doorbin.com
SMTP_PASS=secret
```

---

## 3. MODULE 1 - AUTHENTICATION & RBAC APIs

### 3.1 Authentication Operations
- **`POST /api/auth/register`**: Register new user account (Director / HR).
- **`POST /api/auth/login`**: Authenticate user credentials, return JWT access token & decoded profile.
- **`POST /api/auth/logout`**: Authenticated user logout session.
- **`POST /api/auth/refresh-token`**: Issue fresh access token using valid refresh token.
- **`GET /api/auth/me`**: Get current logged-in user profile, role, department, & permissions.
- **`PUT /api/auth/change-password`**: Update account password.
- **`POST /api/auth/forgot-password`**: Request password reset token.
- **`POST /api/auth/reset-password/:token`**: Reset password using issued token.

---

## 4. MODULE 1 - USER & ROLE MANAGEMENT APIs

### 4.1 User Roster & Status Management
- **`GET /api/users`**: List all studio employees with filtering by department, status, or role.
- **`GET /api/users/:id`**: Get single user details with department and employee metadata.
- **`POST /api/users`**: Create new studio user (Director only).
- **`PUT /api/users/:id`**: Update user profile, skills, designation, shift times (Director / HR).
- **`DELETE /api/users/:id`**: Soft-deactivate user account (Director only).
- **`PATCH /api/users/:id/status`**: Toggle user status (`Active` / `Inactive`).

### 4.2 Role Management
- **`GET /api/roles`**: List system & custom roles.
- **`GET /api/roles/:id`**: Get role details by ID.
- **`POST /api/roles`**: Create custom role template with permission flags (Director only).
- **`PUT /api/roles/:id`**: Update role permissions matrix.
- **`DELETE /api/roles/:id`**: Delete custom role.

---

## 5. MODULE 2 - ORGANIZATION & DEPARTMENT MANAGEMENT APIs

### 5.1 Department Operations
- **`GET /api/departments`**: List studio departments & department heads.
- **`GET /api/departments/:id`**: Get department details with assigned team members.
- **`POST /api/departments`**: Create department (Director only).
- **`PUT /api/departments/:id`**: Update department details or reassign head.
- **`DELETE /api/departments/:id`**: Delete department (Director only).

---

## 6. MODULE 3 - CLIENT MANAGEMENT APIs

### 6.1 Client Roster & Financial Ledger
- **`GET /api/clients`**: List clients with search and industry filters.
- **`GET /api/clients/:id`**: Get client detail with contact persons.
- **`POST /api/clients`**: Create new client record (Director / BD Manager).
- **`PUT /api/clients/:id`**: Update client details.
- **`DELETE /api/clients/:id`**: Delete client (Director only).
- **`GET /api/clients/:id/statements`**: Generate live client financial statement summary.

---

## 7. MODULE 4 - BUSINESS DEVELOPMENT (CRM) APIs

### 7.1 Lead Capture & Pipeline Lifecycle
- **`GET /api/crm/enquiries`**: List CRM enquiries filterable by stage, priority, or client category.
- **`GET /api/crm/enquiries/:id`**: Get single enquiry with full activity log history.
- **`POST /api/crm/enquiries`**: Capture new sales lead / enquiry (BD Manager / Director).
- **`PUT /api/crm/enquiries/:id`**: Update enquiry details.
- **`PATCH /api/crm/enquiries/:id/stage`**: Update lead pipeline stage (`New` → `Qualification` → `Meeting` → `Proposal` → `Negotiation` → `Won` / `Lost`).
- **`POST /api/crm/enquiries/:id/activity`**: Log discovery call, meeting notes, email, or follow-up note.
- **`POST /api/crm/enquiries/:id/convert`**: Convert `Won` enquiry into a new Project & Client record.
- **`GET /api/crm/pipeline`**: Get Kanban pipeline stage metrics and conversion totals.
- **`GET /api/crm/reports/conversion`**: Get lead conversion analytics report.

---

## 8. MODULE 5 - PROJECT MANAGEMENT (CORE WORKFLOW & APPROVAL) APIs

### 8.1 Project Lifecycle & Approval Chain
- **`GET /api/projects`**: List projects (role-scoped & department-scoped visibility).
- **`GET /api/projects/:id`**: Get project detail with stage progress summary.
- **`POST /api/projects`**: Create new project & auto-clone category stage templates (Director / PM).
- **`PUT /api/projects/:id`**: Update project details, budget, or dates.
- **`DELETE /api/projects/:id`**: Soft-delete project (Director only).
- **`PATCH /api/projects/:id/approve`**: Approve pending project (Director only).
- **`PATCH /api/projects/:id/reject`**: Reject project with feedback notes (Director only).
- **`GET /api/projects/:id/progress`**: Get calculated progress percentage and delay flag.
- **`POST /api/projects/:id/team`**: Assign team members and Production Manager.
- **`POST /api/projects/:id/comments`**: Add project discussion comment.
- **`POST /api/projects/:id/attachments`**: Upload project attachment.

---

## 9. MODULE 6 - STAGE & TASK MANAGEMENT APIs

### 9.1 Stages & Sub-stages
- **`GET /api/projects/:projectId/stages`**: List stages for project.
- **`POST /api/projects/:projectId/stages`**: Add custom stage to project (Director / PM).
- **`PUT /api/stages/:id`**: Update stage details or order.
- **`DELETE /api/stages/:id`**: Delete custom stage (Director only).
- **`PATCH /api/stages/:id/approve`**: Approve stage completion milestone.

### 9.2 Task Management & Review Workflow
- **`GET /api/tasks`**: List tasks (role-scoped — Artist sees assigned tasks only).
- **`GET /api/tasks/:id`**: Get task details, audit history, comments, and attachments.
- **`POST /api/tasks`**: Create & assign task with working days auto-calculation (PM / Director / Artist self-task).
- **`PUT /api/tasks/:id`**: Update task details or priority.
- **`DELETE /api/tasks/:id`**: Delete task (PM / Director).
- **`PATCH /api/tasks/:id/status`**: Update task status (`Pending` → `Assigned` → `In Progress` → `Under Review` → `Revision Required` → `Completed` → `Approved`).
- **`POST /api/tasks/:id/upload`**: Upload WIP or final output files (any file format supported).
- **`POST /api/tasks/:id/comments`**: Add discussion note to task.
- **`GET /api/tasks/:id/history`**: Get audit trail of field changes.

---

## 10. MODULE 7 - TIMELINE, GANTT CHART, CRITICAL PATH (CPM) & STUDIO CALENDAR APIs

### 10.1 Gantt & Critical Path Analysis
- **`GET /api/timeline/project/:projectId`**: Get interactive Gantt chart JSON tree structure.
- **`GET /api/timeline/critical-path/:projectId`**: Compute Critical Path Method (CPM) for project dependencies, identifying zero-slack tasks and project minimum duration.
- **`GET /api/timeline/planned-vs-actual/:projectId`**: Get variance comparison between planned and actual task completion dates.
- **`GET /api/gantt/:projectId`**: Alias endpoint for Gantt chart JSON data.

### 10.2 Studio Calendar
- **`GET /api/calendar`**: Unified studio calendar feed (tasks, meetings, follow-ups, leaves, holidays).
- **`POST /api/calendar/events`**: Create manual calendar event (meeting, follow-up, milestone).
- **`PUT /api/calendar/events/:id`**: Update calendar event.
- **`DELETE /api/calendar/events/:id`**: Delete calendar event.

---

## 11. MODULE 8 - RESOURCE ALLOCATION & ARTIST AVAILABILITY APIs

### 11.1 Artist Capacity & Utilization
- **`GET /api/resources/availability`**: Query artist daily allocated hours vs capacity for a date range (includes leave conflict detection).
- **`GET /api/resources/utilization`**: Get utilization percentage report per artist and department.
- **`GET /api/resources/allocation/:userId`**: Get task workload breakdown for a specific user.
- **`POST /api/resources/allocate`**: Confirm task allocation (triggers over-allocation alert if daily hours exceed capacity).
- **`GET /api/resources/forecast`**: Get upcoming workload forecasting based on project pipelines.

---

## 12. MODULE 9 - FINANCE MANAGEMENT APIs

### 12.1 Quotations, Invoices & Payments
- **`GET /api/finance/quotations`**: List quotations (Director / BD Manager).
- **`POST /api/finance/quotations`**: Create quotation for project/client.
- **`PUT /api/finance/quotations/:id`**: Update quotation details.
- **`DELETE /api/finance/quotations/:id`**: Delete quotation (Director only).
- **`GET /api/finance/invoices`**: List milestone invoices with status (`Unpaid`, `Partially Paid`, `Paid`).
- **`POST /api/finance/invoices`**: Generate milestone invoice with server-computed GST (Director only).
- **`GET /api/finance/payments`**: List received payment transactions.
- **`POST /api/finance/payments`**: Record payment receipt against invoice (auto-recalculates invoice status, outstanding dues, and client statement).
- **`PUT /api/finance/payments/:id`**: Update payment record (Director only).
- **`DELETE /api/finance/payments/:id`**: Delete payment record (Director only).
- **`GET /api/finance/reports/cashflow`**: Get monthly/quarterly/annual cashflow report.
- **`GET /api/finance/reports/outstanding`**: Get client-wise outstanding dues summary.

---

## 13. MODULE 10 - ATTENDANCE & HUMAN RESOURCE MANAGEMENT (HRM) APIs

### 13.1 Attendance System (Single Source of Truth)
- **`POST /api/attendance/clock-in`**: Clock in for today. Auto-evaluates `isLate` against shift start (`09:00`).
- **`POST /api/attendance/clock-out`**: Clock out for today. Auto-calculates `workingHours`, checks `isEarlyLeave` (`< 18:00`), and sets status (`Present` vs `Half-day`).
- **`GET /api/attendance/today`**: Get active clock-in session details and worked hours for today.
- **`GET /api/attendance/average`**: Calculate `averageClockIn`, `averageClockOut`, `averageWorkingHours`, and `totalDaysPresent` for employee/period.
- **`GET /api/attendance`**: List attendance logs filterable by date, department, or status.
- **`GET /api/attendance/:employeeId`**: Get attendance history for a specific employee.
- **`PUT /api/attendance/:id`**: Manual correction for a particular day's attendance (HR / Director only; sets `editedManually: true` & `markedBy`).
- **`GET /api/attendance/summary/:employeeId`**: Aggregated monthly present/absent/leave/half-day counts.
- **`GET /api/attendance/team-summary`**: Studio-wide daily present/absent grid by department.
- **`GET /api/attendance/export`**: Download attendance report in Excel, PDF, or CSV.

### 13.2 Employee Master, Leaves & Holidays
- **`GET /api/hr/employees`**: List employee master profiles.
- **`GET /api/hr/employees/:id`**: Get single employee profile with documents and exit history.
- **`POST /api/hr/employees`**: Create employee master record.
- **`PUT /api/hr/employees/:id`**: Update employee details, joining date, exit info, or upload documents.
- **`GET /api/hr/leaves`**: List leave applications.
- **`POST /api/hr/leaves`**: Apply for leave (All employees).
- **`PATCH /api/hr/leaves/:id/approve`**: Approve leave application (HR / Director; auto-syncs attendance records as `On Leave`).
- **`PATCH /api/hr/leaves/:id/reject`**: Reject leave application with feedback.
- **`GET /api/hr/holidays`**: List studio holidays.
- **`POST /api/hr/holidays`**: Add studio holiday (HR / Director).
- **`GET /api/hr/reports/attendance`**: HR Attendance Analytics Report.
- **`GET /api/hr/reports/performance`**: Employee performance reviews report.

---

## 14. MODULE 11 - WEB PUSH NOTIFICATIONS & SYSTEM ALERTS APIs

### 14.1 Web Push Infrastructure & Notification Management
- **`GET /api/notifications/vapid-key`**: Get public VAPID key for client web push subscription setup.
- **`POST /api/notifications/subscribe`**: Register browser/device subscription (`endpoint`, `keys: { p256dh, auth }`).
- **`POST /api/notifications/unsubscribe`**: Unsubscribe browser/device from Web Push notifications.
- **`POST /api/notifications/send-push`**: Trigger Web Push Notification to a user (dispatches to all active user devices).
- **`GET /api/notifications`**: Retrieve system notifications for logged-in user with unread count badge.
- **`POST /api/notifications/mark-read`**: Mark specific notification or all notifications as read.
- **`DELETE /api/notifications/:id`**: Delete notification entry.

---

## 15. MODULE 12 - DASHBOARDS APIs (ROLE-WISE)

### 15.1 Curated Role-Specific KPI Aggregations
- **`GET /api/dashboard/director`**: Executive KPI Dashboard (Total/Active/Delayed projects, Revenue, Cashflow, Outstanding Dues, Team Strength, Department Utilization).
- **`GET /api/dashboard/production-manager`**: PM Dashboard (Active Projects, Stage Progress, Delayed Tasks, Team Workload, Upcoming Milestones).
- **`GET /api/dashboard/artist`**: Artist Dashboard (Today's Assigned Tasks, Pending Reviews, Deadlines, Personal Working Hours Stats).
- **`GET /api/dashboard/hr`**: HR Dashboard (Today's Attendance Grid, Late Arrivals, Pending Leave Requests, Employee Strength, Department Summary).
- **`GET /api/dashboard/bd`**: BD Manager Dashboard (New Enquiries, Sales Pipeline Stage Totals, Scheduled Meetings, Follow-ups Due Today, Conversion Rate).

---

## 16. MODULE 13 - REPORTING & ANALYTICS APIs & STREAMING EXPORT

### 16.1 Deep Analytics & Unified Streaming Exporters
- **`GET /api/reports/projects`**: Comprehensive project analytics (`active`, `delayed`, `completed`, `stage-wise`, `timeline-variance`).
- **`GET /api/reports/employees`**: Employee productivity & performance ranking report.
- **`GET /api/reports/finance`**: Double-gated financial reports (`receivables`, `turnover`, `cashflow`, `outstanding`).
- **`GET /api/reports/productivity`**: Team & department productivity analytics.
- **`GET /api/reports/export`**: Streaming file exporter (`?category=projects|employees|finance|productivity&format=excel|pdf|csv`).
- **`POST /api/reports/scheduled`**: Create scheduled report configuration for automated recurring email deliveries via `node-cron` & `nodemailer`.
- **`GET /api/reports/scheduled`**: List configured scheduled reports.
- **`DELETE /api/reports/scheduled/:id`**: Delete scheduled report configuration.

---

## 17. AUTOMATION ENGINE & BACKGROUND CRON JOBS

The automation engine executes background scheduled jobs via `node-cron`:

| Cron Job File | Schedule | Purpose & Logic |
|---|---|---|
| **`autoMarkAbsent.job.js`** | Daily at 23:59 | Scans active users; if no clock-in recorded for today and not a holiday/approved leave, creates an `Attendance` record with `status: 'Absent'`. |
| **`recalcTaskDelay.job.js`** | Daily at 00:30 | Checks tasks with `endDate < today` and non-completed status, flagging `isDelayed = true`. |
| **`recalcProjectProgress.job.js`** | Daily at 01:00 | Recalculates progress percentage for active projects and updates delay flags. |
| **`invoiceReminder.job.js`** | Daily at 09:00 | Finds unpaid/partially paid invoices due within 3 days or overdue, sending system & web push notifications to Director & BD Manager. |
| **`enquiryFollowupReminder.job.js`** | Daily at 09:00 | Finds CRM enquiries with follow-up dates due today or overdue, notifying assigned executive. |

---

## 18. HEALTH, SYSTEM & ACTIVITY AUDIT LOG APIs

### 18.1 Monitoring & Audit Trail
- **`GET /`**: API Landing info.
- **`GET /api/health`** & **`HEAD /api/health`**: System health check & HTTP HEAD monitoring endpoint for UptimeRobot.
- **`GET /api/activity-logs`**: Search & filter audit trail logs (user, action, module, date range).

---

## 19. SUMMARY TABLE OF ALL SYSTEM API ENDPOINTS

| Module | Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|---|
| **Auth** | `POST` | `/api/auth/login` | Public | Authenticate user & return JWT token |
| **Auth** | `GET` | `/api/auth/me` | All | Get logged-in user profile & permissions |
| **Auth** | `PUT` | `/api/auth/change-password` | All | Update user password |
| **User** | `GET` | `/api/users` | Director, HR | List all employees |
| **User** | `POST` | `/api/users` | Director | Onboard new user |
| **User** | `PUT` | `/api/users/:id` | Director, HR | Update user profile/skills |
| **User** | `DELETE` | `/api/users/:id` | Director | Soft-delete user |
| **Dept** | `GET` | `/api/departments` | All | List studio departments |
| **Dept** | `POST` | `/api/departments` | Director | Create department |
| **Client** | `GET` | `/api/clients` | Director, BD | List clients |
| **Client** | `POST` | `/api/clients` | Director, BD | Create client record |
| **Client** | `GET` | `/api/clients/:id/statements` | Director, BD | Generate live financial statement |
| **CRM** | `GET` | `/api/crm/enquiries` | Director, BD | List sales leads |
| **CRM** | `POST` | `/api/crm/enquiries` | Director, BD | Capture new lead |
| **CRM** | `PATCH` | `/api/crm/enquiries/:id/stage` | Director, BD | Move lead stage |
| **CRM** | `POST` | `/api/crm/enquiries/:id/convert` | Director, BD | Convert lead to Project & Client |
| **Project** | `GET` | `/api/projects` | All (Scoped) | List projects |
| **Project** | `POST` | `/api/projects` | Director, PM | Create project & auto-clone stage template |
| **Project** | `PATCH` | `/api/projects/:id/approve` | Director | Approve pending project |
| **Project** | `PATCH` | `/api/projects/:id/reject` | Director | Reject project with notes |
| **Stage** | `GET` | `/api/projects/:id/stages` | All | Get stages for project |
| **Stage** | `PATCH` | `/api/stages/:id/approve` | Director, PM | Approve stage milestone |
| **Task** | `GET` | `/api/tasks` | All (Scoped) | List tasks |
| **Task** | `POST` | `/api/tasks` | Director, PM, Artist | Create & assign task |
| **Task** | `PATCH` | `/api/tasks/:id/status` | Assignee, PM, Director | Update task status |
| **Task** | `POST` | `/api/tasks/:id/upload` | Assignee | Upload task files (any format) |
| **Timeline** | `GET` | `/api/timeline/project/:id` | All | Get interactive Gantt chart data |
| **Timeline** | `GET` | `/api/timeline/critical-path/:id` | PM, Director | Calculate Critical Path Method (CPM) |
| **Resource** | `GET` | `/api/resources/availability` | PM, Director, HR | Query artist capacity & leave conflicts |
| **Resource** | `POST` | `/api/resources/allocate` | PM, Director | Allocate task & check over-allocation |
| **Finance** | `GET` | `/api/finance/quotations` | Director, BD | List quotations |
| **Finance** | `POST` | `/api/finance/invoices` | Director | Raise milestone invoice with GST |
| **Finance** | `POST` | `/api/finance/payments` | Director | Record payment & recalculate dues |
| **Attendance**| `POST` | `/api/attendance/clock-in` | All | Clock in today (auto-checks late arrival) |
| **Attendance**| `POST` | `/api/attendance/clock-out` | All | Clock out today (auto-calculates hours) |
| **Attendance**| `GET` | `/api/attendance/today` | All | Get active session & current worked hours |
| **Attendance**| `GET` | `/api/attendance/average` | All | Compute avg clock-in/out & hours |
| **Attendance**| `PUT` | `/api/attendance/:id` | HR, Director | Edit particular day's attendance record |
| **HR** | `GET` | `/api/hr/employees` | Director, HR | List employee master profiles |
| **HR** | `POST` | `/api/hr/leaves` | All | Apply for leave |
| **HR** | `PATCH` | `/api/hr/leaves/:id/approve` | Director, HR | Approve leave & auto-sync attendance |
| **Web Push** | `GET` | `/api/notifications/vapid-key` | Public / All | Retrieve public VAPID key |
| **Web Push** | `POST` | `/api/notifications/subscribe` | All | Register browser push subscription |
| **Web Push** | `POST` | `/api/notifications/unsubscribe` | All | Unsubscribe browser push subscription |
| **Web Push** | `POST` | `/api/notifications/send-push` | All | Trigger web push notification |
| **Notification**|`GET` | `/api/notifications` | All | Get notifications with unread badge count |
| **Dashboard** | `GET` | `/api/dashboard/director` | Director | Executive Director KPI Dashboard |
| **Dashboard** | `GET` | `/api/dashboard/production-manager` | PM | Production Manager Dashboard |
| **Dashboard** | `GET` | `/api/dashboard/artist` | Artist | Artist Dashboard |
| **Dashboard** | `GET` | `/api/dashboard/hr` | HR | HR Dashboard |
| **Dashboard** | `GET` | `/api/dashboard/bd` | BD Manager | BD Manager Dashboard |
| **Reports** | `GET` | `/api/reports/projects` | Director, PM | Filterable project reports |
| **Reports** | `GET` | `/api/reports/export` | Role-based | Streaming export (Excel, PDF, CSV) |
| **Audit** | `GET` | `/api/activity-logs` | Director, HR | Search audit activity logs |
| **Health** | `GET` | `/api/health` | Public | System health check |

---

*Doorbin Visuals Master API Documentation — NexAlliance IT Solutions (Production-Ready Architecture Complete — 135+ Total Operational APIs)*
