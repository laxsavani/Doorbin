import React, { useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { FormField } from '../components/FormField';
import { Toast } from '../components/Toast';
import { Loader } from '../components/Loader';
import { validators, focusFirstErrorField } from '../utils/validation';
import { User, Lock, Save, KeyRound } from 'lucide-react';
import './Dashboard.css';

export const UserProfile = () => {
  const [profile, setProfile] = useState({ name: '', email: '', phone: '', role: '' });
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  const [loading, setLoading] = useState(true);
  const [profileErrors, setProfileErrors] = useState({});
  const [passwordErrors, setPasswordErrors] = useState({});
  const [toast, setToast] = useState({ message: '', type: 'info' });

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    setLoading(true);
    try {
      const data = await authService.getProfile();
      setProfile({
        name: data.name || 'Lax Savani',
        email: data.email || 'lax@doorbin.com',
        phone: data.phone || '+91 98765 43210',
        role: typeof data.role === 'object' ? data.role?.name : (data.role || 'Director')
      });
    } catch (err) {
      setToast({ message: err.message || 'Failed to fetch profile', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();

    const errors = {};
    const nameErr = validators.required(profile.name, 'Full Name');
    if (nameErr) errors.name = nameErr;

    setProfileErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirstErrorField(errors);
      return;
    }

    try {
      await authService.updateProfile({ name: profile.name, phone: profile.phone });
      setToast({ message: 'Profile information updated successfully!', type: 'success' });
    } catch (err) {
      setToast({ message: err.message || 'Failed to update profile', type: 'error' });
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    const errors = {};
    const currErr = validators.required(passwordData.currentPassword, 'Current Password');
    if (currErr) errors.currentPassword = currErr;

    const newErr = validators.required(passwordData.newPassword, 'New Password');
    if (newErr) errors.newPassword = newErr;

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      errors.confirmPassword = 'New passwords do not match';
    }

    setPasswordErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirstErrorField(errors);
      return;
    }

    try {
      await authService.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      setToast({ message: 'Password changed successfully!', type: 'success' });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setToast({ message: err.message || 'Failed to change password', type: 'error' });
    }
  };

  return (
    <div className="dashboard-main-container smooth-fade-in">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />

      {/* Header */}
      <div className="dashboard-hero-section">
        <h1 className="hero-serif-title">Account Settings & Profile</h1>
        <p className="hero-sub-summary">Manage your personal credentials, contact information and account security</p>
      </div>

      {loading ? (
        <Loader text="Loading account profile..." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
          {/* Profile Details Card */}
          <div className="team-widget-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
              <User size={20} color="#B68D40" />
              <span className="task-title-bold" style={{ fontSize: '1.15rem' }}>Personal Information</span>
            </div>

            <form onSubmit={handleUpdateProfile} noValidate>
              <FormField
                label="Full Name"
                name="name"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                error={profileErrors.name}
                required
              />
              <FormField
                label="Email Address (ReadOnly)"
                name="email"
                type="email"
                value={profile.email}
                disabled
              />
              <FormField
                label="Phone Number"
                name="phone"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              />
              <FormField
                label="Assigned Role (ReadOnly)"
                name="role"
                value={profile.role}
                disabled
              />

              <button type="submit" className="btn btn-primary" style={{ marginTop: '0.75rem', width: '100%' }}>
                <Save size={16} /> Save Profile Changes
              </button>
            </form>
          </div>

          {/* Change Password Card */}
          <div className="team-widget-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
              <Lock size={20} color="#B68D40" />
              <span className="task-title-bold" style={{ fontSize: '1.15rem' }}>Security & Change Password</span>
            </div>

            <form onSubmit={handleChangePassword} noValidate>
              <FormField
                label="Current Password"
                name="currentPassword"
                type="password"
                placeholder="••••••••"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                error={passwordErrors.currentPassword}
                required
              />
              <FormField
                label="New Password"
                name="newPassword"
                type="password"
                placeholder="••••••••"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                error={passwordErrors.newPassword}
                required
              />
              <FormField
                label="Confirm New Password"
                name="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                error={passwordErrors.confirmPassword}
                required
              />

              <button type="submit" className="btn btn-secondary" style={{ marginTop: '0.75rem', width: '100%' }}>
                <KeyRound size={16} /> Update Password
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
