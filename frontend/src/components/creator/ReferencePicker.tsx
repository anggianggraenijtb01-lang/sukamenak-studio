import React, { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Camera, Check, Images, Loader2, Trash2, X } from 'lucide-react';
import { deleteReference, listLibraryReferences, listMyReferences } from '../../api/creator';
import { fileUrl } from '../../api/client';
import { getErrorMessage } from '../../api/errors';
import { queryKeys } from '../../api/queryKeys';
import type { LibraryReference, Reference, ReferenceRole } from '../../api/types';
import { Modal } from './Modal';
import { EmptyBlock, ErrorBlock, FieldError, LoadingBlock } from './StateViews';
import { ROLE_LABELS, ROLE_ORDER, roleLabel } from './labels';
import { ACCEPTED_IMAGE_TYPES, type PickedRef, type UploadProblem } from './useReferences';

interface ReferencePickerProps {
  refs: PickedRef[];
  maxRefs: number;
  uploadRole: ReferenceRole;
  onUploadRoleChange: (role: ReferenceRole) => void;
  onUpload: (files: File[], role: ReferenceRole) => void;
  onRemove: (key: string) => void;
  onPickExisting: (ref: LibraryReference | Reference, source: 'library' | 'mine') => void;
  onForget: (id: string) => void;
  problem: UploadProblem | null;
  fieldError?: string | null;
  disabled?: boolean;
  /** Template slug, used to list the matching library references first. */
  templateSlug?: string | null;
}

