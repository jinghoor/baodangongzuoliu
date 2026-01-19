export const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:1888";

export const getAuthToken = () => localStorage.getItem("auth_token");

export const apiFetch = async (path: string, options: RequestInit = {}) => {
  const headers = new Headers(options.headers || {});
  const token = getAuthToken();
  if (token) headers.set("authorization", `Bearer ${token}`);

  const hasBody = options.body !== undefined && options.body !== null;
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (hasBody && !isFormData && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const url = path.startsWith("http") ? path : `${apiBase}${path}`;
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401 && !path.startsWith("/auth/")) {
    localStorage.removeItem("auth_token");
    if (typeof window !== "undefined") {
      const current = window.location.pathname;
      if (current !== "/login" && current !== "/register") {
        window.location.assign("/login");
      }
    }
  }
  return res;
};
