import axios, { type AxiosError } from "axios";

/**
 * API base URL.
 * - When NEXT_PUBLIC_API_URL is set (e.g. in production or local dev), use it so the
 *   client talks directly to the backend (CORS is handled by the server).
 * - When not set, fall back to "" so requests go to the same origin (useful only if a
 *   reverse proxy is configured in front of the frontend).
 */
export const getBaseUrl = (): string =>
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL) || "";

/**
 * Read CSRF token from sessionStorage or cookie. Backend returns it in login response.
 */
export function getCsrfToken(): string | null {
  if (typeof window === "undefined") return null;
  const fromStorage = sessionStorage.getItem("csrf_token");
  if (fromStorage && fromStorage.trim()) return fromStorage.trim();
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1].trim()) : null;
}

const apiClient = axios.create({
  baseURL: getBaseUrl(),
  withCredentials: true,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

/**
 * Fetch a fresh CSRF token from backend and store it. Call before state-changing requests if token is missing.
 * Also used by the response interceptor to retry after 403 Invalid CSRF token.
 */
export async function ensureCsrfToken(): Promise<void> {
  if (typeof window === "undefined") return;
  const { data } = await apiClient.get<{ csrfToken?: string }>("/api/admin/csrf");
  const token = typeof data?.csrfToken === "string" ? data.csrfToken.trim() : null;
  if (token) sessionStorage.setItem("csrf_token", token);
}

apiClient.interceptors.request.use((config) => {
  config.baseURL = getBaseUrl();
  const csrf = getCsrfToken();
  if (csrf) {
    config.headers.set("x-csrf-token", csrf);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ message?: string }>) => {
    const config = error.config;
    const isCsrf403 =
      error.response?.status === 403 &&
      error.response?.data?.message === "Invalid CSRF token";
    const notRetried = config && !(config as typeof config & { _csrfRetried?: boolean })._csrfRetried;

    if (isCsrf403 && notRetried && config) {
      (config as typeof config & { _csrfRetried?: boolean })._csrfRetried = true;
      await ensureCsrfToken();
      return apiClient.request(config);
    }

    const message =
      error.response?.data?.message ??
      (error.response?.status ? `Request failed with status ${error.response.status}` : error.message) ??
      "Request failed";
    throw new Error(message);
  }
);

export { apiClient };