export const ReferencePicker: React.FC<ReferencePickerProps> = ({
  refs,
  maxRefs,
  uploadRole,
  onUploadRoleChange,
  onUpload,
  onRemove,
  onPickExisting,
  onForget,
  problem,
  fieldError,
  disabled = false,
  templateSlug,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const used = refs.filter((r) => r.status !== 'error').length;

  const pickFiles = (list: FileList | null) => {
    const files = list ? Array.from(list) : [];
    if (files.length) onUpload(files, uploadRole);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 gap-3">
        <span className="text-xs font-bold text-[#0F172A]">Foto Referensi dari Kamera HP</span>
        <span className="text-[10px] font-mono text-slate-400" aria-label={`${used} dari ${maxRefs} foto referensi dipakai`}>
          {used}/{maxRefs} foto
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-[11px] font-semibold text-slate-500">Peran foto yang diunggah:</span>
        <select
          id="studio-ref-role"
          aria-label="Peran foto yang diunggah"
          value={uploadRole}
          onChange={(e) => onUploadRoleChange(e.target.value as ReferenceRole)}
          disabled={disabled}
          className="px-3 py-1.5 rounded-full bg-[#F8FAFC] border border-[#CBD5E1] text-xs font-bold text-[#0F172A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
        >
          {ROLE_ORDER.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </div>

      <input
        type="file"
        ref={inputRef}
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        multiple
        aria-label="Pilih foto referensi"
        onChange={(e) => pickFiles(e.target.files)}
        className="hidden"
        disabled={disabled}
      />
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label="Unggah foto referensi"
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) pickFiles(e.dataTransfer.files);
        }}
        className={`rounded-2xl border-2 border-dashed p-5 text-center flex flex-col items-center justify-center gap-2 transition-colors group ${
          dragging ? 'border-[#2563EB] bg-[#EFF6FF]' : 'border-[#BFDBFE] hover:border-[#2563EB] bg-[#EFF6FF]/40 hover:bg-[#EFF6FF]/70'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="w-11 h-11 rounded-full bg-white text-[#2563EB] flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
          <Camera className="w-5 h-5 text-[#2563EB]" />
        </div>
        <div>
          <span className="text-xs font-black text-[#2563EB]">Klik untuk Ambil Foto Kamera HP</span>
          <span className="text-xs text-slate-500"> atau seret gambar ke sini</span>
        </div>
        <span className="text-[10px] text-slate-400 font-medium">Format JPG, PNG, atau WebP, maksimal 8 MB (lokasi GPS pada foto dihapus otomatis)</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-[#EFF6FF] border border-[#CBD5E1] hover:border-[#2563EB] text-xs font-bold text-[#2563EB] transition-colors cursor-pointer disabled:opacity-60"
        >
          <Images className="w-3.5 h-3.5" />
          <span>Pilih dari Pustaka Referensi</span>
        </button>
        <span className="text-[10px] text-slate-400">Tanpa unggah ulang: pustaka admin atau unggahan Anda sebelumnya.</span>
      </div>

      {problem && (
        <div role="alert" className="mt-2 p-2.5 rounded-xl bg-orange-50 border border-orange-200 text-[11px] text-[#EA580C] font-semibold flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{problem.message}</span>
        </div>
      )}
      <FieldError message={fieldError} />

      {refs.length > 0 && (
        <ul className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-2.5" aria-label="Foto referensi terpilih">
          {refs.map((r) => (
            <li key={r.key} className="relative rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
              <div className="aspect-[4/5] bg-slate-200">
                <img src={fileUrl(r.url)} alt={`Referensi ${roleLabel(r.role)}`} className="w-full h-full object-cover" draggable={false} />
              </div>
              <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-black/65 text-[9px] font-black text-white">{roleLabel(r.role)}</div>
              {r.status === 'uploading' && (
                <div className="absolute inset-0 bg-black/45 flex flex-col items-center justify-center gap-1 text-white text-[10px] font-bold" role="status">
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Mengunggah</span>
                </div>
              )}
              {r.status === 'error' && (
                <div className="absolute inset-0 bg-red-700/80 p-1.5 flex items-center justify-center text-center text-[9px] font-bold text-white leading-tight">
                  {r.error ?? 'Gagal diunggah'}
                </div>
              )}
              {r.status === 'ready' && (
                <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md bg-[#2563EB] text-[9px] font-black text-white flex items-center gap-0.5">
                  <Check className="w-2.5 h-2.5" aria-hidden="true" />
                  <span>{r.source === 'library' ? 'Pustaka' : 'Siap'}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => onRemove(r.key)}
                disabled={disabled}
                aria-label={`Hapus referensi ${roleLabel(r.role)}${r.label ? ` ${r.label}` : ''}`}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/95 hover:bg-red-50 text-slate-600 hover:text-red-600 flex items-center justify-center shadow-xs cursor-pointer disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {libraryOpen && (
        <LibraryModal
          templateSlug={templateSlug ?? null}
          selectedIds={refs.map((r) => r.id).filter((id): id is string => !!id)}
          onPick={onPickExisting}
          onForget={onForget}
          onClose={() => setLibraryOpen(false)}
        />
      )}
    </div>
  );
};

// ---- library / my uploads --------------------------------------------------------------------------------

type Tab = 'library' | 'mine';

const LibraryModal: React.FC<{
  templateSlug: string | null;
  selectedIds: string[];
  onPick: (ref: LibraryReference | Reference, source: 'library' | 'mine') => void;
  onForget: (id: string) => void;
  onClose: () => void;
}> = ({ templateSlug, selectedIds, onPick, onForget, onClose }) => {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('library');
  const [role, setRole] = useState<ReferenceRole | ''>('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const libraryQuery = useQuery({
    queryKey: queryKeys.references.library(),
    queryFn: ({ signal }) => listLibraryReferences(undefined, signal),
    enabled: tab === 'library',
    staleTime: 5 * 60_000,
  });
  const mineQuery = useQuery({
    queryKey: queryKeys.references.mine({ limit: 50 }),
    queryFn: ({ signal }) => listMyReferences({ limit: 50 }, signal),
    enabled: tab === 'mine',
    staleTime: 60_000,
  });

  const removeMine = useMutation({
    mutationFn: (id: string) => deleteReference(id),
    onSuccess: (_data, id) => {
      onForget(id);
      void queryClient.invalidateQueries({ queryKey: queryKeys.references.all });
    },
    onError: (err) => setDeleteError(getErrorMessage(err)),
  });

  const library = (libraryQuery.data ?? [])
    .filter((r) => !role || r.role === role)
    .sort((a, b) => Number(b.template_slug === templateSlug) - Number(a.template_slug === templateSlug));
  const mine = (mineQuery.data?.items ?? []).filter((r) => !role || r.role === role);
  const active = tab === 'library' ? libraryQuery : mineQuery;
  const items: Array<LibraryReference | Reference> = tab === 'library' ? library : mine;

  return (
    <Modal title="Pustaka Referensi" eyebrow="PILIH TANPA UNGGAH ULANG" onClose={onClose} widthClass="max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex p-1 rounded-2xl bg-slate-100 border border-slate-200" role="tablist">
          {(
            [
              ['library', 'Pustaka Admin'],
              ['mine', 'Unggahan Saya'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                tab === id ? 'bg-[#2563EB] text-white shadow-xs' : 'text-slate-600 hover:text-[#0F172A]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
          <span>Peran</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as ReferenceRole | '')}
            className="px-3 py-1.5 rounded-full bg-[#F8FAFC] border border-[#CBD5E1] text-xs font-bold text-[#0F172A]"
          >
            <option value="">Semua</option>
            {ROLE_ORDER.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {deleteError && (
        <div role="alert" className="p-2.5 rounded-xl bg-orange-50 border border-orange-200 text-[11px] text-[#EA580C] font-semibold">
          {deleteError}
        </div>
      )}

      {active.isLoading ? (
        <LoadingBlock label="Memuat referensi..." className="py-8" />
      ) : active.isError ? (
        <ErrorBlock error={active.error} onRetry={() => void active.refetch()} title="Referensi tidak dapat dimuat" />
      ) : items.length === 0 ? (
        <EmptyBlock
          title={tab === 'library' ? 'Belum ada referensi di pustaka' : 'Belum ada unggahan'}
          hint={tab === 'library' ? 'Admin belum menambahkan referensi untuk peran ini.' : 'Foto yang Anda unggah di Studio akan muncul di sini. Foto model manusia dihapus otomatis setelah 7 hari.'}
        />
      ) : (
        <ul className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {items.map((item) => {
            const picked = selectedIds.includes(item.id);
            return (
              <li key={item.id} className="rounded-xl border border-slate-200 overflow-hidden bg-white flex flex-col">
                <div className="aspect-[4/5] bg-slate-100">
                  <img src={fileUrl(item.url)} alt={item.label || `Referensi ${roleLabel(item.role)}`} loading="lazy" className="w-full h-full object-cover" draggable={false} />
                </div>
                <div className="p-2 space-y-1.5">
                  <div className="text-[10px] font-black text-[#2563EB] uppercase tracking-wide">{roleLabel(item.role)}</div>
                  {item.label && <div className="text-[10px] text-slate-500 truncate" title={item.label}>{item.label}</div>}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={picked}
                      onClick={() => onPick(item, tab)}
                      className="flex-1 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-slate-200 disabled:text-slate-500 text-white text-[11px] font-black transition-colors cursor-pointer"
                    >
                      {picked ? 'Dipilih' : 'Pilih'}
                    </button>
                    {tab === 'mine' && (
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError(null);
                          removeMine.mutate(item.id);
                        }}
                        disabled={removeMine.isPending}
                        aria-label={`Hapus unggahan ${item.label ?? roleLabel(item.role)}`}
                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 flex items-center justify-center cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-black shadow-md shadow-blue-500/25 transition-all cursor-pointer"
        >
          Selesai
        </button>
      </div>
    </Modal>
  );
};
