const express = require('express');
const router = express.Router();
const {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  approveProject,
  rejectProject,
  addProjectStage,
  updateProjectStage,
  deleteCustomStage,
  updateSubStageStatus,
  approveStage,
  getProjectProgress,
  getDelayedProjects,
  getActiveProjectsReport,
  getCompletedProjectsReport,
  getStageProgressReport,
  getClientProjectsReport,
  addProjectAttachment,
  getProjectAttachments,
  addProjectComment,
  getProjectComments,
  getProjectTeam,
  updateProjectTeam
} = require('../controllers/projectController');
const { protect, checkPermission } = require('../middlewares/authMiddleware');

const pmOrDirectorAccess = (req, res, next) => {
  const p = req.user?.role?.permissions;
  if (p?.projectManagement || p?.userManagement) {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. Project Management or Director permission required.' });
};

const artistOrPmOrDirectorAccess = (req, res, next) => {
  const p = req.user?.role?.permissions;
  if (p?.taskManagement || p?.projectManagement || p?.userManagement) {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. Task Management, Project Management, or Director permission required.' });
};

/**
 * @swagger
 * tags:
 *   name: Project Management
 *   description: Core Project Hierarchy, Template Cloning, Stage Machine, Approval Checkpoints & Progress Reports APIs
 */

/**
 * @swagger
 * /projects:
 *   post:
 *     summary: Create a new project & auto-clone category WorkflowTemplate stages
 *     tags: [Project Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - projectName
 *               - client
 *               - projectCategory
 *               - startDate
 *               - endDate
 *               - productionManager
 *             properties:
 *               projectName:
 *                 type: string
 *                 example: Kaira Apartment 12B Architectural Render
 *               client:
 *                 type: string
 *                 description: Client ObjectId (Module 3)
 *               originEnquiry:
 *                 type: string
 *                 description: Originating Enquiry ObjectId (Module 4)
 *               projectCategory:
 *                 type: string
 *                 enum: [Architecture, Interior Design, Animation]
 *                 example: Architecture
 *               projectSubType:
 *                 type: string
 *                 example: Residential High-rise
 *               priority:
 *                 type: string
 *                 enum: [High, Medium, Low]
 *                 default: Medium
 *               budget:
 *                 type: number
 *                 example: 250000
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               billingParty:
 *                 type: string
 *                 example: Architect
 *               productionManager:
 *                 type: string
 *                 description: User ObjectId of Production Manager
 *               assignedTeam:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Project created & template stages cloned successfully
 *       400:
 *         description: Validation error or inactive client
 *       403:
 *         description: Project Management permission required
 */
router.post('/', protect, checkPermission('projectManagement'), createProject);

/**
 * @swagger
 * /projects:
 *   get:
 *     summary: List projects (Department-Scoped Visibility)
 *     tags: [Project Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Not Started, In Progress, On Hold, Completed, Delayed]
 *       - in: query
 *         name: projectCategory
 *         schema:
 *           type: string
 *           enum: [Architecture, Interior Design, Animation]
 *       - in: query
 *         name: client
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Paginated list of visible projects
 */
router.get('/', protect, getProjects);

/**
 * @swagger
 * /projects/delayed:
 *   get:
 *     summary: List projects flagged as Delayed
 *     tags: [Project Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of delayed projects
 */
router.get('/delayed', protect, pmOrDirectorAccess, getDelayedProjects);

/**
 * @swagger
 * /projects/reports/active:
 *   get:
 *     summary: Project Report - Active Projects (Not Started, In Progress, Delayed)
 *     tags: [Project Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of active projects
 */
router.get('/reports/active', protect, pmOrDirectorAccess, getActiveProjectsReport);

/**
 * @swagger
 * /projects/reports/completed:
 *   get:
 *     summary: Project Report - Completed Projects
 *     tags: [Project Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of completed projects
 */
router.get('/reports/completed', protect, pmOrDirectorAccess, getCompletedProjectsReport);

/**
 * @swagger
 * /projects/reports/stage-wise-progress:
 *   get:
 *     summary: Project Report - Stage-wise Progress across active projects
 *     tags: [Project Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stage-wise progress breakdown per active project
 */
router.get('/reports/stage-wise-progress', protect, pmOrDirectorAccess, getStageProgressReport);

/**
 * @swagger
 * /projects/reports/client-wise:
 *   get:
 *     summary: Project Report - Client-wise Project Summary
 *     tags: [Project Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Projects grouped by client
 */
router.get('/reports/client-wise', protect, pmOrDirectorAccess, getClientProjectsReport);

/**
 * @swagger
 * /projects/{id}:
 *   get:
 *     summary: Get single project details with populated stages & sub-stages
 *     tags: [Project Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Full project profile & stage hierarchy
 *       403:
 *         description: Access denied by department visibility rules
 *       404:
 *         description: Project not found
 */
router.get('/:id', protect, getProjectById);

/**
 * @swagger
 * /projects/{id}:
 *   put:
 *     summary: Update project details
 *     tags: [Project Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               projectName:
 *                 type: string
 *               projectCategory:
 *                 type: string
 *               projectSubType:
 *                 type: string
 *               priority:
 *                 type: string
 *               budget:
 *                 type: number
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               billingParty:
 *                 type: string
 *               productionManager:
 *                 type: string
 *               assignedTeam:
 *                 type: array
 *                 items:
 *                   type: string
 *               status:
 *                 type: string
 *                 enum: [Not Started, In Progress, On Hold, Completed, Delayed]
 *     responses:
 *       200:
 *         description: Project updated
 */
router.put('/:id', protect, checkPermission('projectManagement'), updateProject);

/**
 * @swagger
 * /projects/{id}:
 *   delete:
 *     summary: Soft-delete project (Director ONLY - deleteProjects)
 *     tags: [Project Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Project soft-deleted
 *       403:
 *         description: Director deleteProjects permission required
 */
router.delete('/:id', protect, checkPermission('deleteProjects'), deleteProject);

/**
 * @swagger
 * /projects/{id}/stages:
 *   post:
 *     summary: Add a custom project-instance stage (beyond template)
 *     tags: [Project Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - stageName
 *             properties:
 *               stageName:
 *                 type: string
 *                 example: Stage 4 - Client Walkthrough & Sign-off
 *               order:
 *                 type: integer
 *               approvalRequired:
 *                 type: boolean
 *               dependsOn:
 *                 type: array
 *                 items:
 *                   type: string
 *               subStages:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - name
 *                   properties:
 *                     name:
 *                       type: string
 *                     groupLabel:
 *                       type: string
 *     responses:
 *       201:
 *         description: Project stage added
 */
router.post('/:id/stages', protect, checkPermission('projectManagement'), addProjectStage);

/**
 * @swagger
 * /projects/{id}/stages/{stageId}:
 *   put:
 *     summary: Update project stage details
 *     tags: [Project Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: stageId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               stageName:
 *                 type: string
 *               order:
 *                 type: integer
 *               approvalRequired:
 *                 type: boolean
 *               dependsOn:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Stage updated
 */
router.put('/:id/stages/:stageId', protect, checkPermission('projectManagement'), updateProjectStage);

/**
 * @swagger
 * /projects/{id}/stages/{stageId}:
 *   delete:
 *     summary: Delete custom stage from project (PM / Director)
 *     tags: [Project Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: stageId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Custom stage deleted
 *       400:
 *         description: Cannot delete stage with assigned tasks
 */
router.delete('/:id/stages/:stageId', protect, checkPermission('projectManagement'), deleteCustomStage);

/**
 * @swagger
 * /projects/{id}/stages/{stageId}/substages/{subStageId}:
 *   put:
 *     summary: Update sub-stage status (Cascading Progress & Dependency Check)
 *     tags: [Project Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: stageId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: subStageId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [Pending, In Progress, Under Review, Completed, Approved]
 *                 example: Completed
 *               completionPercentage:
 *                 type: number
 *                 example: 100
 *     responses:
 *       200:
 *         description: Sub-stage status updated, stage & project progress recalculated
 *       400:
 *         description: Prerequisite stage dependency incomplete
 */
router.put('/:id/stages/:stageId/substages/:subStageId', protect, artistOrPmOrDirectorAccess, updateSubStageStatus);

/**
 * @swagger
 * /projects/{id}/stages/{stageId}/approve:
 *   post:
 *     summary: Approve stage checkpoint gate (approvalRequired true)
 *     tags: [Project Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: stageId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Stage approved, marked Completed, approvedBy & approvedAt recorded
 *       403:
 *         description: PM or Director permission required
 */
router.post('/:id/stages/:stageId/approve', protect, pmOrDirectorAccess, approveStage);

/**
 * @swagger
 * /projects/{id}/progress:
 *   get:
 *     summary: Get computed overall project progress & stage breakdown
 *     tags: [Project Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Overall progress percentage and stage progress array
 */
router.get('/:id/progress', protect, getProjectProgress);

/**
 * @swagger
 * /projects/{id}/attachments:
 *   post:
 *     summary: Upload/add attachment file URL to project
 *     tags: [Project Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fileUrl
 *             properties:
 *               fileUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Attachment added
 *   get:
 *     summary: Get project attachments
 *     tags: [Project Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of project attachment URLs
 */
router.post('/:id/attachments', protect, addProjectAttachment);
router.get('/:id/attachments', protect, getProjectAttachments);

/**
 * @swagger
 * /projects/{id}/comments:
 *   post:
 *     summary: Add comment to project
 *     tags: [Project Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *     responses:
 *       201:
 *         description: Comment added
 *   get:
 *     summary: Get project comments
 *     tags: [Project Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of project comments
 */
router.post('/:id/comments', protect, addProjectComment);
router.get('/:id/comments', protect, getProjectComments);

/**
 * @swagger
 * /projects/{id}/team:
 *   get:
 *     summary: Get assigned project team and production manager
 *     tags: [Project Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Project team members
 *   post:
 *     summary: Update assigned team members and production manager
 *     tags: [Project Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               productionManager:
 *                 type: string
 *               assignedTeam:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Team updated
 */
router.get('/:id/team', protect, getProjectTeam);
router.post('/:id/team', protect, pmOrDirectorAccess, updateProjectTeam);

router.patch('/:id/approve', protect, pmOrDirectorAccess, approveProject);
router.patch('/:id/reject', protect, pmOrDirectorAccess, rejectProject);

module.exports = router;
