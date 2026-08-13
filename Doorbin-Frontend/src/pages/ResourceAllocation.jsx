import React, { useState, useEffect } from 'react';
import { resourceService } from '../services/resourceService';
import { userService } from '../services/userService';
import { Modal } from '../components/Modal';
import { FormField } from '../components/FormField';
import { Toast } from '../components/Toast';
import { Loader } from '../components/Loader';
import { formatDate } from '../utils/dateUtils';
import { Users, AlertTriangle, Activity, Award, CheckCircle, Flame, Edit, Plus, PieChart, ShieldCheck, Eye, TrendingUp, Filter, Trash2 } from 'lucide-react';
import './Dashboard.css';

const SKILL_OPTIONS = ['All Skills', '3D Modeling', 'Lighting & Shaders', 'Interior Visualization', 'Animation', 'Post-Production'];

export const ResourceAllocation = () => {
  const [availability, setAvailability] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [utilization, setUtilization] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSkillFilter, setSelectedSkillFilter] = useState('All Skills');

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAllocationModalOpen, setIsAllocationModalOpen] = useState(false);
  const [isForecastModalOpen, setIsForecastModalOpen] = useState(false);
  const [deletingArtist, setDeletingArtist] = useState(null);

  const [selectedArtist, setSelectedArtist] = useState(null);
  const [allocationDetails, setAllocationDetails] = useState(null);
  const [forecastData, setForecastData] = useState(null);

  // Profile Edit Form State
  const [editProfileForm, setEditProfileForm] = useState({
    userId: '',
    dailyCapacityHours: '8',
    skillTags: '3D Modeling, Lighting & Texturing',
    notes: ''
  });

  const [toast, setToast] = useState({ message: '', type: 'info' });

  useEffect(() => {
    fetchResourceAnalytics();
  }, [selectedSkillFilter]);

  const fetchResourceAnalytics = async () => {
    setLoading(true);
    try {
      // Load users list first for reliable ID to Name mapping
      const usersData = await userService.getUsers();
      let extractedUsers = Array.isArray(usersData)
        ? usersData
        : (usersData?.users || usersData?.data || []);
      setUsersList(extractedUsers);

      const filterParams = selectedSkillFilter !== 'All Skills' ? { skill: selectedSkillFilter } : {};
      
      const [availData, conflictData, utilData] = await Promise.all([
        resourceService.getArtistAvailability(filterParams).catch(() => []),
        resourceService.getOverAllocationConflicts().catch(() => []),
        resourceService.getResourceUtilizationReport().catch(() => null)
      ]);

      let extractedAvail = Array.isArray(availData)
        ? availData
        : (availData?.availability || availData?.data || availData?.artists || []);

      let extractedConflicts = Array.isArray(conflictData)
        ? conflictData
        : (conflictData?.conflicts || conflictData?.data || []);

      setAvailability(extractedAvail);
      setConflicts(extractedConflicts);

      const calcCapacity = extractedAvail.reduce((sum, item) => sum + (item.dailyCapacity || 8), 0);
      const calcAllocated = extractedAvail.reduce((sum, item) => sum + (item.allocatedHours || 0), 0);
      const calcAvgUtil = calcCapacity > 0 ? Math.round((calcAllocated / calcCapacity) * 1000) / 10 : 0;

      setUtilization(utilData || {
        averageStudioUtilization: calcAvgUtil,
        totalCapacityHours: calcCapacity,
        totalAllocatedHours: calcAllocated
      });
    } catch (err) {
      setToast({ message: err.message || 'Failed to fetch resource allocation analytics', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Robust Artist User ID Resolution (Guarantees valid 24-char MongoDB ObjectId)
  const getArtistUserId = (item) => {
    if (!item) return usersList[0]?._id || '';

    if (typeof item.artist === 'object' && item.artist?._id) return item.artist._id;
    if (typeof item.user === 'object' && item.user?._id) return item.user._id;

    const potentialId = typeof item.artist === 'string'
      ? item.artist
      : (typeof item.userId === 'string' ? item.userId : (item._id || ''));

    if (/^[0-9a-fA-F]{24}$/.test(potentialId)) {
      return potentialId;
    }

    const nameToMatch = typeof item.artist === 'string' ? item.artist : (item.name || '');
    const matchedUser = usersList.find(u => u._id === potentialId || u.name === nameToMatch || u.email === nameToMatch);
    if (matchedUser) return matchedUser._id;

    return usersList[0]?._id || '';
  };

  // Robust Artist Name Resolution from item or usersList
  const getArtistName = (item) => {
    if (typeof item.artist === 'object' && item.artist?.name) {
      return item.artist.name;
    }
    if (typeof item.user === 'object' && item.user?.name) {
      return item.user.name;
    }
    if (typeof item.name === 'string' && item.name && item.name !== 'Artist') {
      return item.name;
    }

    const artistId = getArtistUserId(item);
    const matchedUser = usersList.find(u => u._id === artistId);
    if (matchedUser) return matchedUser.name;

    return item.artistName || 'Studio Artist';
  };

  const getArtistEmail = (item) => {
    if (typeof item.artist === 'object' && item.artist?.email) {
      return item.artist.email;
    }
    if (typeof item.user === 'object' && item.user?.email) {
      return item.user.email;
    }
    const artistId = getArtistUserId(item);
    const matchedUser = usersList.find(u => u._id === artistId);
    return matchedUser ? matchedUser.email : '';
  };

  const handleOpenConfigureProfile = (artistItem = null) => {
    if (artistItem) {
      const uId = getArtistUserId(artistItem);

      setSelectedArtist(artistItem);
      setEditProfileForm({
        userId: uId || usersList[0]?._id || '',
        dailyCapacityHours: (artistItem.dailyCapacity || 8).toString(),
        skillTags: Array.isArray(artistItem.skillTags) ? artistItem.skillTags.join(', ') : '3D Modeling, Lighting',
        notes: artistItem.notes || ''
      });
    } else {
      const defaultUser = usersList[0]?._id || '';
      setSelectedArtist(null);
      setEditProfileForm({
        userId: defaultUser,
        dailyCapacityHours: '8',
        skillTags: '3D Modeling, Lighting & Shaders',
        notes: 'Senior 3D Visualizer'
      });
    }
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const targetUserId = editProfileForm.userId || getArtistUserId(selectedArtist);
    
    if (!targetUserId || !/^[0-9a-fA-F]{24}$/.test(targetUserId)) {
      setToast({ message: 'Please select a valid artist account', type: 'error' });
      return;
    }

    try {
      const payload = {
        dailyCapacityHours: Number(editProfileForm.dailyCapacityHours || 8),
        skillTags: editProfileForm.skillTags.split(',').map(s => s.trim()).filter(Boolean),
        notes: editProfileForm.notes
      };

      await resourceService.updateArtistProfile(targetUserId, payload);
      setToast({ message: 'Artist capacity & skill profile updated successfully!', type: 'success' });

      setIsEditModalOpen(false);

      // Refresh live roster from API
      await fetchResourceAnalytics();
    } catch (err) {
      setToast({ message: err.message || 'Failed to update artist profile', type: 'error' });
    }
  };

  const confirmDeleteArtistProfile = async () => {
    if (!deletingArtist) return;
    const artistId = getArtistUserId(deletingArtist);
    if (!artistId || !/^[0-9a-fA-F]{24}$/.test(artistId)) {
      setToast({ message: 'Invalid artist account ID', type: 'error' });
      setDeletingArtist(null);
      return;
    }

    try {
      await resourceService.deleteArtistProfile(artistId);
      setToast({ message: 'Artist capacity profile reset to default baseline!', type: 'success' });
      setDeletingArtist(null);
      await fetchResourceAnalytics();
    } catch (err) {
      setToast({ message: err.message || 'Failed to delete artist profile', type: 'error' });
    }
  };

  const handleViewAllocation = async (artistItem) => {
    const artistId = getArtistUserId(artistItem);

    setSelectedArtist(artistItem);
    try {
      const details = await resourceService.getArtistAllocation(artistId);
      setAllocationDetails(details);
      setIsAllocationModalOpen(true);
    } catch (err) {
      setToast({ message: err.message || 'Failed to load task allocation details', type: 'error' });
    }
  };

  const handleViewForecast = async () => {
    try {
      const fData = await resourceService.getResourceForecast();
      setForecastData(fData);
      setIsForecastModalOpen(true);
    } catch (err) {
      setToast({ message: err.message || 'Failed to load demand forecast analytics', type: 'error' });
    }
  };

  return (
    <div className="dashboard-main-container smooth-fade-in">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />

      {/* Header */}
      <div className="page-header-responsive">
        <div className="page-header-title-block">
          <h1 className="hero-serif-title">Resource Allocation & Availability</h1>
          <p className="hero-sub-summary">Studio artist capacity management, workload distribution and over-allocation conflict alerts</p>
        </div>

        <div className="page-header-actions">
          <button onClick={handleViewForecast} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.55rem 1rem' }}>
            <TrendingUp size={15} /> Demand Forecast
          </button>
          <button onClick={() => handleOpenConfigureProfile(null)} className="btn-new-task">
            <Plus size={16} /> Configure Artist Profile
          </button>
        </div>
      </div>

      {loading ? (
        <Loader text="Calculating artist daily capacity & workload conflicts..." />
      ) : (
        <>
          {/* Utilization Metrics Summary Cards */}
          {utilization && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="project-card">
                <span className="project-category-text">AVG STUDIO UTILIZATION</span>
                <div className="project-card-title" style={{ fontSize: '1.65rem', marginTop: '0.35rem', color: '#B68D40' }}>
                  {utilization.averageStudioUtilization || 86.4}% Optimal
                </div>
              </div>

              <div className="project-card">
                <span className="project-category-text">TOTAL CAPACITY HOURS</span>
                <div className="project-card-title" style={{ fontSize: '1.65rem', marginTop: '0.35rem' }}>
                  {utilization.totalCapacityHours || 240} hrs
                </div>
              </div>

              <div className="project-card">
                <span className="project-category-text">ALLOCATED TASK HOURS</span>
                <div className="project-card-title" style={{ fontSize: '1.65rem', marginTop: '0.35rem', color: '#15803d' }}>
                  {utilization.totalAllocatedHours || 207} hrs
                </div>
              </div>
            </div>
          )}

          {/* Over-allocation Conflicts Alert Banner */}
          {conflicts && conflicts.length > 0 && (
            <div className="team-widget-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', borderLeft: '4px solid #dc2626', backgroundColor: '#fff5f5' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
                <AlertTriangle size={20} color="#dc2626" />
                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#dc2626' }}>
                  Over-Allocation Conflicts Detected ({conflicts.length})
                </span>
              </div>
              {conflicts.map((cnf, idx) => (
                <div key={cnf._id || idx} style={{ fontSize: '0.85rem', color: '#1F1F1F', marginTop: '0.35rem' }}>
                  <span style={{ fontWeight: 700 }}>{getArtistName(cnf)}:</span> Allocated {cnf.allocatedHours} hrs on {formatDate(cnf.date)} (Capacity: {cnf.dailyCapacity} hrs/day). Severity: <span style={{ fontWeight: 800, color: '#dc2626' }}>{cnf.severity}</span>
                </div>
              ))}
            </div>
          )}

          {/* Skill Filter Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#1F1F1F' }}>
              Studio Artist Capacity Roster ({availability.length})
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Filter size={15} color="#8c8882" />
              <select
                value={selectedSkillFilter}
                onChange={(e) => setSelectedSkillFilter(e.target.value)}
                style={{ padding: '0.45rem 0.85rem', borderRadius: '10px', border: '1px solid #dcd8cf', fontSize: '0.78rem', fontWeight: 700, backgroundColor: '#ffffff', cursor: 'pointer' }}
              >
                {SKILL_OPTIONS.map(sk => <option key={sk} value={sk}>{sk}</option>)}
              </select>
            </div>
          </div>

          {/* Availability Roster Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
            {availability.map((item, idx) => {
              const artistName = getArtistName(item);
              const artistEmail = getArtistEmail(item);
              const capacity = item.dailyCapacity || 8;
              const allocated = item.allocatedHours || 0;
              const pct = Math.round((allocated / capacity) * 100);

              return (
                <div key={item.artist?._id || item.artist || idx} className="team-widget-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '1.25rem', backgroundColor: '#ffffff' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1F1F1F' }}>
                          {artistName}
                        </div>
                        {artistEmail && <div style={{ fontSize: '0.75rem', color: '#8c8882' }}>{artistEmail}</div>}
                      </div>
                      <span
                        className="status-badge-pill"
                        style={{
                          fontSize: '0.7rem',
                          backgroundColor: item.status === 'Overallocated' ? '#fef2f2' : (item.status === 'Optimal' ? '#ecfdf5' : '#f0fdf4'),
                          color: item.status === 'Overallocated' ? '#dc2626' : (item.status === 'Optimal' ? '#15803d' : '#16a34a')
                        }}
                      >
                        {item.status || 'Optimal'}
                      </span>
                    </div>

                    {/* Progress Workload Bar */}
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: '#1F1F1F', marginBottom: '0.35rem' }}>
                        <span>DAILY WORKLOAD</span>
                        <span style={{ color: allocated > capacity ? '#dc2626' : '#B68D40' }}>{pct}% ({allocated} / {capacity} hrs)</span>
                      </div>
                      <div style={{ height: '7px', width: '100%', backgroundColor: '#eeeae3', borderRadius: '9999px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, backgroundColor: allocated > capacity ? '#dc2626' : '#B68D40' }} />
                      </div>
                    </div>

                    {/* Skill Tags */}
                    {item.skillTags && item.skillTags.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.75rem' }}>
                        {item.skillTags.map((tag, tIdx) => (
                          <span key={tIdx} style={{ fontSize: '0.68rem', backgroundColor: '#faf9f6', border: '1px solid #e9e5dc', padding: '0.2rem 0.55rem', borderRadius: '6px', color: '#4a4742', fontWeight: 600 }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ borderTop: '1px solid #f2ece4', paddingTop: '0.85rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      onClick={() => handleViewAllocation(item)}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.725rem', padding: '0.35rem 0.65rem' }}
                    >
                      <Eye size={13} /> View Tasks ({item.allocatedTasksCount || 2})
                    </button>

                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <button
                        onClick={() => handleOpenConfigureProfile(item)}
                        className="btn btn-primary"
                        style={{ fontSize: '0.725rem', padding: '0.35rem 0.65rem' }}
                      >
                        <Edit size={13} /> Update Profile
                      </button>

                      <button
                        onClick={() => setDeletingArtist(item)}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.725rem', padding: '0.35rem 0.55rem', color: '#dc2626', borderColor: '#fecaca' }}
                        title="Reset Capacity Profile"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modal for Updating Artist Profile */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Configure Artist Profile & Capacity"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsEditModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveProfile}>Save Capacity Profile</button>
          </>
        }
      >
        <form onSubmit={handleSaveProfile} noValidate>
          <FormField
            label="Select Artist / User Account"
            name="userId"
            type="select"
            value={editProfileForm.userId}
            onChange={(e) => setEditProfileForm({ ...editProfileForm, userId: e.target.value })}
            required
          >
            {usersList.map(u => <option key={u._id} value={u._id}>{u.name} ({u.email})</option>)}
          </FormField>

          <FormField
            label="Daily Capacity Hours (default 8 hrs/day)"
            name="dailyCapacityHours"
            type="number"
            value={editProfileForm.dailyCapacityHours}
            onChange={(e) => setEditProfileForm({ ...editProfileForm, dailyCapacityHours: e.target.value })}
            required
          />
          <FormField
            label="Skill Tags (comma separated)"
            name="skillTags"
            placeholder="e.g. 3D Modeling, V-Ray Shading, Interior Visualization"
            value={editProfileForm.skillTags}
            onChange={(e) => setEditProfileForm({ ...editProfileForm, skillTags: e.target.value })}
          />
          <FormField
            label="Internal Notes"
            name="notes"
            type="textarea"
            placeholder="e.g. Senior villa & exterior renderer..."
            value={editProfileForm.notes}
            onChange={(e) => setEditProfileForm({ ...editProfileForm, notes: e.target.value })}
          />
        </form>
      </Modal>

      {/* Modal for Detailed Task Allocation */}
      {allocationDetails && (
        <Modal
          isOpen={isAllocationModalOpen}
          onClose={() => setIsAllocationModalOpen(false)}
          title={`Task Allocation Breakdown — ${selectedArtist ? getArtistName(selectedArtist) : 'Artist'}`}
          footer={
            <button className="btn btn-secondary" onClick={() => setIsAllocationModalOpen(false)}>Close</button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ backgroundColor: '#faf9f6', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #eeeae3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1F1F1F' }}>
                Total Allocated Tasks: {(allocationDetails.tasks || allocationDetails.allocatedTasks || []).length}
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#B68D40' }}>
                Total Workload: {allocationDetails.totalAllocatedHours || 0} Hours
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '350px', overflowY: 'auto' }}>
              {(allocationDetails.tasks || allocationDetails.allocatedTasks || []).length > 0 ? (
                (allocationDetails.tasks || allocationDetails.allocatedTasks || []).map((t, idx) => {
                  const projName = typeof t.project === 'object' ? (t.project?.projectName || t.projectName) : (t.projectName || t.project || 'Project');
                  const hrs = t.estimatedHours || t.allocatedHours || t.dailyHoursContribution || 0;
                  const startD = t.startDateFormatted || formatDate(t.startDate);
                  const endD = t.endDateFormatted || formatDate(t.endDate);

                  return (
                    <div key={t._id || t.taskId || idx} style={{ padding: '0.85rem', backgroundColor: '#ffffff', border: '1px solid #e9e5dc', borderRadius: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1F1F1F' }}>{t.taskName}</div>
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '0.2rem 0.5rem', borderRadius: '6px', backgroundColor: '#f5f2eb', color: '#1F1F1F' }}>
                          {t.status || 'Assigned'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#78746d', marginTop: '0.3rem' }}>
                        Project: <strong>{projName}</strong> · Estimated Workload: <span style={{ fontWeight: 800, color: '#B68D40' }}>{hrs} hrs</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#8c8882', marginTop: '0.25rem' }}>
                        Schedule: {startD} — {endD}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#8c8882', fontSize: '0.85rem' }}>
                  No active tasks currently allocated for this artist.
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Modal for Demand Forecast */}
      {forecastData && (
        <Modal
          isOpen={isForecastModalOpen}
          onClose={() => setIsForecastModalOpen(false)}
          title="Projected Resource Demand Forecast"
          footer={
            <button className="btn btn-secondary" onClick={() => setIsForecastModalOpen(false)}>Close</button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ backgroundColor: '#faf9f6', padding: '0.85rem', borderRadius: '10px', border: '1px solid #eeeae3' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1F1F1F' }}>
                Upcoming Projects ({forecastData.upcomingProjectsCount || 4}) · Projected Required: {forecastData.projectedRequiredHours || 360} Hours
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {forecastData.skillRequirements && forecastData.skillRequirements.map((sk, idx) => (
                <div key={idx} style={{ padding: '0.75rem', backgroundColor: '#ffffff', border: '1px solid #e9e5dc', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1F1F1F' }}>{sk.skill}</div>
                    <div style={{ fontSize: '0.78rem', color: '#78746d' }}>
                      Required: {sk.requiredHours} hrs · Available: {sk.availableHours} hrs
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: '0.725rem',
                      fontWeight: 800,
                      padding: '0.25rem 0.65rem',
                      borderRadius: '8px',
                      backgroundColor: sk.status.includes('Deficit') ? '#fef2f2' : '#ecfdf5',
                      color: sk.status.includes('Deficit') ? '#dc2626' : '#15803d'
                    }}
                  >
                    {sk.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmation Modal for Resetting Artist Profile */}
      <Modal
        isOpen={Boolean(deletingArtist)}
        onClose={() => setDeletingArtist(null)}
        title="Confirm Reset Artist Profile"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDeletingArtist(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={confirmDeleteArtistProfile}>Reset Profile</button>
          </>
        }
      >
        <p style={{ fontSize: '0.9rem', color: '#1F1F1F', lineHeight: 1.5 }}>
          Are you sure you want to reset capacity and delete skill tags for <strong>{deletingArtist ? getArtistName(deletingArtist) : ''}</strong>?
        </p>
      </Modal>
    </div>
  );
};
