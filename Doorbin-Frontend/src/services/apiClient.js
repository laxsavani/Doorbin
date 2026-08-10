import axios from 'axios';

// SOP #3.5: No hardcoded URLs are allowed in the codebase. Using VITE_API_BASE_URL from env.
const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request Interceptor: Attach authentication token if available
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle API responses and extract exact backend messages
// SOP #8: Display exact backend error message, fallback to network failure message only when API is unreachable.
apiClient.interceptors.response.use(
  (response) => {
    // Return standard response structure
    return response;
  },
  (error) => {
    let formattedError = {
      message: 'Network connection failed. Please check your internet or server status.',
      status: 0,
      data: null,
    };

    if (error.response) {
      // Backend responded with an HTTP status outside 2xx range
      const backendMessage = error.response.data?.message || error.response.data?.error || error.response.statusText;
      formattedError = {
        message: backendMessage || `Request failed with status ${error.response.status}`,
        status: error.response.status,
        data: error.response.data,
      };

      // Unauthenticated handling
      if (error.response.status === 401) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
      }
    } else if (error.request) {
      // API is not reachable / Network failure / Backend not responding
      formattedError.message = 'Backend server is not responding. Please verify server connection.';
    } else {
      formattedError.message = error.message;
    }

    return Promise.reject(formattedError);
  }
);

export default apiClient;
