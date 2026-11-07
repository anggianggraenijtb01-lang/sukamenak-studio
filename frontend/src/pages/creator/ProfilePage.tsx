import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Phone, MapPin, CheckCircle2, Save, Mail, Store, Camera, Trash2, LogOut } from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('Keripik Tempe Bu Cantika');
  const [orderWhatsapp, setOrderWhatsapp] = useState('+62 812-3456-7890');
  const [storeAddress, setStoreAddress] = useState('Jl. Terusan Sukamenak No. 15');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [avatarImage, setAvatarImage] = useState<string | null>(() => localStorage.getItem('sukamenak_user_avatar'));
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setAvatarImage(result);
        localStorage.setItem('sukamenak_user_avatar', result);
        window.dispatchEvent(new Event('avatarUpdated'));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarImage(null);
    localStorage.removeItem('sukamenak_user_avatar');
    window.dispatchEvent(new Event('avatarUpdated'));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleLogout = () => {
    navigate('/login');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header (No small pill badge) */}
      <div className="bg-gradient-to-r from-blue-50/90 via-[#EFF6FF] to-sky-50/60 rounded-3xl border border-[#BFDBFE] p-6 sm:p-7 shadow-xs">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight">
            Profil Saya
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] mt-1 font-normal">
            Informasi identitas kreator dan profil toko yang otomatis disematkan pada setiap materi poster promosi.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT PANE: Citizen & Creator identity card with customizable avatar */}
        <div className="lg:col-span-4 bg-white rounded-3xl border border-[#CBD5E1] p-6 sm:p-7 text-center space-y-5 shadow-sm">
          
          {/* Avatar Container with Real-time Image Upload & Camera Button */}
          <div className="relative w-28 h-28 mx-auto group">
            {avatarImage ? (
              <img
                src={avatarImage}
                alt="Foto Profil Cantika"
                className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-lg shadow-blue-500/20"
              />
            ) : (
              <div className="w-28 h-28 rounded-full bg-[#EFF6FF] border-4 border-white text-[#2563EB] flex items-center justify-center font-black text-4xl shadow-lg shadow-blue-500/20">
                C
              </div>
            )}

            {/* Quick Camera Trigger */}
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              title="Ganti Foto Profil"
              className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white flex items-center justify-center shadow-md border-2 border-white transition-transform hover:scale-110 cursor-pointer"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          {/* Hidden File Input */}
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarFile}
            className="hidden"
          />

          {/* Upload / Remove Buttons */}
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="px-3.5 py-1.5 rounded-full bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-[#BFDBFE] text-xs font-bold text-[#2563EB] transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{avatarImage ? 'Ubah Gambar' : 'Pilih Gambar'}</span>
            </button>
            {avatarImage && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-red-50 text-xs font-bold text-slate-600 hover:text-red-600 border border-slate-200 transition-colors cursor-pointer flex items-center gap-1"
                title="Hapus foto profil dan kembali ke default"
              >
                <Trash2 className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>

          <div>
            <h2 className="font-black text-xl text-[#0F172A]">
              Cantika Anggi
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Kreator &amp; Pelaku UMKM
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 text-left space-y-3 text-xs">
            <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block flex items-center gap-1">
                <Mail className="w-3 h-3 text-[#2563EB]" />
                Alamat Email
              </span>
              <span className="font-semibold text-[#0F172A] block break-all">
                cantika.anggi@gmail.com
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block flex items-center gap-1">
                <Phone className="w-3 h-3 text-[#2563EB]" />
                WhatsApp Aktif
              </span>
              <span className="font-semibold text-[#0F172A] block">
                +62 812-3456-7890
              </span>
            </div>
          </div>

          {/* Prominent Red Logout Button on Left Pane */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-2.5 px-4 rounded-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-red-600" />
              <span>Keluar dari Akun</span>
            </button>
          </div>
        </div>

        {/* RIGHT PANE: Auto-stamping UMKM Business Card Form */}
        <div className="lg:col-span-8 bg-white rounded-3xl border border-[#CBD5E1] p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-black text-[#0F172A]">
              Profil Usaha UMKM (Auto-Stamping Poster)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Data usaha ini otomatis dicetak rapi pada bagian bawah poster dan kartu katalog digital Anda.
            </p>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            
            {/* Field 1: Nama (was 'Nama Merek / Usaha') */}
            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1.5 flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-[#2563EB]" />
                Nama
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Keripik Tempe Bu Cantika"
                className="w-full px-4 py-2.5 rounded-full bg-[#F8FAFC] border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] transition-all"
              />
            </div>

            {/* (Slogan Promosi removed as requested) */}

            {/* Field 2: Nomor WhatsApp Pemesanan */}
            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#2563EB]" />
                Nomor WhatsApp Pemesanan
              </label>
              <input
                type="text"
                required
                value={orderWhatsapp}
                onChange={(e) => setOrderWhatsapp(e.target.value)}
                placeholder="Contoh: +62 812-3456-7890"
                className="w-full px-4 py-2.5 rounded-full bg-[#F8FAFC] border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] transition-all"
              />
            </div>

            {/* Field 3: Alamat Usaha / Toko */}
            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#2563EB]" />
                Alamat Usaha / Toko
              </label>
              <input
                type="text"
                required
                value={storeAddress}
                onChange={(e) => setStoreAddress(e.target.value)}
                placeholder="Contoh: Jl. Terusan Sukamenak No. 15"
                className="w-full px-4 py-2.5 rounded-full bg-[#F8FAFC] border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] transition-all"
              />
            </div>

            {savedSuccess && (
              <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-xs font-bold text-[#2563EB] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                <span>Profil usaha berhasil disimpan &amp; disinkronkan ke seluruh poster!</span>
              </div>
            )}

            {/* Royal Blue CTA: Simpan Profil & Data Usaha */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-500/25 transition-all cursor-pointer hover:shadow-lg"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Profil &amp; Data Usaha</span>
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
};
export default ProfilePage;
