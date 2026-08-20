import axios from 'axios';

const API = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const authAPI = {
  register: (data) => API.post('/auth/register', data),
  login: (data) => API.post('/auth/login', data)
};

export const mixAPI = {
  calculate: (data) => API.post('/mix/calculate', data),
  history: () => API.get('/mix/history'),
  get: (id) => API.get(`/mix/${id}`),
  pdf: (id) => API.get(`/mix/${id}/pdf`, { responseType: 'blob' }),
  excel: (id) => API.get(`/mix/${id}/excel`, { responseType: 'blob' })
};

export default API;

