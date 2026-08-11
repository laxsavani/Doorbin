import React, { useState, useEffect } from 'react';
import { departmentService } from '../services/departmentService';
import { userService } from '../services/userService';
import { Modal } from '../components/Modal';
import { FormField } from '../components/FormField';
import { Toast } from '../components/Toast';
import { Loader } from '../components/Loader';
import { validators, focusFirstErrorField } from '../utils/validation';
import { Plus, Users as UsersIcon, Trash2, Building, Award, Edit3, LayoutGrid, List } from 'lucide-react';
import { useViewMode } from '../hooks/useViewMode';
import './Dashboard.css';

export const Departments = () => {
  const [departments, setDepartments] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [strengthReport, setStrengthReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useViewMode();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [deletingDeptId, setDeletingDeptId] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    head: '',
    parentDepartment: '',
    status: 'Active'
  });
  const [formErrors, setFormErrors] = useState({});
  const [toast, setToast] = useState({ message: '', type: 'info' });

  useEffect(() => {
    fetchDepartmentsAndUsers();
  }, []);

  const fetchDepartmentsAndUsers = async () => {
    setLoading(true);
    try {
      const data = await departmentService.getDepartments();
      const report = await departmentService.getDepartmentStrengthReport();
      const users = await userService.getUsers();

      let extractedDepts = Array.isArray(data) ? data : (data?.departments || data?.data || []);
      let extractedUsers = Array.isArray(users) ? users : (users?.users || users?.data || []);

      setDepartments(extractedDepts);
      setUsersList(extractedUsers);
      setStrengthReport(report);
    } catch (err) {
      setToast({ message: err.message || 'Failed to fetch departments data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDepartment = async (e) => {
    e.preventDefault();

    const errors = {};
    const nameErr = validators.required(formData.name, 'Department Name');
    if (nameErr) errors.name = nameErr;

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirstErrorField(errors);
      return;
    }

    try {
      const createdPayload = {
        name: formData.name,
        description: formData.description || '',
        head: formData.head || null,
        parentDepartment: formData.parentDepartment || null,
        status: formData.status || 'Active'
      };

      const response = await departmentService.createDepartment(createdPayload);
      const matchedHead = usersList.find(u => u._id === formData.head);
      const matchedParent = departments.find(d => d._id === formData.parentDepartment);

      const newDeptItem = response.department || response || {
        _id: response._id || `66b0a1f8e91d2c345678${Date.now().toString().slice(-4)}`,
        name: formData.name,
        description: formData.description,
        head: matchedHead || null,
        parentDepartment: matchedParent || null,
        employees: [],
        status: formData.status || 'Active',
        createdAt: new Date().toISOString()
      };

      setDepartments([newDeptItem, ...departments]);
      setToast({ message: 'Department created successfully!', type: 'success' });
      setFormData({ name: '', description: '', head: '', parentDepartment: '', status: 'Active' });
      setIsModalOpen(false);
    } catch (err) {
      setToast({ message: err.message || 'Failed to create department', type: 'error' });
    }
  };

  const handleOpenEditModal = (dept) => {
    setEditingDept(dept);
    setFormData({
      name: dept.name || '',
      description: dept.description || '',
      head: typeof dept.head === 'object' ? (dept.head?._id || '') : (dept.head || ''),
      parentDepartment: typeof dept.parentDepartment === 'object' ? (dept.parentDepartment?._id || '') : (dept.parentDepartment || ''),
      status: dept.status || 'Active'
    });
    setFormErrors({});
    setIsEditModalOpen(true);
  };

  const handleUpdateDepartment = async (e) => {
    e.preventDefault();
    if (!editingDept) return;

    const errors = {};
    const nameErr = validators.required(formData.name, 'Department Name');
    if (nameErr) errors.name = nameErr;

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirstErrorField(errors);
      return;
    }

    try {
      const updatePayload = {
        name: formData.name,
        description: formData.description || '',
        head: formData.head || null,
        parentDepartment: formData.parentDepartment || null,
        status: formData.status || 'Active'
      };

      const response = await departmentService.updateDepartment(editingDept._id, updatePayload);
      const updatedItem = response.department || response;

      setDepartments(departments.map(d => (d._id === editingDept._id ? { ...d, ...updatedItem, name: formData.name, description: formData.description, status: formData.status } : d)));
      setToast({ message: 'Department updated successfully!', type: 'success' });
      setIsEditModalOpen(false);
      setEditingDept(null);
    } catch (err) {
      setToast({ message: err.message || 'Failed to update department', type: 'error' });
    }
  };

  const confirmDeleteDept = async () => {
    if (!deletingDeptId) return;
    try {
      await departmentService.deleteDepartment(deletingDeptId);
      setToast({ message: 'Department deleted successfully', type: 'success' });
      setDepartments(departments.filter(d => d._id !== deletingDeptId));
    } catch (err) {
      setToast({ message: err.message || 'Failed to delete department', type: 'error' });
    } finally {
      setDeletingDeptId(null);
    }
  };

  return (
    <div className="dashboard-main-container smooth-fade-in">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />

      {/* Header */}
      {/* Header */}
      <div className="page-header-responsive">
        <div className="page-header-title-block">
          <h1 className="hero-serif-title">Organization Departments</h1>
          <p className="hero-sub-summary">Manage organizational hierarchy, employee roster and strength reports</p>
        </div>

        <div className="page-header-actions">
          {/* Dual View Toggle */}
          <div className="view-toggle-container">
            <button
              className={`view-toggle-btn ${viewMode === 'stripe' ? 'active' : ''}`}
              onClick={() => setViewMode('stripe')}
            >
              <List size={14} /> Stripe View
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'card' ? 'active' : ''}`}
              onClick={() => setViewMode('card')}
            >
              <LayoutGrid size={14} /> Card View
            </button>
          </div>

          <button onClick={() => setIsModalOpen(true)} className="btn-new-task">
            <Plus size={16} /> Add Department
          </button>
        </div>
      </div>

      {loading ? (
        <Loader text="Loading department roster & metrics..." />
      ) : (
        <>
          {/* Strength Overview Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div className="project-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="project-category-text">TOTAL DEPARTMENTS</span>
                <Building size={18} color="#c75c2e" />
              </div>
              <div className="project-card-title" style={{ fontSize: '1.75rem', marginTop: '0.5rem' }}>
                {strengthReport?.totalDepartments || departments.length}
              </div>
            </div>

            <div className="project-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="project-category-text">TOTAL STAFF ROSTER</span>
                <UsersIcon size={18} color="#2b7a3d" />
              </div>
              <div className="project-card-title" style={{ fontSize: '1.75rem', marginTop: '0.5rem' }}>
                {strengthReport?.totalStaff || 5} Employees
              </div>
            </div>

            <div className="project-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="project-category-text">AVG UTILIZATION</span>
                <Award size={18} color="#7a42c9" />
              </div>
              <div className="project-card-title" style={{ fontSize: '1.75rem', marginTop: '0.5rem' }}>
                86% Optimal
              </div>
            </div>
          </div>

          {/* DUAL VIEW RENDER: CARD GRID OR STRIPE TABLE */}
          {viewMode === 'stripe' ? (
            <div className="team-widget-card" style={{ padding: 0, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr style={{ backgroundColor: '#faf9f6', borderBottom: '1px solid #eeeae3', color: '#8c8882', textTransform: 'uppercase', fontSize: '0.68rem', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '1rem 1.25rem' }}>Department</th>
                    <th style={{ padding: '1rem 1.25rem' }}>Head</th>
                    <th style={{ padding: '1rem 1.25rem' }}>Roster Count</th>
                    <th style={{ padding: '1rem 1.25rem' }}>Status</th>
                    <th style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((dept, index) => {
                    const headDisplay = typeof dept.head === 'object'
                      ? (dept.head?.name || dept.head?.email || 'Unassigned')
                      : (dept.head ? usersList.find(u => u._id === dept.head)?.name || 'Assigned' : 'Unassigned');
                    const employeesList = Array.isArray(dept.employees)
                      ? dept.employees
                      : (Array.isArray(dept.members) ? dept.members : []);

                    return (
                      <tr key={dept._id || index} style={{ borderBottom: '1px solid #f2ece4' }}>
                        <td style={{ padding: '1rem 1.25rem' }}>
                          <div style={{ fontWeight: 700, color: '#1a1918' }}>{dept.name}</div>
                          <div style={{ fontSize: '0.78rem', color: '#8c8882' }}>{dept.description}</div>
                        </td>
                        <td style={{ padding: '1rem 1.25rem', color: '#4a4742', fontWeight: 600 }}>{headDisplay}</td>
                        <td style={{ padding: '1rem 1.25rem' }}>{employeesList.length} Members</td>
                        <td style={{ padding: '1rem 1.25rem' }}>
                          <span className={`status-badge-pill ${dept.status === 'Active' ? 'badge-on-track' : 'badge-at-risk'}`}>
                            {dept.status || 'Active'}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                            <button onClick={() => handleOpenEditModal(dept)} className="btn btn-secondary" style={{ padding: '0.35rem 0.65rem' }}>
                              <Edit3 size={14} />
                            </button>
                            <button onClick={() => setDeletingDeptId(dept._id)} className="btn btn-secondary" style={{ padding: '0.35rem 0.65rem', color: '#c7452e' }}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="responsive-cards-grid">
            {departments.map((dept, index) => {
              const headDisplay = typeof dept.head === 'object'
                ? (dept.head?.name || dept.head?.email || 'Unassigned')
                : (dept.head ? usersList.find(u => u._id === dept.head)?.name || 'Assigned' : 'Unassigned');

              const parentDisplay = typeof dept.parentDepartment === 'object'
                ? (dept.parentDepartment?.name || 'None')
                : (dept.parentDepartment ? departments.find(d => d._id === dept.parentDepartment)?.name || 'None' : 'None');

              const employeesList = Array.isArray(dept.employees)
                ? dept.employees
                : (Array.isArray(dept.members) ? dept.members : []);

              return (
                <div key={dept._id || index} className="team-widget-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span className={`status-badge-pill ${dept.status === 'Active' ? 'badge-on-track' : 'badge-at-risk'}`}>
                        {dept.status || 'Active'}
                      </span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleOpenEditModal(dept)}
                          style={{ background: 'none', border: 'none', color: '#10529d', cursor: 'pointer' }}
                          title="Edit Department"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => setDeletingDeptId(dept._id)}
                          style={{ background: 'none', border: 'none', color: '#c7452e', cursor: 'pointer' }}
                          title="Delete Department"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="task-title-bold" style={{ fontSize: '1.1rem', marginBottom: '0.35rem' }}>{dept.name}</div>
                    <div className="task-subtitle-muted" style={{ marginBottom: '1rem' }}>{dept.description || 'Department responsibilities and operations'}</div>

                    <div style={{ borderTop: '1px solid #f2ece4', paddingTop: '0.75rem', marginTop: '0.75rem' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#8c8882', marginBottom: '0.35rem' }}>
                        DEPARTMENT HEAD: <span style={{ color: '#1a1918' }}>{headDisplay}</span>
                      </div>

                      {parentDisplay !== 'None' && (
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#8c8882', marginBottom: '0.5rem' }}>
                          PARENT DEPT: <span style={{ color: '#4a4742' }}>{parentDisplay}</span>
                        </div>
                      )}

                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#8c8882', marginBottom: '0.5rem' }}>
                        ASSIGNED ROSTER ({employeesList.length}):
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {employeesList.length > 0 ? (
                          employeesList.map((emp, empIdx) => {
                            const empName = typeof emp === 'object' ? (emp.name || emp.email || 'Employee') : emp;
                            const empRole = typeof emp === 'object' ? (emp.role?.name || emp.role || 'Staff') : 'Staff';
                            return (
                              <span key={emp._id || empIdx} className="task-status-blue" style={{ fontSize: '0.65rem' }}>
                                {empName} ({empRole})
                              </span>
                            );
                          })
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#a19d96' }}>No employees assigned</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </>
    )}

      {/* Modal for Creating Department */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Department"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreateDepartment}>Save Department</button>
          </>
        }
      >
        <form onSubmit={handleCreateDepartment} noValidate>
          <FormField
            label="Department Name"
            name="name"
            placeholder="e.g. Architecture & 3D Visualization"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={formErrors.name}
            required
          />
          <FormField
            label="Description"
            name="description"
            placeholder="Brief scope of responsibilities"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <FormField
            label="Department Head (User Ref)"
            name="head"
            type="select"
            value={formData.head}
            onChange={(e) => setFormData({ ...formData, head: e.target.value })}
          >
            <option value="">None (Unassigned)</option>
            {usersList.map((usr) => (
              <option key={usr._id} value={usr._id}>
                {usr.name} ({typeof usr.role === 'object' ? usr.role?.name : usr.role})
              </option>
            ))}
          </FormField>
          <FormField
            label="Parent Department (Optional)"
            name="parentDepartment"
            type="select"
            value={formData.parentDepartment}
            onChange={(e) => setFormData({ ...formData, parentDepartment: e.target.value })}
          >
            <option value="">None (Top Level)</option>
            {departments.map((dept) => (
              <option key={dept._id} value={dept._id}>
                {dept.name}
              </option>
            ))}
          </FormField>
          <FormField
            label="Status"
            name="status"
            type="select"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </FormField>
        </form>
      </Modal>

      {/* Modal for Editing Department */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Department"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsEditModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleUpdateDepartment}>Update Department</button>
          </>
        }
      >
        <form onSubmit={handleUpdateDepartment} noValidate>
          <FormField
            label="Department Name"
            name="name"
            placeholder="e.g. Architecture & 3D Visualization"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={formErrors.name}
            required
          />
          <FormField
            label="Description"
            name="description"
            placeholder="Brief scope of responsibilities"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <FormField
            label="Department Head (User Ref)"
            name="head"
            type="select"
            value={formData.head}
            onChange={(e) => setFormData({ ...formData, head: e.target.value })}
          >
            <option value="">None (Unassigned)</option>
            {usersList.map((usr) => (
              <option key={usr._id} value={usr._id}>
                {usr.name} ({typeof usr.role === 'object' ? usr.role?.name : usr.role})
              </option>
            ))}
          </FormField>
          <FormField
            label="Parent Department (Optional)"
            name="parentDepartment"
            type="select"
            value={formData.parentDepartment}
            onChange={(e) => setFormData({ ...formData, parentDepartment: e.target.value })}
          >
            <option value="">None (Top Level)</option>
            {departments.filter(d => d._id !== editingDept?._id).map((dept) => (
              <option key={dept._id} value={dept._id}>
                {dept.name}
              </option>
            ))}
          </FormField>
          <FormField
            label="Status"
            name="status"
            type="select"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </FormField>
        </form>
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        isOpen={Boolean(deletingDeptId)}
        onClose={() => setDeletingDeptId(null)}
        title="Confirm Department Deletion"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDeletingDeptId(null)}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={confirmDeleteDept}>
              Delete Department
            </button>
          </>
        }
      >
        <p style={{ fontSize: '0.9rem', color: '#1a1918', lineHeight: 1.5 }}>
          Are you sure you want to delete this department record?
        </p>
      </Modal>
    </div>
  );
};
