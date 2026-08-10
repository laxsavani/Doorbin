import React, { useState, useEffect } from 'react';
import { clientService } from '../services/clientService';
import { Modal } from '../components/Modal';
import { FormField } from '../components/FormField';
import { Toast } from '../components/Toast';
import { Loader } from '../components/Loader';
import { validators, focusFirstErrorField } from '../utils/validation';
import { Plus, Search, Building2, Phone, Mail, MessageSquare, Trash2, UserPlus, Edit3 } from 'lucide-react';
import './Dashboard.css';

export const Clients = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Active Client State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);

  // Custom UI Delete Confirmation Modal State
  const [deletingClientId, setDeletingClientId] = useState(null);

  // New Client Form State
  const [newClient, setNewClient] = useState({
    companyName: '',
    clientName: '',
    email: '',
    phone: '',
    address: '',
    gstDetails: '',
    industry: 'Real Estate & Infrastructure',
    notes: '',
    status: 'Active'
  });

  // Additional Contact Form State
  const [newContact, setNewContact] = useState({
    name: '',
    designation: '',
    email: '',
    phone: ''
  });

  // Communication Log Form State
  const [newComm, setNewComm] = useState({
    type: 'Call',
    description: ''
  });

  const [formErrors, setFormErrors] = useState({});
  const [toast, setToast] = useState({ message: '', type: 'info' });

  useEffect(() => {
    fetchClientsData();
  }, []);

  const fetchClientsData = async () => {
    setLoading(true);
    try {
      const data = await clientService.getClients();
      setClients(Array.isArray(data) ? data : (data?.clients || data?.data || []));
    } catch (err) {
      setToast({ message: err.message || 'Failed to fetch clients', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClient = async (e) => {
    e.preventDefault();

    const errors = {};
    const compErr = validators.required(newClient.companyName, 'Company Name');
    if (compErr) errors.companyName = compErr;

    const nameErr = validators.required(newClient.clientName, 'Primary Contact Name');
    if (nameErr) errors.clientName = nameErr;

    const emailErr = validators.email(newClient.email);
    if (emailErr) errors.email = emailErr;

    const phoneErr = validators.required(newClient.phone, 'Phone Number');
    if (phoneErr) errors.phone = phoneErr;

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirstErrorField(errors);
      return;
    }

    try {
      const response = await clientService.createClient(newClient);
      const createdItem = response.client || response || {
        _id: response._id || `66b0a1f8e91d2c345678${Date.now().toString().slice(-4)}`,
        ...newClient,
        contacts: [],
        communicationLog: [],
        createdAt: new Date().toISOString()
      };

      setClients([createdItem, ...clients]);
      setToast({ message: 'Client record created successfully!', type: 'success' });
      setNewClient({
        companyName: '',
        clientName: '',
        email: '',
        phone: '',
        address: '',
        gstDetails: '',
        industry: 'Real Estate & Infrastructure',
        notes: '',
        status: 'Active'
      });
      setIsCreateModalOpen(false);
    } catch (err) {
      setToast({ message: err.message || 'Failed to create client', type: 'error' });
    }
  };

  const handleOpenEditModal = (client) => {
    setEditingClient(client);
    setNewClient({
      companyName: client.companyName || '',
      clientName: client.clientName || '',
      email: client.email || '',
      phone: client.phone || '',
      address: client.address || '',
      gstDetails: client.gstDetails || '',
      industry: client.industry || 'Real Estate & Infrastructure',
      notes: client.notes || '',
      status: client.status || 'Active'
    });
    setFormErrors({});
    setIsEditModalOpen(true);
  };

  const handleUpdateClient = async (e) => {
    e.preventDefault();
    if (!editingClient) return;

    const errors = {};
    const compErr = validators.required(newClient.companyName, 'Company Name');
    if (compErr) errors.companyName = compErr;

    const nameErr = validators.required(newClient.clientName, 'Primary Contact Name');
    if (nameErr) errors.clientName = nameErr;

    const emailErr = validators.email(newClient.email);
    if (emailErr) errors.email = emailErr;

    const phoneErr = validators.required(newClient.phone, 'Phone Number');
    if (phoneErr) errors.phone = phoneErr;

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirstErrorField(errors);
      return;
    }

    try {
      const response = await clientService.updateClient(editingClient._id, newClient);
      const updatedItem = response.client || response;

      setClients(clients.map(c => c._id === editingClient._id ? { ...c, ...updatedItem, ...newClient } : c));
      if (selectedClient && selectedClient._id === editingClient._id) {
        setSelectedClient({ ...selectedClient, ...newClient });
      }

      setToast({ message: 'Client record updated successfully!', type: 'success' });
      setIsEditModalOpen(false);
      setEditingClient(null);
    } catch (err) {
      setToast({ message: err.message || 'Failed to update client record', type: 'error' });
    }
  };

  const handleAddContact = async (e) => {
    e.preventDefault();
    if (!selectedClient || !newContact.name) return;

    try {
      await clientService.addContact(selectedClient._id, newContact);
      const addedItem = { _id: `ct_${Date.now()}`, ...newContact };
      const updatedClient = {
        ...selectedClient,
        contacts: [...(selectedClient.contacts || []), addedItem]
      };

      setSelectedClient(updatedClient);
      setClients(clients.map(c => c._id === selectedClient._id ? updatedClient : c));
      setNewContact({ name: '', designation: '', email: '', phone: '' });
      setToast({ message: 'Additional contact added successfully!', type: 'success' });
    } catch (err) {
      setToast({ message: err.message || 'Failed to add contact', type: 'error' });
    }
  };

  const handleLogCommunication = async (e) => {
    e.preventDefault();
    if (!selectedClient || !newComm.description) return;

    try {
      await clientService.logCommunication(selectedClient._id, newComm);
      const commEntry = {
        _id: `cm_${Date.now()}`,
        type: newComm.type,
        description: newComm.description,
        date: new Date().toISOString(),
        createdBy: { name: 'Logged User' }
      };

      const updatedClient = {
        ...selectedClient,
        communicationLog: [commEntry, ...(selectedClient.communicationLog || [])]
      };

      setSelectedClient(updatedClient);
      setClients(clients.map(c => c._id === selectedClient._id ? updatedClient : c));
      setNewComm({ type: 'Call', description: '' });
      setToast({ message: 'Communication logged successfully!', type: 'success' });
    } catch (err) {
      setToast({ message: err.message || 'Failed to log communication', type: 'error' });
    }
  };

  const confirmDeleteClient = async () => {
    if (!deletingClientId) return;
    try {
      await clientService.deleteClient(deletingClientId);
      setToast({ message: 'Client status updated to Inactive', type: 'success' });
      setClients(clients.map(c => c._id === deletingClientId ? { ...c, status: 'Inactive' } : c));
    } catch (err) {
      setToast({ message: err.message || 'Failed to delete client', type: 'error' });
    } finally {
      setDeletingClientId(null);
    }
  };

  const filteredClients = clients.filter(c =>
    c.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.clientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.industry?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="dashboard-main-container smooth-fade-in">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />

      {/* Header */}
      <div className="dashboard-hero-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="hero-serif-title">Client Management & CRM</h1>
          <p className="hero-sub-summary">Manage client database, multi-contacts, communication logs and project statements</p>
        </div>
        <button onClick={() => setIsCreateModalOpen(true)} className="btn-new-task">
          <Plus size={16} /> Add New Client
        </button>
      </div>

      {loading ? (
        <Loader text="Loading CRM client database..." />
      ) : (
        <>
          {/* Search & Filter */}
          <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '380px' }}>
              <Search size={16} color="#8c8882" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search by company, client name, email or industry..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="top-bar-search-input"
                style={{ width: '100%', paddingLeft: '2.25rem' }}
              />
            </div>
          </div>

          {/* Clients Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
            {filteredClients.map((client) => (
              <div key={client._id} className="team-widget-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span className={`status-badge-pill ${client.status === 'Active' ? 'badge-on-track' : 'badge-at-risk'}`}>
                      {client.status || 'Active'}
                    </span>
                    <span className="project-category-text">{client.industry || 'Real Estate'}</span>
                  </div>

                  <div className="task-title-bold" style={{ fontSize: '1.15rem', marginBottom: '0.2rem' }}>
                    {client.companyName}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.825rem', color: '#1a1918', fontWeight: 600 }}>
                      <Building2 size={14} color="#8c8882" />
                      <span>{client.clientName}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: '#8c8882' }}>
                      <Mail size={13} color="#8c8882" />
                      <span>{client.email}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: '#8c8882' }}>
                      <Phone size={13} color="#8c8882" />
                      <span>{client.phone}</span>
                    </div>
                    {client.gstDetails && (
                      <div style={{ fontSize: '0.725rem', color: '#78746d', fontFamily: 'monospace', marginTop: '0.25rem' }}>
                        GSTIN: {client.gstDetails}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #f2ece4', paddingTop: '0.85rem', marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    onClick={() => { setSelectedClient(client); setIsDetailModalOpen(true); }}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem' }}
                  >
                    <MessageSquare size={14} /> CRM Logs & Contacts ({client.communicationLog?.length || 0})
                  </button>

                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      onClick={() => handleOpenEditModal(client)}
                      style={{ background: 'none', border: 'none', color: '#10529d', cursor: 'pointer', padding: '0.35rem' }}
                      title="Edit Client Record"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={() => setDeletingClientId(client._id)}
                      style={{ background: 'none', border: 'none', color: '#c7452e', cursor: 'pointer', padding: '0.35rem' }}
                      title="Deactivate Client"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Create New Client Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add New Client Record"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsCreateModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreateClient}>Save Client</button>
          </>
        }
      >
        <form onSubmit={handleCreateClient} noValidate>
          <FormField
            label="Company Name"
            name="companyName"
            placeholder="e.g. Vistara Developers Ltd"
            value={newClient.companyName}
            onChange={(e) => setNewClient({ ...newClient, companyName: e.target.value })}
            error={formErrors.companyName}
            required
          />
          <FormField
            label="Primary Contact Person"
            name="clientName"
            placeholder="e.g. Rahul Sharma"
            value={newClient.clientName}
            onChange={(e) => setNewClient({ ...newClient, clientName: e.target.value })}
            error={formErrors.clientName}
            required
          />
          <FormField
            label="Email Address"
            name="email"
            type="email"
            placeholder="e.g. rahul@vistaradevelopers.com"
            value={newClient.email}
            onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
            error={formErrors.email}
            required
          />
          <FormField
            label="Phone Number"
            name="phone"
            placeholder="+91 98250 12345"
            value={newClient.phone}
            onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
            error={formErrors.phone}
            required
          />
          <FormField
            label="Industry / Domain"
            name="industry"
            placeholder="e.g. Real Estate & Infrastructure"
            value={newClient.industry}
            onChange={(e) => setNewClient({ ...newClient, industry: e.target.value })}
          />
          <FormField
            label="GSTIN Details"
            name="gstDetails"
            placeholder="e.g. 24AAAAA0000A1Z5"
            value={newClient.gstDetails}
            onChange={(e) => setNewClient({ ...newClient, gstDetails: e.target.value })}
          />
          <FormField
            label="Address"
            name="address"
            placeholder="e.g. 401 Vistara Tower, SG Highway"
            value={newClient.address}
            onChange={(e) => setNewClient({ ...newClient, address: e.target.value })}
          />
          <FormField
            label="Internal Notes"
            name="notes"
            type="textarea"
            placeholder="Important client references or project scope notes..."
            value={newClient.notes}
            onChange={(e) => setNewClient({ ...newClient, notes: e.target.value })}
          />
        </form>
      </Modal>

      {/* Edit Client Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Client Record"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsEditModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleUpdateClient}>Update Client</button>
          </>
        }
      >
        <form onSubmit={handleUpdateClient} noValidate>
          <FormField
            label="Company Name"
            name="companyName"
            placeholder="e.g. Vistara Developers Ltd"
            value={newClient.companyName}
            onChange={(e) => setNewClient({ ...newClient, companyName: e.target.value })}
            error={formErrors.companyName}
            required
          />
          <FormField
            label="Primary Contact Person"
            name="clientName"
            placeholder="e.g. Rahul Sharma"
            value={newClient.clientName}
            onChange={(e) => setNewClient({ ...newClient, clientName: e.target.value })}
            error={formErrors.clientName}
            required
          />
          <FormField
            label="Email Address"
            name="email"
            type="email"
            placeholder="e.g. rahul@vistaradevelopers.com"
            value={newClient.email}
            onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
            error={formErrors.email}
          />
          <FormField
            label="Phone Number"
            name="phone"
            placeholder="e.g. +91 98765 43210"
            value={newClient.phone}
            onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
            error={formErrors.phone}
            required
          />
          <FormField
            label="Industry Sector"
            name="industry"
            type="select"
            value={newClient.industry}
            onChange={(e) => setNewClient({ ...newClient, industry: e.target.value })}
          >
            <option value="Real Estate & Infrastructure">Real Estate & Infrastructure</option>
            <option value="Architectural Visualization">Architectural Visualization</option>
            <option value="Film & VFX Studio">Film & VFX Studio</option>
            <option value="Product Design">Product Design</option>
            <option value="Gaming & Interactive">Gaming & Interactive</option>
            <option value="Corporate & Advertising">Corporate & Advertising</option>
          </FormField>
          <FormField
            label="Status"
            name="status"
            type="select"
            value={newClient.status}
            onChange={(e) => setNewClient({ ...newClient, status: e.target.value })}
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </FormField>
          <FormField
            label="GSTIN Details"
            name="gstDetails"
            placeholder="e.g. 24AAAAA0000A1Z5"
            value={newClient.gstDetails}
            onChange={(e) => setNewClient({ ...newClient, gstDetails: e.target.value })}
          />
          <FormField
            label="Address"
            name="address"
            placeholder="e.g. 401 Vistara Tower, SG Highway"
            value={newClient.address}
            onChange={(e) => setNewClient({ ...newClient, address: e.target.value })}
          />
          <FormField
            label="Internal Notes"
            name="notes"
            type="textarea"
            placeholder="Important client references or project scope notes..."
            value={newClient.notes}
            onChange={(e) => setNewClient({ ...newClient, notes: e.target.value })}
          />
        </form>
      </Modal>

      {/* Client Detail & CRM Log Modal */}
      {selectedClient && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`${selectedClient.companyName} — CRM & Communication`}
          footer={
            <button className="btn btn-secondary" onClick={() => setIsDetailModalOpen(false)}>Close</button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Client Summary */}
            <div style={{ backgroundColor: '#faf9f6', padding: '1rem', borderRadius: '12px', border: '1px solid #eeeae3' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1a1918' }}>Primary Contact: {selectedClient.clientName}</div>
              <div style={{ fontSize: '0.8rem', color: '#8c8882', marginTop: '0.2rem' }}>
                {selectedClient.email} · {selectedClient.phone}
              </div>
              {selectedClient.address && (
                <div style={{ fontSize: '0.78rem', color: '#4a4742', marginTop: '0.35rem' }}>
                  Address: {selectedClient.address}
                </div>
              )}
            </div>

            {/* Additional Contacts Section */}
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1a1918', marginBottom: '0.65rem' }}>
                Additional Contact Persons ({selectedClient.contacts?.length || 0})
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                {selectedClient.contacts && selectedClient.contacts.length > 0 ? (
                  selectedClient.contacts.map((ct) => (
                    <div key={ct._id} style={{ padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #eeeae3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: '0.825rem' }}>{ct.name}</span>
                        {ct.designation && <span style={{ fontSize: '0.75rem', color: '#8c8882', marginLeft: '0.5rem' }}>({ct.designation})</span>}
                        <div style={{ fontSize: '0.75rem', color: '#8c8882' }}>{ct.email} · {ct.phone}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: '0.78rem', color: '#a19d96' }}>No additional contacts added yet</div>
                )}
              </div>

              {/* Add Contact Form */}
              <form onSubmit={handleAddContact} style={{ borderTop: '1px dashed #e9e7e1', paddingTop: '0.75rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="Contact Name"
                    value={newContact.name}
                    onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                    className="top-bar-search-input"
                    style={{ width: '100%', fontSize: '0.78rem', padding: '0.45rem 0.75rem' }}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Designation"
                    value={newContact.designation}
                    onChange={(e) => setNewContact({ ...newContact, designation: e.target.value })}
                    className="top-bar-search-input"
                    style={{ width: '100%', fontSize: '0.78rem', padding: '0.45rem 0.75rem' }}
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={newContact.email}
                    onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                    className="top-bar-search-input"
                    style={{ width: '100%', fontSize: '0.78rem', padding: '0.45rem 0.75rem' }}
                  />
                  <input
                    type="text"
                    placeholder="Phone"
                    value={newContact.phone}
                    onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                    className="top-bar-search-input"
                    style={{ width: '100%', fontSize: '0.78rem', padding: '0.45rem 0.75rem' }}
                  />
                </div>
                <button type="submit" className="btn btn-secondary" style={{ marginTop: '0.5rem', width: '100%', fontSize: '0.75rem', padding: '0.4rem' }}>
                  <UserPlus size={14} /> Add Contact
                </button>
              </form>
            </div>

            {/* Communication Log Section */}
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1a1918', marginBottom: '0.65rem' }}>
                Communication Timeline & Logs ({selectedClient.communicationLog?.length || 0})
              </div>

              {/* Log Communication Entry Form */}
              <form onSubmit={handleLogCommunication} style={{ marginBottom: '1rem', backgroundColor: '#faf9f6', padding: '0.75rem', borderRadius: '10px', border: '1px solid #eeeae3' }}>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <select
                    value={newComm.type}
                    onChange={(e) => setNewComm({ ...newComm, type: e.target.value })}
                    style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid #d8d4cb', fontSize: '0.78rem', fontWeight: 600, backgroundColor: '#ffffff' }}
                  >
                    <option value="Call">Call</option>
                    <option value="Email">Email</option>
                    <option value="Meeting">Meeting</option>
                    <option value="Note">Note</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Enter discussion notes or follow-up summary..."
                    value={newComm.description}
                    onChange={(e) => setNewComm({ ...newComm, description: e.target.value })}
                    className="top-bar-search-input"
                    style={{ flex: 1, fontSize: '0.78rem', padding: '0.45rem 0.75rem' }}
                    required
                  />
                </div>
                <button type="submit" className="btn-new-task" style={{ width: '100%', justifyContent: 'center', fontSize: '0.75rem', padding: '0.4rem' }}>
                  <MessageSquare size={14} /> Add Log Entry
                </button>
              </form>

              {/* Communication Logs Timeline List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '220px', overflowY: 'auto' }}>
                {selectedClient.communicationLog && selectedClient.communicationLog.length > 0 ? (
                  selectedClient.communicationLog.map((log) => (
                    <div key={log._id} style={{ padding: '0.65rem 0.85rem', borderRadius: '10px', backgroundColor: '#ffffff', border: '1px solid #eeeae3' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                        <span className="task-status-blue" style={{ fontSize: '0.65rem', textTransform: 'uppercase' }}>
                          {log.type}
                        </span>
                        <span style={{ fontSize: '0.725rem', color: '#8c8882', fontFamily: 'monospace' }}>
                          {new Date(log.date).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#1a1918', fontWeight: 500 }}>
                        {log.description}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: '0.78rem', color: '#a19d96' }}>No communication logs recorded</div>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={Boolean(deletingClientId)}
        onClose={() => setDeletingClientId(null)}
        title="Confirm Client Deactivation"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDeletingClientId(null)}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={confirmDeleteClient}>
              Deactivate Client
            </button>
          </>
        }
      >
        <p style={{ fontSize: '0.9rem', color: '#1a1918', lineHeight: 1.5 }}>
          Are you sure you want to deactivate this client record? This action is restricted to Director roles.
        </p>
      </Modal>
    </div>
  );
};
