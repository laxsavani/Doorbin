import React, { useState, useEffect } from 'react';
import { roleService } from '../services/roleService';
import { Modal } from '../components/Modal';
import { FormField } from '../components/FormField';
import { Toast } from '../components/Toast';
import { Loader } from '../components/Loader';
import { Shield, Check, X, Save, Edit2, RotateCcw, Plus, Trash2 } from 'lucide-react';
import './Dashboard.css';

const SYSTEM_ROLES = ['Director', 'Production Manager', 'Artist', 'Human Resource', 'Business Development Manager'];

const DEFAULT_PERMISSIONS = {
  userManagement: false,
  departmentManagement: false,
  projectManagement: false,
  taskManagement: true,
  financeAccess: false,
  hrAccess: false,
  businessDevAccess: false,
  reportsAccess: true,
  dashboardAccess: true,
  resourceAllocation: false,
  calendarAccess: true,
  timelineAccess: false,
  deleteProjects: false,
  systemConfiguration: false
};

export const RolesPermissions = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [activePermissions, setActivePermissions] = useState({});
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newRoleForm, setNewRoleForm] = useState({
    name: '',
    description: ''
  });
  const [toast, setToast] = useState({ message: '', type: 'info' });

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const data = await roleService.getRoles();
      setRoles(Array.isArray(data) ? data : []);
    } catch (err) {
      setToast({ message: err.message || 'Failed to load roles', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleEditRole = (role) => {
    setEditingRoleId(role._id);
    setActivePermissions({ ...role.permissions });
  };

  const handleCancelEdit = () => {
    setEditingRoleId(null);
    setActivePermissions({});
  };

  const handleTogglePermission = (key) => {
    setActivePermissions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSaveRole = async (roleId) => {
    try {
      await roleService.updateRole(roleId, { permissions: activePermissions });
      setToast({ message: 'Role permission matrix updated successfully!', type: 'success' });
      setRoles(roles.map(r => r._id === roleId ? { ...r, permissions: activePermissions } : r));
      setEditingRoleId(null);
    } catch (err) {
      setToast({ message: err.message || 'Failed to update role permissions', type: 'error' });
    }
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    if (!newRoleForm.name.trim()) {
      setToast({ message: 'Role name is required', type: 'error' });
      return;
    }

    try {
      const createdRole = await roleService.createRole({
        name: newRoleForm.name,
        description: newRoleForm.description,
        permissions: DEFAULT_PERMISSIONS
      });

      setRoles([...roles, createdRole.role || createdRole]);
      setToast({ message: 'New custom role created successfully!', type: 'success' });
      setIsCreateModalOpen(false);
      setNewRoleForm({ name: '', description: '' });
    } catch (err) {
      setToast({ message: err.message || 'Failed to create role', type: 'error' });
    }
  };

  const handleDeleteRole = async (role) => {
    if (SYSTEM_ROLES.includes(role.name)) {
      setToast({ message: 'Built-in system roles cannot be deleted', type: 'error' });
      return;
    }

    if (!window.confirm(`Are you sure you want to delete the custom role "${role.name}"?`)) return;

    try {
      await roleService.deleteRole(role._id);
      setToast({ message: 'Role deleted successfully', type: 'success' });
      setRoles(roles.filter(r => r._id !== role._id));
    } catch (err) {
      setToast({ message: err.message || 'Failed to delete role', type: 'error' });
    }
  };

  return (
    <div className="dashboard-main-container smooth-fade-in">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />

      {/* Header */}
      <div className="dashboard-hero-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="hero-serif-title">Role & Permission Management</h1>
          <p className="hero-sub-summary">Manage granular access control matrix across system roles and custom roles</p>
        </div>
        <button onClick={() => setIsCreateModalOpen(true)} className="btn-new-task">
          <Plus size={16} /> Create Custom Role
        </button>
      </div>

      {loading ? (
        <Loader text="Loading permission matrix..." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {roles.map((role) => {
            const isEditing = editingRoleId === role._id;
            const isSystemRole = SYSTEM_ROLES.includes(role.name);
            const currentPerms = isEditing ? activePermissions : (role.permissions || {});
            const permKeys = Object.keys(currentPerms);
            const enabledCount = Object.values(currentPerms).filter(Boolean).length;
            const totalCount = permKeys.length;

            return (
              <div
                key={role._id}
                className="team-widget-card"
                style={{
                  padding: '1.5rem',
                  borderRadius: '16px',
                  backgroundColor: '#ffffff',
                  border: isEditing ? '1.5px solid #B68D40' : '1px solid #e9e5dc',
                  boxShadow: isEditing ? '0 6px 24px rgba(182, 141, 64, 0.12)' : '0 2px 10px rgba(0, 0, 0, 0.02)',
                  transition: 'all 200ms ease'
                }}
              >
                {/* Role Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '12px',
                        backgroundColor: '#fbf7f0',
                        border: '1px solid #e9e0d1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <Shield size={20} color="#B68D40" style={{ display: 'block', margin: 'auto' }} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1F1F1F' }}>{role.name}</span>
                        <span
                          style={{
                            fontSize: '0.725rem',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '9999px',
                            backgroundColor: enabledCount === totalCount ? '#ecfdf5' : (enabledCount > 0 ? '#fbf7f0' : '#f1f5f9'),
                            color: enabledCount === totalCount ? '#15803d' : (enabledCount > 0 ? '#b45309' : '#64748b'),
                            border: `1px solid ${enabledCount === totalCount ? '#bbf7d0' : (enabledCount > 0 ? '#fcd34d' : '#cbd5e1')}`,
                            fontWeight: 700
                          }}
                        >
                          {enabledCount} of {totalCount} Granted
                        </span>
                      </div>
                      <div style={{ fontSize: '0.825rem', color: '#78746d', marginTop: '0.2rem' }}>{role.description}</div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {isEditing ? (
                      <>
                        <button
                          onClick={handleCancelEdit}
                          className="btn btn-secondary"
                          style={{ padding: '0.45rem 0.85rem', fontSize: '0.78rem' }}
                        >
                          <RotateCcw size={14} /> Cancel
                        </button>
                        <button
                          onClick={() => handleSaveRole(role._id)}
                          className="btn btn-primary"
                          style={{ padding: '0.45rem 1.15rem', fontSize: '0.78rem' }}
                        >
                          <Save size={14} /> Save Changes
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEditRole(role)}
                          className="btn btn-secondary"
                          style={{ padding: '0.45rem 1rem', fontSize: '0.78rem', gap: '0.4rem' }}
                        >
                          <Edit2 size={13} /> Edit Permissions
                        </button>

                        {!isSystemRole && (
                          <button
                            onClick={() => handleDeleteRole(role)}
                            className="btn btn-secondary"
                            style={{ padding: '0.45rem 0.75rem', fontSize: '0.78rem', color: '#dc2626', borderColor: '#fecaca' }}
                            title="Delete Custom Role"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Responsive Roles & Permissions Grid */}
                <div className="roles-permissions-grid">
                  {permKeys.map((permKey) => {
                    const isEnabled = currentPerms[permKey];
                    const labelText = permKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

                    return (
                      <div
                        key={permKey}
                        onClick={() => isEditing && handleTogglePermission(permKey)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.6rem 0.75rem',
                          borderRadius: '10px',
                          border: isEnabled ? '1px solid #dcd3c8' : '1px solid #e2e8f0',
                          backgroundColor: isEnabled ? '#fbf8f3' : '#f8fafc',
                          cursor: isEditing ? 'pointer' : 'default',
                          userSelect: 'none',
                          transition: 'all 150ms ease'
                        }}
                      >
                        <span
                          style={{
                            fontSize: '0.78rem',
                            fontWeight: isEnabled ? 600 : 500,
                            color: isEnabled ? '#1F1F1F' : '#64748b',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            marginRight: '0.35rem'
                          }}
                          title={labelText}
                        >
                          {labelText}
                        </span>

                        {isEnabled ? (
                          <div
                            style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '50%',
                              backgroundColor: '#15803d',
                              display: 'grid',
                              placeItems: 'center',
                              flexShrink: 0
                            }}
                            title="Allowed"
                          >
                            <Check size={12} color="#ffffff" strokeWidth={3} style={{ display: 'block', margin: 'auto' }} />
                          </div>
                        ) : (
                          <div
                            style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '50%',
                              backgroundColor: '#e2e8f0',
                              display: 'grid',
                              placeItems: 'center',
                              flexShrink: 0
                            }}
                            title="Denied"
                          >
                            <X size={11} color="#94a3b8" strokeWidth={2.5} style={{ display: 'block', margin: 'auto' }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal for Creating Custom Role */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Custom Role"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsCreateModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreateRole}>Save Custom Role</button>
          </>
        }
      >
        <form onSubmit={handleCreateRole} noValidate>
          <FormField
            label="Role Title / Name"
            name="name"
            placeholder="e.g. Senior Quality Auditor"
            value={newRoleForm.name}
            onChange={(e) => setNewRoleForm({ ...newRoleForm, name: e.target.value })}
            required
          />
          <FormField
            label="Description"
            name="description"
            type="textarea"
            placeholder="e.g. Responsible for final render quality audit and client submission approvals..."
            value={newRoleForm.description}
            onChange={(e) => setNewRoleForm({ ...newRoleForm, description: e.target.value })}
          />
        </form>
      </Modal>
    </div>
  );
};
