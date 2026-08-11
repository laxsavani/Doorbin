import React, { useState, useEffect } from 'react';
import { workflowTemplateService } from '../services/workflowTemplateService';
import { Modal } from '../components/Modal';
import { FormField } from '../components/FormField';
import { Toast } from '../components/Toast';
import { Loader } from '../components/Loader';
import { Layers, Plus, CheckCircle2, ShieldAlert, Check, X, Save, Trash2 } from 'lucide-react';
import './Dashboard.css';

const CATEGORIES = ['Architecture', 'Interior Design', 'Animation'];

export const WorkflowTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('Architecture');
  const [activeTemplate, setActiveTemplate] = useState(null);

  // Add Stage Modal State
  const [isAddStageModalOpen, setIsAddStageModalOpen] = useState(false);
  const [newStageForm, setNewStageForm] = useState({
    name: '',
    approvalRequired: true,
    subStageName: ''
  });

  const [toast, setToast] = useState({ message: '', type: 'info' });

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (templates.length > 0) {
      const found = templates.find(t => t.projectCategory === selectedCategory);
      setActiveTemplate(found || { projectCategory: selectedCategory, stages: [] });
    }
  }, [selectedCategory, templates]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const data = await workflowTemplateService.getWorkflowTemplates();
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err) {
      setToast({ message: err.message || 'Failed to load workflow templates', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!activeTemplate) return;
    try {
      await workflowTemplateService.updateWorkflowTemplate(selectedCategory, activeTemplate);
      setToast({ message: `Workflow template for ${selectedCategory} updated successfully!`, type: 'success' });
    } catch (err) {
      setToast({ message: err.message || 'Failed to update template', type: 'error' });
    }
  };

  const handleDeleteTemplate = async () => {
    if (!window.confirm(`Are you sure you want to delete the complete workflow template for ${selectedCategory}?`)) return;

    try {
      await workflowTemplateService.deleteWorkflowTemplate(selectedCategory);
      setToast({ message: `Workflow template for ${selectedCategory} deleted successfully`, type: 'success' });
      const updatedList = templates.filter(t => t.projectCategory !== selectedCategory);
      setTemplates(updatedList);
      setActiveTemplate({ projectCategory: selectedCategory, stages: [] });
    } catch (err) {
      setToast({ message: err.message || 'Failed to delete template', type: 'error' });
    }
  };

  const handleAddStageToTemplate = (e) => {
    e.preventDefault();
    if (!newStageForm.name.trim()) {
      setToast({ message: 'Stage name is required', type: 'error' });
      return;
    }

    const currentStages = activeTemplate?.stages || [];
    const nextOrder = currentStages.length + 1;

    const newStageItem = {
      _id: `wts_${Date.now()}`,
      name: newStageForm.name,
      order: nextOrder,
      approvalRequired: newStageForm.approvalRequired,
      subStages: newStageForm.subStageName.trim() ? [
        { _id: `wtss_${Date.now()}`, name: newStageForm.subStageName, order: 1, isRepeatableGroup: false, checklist: ['Initial Verification'] }
      ] : []
    };

    const updatedTemplate = { ...activeTemplate, stages: [...currentStages, newStageItem] };
    setActiveTemplate(updatedTemplate);
    setTemplates(templates.map(t => t.projectCategory === selectedCategory ? updatedTemplate : t));

    setToast({ message: 'New stage added to blueprint!', type: 'success' });
    setIsAddStageModalOpen(false);
    setNewStageForm({ name: '', approvalRequired: true, subStageName: '' });
  };

  const handleDeleteStageFromTemplate = (stageId) => {
    if (!activeTemplate) return;
    const updatedStages = (activeTemplate.stages || []).filter(s => (s._id || s.order) !== stageId);
    const updatedTemplate = { ...activeTemplate, stages: updatedStages };
    setActiveTemplate(updatedTemplate);
    setTemplates(templates.map(t => t.projectCategory === selectedCategory ? updatedTemplate : t));
    setToast({ message: 'Stage removed from template', type: 'info' });
  };

  return (
    <div className="dashboard-main-container smooth-fade-in">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />

      {/* Header */}
      <div className="page-header-responsive">
        <div className="page-header-title-block">
          <h1 className="hero-serif-title">Workflow Templates</h1>
          <p className="hero-sub-summary">Configure stage blueprints, repeatable sub-stages and approval rules for 3D visualization categories</p>
        </div>

        <div className="page-header-actions">
          <button onClick={handleDeleteTemplate} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.55rem 0.95rem', color: '#dc2626', borderColor: '#fecaca' }}>
            <Trash2 size={15} /> Delete Template
          </button>

          <button onClick={() => setIsAddStageModalOpen(true)} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.55rem 0.95rem' }}>
            <Plus size={15} /> Add Stage
          </button>

          <button onClick={handleSaveTemplate} className="btn-new-task">
            <Save size={16} /> Save Template
          </button>
        </div>
      </div>

      {loading ? (
        <Loader text="Loading category workflow blueprints..." />
      ) : (
        <>
          {/* Category Tabs & Filter */}
          <div className="responsive-filter-bar">
            {/* Desktop Category Tabs */}
            <div className="desktop-tabs-container">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: '0.55rem 1.15rem',
                    borderRadius: '8px',
                    border: 'none',
                    borderBottom: selectedCategory === cat ? '3px solid #B68D40' : 'none',
                    fontWeight: selectedCategory === cat ? 700 : 500,
                    backgroundColor: 'transparent',
                    color: selectedCategory === cat ? '#B68D40' : '#78746d',
                    cursor: 'pointer'
                  }}
                >
                  {cat} Blueprint
                </button>
              ))}
            </div>

            {/* Mobile Category Select */}
            <select
              className="mobile-filter-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat} Blueprint</option>
              ))}
            </select>
          </div>


          {/* Active Category Stages Blueprint */}
          {activeTemplate && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {activeTemplate.stages && activeTemplate.stages.length > 0 ? (
                activeTemplate.stages.map((stage) => (
                  <div key={stage._id || stage.order} className="team-widget-card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#fbf7f0', border: '1px solid #e9e0d1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', color: '#B68D40' }}>
                          {stage.order}
                        </div>
                        <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1F1F1F' }}>{stage.name}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        {stage.approvalRequired ? (
                          <span className="status-badge-pill badge-on-track" style={{ fontSize: '0.7rem' }}>
                            Approval Required
                          </span>
                        ) : (
                          <span className="status-badge-pill" style={{ fontSize: '0.7rem', backgroundColor: '#f1f5f9', color: '#64748b' }}>
                            Auto Progression
                          </span>
                        )}

                        <button
                          onClick={() => handleDeleteStageFromTemplate(stage._id || stage.order)}
                          style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '0.2rem' }}
                          title="Remove Stage from Blueprint"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Sub Stages & Checklists */}
                    <div style={{ borderTop: '1px solid #f2ece4', paddingTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#8c8882', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        SUB-STAGES & CHECKLIST ITEMS ({stage.subStages?.length || 0}):
                      </div>

                      {stage.subStages && stage.subStages.length > 0 ? (
                        stage.subStages.map((sub) => (
                          <div key={sub._id || sub.order} style={{ backgroundColor: '#faf9f6', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #eeeae3' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1F1F1F' }}>
                                Sub-stage {sub.order}: {sub.name}
                              </span>
                              {sub.isRepeatableGroup && (
                                <span className="task-status-blue" style={{ fontSize: '0.65rem' }}>
                                  Repeatable Group (e.g. per room/scene)
                                </span>
                              )}
                            </div>

                            {/* Checklist Items */}
                            {sub.checklist && sub.checklist.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem' }}>
                                {sub.checklist.map((chk, chkIdx) => (
                                  <span key={chkIdx} style={{ fontSize: '0.725rem', backgroundColor: '#ffffff', border: '1px solid #e9e5dc', padding: '0.2rem 0.6rem', borderRadius: '6px', color: '#4a4742', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <Check size={11} color="#15803d" /> {chk}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: '0.78rem', color: '#a19d96' }}>No sub-stages configured for this stage</div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '0.85rem', color: '#78746d', textAlign: 'center', padding: '2rem 0' }}>
                  No template stages configured for {selectedCategory}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal for Adding Stage to Template */}
      <Modal
        isOpen={isAddStageModalOpen}
        onClose={() => setIsAddStageModalOpen(false)}
        title={`Add Stage to ${selectedCategory} Template`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsAddStageModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAddStageToTemplate}>Add Stage</button>
          </>
        }
      >
        <form onSubmit={handleAddStageToTemplate} noValidate>
          <FormField
            label="Stage Name"
            name="name"
            placeholder="e.g. High-Poly 3D Exterior Geometry"
            value={newStageForm.name}
            onChange={(e) => setNewStageForm({ ...newStageForm, name: e.target.value })}
            required
          />
          <FormField
            label="Initial Sub-Stage Name (Optional)"
            name="subStageName"
            placeholder="e.g. Wall & Floor Geometry Setup"
            value={newStageForm.subStageName}
            onChange={(e) => setNewStageForm({ ...newStageForm, subStageName: e.target.value })}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <input
              type="checkbox"
              id="chkApproval"
              checked={newStageForm.approvalRequired}
              onChange={(e) => setNewStageForm({ ...newStageForm, approvalRequired: e.target.checked })}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <label htmlFor="chkApproval" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1F1F1F', cursor: 'pointer' }}>
              Require formal Director/PM approval checkpoint gate before progression
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
};
