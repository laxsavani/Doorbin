# DOORBIN VISUALS - MASTER API DIRECTORY & WORKING SPECIFICATION

This document provides a comprehensive, production-grade API reference and working specification for **every single API endpoint** in the **Doorbin Visuals - Collaborative Project Management System** codebase (covering Modules 1 through 12, System Health, and Activity Audit Logs), including full CRUD (Create, Read, Update, Delete) capability across all modules.

---

## TABLE OF CONTENTS
1. [Overview & Architecture Principles](#1-overview--architecture-principles)
2. [Environment Setup & Swagger UI](#2-environment-setup--swagger-ui)
3. [Module 1 - Authentication & RBAC APIs](#3-module-1---authentication--rbac-apis)
4. [Module 1 - User & Role Management APIs](#4-module-1---user--role-management-apis)
5. [Module 2 - Organization & Department Management APIs](#5-module-2---organization--department-management-apis)
6. [Module 3 - Client Management APIs](#6-module-3---client-management-apis)
7. [Module 4 - Business Development (CRM) APIs](#7-module-4---business-development-crm-apis)
8. [Module 5 - Project Management (Core Workflow) APIs](#8-module-5---project-management-core-workflow-apis)
9. [Module 6 - Task Management APIs](#9-module-6---task-management-apis)
10. [Module 7 - Timeline, Gantt Chart & Studio Calendar APIs](#10-module-7---timeline-gantt-chart--studio-calendar-apis)
11. [Module 8 - Resource Allocation & Artist Availability APIs](#11-module-8---resource-allocation--artist-availability-apis)
12. [Module 9 - Finance Management APIs](#12-module-9---finance-management-apis)
13. [Module 10 - Human Resource Management (HRM) APIs](#13-module-10---human-resource-management-hrm-apis)
14. [Module 11 - Dashboards APIs](#14-module-11---dashboards-apis)
15. [Module 12 - Reporting & Analytics APIs (Final Module)](#15-module-12---reporting--analytics-apis-final-module)
16. [Health, System & Activity Audit Log APIs](#16-health-system--activity-audit-log-apis)
17. [Summary Table of All System API Endpoints](#17-summary-table-of-all-system-api-endpoints)

---

## 1. OVERVIEW & ARCHITECTURE PRINCIPLES

- **Stack**: Node.js + Express.js + MongoDB Atlas / Local MongoDB (Mongoose v8) + exceljs + pdfkit + node-cron + nodemailer.
- **Authentication**: JWT Bearer Tokens (`Authorization: Bearer <token>`). Tokens do NOT contain passwords.
- **RBAC Matrix**: 5 Seeded System Roles (`Director`, `Production Manager`, `Artist`, `Human Resource`, `Business Development Manager`).
- **Complete CRUD Integration**: Full support for POST, GET, PUT/PATCH, and DELETE operations across all business collections with safety guards.
- **Date Format Standard**: `DD/MM/YYYY` (Day/Month/Year) formatted response helper strings, supporting seamless parsing of both `DD/MM/YYYY` and `YYYY-MM-DD` inputs.
- **Swagger Documentation**: Live interactive OpenAPI 3.0 UI hosted at `/api-docs`.

---

## 2. ENVIRONMENT SETUP & SWAGGER UI

### Single `.env` Setup
```env
PORT=5000
NODE_ENV=development

# Database URIs
MONGODB_URI=mongodb://127.0.0.1:27017/doorbin
MONGODB_URI_PROD=mongodb+srv://laxsavani:laxsavani@cluster0.ykxfhke.mongodb.net/doorbin

# Security & Tokens
JWT_SECRET=developer-secret-key-2508
JWT_REFRESH_SECRET=developer-secret-key-2508
JWT_ACCESS_EXPIRE=7d

# Media Uploads
CLOUDINARY_CLOUD_NAME=djn7ivlo7
CLOUDINARY_API_KEY=278376822492173
CLOUDINARY_API_SECRET=n7gWH7n3c1PP5l3ZmZtCUWMWUsA

# SMTP Mail Delivery (Optional / Ethereal Fallback)
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=test@doorbin.com
SMTP_PASS=secret
```

---

## 3. MODULE 1 - AUTHENTICATION & RBAC APIs

### 3.1 `POST /api/auth/register` & `/login` & `GET /profile` & `PUT /change-password`
- **Description**: Authentication, JWT token management, and profile operations.

---

## 4. MODULE 1 - USER & ROLE MANAGEMENT APIs

### 4.1 `GET /api/users` & `GET /api/users/:id` & `PUT /api/users/:id/status` & `PUT /api/users/:id/role`
- **Description**: User roster, account status toggle, and role assignment.

### 4.2 `GET /api/roles` & `GET /api/roles/:id` & `POST /api/roles` & `PUT /api/roles/:id` & `DELETE /api/roles/:id`
- **Description**: Full Role CRUD management for system & custom roles.

---

## 5. MODULE 2 - ORGANIZATION & DEPARTMENT MANAGEMENT APIs

### 5.1 `POST /api/departments` & `GET /api/departments` & `GET /api/departments/:id` & `PUT /api/departments/:id` & `DELETE /api/departments/:id`
- **Description**: Full Department CRUD management.

---

## 6. MODULE 3 - CLIENT MANAGEMENT APIs

### 6.1 `POST /api/clients` & `GET /api/clients` & `GET /api/clients/:id` & `PUT /api/clients/:id` & `DELETE /api/clients/:id`
- **Description**: Full Client CRUD lifecycle.

### 6.2 `GET /api/clients/:id/payments` & `GET /api/clients/:id/statement`
- **Description**: Live financial payments log & client statement summary wired directly to Module 9 collections.

---

## 7. MODULE 4 - BUSINESS DEVELOPMENT (CRM) APIs

### 7.1 `POST /api/enquiries` & `GET /api/enquiries` & `GET /api/enquiries/:id` & `PUT /api/enquiries/:id` & `DELETE /api/enquiries/:id`
- **Description**: Full CRM sales enquiry CRUD lifecycle.

---

## 8. MODULE 5 - PROJECT MANAGEMENT (CORE WORKFLOW) APIs

### 8.1 `POST /api/projects` & `GET /api/projects` & `GET /api/projects/:id` & `PUT /api/projects/:id` & `DELETE /api/projects/:id`
- **Description**: Complete Project CRUD lifecycle with Director soft-delete.

---

## 9. MODULE 6 - TASK MANAGEMENT APIs

### 9.1 `POST /api/tasks` & `GET /api/tasks` & `GET /api/tasks/:id` & `PUT /api/tasks/:id` & `DELETE /api/tasks/:id`
- **Description**: Complete Task CRUD lifecycle with working-days auto-calculation excluding weekends, studio holidays, and assignee approved leaves.

---

## 10. MODULE 7 - TIMELINE, GANTT CHART & STUDIO CALENDAR APIs

### 10.1 `GET /api/timeline/project/:id` & `GET /api/timeline/critical-path/:projectId` & `/planned-vs-actual/:projectId`
- **Description**: Gantt Chart data tree, Critical Path Method (CPM), and Planned vs Actual variance reports.

---

## 11. MODULE 8 - RESOURCE ALLOCATION & ARTIST AVAILABILITY APIs

### 11.1 `GET /api/resources/availability` & `/allocation` & `/conflicts` & `/utilization` & `/forecast`
- **Description**: Artist daily capacity, over-allocation, artist leave conflicts detection, utilization %, and forecast planning.

---

## 12. MODULE 9 - FINANCE MANAGEMENT APIs

### 12.1 `POST /api/finance/quotations` & `/invoices` & `/payments`
- **Description**: Quotation lifecycle, milestone invoices with server-computed GST, automatic payment status recalculation (`Pending` → `Partially Paid` → `Paid`), receivables ageing analysis (`0-30`, `31-60`, `61-90`, `90+` days), cashflow, turnover, and client statements.

---

## 13. MODULE 10 - HUMAN RESOURCE MANAGEMENT (HRM) APIs

### 13.1 `POST /api/hr/employees` & `/attendance` & `/leave` & `/holidays` & `/performance-reviews`
- **Description**: Employee onboarding, self-service attendance, leave applications with auto-generated `On Leave` attendance records, studio holiday calendar, and performance reviews.

### 13.2 `POST /api/attendance/clock-in`, `POST /api/attendance/clock-out` & `GET /api/attendance/today`
- **Description**: Attendance Module clock-in and clock-out operating on a single daily Attendance entry, auto-calculating worked hours, setting `status` (`Present` / `Half-day`), and returning live average working hours calculation (`averageWorkingHours`).

---

## 14. MODULE 11 - DASHBOARDS APIs

### 14.1 `GET /api/dashboard/summary` & `/director` & `/production-manager` & `/artist` & `/hr` & `/bd`
- **Description**: Role-specific curated dashboards and auto-routing summary endpoint with fault-tolerant `Promise.allSettled` execution.

---

## 15. MODULE 12 - REPORTING & ANALYTICS APIs (FINAL MODULE)

### 15.1 Deep-Dive Filterable Reports & Export Engine
- **`GET /api/reports/projects`**: Project reports (`active`, `delayed`, `completed`, `stage-wise-progress`, `timeline-variance`, `client-wise`).
- **`GET /api/reports/employees`**: Employee reports (`productivity`, `assigned-vs-completed`, `utilization`, `attendance`, `performance-ranking` with blended score formula).
- **`GET /api/reports/finance`**: Double-gated Finance reports (`receivables`, `revenue`, `profitability`, `outstanding-dues`, `cashflow`, `wip` with `assumedHourlyCostRate` estimate).
- **`GET /api/reports/productivity`**: Productivity reports (`artist-efficiency`, `department-performance`, `avg-completion-time`, `delay-analysis`, `resource-utilization`).
- **`GET /api/reports/export`**: Unified streaming export engine generating downloadable Excel (`exceljs`) or PDF (`pdfkit`) documents (`?category=...&type=...&format=excel|pdf`).
- **`POST /api/reports/scheduled` & `GET` & `PUT` & `DELETE /api/reports/scheduled/:id`**: Scheduled report CRUD configurations for recurring background email deliveries via `node-cron` & `nodemailer`.

---

## 16. HEALTH, SYSTEM & ACTIVITY AUDIT LOG APIs

### 16.1 `GET /api/health` & `HEAD /api/health`
- **Description**: Health check & HTTP HEAD monitoring endpoint for UptimeRobot.

### 16.2 `GET /` & `GET /api/activity-logs`
- **Description**: System landing & audit activity log search.

---

## 17. NOTIFICATIONS APIs

### 17.1 `GET /api/notifications`, `POST /api/notifications/mark-read` & `DELETE /api/notifications/:id`
- **Description**: Real-time user notifications retrieval with unread count badge, mark read status, and deletion.

---

*Doorbin Visuals Master API Documentation — NexAlliance IT Solutions (Full 12-Module System Complete — 130 Total APIs)*
