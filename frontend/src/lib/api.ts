
import axios from 'axios';
import { useAuthStore } from '@/store/auth';

const defaultBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1'
const storedBase = typeof window !== 'undefined' ? window.localStorage.getItem('assignwell.apiBase') : null
const api = axios.create({
    baseURL: storedBase || defaultBase,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 10000,
});

// Request interceptor to add token
api.interceptors.request.use(
    (config) => {
        const token = useAuthStore.getState().token;
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor to handle 401
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (!error.response && (error.message === 'Network Error' || error.code === 'ERR_NETWORK')) {
            const tried = api.defaults.baseURL
            const candidates = [
                defaultBase,
                'http://localhost:8000/api/v1',
                'http://127.0.0.1:8000/api/v1',
            ].filter((b) => b && b !== tried)
            for (const base of candidates) {
                try {
                    api.defaults.baseURL = base
                    if (typeof window !== 'undefined') window.localStorage.setItem('assignwell.apiBase', base)
                    const cfg = error.config
                    cfg.baseURL = base
                    return await api.request(cfg)
                } catch (e) {
                    continue
                }
            }
        }
        if (error.response?.status === 401) {
            useAuthStore.getState().logout();
        }
        return Promise.reject(error);
    }
);

export default api;
