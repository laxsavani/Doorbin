const WorkflowTemplate = require('../models/WorkflowTemplate');
const logActivity = require('../utils/activityLogger');

// @desc    Get all workflow templates
// @route   GET /api/workflow-templates
// @access  Private (Authenticated users)
const getWorkflowTemplates = async (req, res) => {
  try {
    const templates = await WorkflowTemplate.find({}).sort({ projectCategory: 1 });
    return res.json(templates);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get workflow template by category
// @route   GET /api/workflow-templates/:category
// @access  Private (Authenticated users)
const getWorkflowTemplateByCategory = async (req, res) => {
  try {
    const category = req.params.category;
    const template = await WorkflowTemplate.findOne({
      projectCategory: new RegExp(`^${category}$`, 'i')
    });

    if (!template) {
      return res.status(404).json({ message: `Workflow template for category '${category}' not found.` });
    }

    return res.json(template);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new workflow template
// @route   POST /api/workflow-templates
// @access  Private (Director ONLY - systemConfiguration)
const createWorkflowTemplate = async (req, res) => {
  const { projectCategory, description, stages } = req.body;

  if (!projectCategory || !projectCategory.trim()) {
    return res.status(400).json({ message: 'projectCategory is required' });
  }

  if (!Array.isArray(stages) || stages.length === 0) {
    return res.status(400).json({ message: 'stages array with at least one stage definition is required' });
  }

  try {
    const existing = await WorkflowTemplate.findOne({
      projectCategory: new RegExp(`^${projectCategory.trim()}$`, 'i')
    });

    if (existing) {
      return res.status(400).json({ message: `Workflow template for category '${projectCategory}' already exists.` });
    }

    const template = await WorkflowTemplate.create({
      projectCategory: projectCategory.trim(),
      description: description ? description.trim() : '',
      stages
    });

    await logActivity({
      req,
      userId: req.user._id,
      action: 'WORKFLOW_TEMPLATE_CREATED',
      targetType: 'WorkflowTemplate',
      targetId: template._id,
      metadata: { category: template.projectCategory }
    });

    return res.status(201).json(template);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Update workflow template stages/sub-stages
// @route   PUT /api/workflow-templates/:category
// @access  Private (Director ONLY - systemConfiguration)
const updateWorkflowTemplate = async (req, res) => {
  const category = req.params.category;
  const { description, stages } = req.body;

  if (stages !== undefined && !Array.isArray(stages)) {
    return res.status(400).json({ message: 'stages must be an array of stage definitions' });
  }

  try {
    const template = await WorkflowTemplate.findOne({
      projectCategory: new RegExp(`^${category}$`, 'i')
    });

    if (!template) {
      return res.status(404).json({ message: `Workflow template for category '${category}' not found.` });
    }

    if (description !== undefined) template.description = String(description).trim();
    if (stages !== undefined) template.stages = stages;

    const updatedTemplate = await template.save();

    await logActivity({
      req,
      userId: req.user._id,
      action: 'WORKFLOW_TEMPLATE_UPDATED',
      targetType: 'WorkflowTemplate',
      targetId: updatedTemplate._id,
      metadata: { category: updatedTemplate.projectCategory }
    });

    return res.json(updatedTemplate);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Delete workflow template by category
// @route   DELETE /api/workflow-templates/:category
// @access  Private (Director ONLY - systemConfiguration)
const deleteWorkflowTemplate = async (req, res) => {
  const category = req.params.category;

  try {
    const template = await WorkflowTemplate.findOneAndDelete({
      projectCategory: new RegExp(`^${category}$`, 'i')
    });

    if (!template) {
      return res.status(404).json({ message: `Workflow template for category '${category}' not found.` });
    }

    await logActivity({
      req,
      userId: req.user._id,
      action: 'WORKFLOW_TEMPLATE_DELETED',
      targetType: 'WorkflowTemplate',
      targetId: template._id,
      metadata: { category: template.projectCategory }
    });

    return res.json({ message: `Workflow template for category '${template.projectCategory}' deleted successfully.` });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getWorkflowTemplates,
  getWorkflowTemplateByCategory,
  createWorkflowTemplate,
  updateWorkflowTemplate,
  deleteWorkflowTemplate
};
