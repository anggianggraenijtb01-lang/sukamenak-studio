import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStudio } from '../../components/common/StudioContext';
import {
  User,
  Mail,
  Phone,
  ShieldCheck,
  Camera,
  Trash2,
  Save,
  CheckCircle2,
  KeyRound,
  LogOut,
  Server,
  Lock,
} from 'lucide-react';

export const AdminProfile: React.FC = () => {
  const navigate = useNavigate();
  const { adminLogout } = useStudio();
  const [adminName, setAdminName] = useState('Admin Operasional');
  const [adminEmail, setAdminEmail] = useState('admin@sukamenak.org');
  const [adminPhone, setAdminPhone] = useState('+62 812-3456-7890');
  const [currentPassword, setCurrentPassword] = useState('admin123');
  const [newPassword, setNewPassword] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [adminAvatar, setAdminAvatar] = useState<string | null>(() =>
    localStorage.getItem('sukamenak_admin_avatar')
  );
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setAdminAvatar(result);
        localStorage.setItem('sukamenak_admin_avatar', result);
        window.dispatchEvent(new Event('adminAvatarUpdated'));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = () => {
    setAdminAvatar(null);
    localStorage.removeItem('sukamenak_admin_avatar');
    window.dispatchEvent(new Event('adminAvatarUpdated'));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleLogout = () => {
    adminLogout();
    navigate('/login');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50/90 via-[#EFF6FF] to-sky-50/60 rounded-3xl border border-[#BFDBFE] p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#0F172A] text-white flex items-center justify-center shadow-md">
            <ShieldCheck className="w-6 h-6 text-[#2563EB]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">
              Profil Admin &amp; <span className="text-[#2563EB]">Kredensial Operator</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#475569] mt-0.5">
              Kelola identitas operator sistem, foto avatar, email kontak, dan kata sandi akses panel admin.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Admin Identity Card */}
        <div className="lg:col-span-4 bg-white rounded-3xl border border-[#CBD5E1] p-6 sm:p-7 text-center space-y-5 shadow-xs">
          {/* Avatar with Upload */}
          <div className="relative w-28 h-28 mx-auto group">
            {adminAvatar ? (
              <img
                src={adminAvatar}
                alt="Foto Profil Admin"
                className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-lg shadow-blue-500/20"
              />
            ) : (
              <div className="w-28 h-28 rounded-full bg-[#0F172A] border-4 border-white text-white flex items-center justify-center font-black text-4xl shadow-lg shadow-blue-500/20">
                A
              </div>
            )}

            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              title="Ganti Foto Profil Admin"
              className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white flex items-center justify-center shadow-md border-2 border-white transition-transform hover:scale-110 cursor-pointer"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarFile}
            className="hidden"
          />

          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="px-3.5 py-1.5 rounded-full bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-[#BFDBFE] text-xs font-bold text-[#2563EB] transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{adminAvatar ? 'Ubah Gambar' : 'Pilih Gambar'}</span>
            </button>
            {adminAvatar && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-red-50 text-xs font-bold text-slate-600 hover:text-red-600 border border-slate-200 transition-colors cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>

          <div>
            <h2 className="font-black text-xl text-[#0F172A]">{adminName}</h2>
            <p className="text-xs text-[#2563EB] font-bold mt-0.5">
              Super Administrator • Sukamenak Studio
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 text-left space-y-3 text-xs">
            <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block flex items-center gap-1">
                <Mail className="w-3 h-3 text-[#2563EB]" />
                Email Administrator
              </span>
              <span className="font-semibold text-[#0F172A] block">{adminEmail}</span>
            </div>

            <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block flex items-center gap-1">
                <Phone className="w-3 h-3 text-[#2563EB]" />
                WhatsApp Helpdesk Admin
              </span>
              <span className="font-semibold text-[#0F172A] block">{adminPhone}</span>
            </div>

            <div className="p-3 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-blue-500 block flex items-center gap-1">
                <Lock className="w-3 h-3 text-[#2563EB]" />
                Tingkat Otoritas Sistem
              </span>
              <span className="font-bold text-[#0F172A] block">
                Hak Penuh (Enkripsi Master AES-256 &amp; Kuota)
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Edit Profile Form */}
        <div className="lg:col-span-8 bg-white rounded-3xl border border-[#CBD5E1] p-6 sm:p-8 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-black text-[#0F172A]">
              Informasi Akun <span className="text-[#2563EB]">Operator Administrator</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Data identitas ini digunakan untuk menandatangani log audit sistem dan respon bantuan warga.
            </p>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#2563EB]" />
                Nama Operator Admin
              </label>
              <input
                type="text"
                required
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="Admin Operasional"
                className="w-full px-4 py-2.5 rounded-full bg-[#F8FAFC] border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#2563EB]" />
                Email Administrator
              </label>
              <input
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@sukamenak.org"
                className="w-full px-4 py-2.5 rounded-full bg-[#F8FAFC] border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#2563EB]" />
                WhatsApp Helpdesk Operasional
              </label>
              <input
                type="text"
                required
                value={adminPhone}
                onChange={(e) => setAdminPhone(e.target.value)}
                placeholder="+62 812-3456-7890"
                className="w-full px-4 py-2.5 rounded-full bg-[#F8FAFC] border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] transition-all"
              />
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                Keamanan &amp; Kata Sandi Gerbang Admin
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1.5 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-[#2563EB]" />
                    Kata Sandi Saat Ini
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="admin123"
                    className="w-full px-4 py-2.5 rounded-full bg-[#F8FAFC] border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1.5 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                    Kata Sandi Baru (Opsional)
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Kosongkan jika tidak diubah"
                    className="w-full px-4 py-2.5 rounded-full bg-[#F8FAFC] border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] transition-all"
                  />
                </div>
              </div>
            </div>

            {savedSuccess && (
              <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-xs font-bold text-[#2563EB] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                <span>Profil dan kredensial administrator berhasil disimpan!</span>
              </div>
            )}

            <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100">
              <button
                type="submit"
                className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-500/25 transition-all cursor-pointer hover:shadow-lg"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Profil Admin</span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full sm:w-auto px-6 py-3.5 rounded-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-red-600" />
                <span>Keluar Akun Admin (Logout)</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
export default AdminProfile;

