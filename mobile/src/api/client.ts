import axios from 'axios';

// Falls back to this machine's LAN address for Expo Go dev. For the public
// web build, set EXPO_PUBLIC_API_BASE_URL when running `expo export` —
// see deploy/README.md.
const LAN_DEV_API_BASE_URL = 'http://192.168.1.125:3000';

export function resolveApiBaseUrl(envValue: string | undefined): string {
  return envValue && envValue.length > 0 ? envValue : LAN_DEV_API_BASE_URL;
}

export const API_BASE_URL = resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

export function setAuthToken(token: string | null) {
  if (token) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common.Authorization;
  }
}

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler;
}

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && unauthorizedHandler) {
      unauthorizedHandler();
    }
    return Promise.reject(error);
  }
);
