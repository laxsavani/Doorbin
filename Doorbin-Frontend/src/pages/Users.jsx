import React, { useState, useEffect } from 'react';
import { userService } from '../services/userService';
import { departmentService } from '../services/departmentService';
import { roleService } from '../services/roleService';
import { authService } from '../services/authService';
import { Modal } from '../components/Modal';
import { FormField } from '../components/FormField';
import { Toast } from '../components/Toast';
import { Loader } from '../components/Loader';
import { validators, focusFirstErrorField } from '../utils/validation';
import { Search, UserPlus, LayoutGrid, List, Edit } from 'lucide-react';
import { useViewMode } from '../hooks/useViewMode';
import './Dashboard.css';

export const Users = () => {
  const [users, setUsers] = useState([]);
  const [departmentsList, setDepartmentsList] = useState([]);
  const [rolesList, setRolesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [viewMode, setViewMode] = useViewMode();

  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: '',
    department: '',
    status: 'Active'
  });

  const [editingUser, setEditingUser] = useState({
    id: '',
    name: '',
    email: '',
    password: '',
    phone: '',
    role: '',
    department: '',
    status: 'Active'
  });

  const [formErrors, setFormErrors] = useState({});
  const [toast, setToast] = useState({ message: '', type: 'info' });

  useEffect(() => {
    fetchUsersDepartmentsAndRoles();
  }, []);

  const fetchUsersDepartmentsAndRoles = async () => {
    setLoading(true);
    try {
      const data = await userService.getUsers();
      const depts = await departmentService.getDepartments();
      const roles = await roleService.getRoles();

      let extractedUsers = Array.isArray(data) ? data : (data?.users || data?.data || []);
      let extractedDepts = Array.isArray(depts) ? depts : (depts?.departments || depts?.data || []);
      let extractedRoles = Array.isArray(roles) ? roles : (roles?.roles || roles?.data || []);

      setUsers(extractedUsers);
      setDepartmentsList(extractedDepts);
      setRolesList(extractedRoles);

      if (extractedRoles.length > 0) {
        setNewUser(prev => ({
          ...prev,
          role: extractedRoles[0]._id || '',
          department: extractedDepts[0]?._id || ''
        }));
      }
    } catch (err) {
      setToast({ message: err.message || 'Failed to load user management data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusToggle = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    try {
      await userService.updateUserStatus(userId, newStatus);
      setToast({ message: `User status changed to ${newStatus}`, type: 'success' });
      setUsers(users.map(u => u._id === userId ? { ...u, status: newStatus } : u));
    } catch (err) {
      setToast({ message: err.message || 'Failed to update user status', type: 'error' });
    }
  };

  const handleRoleChange = async (userId, newRoleId) => {
    try {
      await userService.updateUserRole(userId, newRoleId);
      const matchedRoleObj = rolesList.find(r => r._id === newRoleId);
      setToast({ message: `User role reassigned to ${matchedRoleObj?.name || 'new role'}`, type: 'success' });
      setUsers(users.map(u => u._id === userId ? { ...u, role: matchedRoleObj || newRoleId } : u));
    } catch (err) {
      setToast({ message: err.message || 'Failed to reassign role', type: 'error' });
    }
  };

  const handleCreateUser = async (e) => {
    if (e) e.preventDefault();

    const errors = {};
    const nameErr = validators.required(newUser.name, 'Full Name');
    if (nameErr) errors.name = nameErr;

    const emailErr = validators.email(newUser.email);
    if (emailErr) errors.email = emailErr;

    const passErr = validators.minLength(newUser.password, 6, 'Password');
    if (passErr) errors.password = passErr;

    const phoneErr = validators.phone(newUser.phone);
    if (phoneErr) errors.phone = phoneErr;

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      focusFirstErrorField(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      await userService.createUser(newUser);
      setToast({ message: 'User registered successfully', type: 'success' });
      fetchUsersDepartmentsAndRoles();
      setNewUser({
        name: '',
        email: '',
        password: '',
        phone: '',
        role: rolesList[0]?._id || '',
        department: departmentsList[0]?._id || '',
        status: 'Active'
      });
      setIsModalOpen(false);
    } catch (err) {
      setToast({ message: err.message || 'Failed to register user', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditModal = (user) => {
    setEditingUser({
      id: user._id,
      name: user.name || '',
      email: user.email || '',
      password: '',
      phone: user.phone || '',
      role: typeof user.role === 'object' ? user.role?._id : (user.role || rolesList[0]?._id || ''),
      department: typeof user.department === 'object' ? user.department?._id : (user.department || ''),
      status: user.status || 'Active'
    });
    setFormErrors({});
    setIsEditModalOpen(true);
  };

  const handleUpdateUser = async (e) => {
    if (e) e.preventDefault();

    const errors = {};
    const nameErr = validators.required(editingUser.name, 'Full Name');
    if (nameErr) errors.name = nameErr;

    const emailErr = validators.email(editingUser.email);
    if (emailErr) errors.email = emailErr;

    if (editingUser.password && editingUser.password.trim().length > 0 && editingUser.password.trim().length < 6) {
      errors.password = 'Password must be at least 6 characters long';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      focusFirstErrorField(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: editingUser.name,
        email: editingUser.email,
        phone: editingUser.phone,
        role: editingUser.role,
        department: editingUser.department,
        status: editingUser.status
      };
      if (editingUser.password && editingUser.password.trim().length >= 6) {
        payload.password = editingUser.password;
      }

      await userService.updateUser(editingUser.id, payload);
      setToast({ message: 'User profile updated successfully!', type: 'success' });
      fetchUsersDepartmentsAndRoles();
      setIsEditModalOpen(false);
    } catch (err) {
      setToast({ message: err.message || 'Failed to update user', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const roleName = typeof u.role === 'object' ? u.role?.name : u.role;
    const deptName = typeof u.department === 'object' ? u.department?.name : u.department;
    return (
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      roleName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deptName?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="dashboard-main-container smooth-fade-in">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />

      {/* Header */}
      <div className="page-header-responsive">
        <div className="page-header-title-block">
          <h1 className="hero-serif-title">User Management</h1>
          <p className="hero-sub-summary">Manage system users, edit accounts, status activation/deactivation and role reassignments</p>
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
            <UserPlus size={16} /> Add User
          </button>
        </div>
      </div>

      {loading ? (
        <Loader text="Loading user management roster..." />
      ) : (
        <>
          {/* Filter / Search Bar */}
          <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '380px' }}>
              <Search size={16} color="#8c8882" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search user by name, email, department or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="top-bar-search-input"
                style={{ width: '100%', paddingLeft: '2.25rem' }}
              />
            </div>
          </div>

          {/* DUAL VIEW CONDITIONAL RENDER */}
          {viewMode === 'card' ? (
            /* CARD VIEW (DEFAULT ON MOBILE) */
            <div className="responsive-cards-grid">
              {filteredUsers.map((user) => {
                const roleId = typeof user.role === 'object' ? user.role?._id : user.role;
                const roleName = typeof user.role === 'object' ? user.role?.name : user.role;
                const deptName = typeof user.department === 'object' ? user.department?.name : (user.department || 'General');

                return (
                  <div key={user._id} className="responsive-card-item">
                    <div className="responsive-card-header">
                      <div>
                        <div className="responsive-card-title">{user.name}</div>
                        <div className="responsive-card-subtitle">{user.email}</div>
                        {user.phone && <div style={{ fontSize: '0.75rem', color: '#8c8882', marginTop: '0.2rem' }}>{user.phone}</div>}
                      </div>
                      <span className={`status-badge-pill ${user.status === 'Active' ? 'badge-on-track' : 'badge-at-risk'}`}>
                        {user.status || 'Active'}
                      </span>
                    </div>

                    <div className="responsive-card-body">
                      <div><strong>Department:</strong> {deptName}</div>
                      <div style={{ marginTop: '0.25rem' }}>
                        <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Role Assignment:</strong>
                        <select
                          value={roleId || roleName}
                          onChange={(e) => handleRoleChange(user._id, e.target.value)}
                          style={{
                            padding: '0.35rem 0.65rem',
                            borderRadius: '8px',
                            border: '1px solid #d8d4cb',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            backgroundColor: '#ffffff',
                            width: '100%'
                          }}
                        >
                          {rolesList.map((r) => (
                            <option key={r._id} value={r._id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="responsive-card-footer" style={{ gap: '0.4rem' }}>
                      <button
                        onClick={() => handleOpenEditModal(user)}
                        className="btn btn-secondary"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', flex: 1, justifyContent: 'center' }}
                      >
                        <Edit size={13} /> Edit User
                      </button>
                      <button
                        onClick={() => handleStatusToggle(user._id, user.status || 'Active')}
                        className="btn btn-secondary"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', flex: 1, justifyContent: 'center' }}
                      >
                        {user.status === 'Active' ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* STRIPE / TABLE VIEW (DEFAULT ON DESKTOP) */
            <div className="team-widget-card" style={{ padding: 0, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr style={{ backgroundColor: '#faf9f6', borderBottom: '1px solid #eeeae3', color: '#8c8882', textTransform: 'uppercase', fontSize: '0.68rem', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '1rem 1.25rem', textAlign: 'left' }}>User Info</th>
                    <th style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>Department</th>
                    <th style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>Role Assignment</th>
                    <th style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => {
                    const roleId = typeof user.role === 'object' ? user.role?._id : user.role;
                    const roleName = typeof user.role === 'object' ? user.role?.name : user.role;
                    const deptName = typeof user.department === 'object' ? user.department?.name : (user.department || 'General');

                    return (
                      <tr key={user._id} style={{ borderBottom: '1px solid #f2ece4' }}>
                        <td style={{ padding: '1rem 1.25rem', textAlign: 'left', wordBreak: 'break-word' }}>
                          <div style={{ fontWeight: 700, color: '#1a1918' }}>{user.name}</div>
                          <div style={{ fontSize: '0.78rem', color: '#8c8882' }}>{user.email}</div>
                          {user.phone && <div style={{ fontSize: '0.725rem', color: '#8c8882' }}>{user.phone}</div>}
                        </td>
                        <td style={{ padding: '1rem 1.25rem', textAlign: 'center', color: '#4a4742', fontWeight: 600 }}>
                          {deptName}
                        </td>
                        <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                          <select
                            value={roleId || roleName}
                            onChange={(e) => handleRoleChange(user._id, e.target.value)}
                            style={{
                              padding: '0.35rem 0.65rem',
                              borderRadius: '8px',
                              border: '1px solid #d8d4cb',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              backgroundColor: '#ffffff'
                            }}
                          >
                            {rolesList.map((r) => (
                              <option key={r._id} value={r._id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                          <span className={`status-badge-pill ${user.status === 'Active' ? 'badge-on-track' : 'badge-at-risk'}`}>
                            {user.status || 'Active'}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '0.4rem', justifyContent: 'center' }}>
                            <button
                              onClick={() => handleOpenEditModal(user)}
                              className="btn btn-secondary"
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                            >
                              <Edit size={13} /> Edit
                            </button>
                            <button
                              onClick={() => handleStatusToggle(user._id, user.status || 'Active')}
                              className="btn btn-secondary"
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                            >
                              {user.status === 'Active' ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Modal for Creating User */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isSubmitting && setIsModalOpen(false)}
        title="Add New User"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreateUser} disabled={isSubmitting}>
              {isSubmitting ? 'Registering...' : 'Register User'}
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateUser} noValidate>
          <FormField
            label="Full Name"
            name="name"
            placeholder="e.g. John Doe"
            value={newUser.name}
            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
            error={formErrors.name}
            required
          />
          <FormField
            label="Email Address"
            name="email"
            type="email"
            placeholder="e.g. john@doorbin.com"
            value={newUser.email}
            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            error={formErrors.email}
            required
          />
          <FormField
            label="Password"
            name="password"
            type="password"
            placeholder="Password123"
            value={newUser.password}
            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            error={formErrors.password}
            required
          />
          <FormField
            label="Phone Number"
            name="phone"
            placeholder="+91 9876543210"
            value={newUser.phone}
            onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
            error={formErrors.phone}
            required
          />
          <FormField
            label="Role Assignment"
            name="role"
            type="select"
            value={newUser.role}
            onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
            error={formErrors.role}
            required
          >
            {rolesList.map((r) => (
              <option key={r._id} value={r._id}>
                {r.name}
              </option>
            ))}
          </FormField>
          <FormField
            label="Department"
            name="department"
            type="select"
            value={newUser.department}
            onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
          >
            <option value="">None (Unassigned)</option>
            {departmentsList.map((dept) => (
              <option key={dept._id} value={dept._id}>
                {dept.name}
              </option>
            ))}
          </FormField>
          <FormField
            label="Status"
            name="status"
            type="select"
            value={newUser.status}
            onChange={(e) => setNewUser({ ...newUser, status: e.target.value })}
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </FormField>
        </form>
      </Modal>

      {/* Modal for Editing User */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => !isSubmitting && setIsEditModalOpen(false)}
        title="Edit User Profile"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsEditModalOpen(false)} disabled={isSubmitting}>Cancel</button>
            <button className="btn btn-primary" onClick={handleUpdateUser} disabled={isSubmitting}>
              {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </>
        }
      >
        <form onSubmit={handleUpdateUser} noValidate>
          <FormField
            label="Full Name"
            name="edit_name"
            placeholder="e.g. John Doe"
            value={editingUser.name}
            onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
            error={formErrors.name}
            required
          />
          <FormField
            label="Email Address"
            name="edit_email"
            type="email"
            placeholder="e.g. john@doorbin.com"
            value={editingUser.email}
            onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
            error={formErrors.email}
            required
          />
          <FormField
            label="New Password (Leave blank to keep unchanged)"
            name="edit_password"
            type="password"
            placeholder="Enter new password (optional)"
            value={editingUser.password}
            onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
            error={formErrors.password}
          />
          <FormField
            label="Phone Number"
            name="edit_phone"
            placeholder="+91 9876543210"
            value={editingUser.phone}
            onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
            error={formErrors.phone}
          />
          <FormField
            label="Role Assignment"
            name="edit_role"
            type="select"
            value={editingUser.role}
            onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
            error={formErrors.role}
            required
          >
            {rolesList.map((r) => (
              <option key={r._id} value={r._id}>
                {r.name}
              </option>
            ))}
          </FormField>
          <FormField
            label="Department"
            name="edit_department"
            type="select"
            value={editingUser.department}
            onChange={(e) => setEditingUser({ ...editingUser, department: e.target.value })}
          >
            <option value="">None (Unassigned)</option>
            {departmentsList.map((dept) => (
              <option key={dept._id} value={dept._id}>
                {dept.name}
              </option>
            ))}
          </FormField>
          <FormField
            label="Status"
            name="edit_status"
            type="select"
            value={editingUser.status}
            onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value })}
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </FormField>
        </form>
      </Modal>
    </div>
  );
};
