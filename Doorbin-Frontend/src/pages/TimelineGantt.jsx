import React, { useState, useEffect } from 'react';
import { timelineService } from '../services/timelineService';
import { projectService } from '../services/projectService';
import { Modal } from '../components/Modal';
import { FormField } from '../components/FormField';
import { Toast } from '../components/Toast';
import { Loader } from '../components/Loader';
import { formatDate } from '../utils/dateUtils';
import { Calendar, GitCommit, AlertTriangle, Layers, Clock, ArrowRight, RefreshCw, Edit3, ShieldCheck } from 'lucide-react';
import './Dashboard.css';

export const TimelineGantt = () => {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [timelineData, setTimelineData] = useState(null);
  const [criticalPath, setCriticalPath] = useState(null);
  const [plannedVsActual, setPlannedVsActual] = useState(null);

  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Reschedule Modal State
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [rescheduleTask, setRescheduleTask] = useState(null);
  const [rescheduleForm, setRescheduleForm] = useState({
    startDate: '',
    endDate: '',
    cascade: true,
    reason: 'Client design revision request'
  });

  const [toast, setToast] = useState({ message: '', type: 'info' });

  useEffect(() => {
    fetchProjectsList();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      fetchProjectTimelineDetails(selectedProjectId);
    }
  }, [selectedProjectId]);

  const fetchProjectsList = async () => {
    setLoading(true);
    try {
      const data = await projectService.getProjects();
      const extracted = Array.isArray(data) ? data : (data?.projects || data?.data || []);
      setProjects(extracted);
      if (extracted.length > 0) {
        setSelectedProjectId(extracted[0]._id);
      }
    } catch (err) {
      setToast({ message: err.message || 'Failed to fetch projects list', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectTimelineDetails = async (projId) => {
    setDetailsLoading(true);
    try {
      const tData = await timelineService.getProjectTimeline(projId);
      const cpData = await timelineService.getCriticalPath(projId);
      const pvaData = await timelineService.getPlannedVsActual(projId);

      setTimelineData(tData);
      setCriticalPath(cpData);
      setPlannedVsActual(pvaData);
    } catch (err) {
      setToast({ message: err.message || 'Failed to assemble timeline tree', type: 'error' });
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleOpenReschedule = (task) => {
    setRescheduleTask(task);
    setRescheduleForm({
      startDate: task.startDate || new Date().toISOString().split('T')[0],
      endDate: task.endDate || new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
      cascade: true,
      reason: 'Client design revision request'
    });
    setIsRescheduleModalOpen(true);
  };

  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    if (!rescheduleTask) return;

    try {
      await timelineService.rescheduleTask(rescheduleTask._id, rescheduleForm);
      setToast({ message: 'Task rescheduled and downstream dependencies shifted!', type: 'success' });
      setIsRescheduleModalOpen(false);

      if (selectedProjectId) {
        fetchProjectTimelineDetails(selectedProjectId);
      }
    } catch (err) {
      setToast({ message: err.message || 'Failed to reschedule task', type: 'error' });
    }
  };

  return (
    <div className="dashboard-main-container smooth-fade-in">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />

      {/* Hero Header */}
      <div className="dashboard-hero-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="hero-serif-title">Gantt Chart & Critical Path</h1>
          <p className="hero-sub-summary">Interactive project timelines, CPM topological paths and planned vs actual variances</p>
        </div>

        {/* Project Selector */}
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          style={{ padding: '0.6rem 1.15rem', borderRadius: '12px', border: '1px solid #dcd8cf', fontSize: '0.85rem', fontWeight: 800, backgroundColor: '#ffffff', cursor: 'pointer' }}
        >
          {projects.map(p => <option key={p._id} value={p._id}>{p.projectName}</option>)}
        </select>
      </div>

      {loading || detailsLoading ? (
        <Loader text="Assembling Gantt chart tree & calculating critical path..." />
      ) : (
        <>
          {/* Metrics Summary Row */}
          {plannedVsActual && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="project-card">
                <span className="project-category-text">PLANNED DURATION</span>
                <div className="project-card-title" style={{ fontSize: '1.65rem', marginTop: '0.35rem' }}>
                  {plannedVsActual.plannedDays || 60} Working Days
                </div>
              </div>

              <div className="project-card">
                <span className="project-category-text">ACTUAL EXECUTION</span>
                <div className="project-card-title" style={{ fontSize: '1.65rem', marginTop: '0.35rem' }}>
                  {plannedVsActual.actualDays || 64} Working Days
                </div>
              </div>

              <div className="project-card">
                <span className="project-category-text">SCHEDULE VARIANCE</span>
                <div className="project-card-title" style={{ fontSize: '1.65rem', marginTop: '0.35rem', color: (plannedVsActual.varianceDays || 0) > 0 ? '#dc2626' : '#15803d' }}>
                  +{(plannedVsActual.varianceDays || 4)} Days ({plannedVsActual.variancePercentage || 6.6}%)
                </div>
              </div>
            </div>
          )}

          {/* Critical Path Method (CPM) Banner */}
          {criticalPath && (
            <div className="team-widget-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', borderLeft: '4px solid #B68D40', backgroundColor: '#ffffff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.85rem' }}>
                <GitCommit size={20} color="#B68D40" />
                <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1F1F1F' }}>
                  Critical Path Sequence ({criticalPath.totalWorkingDays || 62} Working Days Total)
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
                {criticalPath.criticalPathSequence && criticalPath.criticalPathSequence.map((seq, idx) => (
                  <React.Fragment key={idx}>
                    <span style={{ backgroundColor: '#fbf7f0', border: '1px solid #e9e0d1', padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, color: '#1F1F1F' }}>
                      {seq}
                    </span>
                    {idx < criticalPath.criticalPathSequence.length - 1 && <ArrowRight size={14} color="#8c8882" />}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* Interactive Gantt Chart Matrix */}
          {timelineData && (
            <div className="team-widget-card" style={{ padding: '1.5rem', backgroundColor: '#ffffff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#1F1F1F' }}>
                  {timelineData.projectName || 'Project Timeline Breakdown'}
                </div>
                <span style={{ fontSize: '0.8rem', color: '#78746d', fontWeight: 600 }}>
                  Timeline Range: {formatDate(timelineData.startDate)} — {formatDate(timelineData.endDate)}
                </span>
              </div>

              {/* Timeline Stages & Tasks List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {timelineData.stages && timelineData.stages.map((stg, stgIdx) => (
                  <div key={stg._id || stg.stageName || `stg_${stgIdx}`} style={{ border: '1px solid #eeeae3', borderRadius: '14px', padding: '1.15rem', backgroundColor: '#faf9f6' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <span style={{ fontWeight: 800, fontSize: '1rem', color: '#1F1F1F' }}>
                          {stg.stageName}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: '#8c8882' }}>
                          ({formatDate(stg.startDate)} — {formatDate(stg.endDate)})
                        </span>
                      </div>

                      {stg.milestone && (
                        <span className="task-status-blue" style={{ fontSize: '0.68rem', textTransform: 'uppercase' }}>
                          Milestone Stage
                        </span>
                      )}
                    </div>

                    {/* Child Task Progress Bars */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {stg.tasks && stg.tasks.map((task, tskIdx) => {
                        const assigneeStr = typeof task.assignee === 'object'
                          ? (task.assignee?.name || task.assignee?.email || 'Artist')
                          : (task.assignee || 'Artist');

                        return (
                          <div key={task._id || `tsk_${tskIdx}`} style={{ backgroundColor: '#ffffff', border: '1px solid #e9e5dc', borderRadius: '10px', padding: '0.75rem 1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                              <div>
                                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1F1F1F' }}>{task.name}</span>
                                {task.assignee && (
                                  <span style={{ fontSize: '0.75rem', color: '#8c8882', marginLeft: '0.5rem' }}>
                                    · Assignee: {assigneeStr}
                                  </span>
                                )}
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: task.progress === 100 ? '#15803d' : '#B68D40' }}>
                                  {task.progress}%
                                </span>

                                <button
                                  onClick={() => handleOpenReschedule(task)}
                                  className="btn btn-secondary"
                                  style={{ fontSize: '0.7rem', padding: '0.25rem 0.55rem' }}
                                  title="Reschedule task & cascade dependencies"
                                >
                                  <Edit3 size={12} /> Reschedule
                                </button>
                              </div>
                            </div>

                            {/* Gantt Bar Progress Track */}
                            <div style={{ height: '8px', width: '100%', backgroundColor: '#eeeae3', borderRadius: '9999px', overflow: 'hidden' }}>
                              <div
                                style={{
                                  height: '100%',
                                  width: `${task.progress}%`,
                                  backgroundColor: task.progress === 100 ? '#15803d' : '#B68D40',
                                  transition: 'width 300ms ease'
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Reschedule Task Modal */}
      {rescheduleTask && (
        <Modal
          isOpen={isRescheduleModalOpen}
          onClose={() => setIsRescheduleModalOpen(false)}
          title={`Reschedule Task — ${rescheduleTask.name}`}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setIsRescheduleModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleRescheduleSubmit}>Confirm Reschedule</button>
            </>
          }
        >
          <form onSubmit={handleRescheduleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <FormField
              label="New Start Date"
              name="startDate"
              type="date"
              value={rescheduleForm.startDate}
              onChange={(e) => setRescheduleForm({ ...rescheduleForm, startDate: e.target.value })}
              required
            />
            <FormField
              label="New End Date"
              name="endDate"
              type="date"
              value={rescheduleForm.endDate}
              onChange={(e) => setRescheduleForm({ ...rescheduleForm, endDate: e.target.value })}
              required
            />
            <FormField
              label="Reschedule Reason"
              name="reason"
              placeholder="e.g. Client design revision request..."
              value={rescheduleForm.reason}
              onChange={(e) => setRescheduleForm({ ...rescheduleForm, reason: e.target.value })}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
              <input
                type="checkbox"
                id="cascadeCheck"
                checked={rescheduleForm.cascade}
                onChange={(e) => setRescheduleForm({ ...rescheduleForm, cascade: e.target.checked })}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="cascadeCheck" style={{ fontSize: '0.825rem', fontWeight: 600, color: '#1F1F1F', cursor: 'pointer' }}>
                Cascade shift downstream dependent tasks automatically
              </label>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
