import { apiRequest } from "./client";

export async function registerOwner(data: {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  company_name: string;
  password: string;
  password_confirm: string;
}) {
  return apiRequest("/accounts/register-owner/", "POST", data);
}

export async function loginUser(data: {
  email: string;
  password: string;
}) {
  return apiRequest("/accounts/login/", "POST", data);
}

export async function refreshToken(refresh: string) {
  return apiRequest("/accounts/token/refresh/", "POST", { refresh });
}

export async function getMe(token: string) {
  return apiRequest("/accounts/me/", "GET", undefined, token);
}

export async function forgotPassword(data: { email: string }) {
  return apiRequest("/accounts/forgot-password/", "POST", data);
}

export async function resetPasswordConfirm(data: {
  uid: string;
  token: string;
  new_password: string;
  new_password_confirm: string;
}) {
  return apiRequest("/accounts/reset-password-confirm/", "POST", data);
}