import api from "./client";
import { clearToken } from "./tokenStorage";

export async function login(username, password) {
  const { data } = await api.post("/auth/login", { username, password });
  return data;
}

export async function adminLogin(password) {
  const { data } = await api.post("/auth/admin-login", { password });
  return data;
}

export async function getMe() {
  const { data } = await api.get("/auth/me");
  return data;
}

export async function logout() {
  try {
    await api.post("/auth/logout");
  } finally {
    clearToken();
  }
}
