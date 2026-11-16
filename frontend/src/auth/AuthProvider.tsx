import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import * as authApi from '../api/auth';
import { getMe } from '../api/creator';
import { isTransientError } from '../api/errors';
import { queryKeys } from '../api/queryKeys';
import type { MeResponse, Role, User } from '../api/types';

/**
 * `unavailable` means the server could not be asked whether there is a session (network error, 5xx, 429), so we
 * genuinely do not know. It is not `anonymous`: sending the user to the login page, or forgetting them, because a
 * deploy or restart was in progress would end a perfectly good session.
 */
export type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'unavailable';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  /** Rejects with `ApiError` (`INVALID_CREDENTIALS`, `ACCOUNT_INACTIVE`, `VALIDATION_ERROR`, ...). */
  login: (email: string, password: string) => Promise<User>;
  /** Always creates a creator; no role is ever sent. Rejects with `ApiError` (`EMAIL_EXISTS`, `VALIDATION_ERROR`). */
  register: (input: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
  /** Re-reads `GET /me` and updates `user` (and the cached usage). */
  refreshUser: () => Promise<User>;
  /** Why the session ended on its own (expired / deactivated), shown once on the login page. */
  sessionNotice: string | null;
  clearSessionNotice: () => void;
  /** Runs the start-up session check again; for the "service unavailable" screen. */
  retry: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Where a user of this role lands after signing in. */
export function homePathForRole(role: Role): string {
  return role === 'admin' ? '/admin/dashboard' : '/creator/studio';
}

const NOTICE_EXPIRED = 'Sesi Anda berakhir. Silakan masuk kembali.';
const NOTICE_INACTIVE = 'Akun Anda dinonaktifkan. Hubungi admin.';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  // Events that arrive while the start-up check runs must not flip the status early.
  const booted = useRef(false);

  // The auth layer of the client reports new sessions (login, refresh, password change) and ended sessions.
  useEffect(
    () =>
      apiClient.subscribe((event) => {
        if (event.type === 'session') {
          setUser(event.session.user);
          if (booted.current) setStatus('authenticated');
        } else {
          setUser(null);
          setStatus('anonymous');
          setSessionNotice(event.reason === 'inactive' ? NOTICE_INACTIVE : NOTICE_EXPIRED);
          queryClient.clear();
        }
      }),
    [queryClient],
  );

  // Start-up (and "Coba lagi"): silent refresh with the httpOnly cookie, then GET /me. Both go through the client's
  // single-flight refresh, so StrictMode's double effect cannot trigger two refreshes.
  const bootstrap = useCallback(
    async (isCancelled: () => boolean) => {
      const becomeAnonymous = () => {
        apiClient.clearSession();
        setUser(null);
        booted.current = true;
        setStatus('anonymous');
      };
      try {
        const session = await authApi.restoreSession();
        if (!session) {
          // The server answered: there is no valid session.
          if (!isCancelled() && !booted.current) becomeAnonymous();
          return;
        }
        const me = await getMe();
        if (isCancelled() || booted.current) return; // a login finished first: it wins
        queryClient.setQueryData<MeResponse>(queryKeys.me, me);
        setUser(me.user);
        booted.current = true;
        setStatus('authenticated');
      } catch (err) {
        if (isCancelled() || booted.current) return;
        if (isTransientError(err)) {
          // The server could not be asked (down, restarting, rate limited), so the session is of unknown validity.
          // Treating that as "signed out" would log people out every time the backend restarts.
          setUser(null);
          setStatus('unavailable');
          return;
        }
        becomeAnonymous();
      }
    },
    [queryClient],
  );

  useEffect(() => {
    let cancelled = false;
    void bootstrap(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [bootstrap]);

  const retry = useCallback(() => {
    setStatus('loading');
    void bootstrap(() => false);
  }, [bootstrap]);

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await authApi.login({ email, password });
      booted.current = true;
      setSessionNotice(null);
      setUser(session.user);
      setStatus('authenticated');
      return session.user;
    },
    [],
  );

  const register = useCallback(async (input: RegisterInput) => {
    const session = await authApi.register({ name: input.name, email: input.email, password: input.password });
    booted.current = true;
    setSessionNotice(null);
    setUser(session.user);
    setStatus('authenticated');
    return session.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // The server call is best effort; the local session is cleared either way.
    }
    setUser(null);
    setStatus('anonymous');
    setSessionNotice(null);
    queryClient.clear();
  }, [queryClient]);

  const refreshUser = useCallback(async () => {
    const me = await queryClient.fetchQuery({ queryKey: queryKeys.me, queryFn: ({ signal }) => getMe(signal), staleTime: 0 });
    setUser(me.user);
    return me.user;
  }, [queryClient]);

  const clearSessionNotice = useCallback(() => setSessionNotice(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, register, logout, refreshUser, sessionNotice, clearSessionNotice, retry }),
    [user, status, login, register, logout, refreshUser, sessionNotice, clearSessionNotice, retry],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus digunakan di dalam AuthProvider');
  return ctx;
}

/**
 * `GET /me` through React Query: `data.usage.remaining_today` is the real remaining daily limit.
 * Disabled until the user is authenticated. Invalidate `queryKeys.me` after a generation (the polling hook does).
 */
export function useMe() {
  const { status } = useAuth();
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => getMe(signal),
    enabled: status === 'authenticated',
  });
}
