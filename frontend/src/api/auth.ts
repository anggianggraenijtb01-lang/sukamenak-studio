/**
 * Auth endpoints. Login / register / refresh hand the session to the client (access token in memory,
 * refresh token in the httpOnly cookie) and the client tells the auth layer through `subscribe`.
 * Prefer `useAuth()` in components; these are for the AuthProvider and for tests.
 */
import { apiClient } from './client';
import type {
  ForgotPasswordResponse,
  LoginRequest,
  LogoutResponse,
  RegisterRequest,
  ResetPasswordRequest,
  ResetPasswordResponse,
  Session,
} from './types';

/** `POST /auth/register`: always creates a creator. The role is never sent. */
export async function register(body: RegisterRequest): Promise<Session> {
  const payload: RegisterRequest = { email: body.email, password: body.password, name: body.name };
  const session = await apiClient.request<Session>('/auth/register', { method: 'POST', body: payload, auth: false });
  apiClient.setSession(session);
  return session;
}

/** `POST /auth/login`. Errors: `INVALID_CREDENTIALS`, `ACCOUNT_INACTIVE`, `VALIDATION_ERROR`. */
export async function login(body: LoginRequest): Promise<Session> {
  const payload: LoginRequest = { email: body.email, password: body.password };
  const session = await apiClient.request<Session>('/auth/login', { method: 'POST', body: payload, auth: false });
  apiClient.setSession(session);
  return session;
}

/**
 * Silent refresh with the cookie (app start). Shares the client's single-flight refresh, so it is safe to call
 * twice at once (React StrictMode). Resolves to `null` when there is no valid session.
 */
export function restoreSession(): Promise<Session | null> {
  return apiClient.restoreSession();
}

/**
 * `POST /auth/forgot-password`: emails a reset link if the address has an account. The answer is always
 * `{ sent: true }`, so the UI must never say whether the address exists.
 */
export const forgotPassword = (email: string) =>
  apiClient.request<ForgotPasswordResponse>('/auth/forgot-password', { method: 'POST', body: { email }, auth: false });

/**
 * `POST /auth/reset-password`: sets a new password with the emailed token. Does not sign the user in.
 * Errors: `INVALID_RESET_TOKEN` (unknown, expired or already used), `VALIDATION_ERROR`, `RATE_LIMIT_EXCEEDED`.
 */
export const resetPassword = (body: ResetPasswordRequest) =>
  apiClient.request<ResetPasswordResponse>('/auth/reset-password', {
    method: 'POST',
    body: { token: body.token, new_password: body.new_password },
    auth: false,
  });

/** `POST /auth/logout`: revokes the token family and clears the cookie. The local session is cleared even if the call fails. */
export async function logout(): Promise<void> {
  try {
    await apiClient.request<LogoutResponse>('/auth/logout', { method: 'POST', auth: false });
  } finally {
    apiClient.clearSession();
  }
}
