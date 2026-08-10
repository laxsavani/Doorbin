const Department = require('../models/Department');
const User = require('../models/User');
const logActivity = require('../utils/activityLogger');
const mongoose = require('mongoose');

// Helper function to detect circular parent department dependency (A -> B -> A)
const isCircularParent = async (departmentId, proposedParentId) => {
  if (!proposedParentId) return false;
  if (departmentId.toString() === proposedParentId.toString()) return true;

  let currentParentId = proposedParentId;
  const visited = new Set();

  while (currentParentId) {
    if (visited.has(currentParentId.toString())) break;
    visited.add(currentParentId.toString());

    if (currentParentId.toString() === departmentId.toString()) {
      return true;
    }

    const parentDept = await Department.findById(currentParentId).select('parentDepartment');
    if (!parentDept || !parentDept.parentDepartment) break;
    currentParentId = parentDept.parentDepartment;
  }

  return false;
};

// @desc    Create a new department
// @route   POST /api/departments
// @access  Private (Director - departmentManagement)
const createDepartment = async (req, res) => {
  const { name, description, head, parentDepartment } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Department name is required' });
  }

  try {
    const existingDept = await Department.findOne({ name: name.trim() });
    if (existingDept) {
      return res.status(400).json({ message: 'Department with this name already exists' });
    }

    if (head && mongoose.Types.ObjectId.isValid(head)) {
      const headUser = await User.findById(head);
      if (!headUser) {
        return res.status(400).json({ message: 'Specified department head user does not exist' });
      }
    }

    let validParent = null;
    if (parentDepartment && mongoose.Types.ObjectId.isValid(parentDepartment)) {
      const parentDeptObj = await Department.findById(parentDepartment);
      if (!parentDeptObj) {
        return res.status(400).json({ message: 'Specified parent department does not exist' });
      }
      validParent = parentDepartment;
    }

    const department = await Department.create({
      name: name.trim(),
      description,
      head: head && mongoose.Types.ObjectId.isValid(head) ? head : null,
      parentDepartment: validParent,
      employees: []
    });

    await logActivity({
      req,
      userId: req.user._id,
      action: 'DEPARTMENT_CREATED',
      targetType: 'Department',
      targetId: department._id,
      metadata: { departmentName: department.name }
    });

    const populatedDept = await Department.findById(department._id)
      .populate('head', 'name email role')
      .populate('parentDepartment', 'name');

    return res.status(201).json(populatedDept);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    List all departments
// @route   GET /api/departments
// @access  Private (Any logged-in user)
const getDepartments = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const departments = await Department.find(filter)
      .populate('head', 'name email role status')
      .populate('parentDepartment', 'name')
      .sort({ name: 1 });

    const responseData = departments.map((dept) => ({
      _id: dept._id,
      name: dept.name,
      description: dept.description,
      head: dept.head,
      parentDepartment: dept.parentDepartment,
      employeeCount: dept.employees ? dept.employees.length : 0,
      status: dept.status,
      createdAt: dept.createdAt,
      updatedAt: dept.updatedAt
    }));

    return res.json(responseData);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get single department detail
// @route   GET /api/departments/:id
// @access  Private (Any logged-in user)
const getDepartmentById = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id)
      .populate('head', 'name email phone status role')
      .populate('parentDepartment', 'name description')
      .populate({
        path: 'employees',
        select: 'name email phone status role profileImage',
        populate: { path: 'role', select: 'name' }
      });

    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    return res.json(department);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Update department details
