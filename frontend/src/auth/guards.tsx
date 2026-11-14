import React from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import type { Role } from '../api/types';
import { homePathForRole, useAuth } from './AuthProvider';

export const AuthLoading: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] text-[#2563EB]" role="status" aria-live="polite">
    <Loader2 className="w-8 h-8 animate-spin" aria-hidden="true" />
    <span className="sr-only">Memuat sesi...</span>
  </div>
);

/** Shown to a signed-in user who opens a page that needs a higher role (HTTP 403 equivalent). */
export const ForbiddenPage: React.FC = () => {
  const { user } = useAuth();
  const home = user ? homePathForRole(user.role) : '/';
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 text-[#0F172A]">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-8 shadow-xl text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-[#EFF6FF] border-2 border-[#BFDBFE] flex items-center justify-center text-[#2563EB]">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="text-[11px] font-black uppercase tracking-wider text-[#2563EB]">403 &bull; Akses Ditolak</div>
        <h1 className="text-2xl font-black tracking-tight">Halaman Khusus Admin</h1>
        <p className="text-sm text-slate-500 leading-relaxed">
          Akun Anda tidak memiliki izin untuk membuka halaman ini. Jika Anda merasa ini keliru, hubungi admin.
        </p>
        <Link
          to={home}
          className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-extrabold text-sm transition-all"
        >
          Kembali ke Studio
        </Link>
      </div>
    </div>
  );
};

interface GuardProps {
  children?: React.ReactNode;
}

/**
 * Any signed-in user. Anonymous visitors are sent to /login and returned to the page they asked for afterwards.
 * Works as a layout route (`<Route element={<RequireAuth />}>`) or around children.
 */
export const RequireAuth: React.FC<GuardProps> = ({ children }) => {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <AuthLoading />;
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location }} />;
  return <>{children ?? <Outlet />}</>;
};

/**
 * Role gate. `admin` admits admins only (creators get the 403 page); `creator` admits any signed-in user, because an
 * admin may use the creator pages too.
 */
export const RequireRole: React.FC<GuardProps & { role: Role }> = ({ role, children }) => {
  const { status, user } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <AuthLoading />;
  if (status === 'anonymous' || !user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (role === 'admin' && user.role !== 'admin') return <ForbiddenPage />;
  return <>{children ?? <Outlet />}</>;
};
