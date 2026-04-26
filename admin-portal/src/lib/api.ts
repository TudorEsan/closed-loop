import axios from 'axios';

const API_BASE_URL = 'https://oyster-app-wpqlj.ondigitalocean.app/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Session expired, redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);
