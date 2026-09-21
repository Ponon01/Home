import axios from "axios";
import { clearToken, getToken } from "./tokenStorage";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      clearToken();
      // Do not hard-redirect to /login; admin sections show their own auth modal.
      window.dispatchEvent(new Event("admin:unauthorized"));
    }
    return Promise.reject(error);
  }
);

export default api;
