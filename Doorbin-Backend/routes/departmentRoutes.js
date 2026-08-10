const express = require('express');
const router = express.Router();
const {
  createDepartment,
  getDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
  assignEmployee,
  removeEmployee,
  getDepartmentReport,
  getAllDepartmentsStrengthReport
} = require('../controllers/departmentController');
const { protect, checkPermission } = require('../middlewares/authMiddleware');

const userOrHrAccess = (req, res, next) => {
  if (
    req.user?.role?.permissions?.departmentManagement ||
    req.user?.role?.permissions?.userManagement ||
    req.user?.role?.permissions?.hrAccess
  ) {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
};

/**
 * @swagger
 * tags:
 *   name: Department Management
 *   description: Organization Hierarchy, Employee Assignment & Department Reports APIs
 */

/**
 * @swagger
 * /departments:
 *   post:
 *     summary: Create a new department
 *     tags: [Department Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: Rendering Team
 *               description:
 *                 type: string
 *                 example: Special 3D rendering and lighting studio department
 *               head:
 *                 type: string
 *                 description: User ObjectId of department head
 *               parentDepartment:
 *                 type: string
 *                 description: Department ObjectId of parent department
 *     responses:
 *       201:
 *         description: Department created successfully
 *       400:
 *         description: Duplicate name or invalid parent/head user
 *       403:
 *         description: Director permission required
 */
router.post('/', protect, checkPermission('departmentManagement'), createDepartment);

/**
 * @swagger
 * /departments:
 *   get:
 *     summary: List all departments
 *     tags: [Department Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Active, Inactive]
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: Array of department summaries
 */
router.get('/', protect, getDepartments);

/**
 * @swagger
 * /departments/reports/strength:
 *   get:
 *     summary: System-wide department strength comparison report
 *     tags: [Department Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Headcount breakdown per department
 *       403:
 *         description: HR or Director permission required
 */
router.get('/reports/strength', protect, userOrHrAccess, getAllDepartmentsStrengthReport);

/**
 * @swagger
 * /departments/{id}:
 *   get:
 *     summary: Get department details with populated employee roster
 *     tags: [Department Management]
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
 *         description: Department details
 *       404:
 *         description: Department not found
 */
router.get('/:id', protect, getDepartmentById);

/**
 * @swagger
 * /departments/{id}:
 *   put:
 *     summary: Update department details
 *     tags: [Department Management]
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
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               head:
 *                 type: string
 *               parentDepartment:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [Active, Inactive]
 *     responses:
 *       200:
 *         description: Department updated
 *       400:
 *         description: Circular parent dependency or invalid payload
 *       403:
 *         description: Director permission required
 */
router.put('/:id', protect, checkPermission('departmentManagement'), updateDepartment);

/**
 * @swagger
 * /departments/{id}:
 *   delete:
 *     summary: Delete a department (Blocked if non-empty or has child departments)
 *     tags: [Department Management]
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
 *         description: Department deleted
 *       400:
 *         description: Cannot delete non-empty or parent department
 *       403:
 *         description: Director permission required
 */
router.delete('/:id', protect, checkPermission('departmentManagement'), deleteDepartment);

/**
 * @swagger
 * /departments/{id}/assign-employee:
 *   post:
 *     summary: Assign employee to department (Auto-syncs User and Department)
 *     tags: [Department Management]
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
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ObjectId to assign
 *     responses:
 *       200:
 *         description: Employee assigned and synced
 *       403:
 *         description: Director or HR permission required
 */
router.post('/:id/assign-employee', protect, userOrHrAccess, assignEmployee);

/**
 * @swagger
 * /departments/{id}/remove-employee:
 *   post:
 *     summary: Remove employee from department
 *     tags: [Department Management]
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
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ObjectId to remove
 *     responses:
 *       200:
 *         description: Employee unassigned
 *       403:
 *         description: Director or HR permission required
 */
router.post('/:id/remove-employee', protect, userOrHrAccess, removeEmployee);

/**
 * @swagger
 * /departments/{id}/report:
 *   get:
 *     summary: Single department strength & roster report
 *     tags: [Department Management]
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
 *         description: Headcount breakdown and roster array
 *       403:
 *         description: HR or Director permission required
 */
router.get('/:id/report', protect, userOrHrAccess, getDepartmentReport);

module.exports = router;
