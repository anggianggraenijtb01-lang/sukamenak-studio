import React, { useState } from 'react';
import {
  Users,
  Search,
  CheckCircle2,
  RotateCcw,
  Power,
  UserX,
  UserCheck,
} from 'lucide-react';

interface CreatorUser {
  id: string;
  name: string;
  businessName: string;
  email: string;
  whatsapp: string;
  quotaUsed: number;
  quotaLimit: number;
  status: 'Aktif' | 'Mendekati Limit' | 'Nonaktif';
}

export const AdminUsers: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Semua' | 'Aktif' | 'Mendekati Limit' | 'Nonaktif'>('Semua');
  const [notification, setNotification] = useState<string | null>(null);

  const [users, setUsers] = useState<CreatorUser[]>([
    {
      id: 'u1',
      name: 'Cantika Anggi',
      businessName: 'Keripik Tempe Bu Cantika',
      email: 'cantika.anggi@gmail.com',
      whatsapp: '+62 812-3456-7890',
      quotaUsed: 12,
      quotaLimit: 15,
      status: 'Mendekati Limit',
    },
    {
      id: 'u2',
      name: 'Hendra Gunawan',
      businessName: 'Kopi Robusta Puntang Single Origin',
      email: 'hendra.kopi@sukamenak.org',
      whatsapp: '+62 813-9876-5432',
      quotaUsed: 8,
      quotaLimit: 15,
      status: 'Aktif',
    },
    {
      id: 'u3',
      name: 'Warsinah',
      businessName: 'Kue Basah & Jajanan Tradisional',
      email: 'warsinah.kue@gmail.com',
      whatsapp: '+62 856-1122-3344',
      quotaUsed: 15,
      quotaLimit: 15,
      status: 'Mendekati Limit',
    },
    {
      id: 'u4',
      name: 'Asep Saepuloh',
      businessName: 'Anyaman Bambu & Kriya Sukamenak',
      email: 'asep.kriya@gmail.com',
      whatsapp: '+62 878-5566-7788',
      quotaUsed: 5,
      quotaLimit: 15,
      status: 'Aktif',
    },
    {
      id: 'u5',
      name: 'Siti Fatimah',
      businessName: 'Gamis & Kerudung Berkah',
      email: 'siti.fatimah@sukamenak.org',
      whatsapp: '+62 821-3344-5566',
      quotaUsed: 9,
      quotaLimit: 15,
      status: 'Aktif',
    },
    {
      id: 'u6',
      name: 'Budi Santoso',
      businessName: 'Bengkel Las & Jasa Logam',
      email: 'budi.las@gmail.com',
      whatsapp: '+62 899-7788-9900',
      quotaUsed: 0,
      quotaLimit: 15,
      status: 'Nonaktif',
    },
  ]);

  const handleToggleStatus = (id: string, name: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === id) {
          const nextStatus = u.status === 'Nonaktif' ? 'Aktif' : 'Nonaktif';
          showNotice(`Status akun ${name} diubah menjadi ${nextStatus}.`);
          return { ...u, status: nextStatus };
        }
        return u;
      })
    );
  };

  const handleResetQuota = (id: string, name: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === id) {
          showNotice(`Kuota harian ${name} berhasil di-reset menjadi 0 / ${u.quotaLimit}.`);
          return { ...u, quotaUsed: 0, status: u.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif' };
        }
        return u;
      })
    );
  };

  const showNotice = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const filteredUsers = users.filter((u) => {
    const matchesStatus =
      statusFilter === 'Semua' || u.status === statusFilter;
    const matchesSearch =
      searchQuery === '' ||
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-5 pb-10">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-50/90 via-[#EFF6FF] to-sky-50/60 rounded-3xl border border-[#BFDBFE] px-6 py-4.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#2563EB] text-white flex items-center justify-center shadow-md shadow-blue-500/25">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-[#0F172A] tracking-tight">
              Manajemen <span className="text-[#2563EB]">Pengguna</span>
            </h1>
            <p className="text-xs text-[#475569] mt-0.5 font-normal">
              Kelola akun kreator, pantau pemakaian kuota harian, serta kontrol reset kuota dan status aktif.
            </p>
          </div>
        </div>
      </div>

      {notification && (
        <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-xs font-bold text-[#2563EB] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-blue-600" />
          <span>{notification}</span>
        </div>
      )}

      {/* Top Control Bar */}
      <div className="bg-white/85 backdrop-blur-md rounded-2xl border border-slate-200/90 px-4 py-3.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Standalone Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama pengguna, merek usaha, atau email..."
            className="w-full pl-9 pr-4 py-2 rounded-full bg-[#F8FAFC] border border-[#CBD5E1] text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:bg-white transition-all"
          />
        </div>

        {/* Status Filter Pills: [Semua, Aktif, Mendekati Limit, Nonaktif] */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {(['Semua', 'Aktif', 'Mendekati Limit', 'Nonaktif'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === filter
                  ? 'bg-[#2563EB] text-white shadow-xs'
                  : 'bg-[#F8FAFC] text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* High-Density Compact Data Table (Tabel Dikecilin Dikit) */}
      <div className="bg-white/85 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-slate-200 text-slate-600 font-bold">
                <th className="py-3 px-4.5">Pengguna &amp; Usaha</th>
                <th className="py-3 px-4.5">Kontak</th>
                <th className="py-3 px-4.5">Kuota Harian</th>
                <th className="py-3 px-4.5">Status Akun</th>
                <th className="py-3 px-4.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-blue-50/20 transition-colors">
                  {/* Column 1: Pengguna & Usaha */}
                  <td className="py-2.5 px-4.5">
                    <div className="font-extrabold text-[#0F172A] text-xs sm:text-sm">
                      {user.name}
                    </div>
                    <div className="text-[11px] font-bold text-[#2563EB]">
                      {user.businessName}
                    </div>
                  </td>

                  {/* Column 2: Kontak (Stacked) */}
                  <td className="py-2.5 px-4.5">
                    <div className="text-slate-700 font-medium text-xs">
                      {user.email}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {user.whatsapp}
                    </div>
                  </td>

                  {/* Column 3: Kuota Harian */}
                  <td className="py-2.5 px-4.5 min-w-[150px]">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-[#0F172A]">
                        {user.quotaUsed} / {user.quotaLimit}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {Math.round((user.quotaUsed / user.quotaLimit) * 100)}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          user.quotaUsed >= user.quotaLimit ? 'bg-[#0F172A]' : 'bg-[#2563EB]'
                        }`}
                        style={{ width: `${(user.quotaUsed / user.quotaLimit) * 100}%` }}
                      />
                    </div>
                  </td>

                  {/* Column 4: Status Akun */}
                  <td className="py-2.5 px-4.5">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider ${
                        user.status === 'Aktif'
                          ? 'bg-blue-50 text-[#2563EB] border border-[#BFDBFE]'
                          : user.status === 'Mendekati Limit'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-300'
                      }`}
                    >
                      {user.status === 'Aktif' ? 'AKTIF' : user.status === 'Mendekati Limit' ? 'MENDEKATI LIMIT' : 'NONAKTIF'}
                    </span>
                  </td>

                  {/* Column 5: Aksi (Logo Reset & Nonaktifkan Langsung) */}
                  <td className="py-2.5 px-4.5 text-right">
                    <div className="inline-flex items-center gap-1.5 justify-end">
                      {/* Logo / Tombol Reset */}
                      <button
                        type="button"
                        onClick={() => handleResetQuota(user.id, user.name)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-[#EFF6FF] hover:border-[#BFDBFE] text-slate-700 hover:text-[#2563EB] border border-slate-200 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                        title="Reset Kuota Harian ke 0"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-[#2563EB]" />
                        <span>Reset</span>
                      </button>

                      {/* Logo / Tombol Nonaktifkan atau Aktifkan */}
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(user.id, user.name)}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shadow-2xs border ${
                          user.status === 'Nonaktif'
                            ? 'bg-blue-50 hover:bg-blue-100 text-[#2563EB] border-[#BFDBFE]'
                            : 'bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-600 border-slate-200'
                        }`}
                        title={user.status === 'Nonaktif' ? 'Aktifkan Akun Pengguna' : 'Nonaktifkan Akun Pengguna'}
                      >
                        {user.status === 'Nonaktif' ? (
                          <>
                            <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                            <span>Aktifkan</span>
                          </>
                        ) : (
                          <>
                            <UserX className="w-3.5 h-3.5 text-red-500" />
                            <span>Nonaktifkan</span>
                          </>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
export default AdminUsers;
