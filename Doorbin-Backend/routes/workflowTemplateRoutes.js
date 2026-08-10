const express = require('express');
const router = express.Router();
const {
  getWorkflowTemplates,
  getWorkflowTemplateByCategory,
  createWorkflowTemplate,
  updateWorkflowTemplate,
  deleteWorkflowTemplate
} = require('../controllers/workflowTemplateController');
const { protect } = require('../middlewares/authMiddleware');

const directorAccess = (req, res, next) => {
  const roleName = req.user?.role?.name;
  if (roleName === 'Director' || req.user?.role?.permissions?.systemConfiguration === true) {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. Director role required.' });
};

/**
 * @swagger
 * tags:
 *   name: Workflow Templates
 *   description: Category-based workflow templates engine for Architecture, Interior Design, and Animation
 */

/**
 * @swagger
 * /workflow-templates:
 *   get:
 *     summary: List all category workflow templates
 *     tags: [Workflow Templates]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of workflow templates
 *   post:
 *     summary: Create custom category workflow template (Director only)
 *     tags: [Workflow Templates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               projectCategory:
 *                 type: string
 *                 example: VR Walkthrough
 *               description:
 *                 type: string
 *                 example: Custom VR walkthrough stage workflow
 *               stages:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       201:
 *         description: Template created successfully
 */
router.route('/')
  .get(protect, getWorkflowTemplates)
  .post(protect, directorAccess, createWorkflowTemplate);

/**
 * @swagger
 * /workflow-templates/{category}:
 *   get:
 *     summary: Get workflow template by category
 *     tags: [Workflow Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Category workflow template details
 *   put:
 *     summary: Update workflow template stages & sub-stages (Director only)
 *     tags: [Workflow Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: category
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
 *               stages:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Template updated successfully
 *   delete:
 *     summary: Delete workflow template by category (Director only)
 *     tags: [Workflow Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Template deleted successfully
 */
router.route('/:category')
  .get(protect, getWorkflowTemplateByCategory)
  .put(protect, directorAccess, updateWorkflowTemplate)
  .delete(protect, directorAccess, deleteWorkflowTemplate);

module.exports = router;