// @route   PUT /api/departments/:id
// @access  Private (Director - departmentManagement)
const updateDepartment = async (req, res) => {
  const { name, description, head, parentDepartment, status } = req.body;

  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    if (name && name.trim() !== department.name) {
      const duplicate = await Department.findOne({ name: name.trim(), _id: { $ne: department._id } });
      if (duplicate) {
        return res.status(400).json({ message: 'Another department with this name already exists' });
      }
      department.name = name.trim();
    }

    if (description !== undefined) department.description = description;
    if (status && ['Active', 'Inactive'].includes(status)) department.status = status;

    if (head !== undefined) {
      if (head && mongoose.Types.ObjectId.isValid(head)) {
        const headUser = await User.findById(head);
        if (!headUser) {
          return res.status(400).json({ message: 'Specified department head user does not exist' });
        }
        department.head = head;
      } else {
        department.head = null;
      }
    }

    if (parentDepartment !== undefined) {
      if (parentDepartment && mongoose.Types.ObjectId.isValid(parentDepartment)) {
        if (parentDepartment.toString() === department._id.toString()) {
          return res.status(400).json({ message: 'A department cannot be its own parent' });
        }

        const isCircular = await isCircularParent(department._id, parentDepartment);
        if (isCircular) {
          return res.status(400).json({ message: 'Circular parent department dependency detected' });
        }
        department.parentDepartment = parentDepartment;
      } else {
        department.parentDepartment = null;
      }
    }

    const updatedDept = await department.save();

    await logActivity({
      req,
      userId: req.user._id,
      action: 'DEPARTMENT_UPDATED',
      targetType: 'Department',
      targetId: updatedDept._id,
      metadata: { departmentName: updatedDept.name }
    });

    const populatedDept = await Department.findById(updatedDept._id)
      .populate('head', 'name email role')
      .populate('parentDepartment', 'name')
      .populate('employees', 'name email status role');

    return res.json(populatedDept);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a department
// @route   DELETE /api/departments/:id
// @access  Private (Director - departmentManagement)
const deleteDepartment = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    // Safety Rail 1: Block deletion if department has assigned employees
    const assignedUsersCount = await User.countDocuments({ department: department._id });
    if ((department.employees && department.employees.length > 0) || assignedUsersCount > 0) {
      return res.status(400).json({
        message: 'Cannot delete department while employees are assigned. Please reassign or remove employees first.'
      });
    }

    // Safety Rail 2: Block deletion if referenced as a parentDepartment by another department
    const childDeptsCount = await Department.countDocuments({ parentDepartment: department._id });
    if (childDeptsCount > 0) {
      return res.status(400).json({
        message: 'Cannot delete department because it is set as a parent for another department. Please reassign child departments first.'
      });
    }

    await Department.findByIdAndDelete(department._id);

    await logActivity({
      req,
      userId: req.user._id,
      action: 'DEPARTMENT_DELETED',
      targetType: 'Department',
      targetId: department._id,
      metadata: { deletedName: department.name }
    });

    return res.json({ message: `Department '${department.name}' deleted successfully` });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Assign employee to department (Sync logic)
// @route   POST /api/departments/:id/assign-employee
// @access  Private (Director / HR - departmentManagement or hrAccess)
const assignEmployee = async (req, res) => {
  const { userId } = req.body;

  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: 'Valid userId is required' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const targetDept = await Department.findById(req.params.id);
    if (!targetDept) {
      return res.status(404).json({ message: 'Target department not found' });
    }

    // Step 1: If user is currently in a different department, remove them from previous department
    if (user.department && user.department.toString() !== targetDept._id.toString()) {
      await Department.findByIdAndUpdate(user.department, {
        $pull: { employees: user._id }
      });
    }

    // Step 2: Add user to target department's employees array ($addToSet prevents duplicates)
    await Department.findByIdAndUpdate(targetDept._id, {
      $addToSet: { employees: user._id }
    });

    // Step 3: Update User.department reference
    user.department = targetDept._id;
    await user.save({ validateBeforeSave: false });

    await logActivity({
      req,
      userId: req.user._id,
      action: 'EMPLOYEE_DEPARTMENT_ASSIGNED',
      targetType: 'Department',
      targetId: targetDept._id,
      metadata: { assignedUserId: user._id, assignedUserEmail: user.email, departmentName: targetDept.name }
    });

    const updatedDept = await Department.findById(targetDept._id)
      .populate('head', 'name email role')
      .populate('parentDepartment', 'name')
      .populate({
        path: 'employees',
        select: 'name email phone status role',
        populate: { path: 'role', select: 'name' }
      });

    return res.json(updatedDept);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Remove employee from department
// @route   POST /api/departments/:id/remove-employee
// @access  Private (Director / HR - departmentManagement or hrAccess)
const removeEmployee = async (req, res) => {
  const { userId } = req.body;

  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: 'Valid userId is required' });
  }

  try {
    const targetDept = await Department.findById(req.params.id);
    if (!targetDept) {
      return res.status(404).json({ message: 'Department not found' });
    }

    const user = await User.findById(userId);
    if (user) {
      if (user.department && user.department.toString() === targetDept._id.toString()) {
        user.department = null;
        await user.save({ validateBeforeSave: false });
      }
    }

    await Department.findByIdAndUpdate(targetDept._id, {
      $pull: { employees: userId }
    });

    await logActivity({
      req,
      userId: req.user._id,
      action: 'EMPLOYEE_DEPARTMENT_REMOVED',
      targetType: 'Department',
      targetId: targetDept._id,
      metadata: { removedUserId: userId, departmentName: targetDept.name }
    });

    const updatedDept = await Department.findById(targetDept._id)
      .populate('head', 'name email role')
      .populate('parentDepartment', 'name')
      .populate({
        path: 'employees',
        select: 'name email phone status role',
        populate: { path: 'role', select: 'name' }
      });

    return res.json(updatedDept);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get single department strength & roster report
// @route   GET /api/departments/:id/report
// @access  Private (Director / HR - departmentManagement or hrAccess)
const getDepartmentReport = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id)
      .populate('head', 'name email role')
      .populate({
        path: 'employees',
        select: 'name email phone status createdAt role',
        populate: { path: 'role', select: 'name' }
      });

    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    const roster = department.employees || [];
    const activeEmployees = roster.filter((emp) => emp.status === 'Active');
    const inactiveEmployees = roster.filter((emp) => emp.status === 'Inactive');

    return res.json({
      department: {
        _id: department._id,
        name: department.name,
        description: department.description,
        head: department.head
      },
      headcount: {
        total: roster.length,
        active: activeEmployees.length,
        inactive: inactiveEmployees.length
      },
      roster
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get all-departments strength summary report
// @route   GET /api/departments/reports/strength
// @access  Private (Director / HR - departmentManagement or hrAccess)
const getAllDepartmentsStrengthReport = async (req, res) => {
  try {
    const departments = await Department.find({})
      .populate('head', 'name email')
      .populate('employees', 'status name email role');

    let overallTotalHeadcount = 0;
    let overallActiveHeadcount = 0;
    let overallInactiveHeadcount = 0;

    const departmentSummaries = departments.map((dept) => {
      const employees = dept.employees || [];
      const activeCount = employees.filter((e) => e.status === 'Active').length;
      const inactiveCount = employees.filter((e) => e.status === 'Inactive').length;

      overallTotalHeadcount += employees.length;
      overallActiveHeadcount += activeCount;
      overallInactiveHeadcount += inactiveCount;

      return {
        _id: dept._id,
        name: dept.name,
        head: dept.head,
        headcount: {
          total: employees.length,
          active: activeCount,
          inactive: inactiveCount
        },
        status: dept.status
      };
    });

    return res.json({
      summary: {
        totalDepartments: departments.length,
        overallTotalHeadcount,
        overallActiveHeadcount,
        overallInactiveHeadcount
      },
      departments: departmentSummaries
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createDepartment,
  getDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
  assignEmployee,
  removeEmployee,
  getDepartmentReport,
  getAllDepartmentsStrengthReport
};
