import apiClient from './apiClient';

/**
 * Auth Service managing all Authentication & User Profile API endpoints
 * SOP #2.1: All API calls managed from Services folder.
 */
export const authService = {
  /**
   * User login API call targeting /auth/login
   */
  async login(credentials) {
    const response = await apiClient.post('/auth/login', credentials);
    
    const token = response.data?.token || response.data?.data?.token;
    const user = response.data?.user || response.data?.data?.user || { email: credentials.email };

    if (token) {
      localStorage.setItem('auth_token', token);
      localStorage.setItem('user_data', JSON.stringify(user));
    }

    return response.data;
  },

  /**
   * Register user API call targeting /auth/register
   */
  async register(userData) {
    const response = await apiClient.post('/auth/register', userData);
    return response.data;
  },

  /**
   * Get user profile details targeting GET /auth/profile
   */
  async getProfile() {
    try {
      const response = await apiClient.get('/auth/profile');
      return response.data;
    } catch {
      return this.getCurrentUser() || {
        name: 'Lax Savani',
        email: 'lax@doorbin.com',
        role: 'Director'
      };
    }
  },

  /**
   * Update user profile details targeting PUT /auth/profile
   */
  async updateProfile(profileData) {
    const response = await apiClient.put('/auth/profile', profileData);
    if (response.data) {
      const updatedUser = { ...this.getCurrentUser(), ...profileData };
      localStorage.setItem('user_data', JSON.stringify(updatedUser));
    }
    return response.data;
  },

  /**
   * Change user password targeting PUT /auth/change-password
   */
  async changePassword(passwordData) {
    const response = await apiClient.put('/auth/change-password', passwordData);
    return response.data;
  },

  /**
   * Request password reset token targeting POST /auth/forgot-password
   */
  async forgotPassword(email) {
    const response = await apiClient.post('/auth/forgot-password', { email });
    return response.data;
  },

  /**
   * Reset password using token targeting PUT /auth/reset-password/:token
   */
  async resetPassword(token, password) {
    const response = await apiClient.put(`/auth/reset-password/${token}`, { password });
    return response.data;
  },

  async getMe() {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  async refreshToken(refreshTokenVal) {
    const response = await apiClient.post('/auth/refresh-token', { refreshToken: refreshTokenVal });
    return response.data;
  },

  async logoutSession() {
    try {
      await apiClient.post('/auth/logout');
    } catch (e) {
      console.warn('Logout session API call silent handling:', e.message);
    }
    this.logout();
  },

  /**
   * Get current authenticated user session
   */
  getCurrentUser() {
    const userStr = localStorage.getItem('user_data');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!localStorage.getItem('auth_token');
  },

  /**
   * Logout user
   */
  logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
  }
};
