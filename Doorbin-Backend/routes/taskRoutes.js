const express = require('express');
const router = express.Router();
const {
  createTask,
  getTasks,
  getMyTasks,
  getTodayTasks,
  getOverdueTasks,
  getTaskById,
  updateTask,
  updateTaskStatus,
  assignTask,
  uploadTaskFiles,
  submitTaskWork,
  reviewTaskWork,
  addTaskComment,
  getTaskComments,
  getTaskAuditLog,
  getTaskDependencies,
  addTaskDependencies,
  deleteTask
} = require('../controllers/taskController');
const { protect, checkPermission } = require('../middlewares/authMiddleware');

const taskCreateAccess = (req, res, next) => {
  const p = req.user?.role?.permissions;
  if (p?.taskManagement || p?.projectManagement || p?.userManagement) {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. Task Management, Project Management, or Director permission required.' });
};

const pmOrDirectorAccess = (req, res, next) => {
  const p = req.user?.role?.permissions;
  if (p?.projectManagement || p?.userManagement) {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. Project Management or Director permission required.' });
};

/**
 * @swagger
 * tags:
 *   name: Task Management
 *   description: Granular Task Execution, Subtasks, Lifecycle State Machine, File Submissions & Audit History APIs
 */

/**
 * @swagger
 * /tasks:
 *   post:
 *     summary: Create a new task or subtask
 *     tags: [Task Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - project
 *               - stage
 *               - taskName
 *             properties:
 *               project:
 *                 type: string
 *                 description: Project ObjectId (Module 5)
 *               stage:
 *                 type: string
 *                 description: Stage ObjectId (Module 5)
 *               subStage:
 *                 type: string
 *                 description: Sub-stage sub-document ObjectId
 *               taskName:
 *                 type: string
 *                 example: High-Poly 3D Sofa Modeling
 *               parentTask:
 *                 type: string
 *                 description: Parent Task ObjectId if creating a subtask
 *               assignee:
 *                 type: string
 *                 description: User ObjectId of assigned Artist
 *               reviewer:
 *                 type: string
 *                 description: User ObjectId of assigned Reviewer / PM
 *               priority:
 *                 type: string
 *                 enum: [High, Medium, Low]
 *                 default: Medium
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               estimatedHours:
 *                 type: number
 *                 example: 16
 *               dependencies:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Task created successfully
 *       400:
 *         description: Validation error or invalid project/stage
 *       403:
 *         description: Task Management or Project Management permission required
 */
router.post('/', protect, taskCreateAccess, createTask);

/**
 * @swagger
 * /tasks:
 *   get:
 *     summary: List tasks with filters (Ownership/Department Scoped)
 *     tags: [Task Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: project
 *         schema:
 *           type: string
 *       - in: query
 *         name: stage
 *         schema:
 *           type: string
 *       - in: query
 *         name: subStage
 *         schema:
 *           type: string
 *       - in: query
 *         name: assignee
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Pending, Assigned, In Progress, Under Review, Revision Required, Completed, Approved, Cancelled]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [High, Medium, Low]
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
 *         description: Paginated list of tasks
 */
router.get('/', protect, getTasks);

/**
 * @swagger
 * /tasks/my-tasks:
 *   get:
 *     summary: Convenience View - Get current user's assigned tasks
 *     tags: [Task Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of assigned tasks for caller
 */
router.get('/my-tasks', protect, getMyTasks);

/**
 * @swagger
 * /tasks/today:
 *   get:
 *     summary: Convenience View - Get current user's active tasks for today
 *     tags: [Task Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of today's active tasks
 */
router.get('/today', protect, getTodayTasks);

/**
 * @swagger
 * /tasks/overdue:
 *   get:
 *     summary: Convenience View - Get overdue active tasks across system (PM / Director)
 *     tags: [Task Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of overdue tasks
 */
router.get('/overdue', protect, pmOrDirectorAccess, getOverdueTasks);

/**
 * @swagger
 * /tasks/{id}:
 *   get:
 *     summary: Get full task details including audit history, comments & attachments
 *     tags: [Task Management]
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
 *         description: Full task profile
 *       403:
 *         description: Access denied by task ownership rules
 *       404:
 *         description: Task not found
 */
router.get('/:id', protect, getTaskById);

/**
 * @swagger
 * /tasks/{id}:
 *   put:
 *     summary: Update task details (Field diffing & audit logging)
 *     tags: [Task Management]
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
 *               taskName:
 *                 type: string
 *               assignee:
 *                 type: string
 *               reviewer:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [High, Medium, Low]
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               estimatedHours:
 *                 type: number
 *               actualHours:
 *                 type: number
 *               dependencies:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Task updated, audit entries recorded
 */
router.put('/:id', protect, updateTask);

/**
 * @swagger
 * /tasks/{id}:
 *   delete:
 *     summary: Delete a task (PM / Director only)
 *     tags: [Task Management]
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
 *         description: Task deleted successfully
 *       403:
 *         description: PM or Director role required
 */
router.delete('/:id', protect, deleteTask);

/**
 * @swagger
 * /tasks/{id}/status:
 *   put:
 *     summary: Transition task status (Lifecycle State Machine & Module 5 Cascade)
 *     tags: [Task Management]
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [Pending, Assigned, In Progress, Under Review, Revision Required, Completed, Approved, Cancelled]
 *                 example: In Progress
 *     responses:
 *       200:
 *         description: Task status updated & Module 5 progress recalculated
 *       400:
 *         description: Invalid status transition
 *       403:
 *         description: Assignee self-approval or unauthorized cancellation blocked
 */
router.put('/:id/status', protect, updateTaskStatus);

/**
 * @swagger
 * /tasks/{id}/upload:
 *   post:
 *     summary: Upload work attachments to task
 *     tags: [Task Management]
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
 *               - attachments
 *             properties:
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["/uploads/tasks/render_draft1.png"]
 *     responses:
 *       201:
 *         description: Attachments added to task
 */
router.post('/:id/upload', protect, uploadTaskFiles);

/**
 * @swagger
 * /tasks/{id}/submit:
 *   post:
 *     summary: Submit work for review (Status -> Under Review)
 *     tags: [Task Management]
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
 *         description: Task work submitted for review
 *       400:
 *         description: Cannot submit work without attachments
 */
router.post('/:id/submit', protect, submitTaskWork);

/**
 * @swagger
 * /tasks/{id}/review:
 *   post:
 *     summary: Review submitted work (Completed, Revision Required, Approved)
 *     tags: [Task Management]
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
 *               - decision
 *             properties:
 *               decision:
 *                 type: string
 *                 enum: [Completed, Revision Required, Approved]
 *                 example: Revision Required
 *               reviewComment:
 *                 type: string
 *                 example: Please adjust ambient occlusion intensity on living room wall textures.
 *     responses:
 *       200:
 *         description: Review verdict recorded
 *       403:
 *         description: Reviewer or PM permission required
 */
router.post('/:id/review', protect, reviewTaskWork);

/**
 * @swagger
 * /tasks/{id}/comments:
 *   post:
 *     summary: Add a comment to task
 *     tags: [Task Management]
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
 *                 example: Uploaded revised renders incorporating client feedback.
 *     responses:
 *       201:
 *         description: Comment added
 */
router.post('/:id/comments', protect, addTaskComment);

/**
 * @swagger
 * /tasks/{id}/comments:
 *   get:
 *     summary: Get all comments for a task
 *     tags: [Task Management]
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
 *         description: List of task comments
 */
router.get('/:id/comments', protect, getTaskComments);

/**
 * @swagger
 * /tasks/{id}/assign:
 *   patch:
 *     summary: Assign or reassign task assignee / reviewer
 *     tags: [Task Management]
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
 *               assignee:
 *                 type: string
 *               reviewer:
 *                 type: string
 *     responses:
 *       200:
 *         description: Task assignee / reviewer updated
 */
router.patch('/:id/assign', protect, assignTask);

/**
 * @swagger
 * /tasks/{id}/audit-log:
 *   get:
 *     summary: Get task audit history log
 *     tags: [Task Management]
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
 *         description: Audit log history
 */
router.get('/:id/audit-log', protect, getTaskAuditLog);

/**
 * @swagger
 * /tasks/{id}/dependencies:
 *   get:
 *     summary: Get task dependencies
 *     tags: [Task Management]
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
 *         description: List of task dependencies
 *   post:
 *     summary: Add or update task dependencies
 *     tags: [Task Management]
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
 *               - dependencies
 *             properties:
 *               dependencies:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Dependencies updated
 */
router.get('/:id/dependencies', protect, getTaskDependencies);
router.post('/:id/dependencies', protect, addTaskDependencies);

module.exports = router;
