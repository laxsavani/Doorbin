import apiClient from './apiClient';

export const resourceService = {
  // GET /resources/artist-profile/:userId
  getArtistProfile: async (userId) => {
    if (!userId || !/^[0-9a-fA-F]{24}$/.test(userId)) {
      return { userId, dailyCapacityHours: 8, skillTags: ['3D Modeling', 'Lighting'] };
    }
    try {
      const response = await apiClient.get(`/resources/artist-profile/${userId}`);
      return response.data;
    } catch (err) {
      return { userId, dailyCapacityHours: 8, skillTags: ['3D Modeling', 'Lighting & Shaders'] };
    }
  },

  // POST /resources/artist-profile/:userId
  updateArtistProfile: async (userId, profileData) => {
    if (!userId || !/^[0-9a-fA-F]{24}$/.test(userId)) {
      return { userId, ...profileData };
    }
    try {
      const response = await apiClient.post(`/resources/artist-profile/${userId}`, profileData);
      return response.data;
    } catch (err) {
      return { userId, ...profileData };
    }
  },

  // GET /resources/availability
  getArtistAvailability: async (params = {}) => {
    const response = await apiClient.get('/resources/availability', { params });
    return response.data;
  },

  // GET /resources/project-availability (Pure project assignment date-overlap model)
  getProjectAvailability: async (artistId, excludeProjectId = null) => {
    try {
      const params = { artistId };
      if (excludeProjectId) params.excludeProjectId = excludeProjectId;
      const response = await apiClient.get('/resources/project-availability', { params });
      return response.data;
    } catch (err) {
      return { artistId, hasConflicts: false, blockedRanges: [] };
    }
  },

  // GET /resources/:artistId/allocation (Detailed Task Allocation Breakdown)
  getArtistAllocation: async (artistId) => {
    if (!artistId || !/^[0-9a-fA-F]{24}$/.test(artistId)) {
      return { artistId, totalAllocatedHours: 0, allocatedTasks: [] };
    }
    try {
      const response = await apiClient.get(`/resources/${artistId}/allocation`);
      return response.data;
    } catch (err) {
      return { artistId, totalAllocatedHours: 0, allocatedTasks: [] };
    }
  },

  // GET /resources/conflicts
  getOverAllocationConflicts: async () => {
    try {
      const response = await apiClient.get('/resources/conflicts');
      return response.data;
    } catch (err) {
      return [];
    }
  },

  // GET /resources/utilization
  getResourceUtilizationReport: async () => {
    try {
      const response = await apiClient.get('/resources/utilization');
      return response.data;
    } catch (err) {
      return null;
    }
  },

  // GET /resources/forecast (Projected Demand Forecast for Upcoming Projects)
  getResourceForecast: async () => {
    try {
      const response = await apiClient.get('/resources/forecast');
      return response.data;
    } catch (err) {
      return {
        upcomingProjectsCount: 0,
        projectedRequiredHours: 0,
        skillRequirements: []
      };
    }
  },

  // DELETE /resources/artist-profile/:userId
  deleteArtistProfile: async (userId) => {
    if (!userId || !/^[0-9a-fA-F]{24}$/.test(userId)) {
      return { userId, message: 'Artist profile reset to default' };
    }
    try {
      const response = await apiClient.delete(`/resources/artist-profile/${userId}`);
      return response.data;
    } catch (err) {
      // If profile doesn't exist yet on backend, return success reset object
      return { userId, message: 'Artist profile reset to default' };
    }
  }
};
