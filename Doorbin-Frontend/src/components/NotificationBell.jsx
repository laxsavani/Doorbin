import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Trash2, Calendar, Clock, AlertTriangle, Briefcase, CheckCircle, Flag, X, CheckCheck } from 'lucide-react';
import { projectService } from '../services/projectService';
import { taskService } from '../services/taskService';
import { notificationService } from '../services/notificationService';
import { authService } from '../services/authService';

export const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  const currentUser = authService.getCurrentUser();
  const currentUserId = currentUser?._id || currentUser?.id || 'user_guest';
  const currentUserName = typeof currentUser?.name === 'string'
    ? currentUser.name
    : (currentUser?.name?.name || currentUser?.email || '');
  const userRoleName = typeof currentUser?.role === 'object'
    ? (currentUser?.role?.name || 'Artist')
    : (currentUser?.role || 'Artist');
  const isDirector = userRoleName.toLowerCase() === 'director' || userRoleName.toLowerCase() === 'admin';

  useEffect(() => {
    fetchRemindersAndNotifications();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getReadIds = () => {
    try {
      return JSON.parse(localStorage.getItem(`doorbin_read_notifs_${currentUserId}`) || '[]');
    } catch {
      return [];
    }
  };

  const fetchRemindersAndNotifications = async () => {
    setLoading(true);
    try {
      const readIds = getReadIds();

      const [projectsData, tasksData, backendNotifs] = await Promise.all([
        projectService.getProjects().catch(() => []),
        taskService.getTasks().catch(() => []),
        notificationService.getNotifications().catch(() => [])
      ]);

      const projects = Array.isArray(projectsData) ? projectsData : (projectsData?.projects || projectsData?.data || []);
      const tasks = Array.isArray(tasksData) ? tasksData : (tasksData?.tasks || tasksData?.data || []);
      const dbNotifs = Array.isArray(backendNotifs) ? backendNotifs : (backendNotifs?.notifications || backendNotifs?.data || []);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const generated = [];

      // 1. Database System Notifications
      dbNotifs.forEach(n => {
        const id = n._id ? String(n._id) : `db_${Math.random()}`;
        generated.push({
          id,
          title: n.title || 'System Notification',
          message: n.message || n.content || 'New update available',
          type: n.type || 'system',
          time: n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently',
          read: n.read || readIds.includes(id),
          is2DayReminder: false,
          icon: Bell,
          color: '#6366f1'
        });
      });

      // 2. Scan Projects for User & 2-Day Start/End Reminders
      projects.forEach(p => {
        const pName = p.projectName || p.name || 'Project';
        const team = (p.assignedTeam || []).map(m => (typeof m === 'object' ? (m._id || m.id || m.name) : String(m)));
        const pm = typeof p.productionManager === 'object' ? (p.productionManager?._id || p.productionManager?.name) : String(p.productionManager || '');
        
        const isUserProject = isDirector || team.includes(currentUserId) || pm.includes(currentUserId) || team.includes(currentUserName);

        if (isUserProject && p.status !== 'Completed' && p.status !== 'Cancelled') {
          let is2Day = false;
          let timeText = `Status: ${p.status || 'In Progress'}`;

          if (p.endDate) {
            const endD = new Date(p.endDate);
            endD.setHours(0, 0, 0, 0);
            const diffDays = Math.ceil((endD.getTime() - today.getTime()) / (1000 * 3600 * 24));
            if (diffDays >= 0 && diffDays <= 2) {
              is2Day = true;
              timeText = `2-Day Deadline Alert (${diffDays === 0 ? 'Due Today' : diffDays === 1 ? 'Due Tomorrow' : 'Due in 2 Days'})`;
            }
          }

          const id = `proj_${p._id}`;
          generated.push({
            id,
            title: is2Day ? `🏁 Project Deadline Approaching` : `📁 Project: ${pName}`,
            message: `Project "${pName}" (${p.category || 'Architecture'}) is currently active.`,
            type: 'project',
            time: timeText,
            read: readIds.includes(id),
            is2DayReminder: is2Day,
            icon: is2Day ? AlertTriangle : Briefcase,
            color: is2Day ? '#dc2626' : '#0284c7'
          });
        }
      });

      // 3. Scan Tasks for User & 2-Day Due Reminders
      tasks.forEach(t => {
        const assigneeStr = typeof t.assignee === 'object' ? (t.assignee?.name || t.assignee?._id || '') : String(t.assignee || '');
        const isUserTask = isDirector || !currentUserId || assigneeStr.includes(currentUserName) || assigneeStr === currentUserId;

        if (isUserTask && t.status !== 'Completed') {
          let is2Day = false;
          let timeText = `Status: ${t.status || 'In Progress'}`;

          if (t.dueDate) {
            const dueD = new Date(t.dueDate);
            dueD.setHours(0, 0, 0, 0);
            const diffDays = Math.ceil((dueD.getTime() - today.getTime()) / (1000 * 3600 * 24));
            if (diffDays >= 0 && diffDays <= 2) {
              is2Day = true;
              timeText = `2-Day Task Due Alert (${diffDays === 0 ? 'Due Today' : diffDays === 1 ? 'Due Tomorrow' : 'Due in 2 Days'})`;
            }
          }

          const id = `task_${t._id}`;
          generated.push({
            id,
            title: is2Day ? `📌 Task Due Soon` : `📋 Task: ${t.taskName || t.name}`,
            message: `Task "${t.taskName || t.name}" assigned to you in project stage.`,
            type: 'task',
            time: timeText,
            read: readIds.includes(id),
            is2DayReminder: is2Day,
            icon: is2Day ? Clock : CheckCircle,
            color: is2Day ? '#d97706' : '#16a34a'
          });
        }
      });

      setNotifications(generated);
    } catch (err) {
      console.warn('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllAsRead = async () => {
    const readIds = getReadIds();
    const currentIds = notifications.map(n => n.id);
    const mergedSet = new Set([...readIds, ...currentIds]);
    const updatedReadArray = Array.from(mergedSet);

    try {
      localStorage.setItem(`doorbin_read_notifs_${currentUserId}`, JSON.stringify(updatedReadArray));
    } catch {}

    try {
      await notificationService.markRead('all').catch(() => {});
    } catch {}

    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleMarkItemRead = async (id) => {
    const readIds = getReadIds();
    if (!readIds.includes(id)) {
      readIds.push(id);
      try {
        localStorage.setItem(`doorbin_read_notifs_${currentUserId}`, JSON.stringify(readIds));
      } catch {}
    }

    try {
      await notificationService.markRead(id).catch(() => {});
    } catch {}

    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const dismissNotification = async (id) => {
    const readIds = getReadIds();
    if (!readIds.includes(id)) {
      readIds.push(id);
      try {
        localStorage.setItem(`doorbin_read_notifs_${currentUserId}`, JSON.stringify(readIds));
      } catch {}
    }

    try {
      await notificationService.deleteNotification(id).catch(() => {});
    } catch {}

    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {/* Bell Icon Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'relative',
          backgroundColor: '#faf9f6',
          border: '1px solid #dcd8cf',
          borderRadius: '50%',
          width: '38px',
          height: '38px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          outline: 'none'
        }}
        title="Notifications & Reminders"
        aria-label="Notifications"
      >
        <Bell size={18} color="#1F1F1F" />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-2px',
              right: '-2px',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              fontSize: '0.65rem',
              fontWeight: 800,
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #ffffff'
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown Popup Drawer */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: '46px',
            width: '360px',
            maxWidth: '92vw',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
            border: '1px solid #e8e4dc',
            zIndex: 9999,
            overflow: 'hidden',
            animation: 'fadeIn 0.2s ease'
          }}
        >
          {/* Dropdown Header with Prominent 'Read All' Option */}
          <div
            style={{
              padding: '0.85rem 1.15rem',
              borderBottom: '1px solid #efeae1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#faf9f6'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bell size={16} color="#1F1F1F" />
              <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1F1F1F' }}>
                Notifications ({unreadCount} unread)
              </span>
            </div>

            {notifications.length > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  background: '#fbf7f0',
                  border: '1px solid #e9e0d1',
                  borderRadius: '6px',
                  padding: '0.25rem 0.6rem',
                  fontSize: '0.725rem',
                  fontWeight: 700,
                  color: '#B68D40',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  transition: 'all 0.15s ease'
                }}
                title="Mark all notifications as read"
              >
                <CheckCheck size={14} /> Read all
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div style={{ maxHeight: '380px', overflowY: 'auto', padding: '0.5rem' }}>
            {loading ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: '#8c8882', fontSize: '0.8rem' }}>
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '2rem 1.5rem', textAlign: 'center', color: '#8c8882' }}>
                <CheckCircle size={32} color="#16a34a" style={{ margin: '0 auto 0.5rem' }} />
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1F1F1F' }}>All Caught Up!</div>
                <div style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}>No active notifications for your profile right now.</div>
              </div>
            ) : (
              notifications.map((n) => {
                const IconComponent = n.icon || Bell;
                return (
                  <div
                    key={n.id}
                    onClick={() => handleMarkItemRead(n.id)}
                    style={{
                      padding: '0.75rem 0.85rem',
                      borderRadius: '10px',
                      marginBottom: '0.35rem',
                      backgroundColor: n.is2DayReminder ? (n.read ? '#ffffff' : '#fff7ed') : (n.read ? '#ffffff' : '#fefce8'),
                      border: n.is2DayReminder ? (n.read ? '1px solid #f3eee7' : '1px solid #ffedd5') : (n.read ? '1px solid #f3eee7' : '1px solid #fef08a'),
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.65rem',
                      position: 'relative',
                      cursor: 'pointer'
                    }}
                  >
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: `${n.color}15`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '2px'
                      }}
                    >
                      <IconComponent size={15} color={n.color} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#1F1F1F', lineHeight: 1.3 }}>
                          {n.title}
                        </span>
                        {n.is2DayReminder && (
                          <span style={{ fontSize: '0.6rem', fontWeight: 800, backgroundColor: '#c2410c', color: '#ffffff', padding: '1px 5px', borderRadius: '4px', textTransform: 'uppercase' }}>
                            2-DAY REMINDER
                          </span>
                        )}
                        {!n.read && !n.is2DayReminder && (
                          <span style={{ fontSize: '0.6rem', fontWeight: 800, backgroundColor: '#ca8a04', color: '#ffffff', padding: '1px 5px', borderRadius: '4px', textTransform: 'uppercase' }}>
                            NEW
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.75rem', color: '#525252', marginTop: '0.2rem', lineHeight: 1.4 }}>
                        {n.message}
                      </div>

                      <div style={{ fontSize: '0.68rem', color: '#8c8882', marginTop: '0.3rem', fontWeight: 600 }}>
                        {n.time}
                      </div>
                    </div>

                    <button
                      onClick={(e) => { e.stopPropagation(); dismissNotification(n.id); }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#a3a3a3',
                        cursor: 'pointer',
                        padding: '2px'
                      }}
                      title="Dismiss notification"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
