import apiClient from './apiClient';
import { projectService } from './projectService';
import { taskService } from './taskService';
import { enquiryService } from './enquiryService';
import { userService } from './userService';

export const dashboardService = {
  /**
   * Fetch Dashboard overview stats, projects, and tasks dynamically from live services
   */
  async getDashboardData() {
    try {
      const response = await apiClient.get('/dashboard/summary');
      if (response.data && (response.data.projects || response.data.data?.projects)) {
        return response.data?.data || response.data;
      }
    } catch {
      // Aggregate live data from services
    }

    try {
      const projects = await projectService.getProjects();
      const tasks = await taskService.getTasks();
      const enquiries = await enquiryService.getEnquiries();
      const users = await userService.getUsers();

      const extractedProjects = Array.isArray(projects) ? projects : (projects?.projects || []);
      const extractedTasks = Array.isArray(tasks) ? tasks : (tasks?.tasks || []);
      const extractedUsers = Array.isArray(users) ? users : (users?.users || []);

      const formattedProjects = extractedProjects.map((p, idx) => ({
        id: p._id || idx,
        category: p.projectCategory || 'Architecture',
        badge: p.status === 'Completed' ? 'Completed' : (p.status === 'In Progress' ? 'On track' : 'Kickoff'),
        badgeClass: p.status === 'Completed' ? 'badge-on-track' : (p.status === 'In Progress' ? 'badge-on-track' : 'badge-kickoff'),
        title: p.projectName,
        client: typeof p.client === 'object' ? (p.client?.companyName || p.client?.clientName) : 'Client',
        progress: p.progressPercentage || 0,
        barColor: p.projectCategory === 'Animation' ? '#7a42c9' : (p.projectCategory === 'Interior Design' ? '#2b7a3d' : '#c75c2e')
      }));

      const formattedTasks = extractedTasks.map((t, idx) => ({
        id: t._id || idx,
        title: t.taskName,
        projectStage: typeof t.project === 'object' ? (t.project?.projectName || 'Project') : 'Project',
        status: t.status || 'Pending',
        statusClass: t.status === 'Completed' || t.status === 'Approved' ? 'task-status-grey' : 'task-status-blue',
        date: new Date(t.createdAt || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric' }),
        userAvatar: typeof t.assignee === 'object' ? (t.assignee?.name?.slice(0, 2).toUpperCase() || 'AR') : 'AR',
        avatarBg: idx % 2 === 0 ? '#2b74c9' : '#925c46'
      }));

      return {
        stats: {
          dueTasksCount: extractedTasks.filter(t => t.status !== 'Completed').length,
          overdueCount: extractedTasks.filter(t => t.status === 'Revision Required').length,
        },
        projects: formattedProjects,
        tasks: formattedTasks
      };
    } catch (err) {
      console.warn('Dashboard live data aggregation fallback:', err.message);
      return {
        stats: { dueTasksCount: 0, overdueCount: 0 },
        projects: [],
        tasks: []
      };
    }
  },

  async createTask(taskData) {
    return taskService.createTask(taskData);
  }
};
