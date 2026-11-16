import React, { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, BookmarkCheck, Check, ChevronLeft, ChevronRight, Copy, Pencil, Trash2, Wand2 } from 'lucide-react';
import { createPrompt, deletePrompt, listPrompts, updatePrompt } from '../../api/creator';
import { getErrorMessage, isApiError } from '../../api/errors';
import { queryKeys } from '../../api/queryKeys';
import type { PromptSource, SavedPrompt } from '../../api/types';
import { useCopy } from './clipboard';
import { relativeTime } from './format';
import { ConfirmDialog, Modal } from './Modal';
import { EmptyBlock, ErrorBlock, FieldError, LoadingBlock } from './StateViews';

const PAGE_SIZE = 6;
export const PROMPT_TITLE_MAX = 120;
export const PROMPT_BODY_MAX = 4000;

/** A short default title from the first words of a prompt. */
export function defaultPromptTitle(text: string): string {
  const words = text.trim().replace(/\s+/g, ' ').split(' ').slice(0, 6).join(' ');
  return (words.length > 60 ? `${words.slice(0, 57)}...` : words) || 'Prompt saya';
}

// ---- save / edit dialog ----------------------------------------------------------------------------------

interface PromptFormDialogProps {
  heading: string;
  confirmLabel: string;
  initialTitle: string;
  initialBody: string;
  /** Body is editable only when editing a saved prompt; when saving from the workbench it is fixed. */
  editableBody: boolean;
  busy: boolean;
  error: string | null;
  fieldErrors: Record<string, string>;
  onSubmit: (value: { title: string; body: string }) => void;
  onClose: () => void;
}

const PromptFormDialog: React.FC<PromptFormDialogProps> = ({ heading, confirmLabel, initialTitle, initialBody, editableBody, busy, error, fieldErrors, onSubmit, onClose }) => {
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [localError, setLocalError] = useState<Record<string, string>>({});

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!title.trim()) errors.title = 'Judul wajib diisi';
    else if (title.trim().length > PROMPT_TITLE_MAX) errors.title = `Maksimal ${PROMPT_TITLE_MAX} karakter`;
    if (!body.trim()) errors.body = 'Teks prompt wajib diisi';
    else if (body.trim().length > PROMPT_BODY_MAX) errors.body = `Maksimal ${PROMPT_BODY_MAX} karakter`;
    setLocalError(errors);
    if (Object.keys(errors).length === 0) onSubmit({ title: title.trim(), body: body.trim() });
  };
  const shown = { ...fieldErrors, ...localError };

  return (
    <Modal title={heading} eyebrow="PROMPT SAYA" onClose={onClose} busy={busy}>
      <form onSubmit={submit} noValidate className="space-y-3.5">
        <div>
          <label htmlFor="prompt-title" className="block text-xs font-bold text-[#0F172A] mb-1.5">
            Judul
          </label>
          <input
            id="prompt-title"
            type="text"
            value={title}
            maxLength={PROMPT_TITLE_MAX}
            disabled={busy}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2.5 rounded-full bg-[#F8FAFC] border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] transition-all"
          />
          <FieldError message={shown.title} />
        </div>
        <div>
          <label htmlFor="prompt-body" className="block text-xs font-bold text-[#0F172A] mb-1.5">
            Teks prompt
          </label>
          {editableBody ? (
            <textarea
              id="prompt-body"
              rows={6}
              value={body}
              maxLength={PROMPT_BODY_MAX}
              disabled={busy}
              onChange={(e) => setBody(e.target.value)}
              className="w-full p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#CBD5E1] text-xs text-[#0F172A] leading-relaxed resize-none focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] transition-all"
            />
          ) : (
            <div id="prompt-body" className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#CBD5E1] text-xs text-[#0F172A] font-mono leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
              {body}
            </div>
          )}
          <FieldError message={shown.body} />
        </div>
        {error && (
          <div role="alert" className="p-3 rounded-xl bg-orange-50 border border-orange-200 text-xs text-[#EA580C] font-semibold">
            {error}
          </div>
        )}
        <div className="flex items-center justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2.5 rounded-xl border border-[#CBD5E1] text-xs font-bold text-slate-700 hover:border-[#2563EB] hover:text-[#2563EB] transition-colors cursor-pointer disabled:opacity-60">
            Batal
          </button>
          <button type="submit" disabled={busy} className="px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-black shadow-md shadow-blue-500/25 transition-all cursor-pointer disabled:opacity-60">
            {busy ? 'Menyimpan...' : confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// ---- save from the workbench -----------------------------------------------------------------------------

export const SavePromptDialog: React.FC<{ text: string; source?: PromptSource; onSaved: (p: SavedPrompt) => void; onClose: () => void }> = ({
  text,
  source = 'manual',
  onSaved,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: (v: { title: string; body: string }) => createPrompt({ title: v.title, body: v.body, source }),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.prompts.all });
      onSaved(saved);
    },
  });
  return (
    <PromptFormDialog
      heading="Simpan ke Prompt Saya"
      confirmLabel="Simpan"
      initialTitle={defaultPromptTitle(text)}
      initialBody={text}
      editableBody={false}
      busy={save.isPending}
      error={save.isError ? getErrorMessage(save.error) : null}
      fieldErrors={save.isError && isApiError(save.error) ? save.error.fieldErrors : {}}
      onSubmit={(v) => save.mutate(v)}
      onClose={onClose}
    />
  );
};

// ---- the library -----------------------------------------------------------------------------------------

interface SavedPromptsProps {
  /** "Pakai di Studio": hands the text to the Studio. */
  onUseInStudio: (text: string) => void;
  /** "Muat ke Simulator": puts the text into the workbench. */
  onLoad: (text: string) => void;
}

export const SavedPrompts: React.FC<SavedPromptsProps> = ({ onUseInStudio, onLoad }) => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<SavedPrompt | null>(null);
  const [deleting, setDeleting] = useState<SavedPrompt | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { copiedKey, failedKey, copy } = useCopy();

  const query = { page, limit: PAGE_SIZE };
  const list = useQuery({
    queryKey: queryKeys.prompts.list(query),
    queryFn: ({ signal }) => listPrompts(query, signal),
    placeholderData: keepPreviousData,
  });
  const items = list.data?.items ?? [];
  const meta = list.data?.meta;
  const refresh = () => void queryClient.invalidateQueries({ queryKey: queryKeys.prompts.all });

  const update = useMutation({
    mutationFn: (v: { id: string; title: string; body: string }) => updatePrompt(v.id, { title: v.title, body: v.body }),
    onSuccess: () => {
      setEditing(null);
      setNotice('Prompt diperbarui.');
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deletePrompt(id),
    onSuccess: () => {
      setDeleting(null);
      setNotice('Prompt dihapus.');
      if (items.length === 1 && page > 1) setPage(page - 1);
      refresh();
    },
  });

  return (
    <section id="saved-prompts-section" className="space-y-4" aria-labelledby="saved-prompts-heading">
      <div className="border-b border-slate-200 pb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookmarkCheck className="w-5 h-5 text-[#2563EB]" />
          <h2 id="saved-prompts-heading" className="text-lg sm:text-xl font-black text-[#0F172A]">
            Prompt <span className="text-[#2563EB]">Saya</span>
          </h2>
        </div>
        {meta && <span className="text-xs text-slate-500 font-medium">{meta.total} tersimpan</span>}
      </div>

      {notice && (
        <div role="status" className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs font-semibold text-[#2563EB]">
          {notice}
        </div>
      )}

      {list.isLoading ? (
        <LoadingBlock label="Memuat prompt tersimpan..." />
      ) : list.isError && !list.data ? (
        <ErrorBlock error={list.error} onRetry={() => void list.refetch()} title="Prompt tersimpan tidak dapat dimuat" />
      ) : items.length === 0 ? (
        <EmptyBlock title="Belum ada prompt tersimpan" hint="Rapikan sebuah prompt di simulator lalu tekan Simpan. Prompt favorit Anda tersimpan di sini." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((p) => (
            <div key={p.id} data-testid="saved-prompt" className="bg-white rounded-3xl border border-[#CBD5E1] p-5 shadow-xs flex flex-col justify-between gap-3">
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-black text-[#0F172A] break-words">{p.title}</h3>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">{relativeTime(p.updated_at)}</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed line-clamp-4 whitespace-pre-wrap break-words">{p.body}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => onUseInStudio(p.body)}
                  className="px-3 py-1.5 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[11px] font-black flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>Pakai di Studio</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onLoad(p.body)}
                  className="px-3 py-1.5 rounded-full bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-[#BFDBFE] text-[#2563EB] text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Wand2 className="w-3 h-3" />
                  <span>Muat ke Simulator</span>
                </button>
                <button
                  type="button"
                  onClick={() => void copy(p.id, p.body)}
                  aria-label={`Salin prompt ${p.title}`}
                  className="px-2.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {copiedKey === p.id ? <Check className="w-3 h-3 text-[#2563EB]" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === p.id ? 'Tersalin' : failedKey === p.id ? 'Salin manual' : 'Salin'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    update.reset();
                    setEditing(p);
                  }}
                  aria-label={`Ubah prompt ${p.title}`}
                  className="px-2.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Ubah</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    remove.reset();
                    setDeleting(p);
                  }}
                  aria-label={`Hapus prompt ${p.title}`}
                  className="px-2.5 py-1.5 rounded-full bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Hapus</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {meta && meta.total_pages > 1 && (
        <nav className="flex items-center justify-center gap-3" aria-label="Halaman prompt tersimpan">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-white border border-[#CBD5E1] text-xs font-bold text-[#475569] hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-50 disabled:pointer-events-none cursor-pointer">
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Sebelumnya</span>
          </button>
          <span className="text-xs font-bold text-slate-500">
            Halaman {meta.page} dari {meta.total_pages}
          </span>
          <button type="button" onClick={() => setPage((p) => Math.min(meta.total_pages, p + 1))} disabled={page >= meta.total_pages} className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-white border border-[#CBD5E1] text-xs font-bold text-[#475569] hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-50 disabled:pointer-events-none cursor-pointer">
            <span>Berikutnya</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </nav>
      )}

      {editing && (
        <PromptFormDialog
          heading="Ubah Prompt"
          confirmLabel="Simpan Perubahan"
          initialTitle={editing.title}
          initialBody={editing.body}
          editableBody
          busy={update.isPending}
          error={update.isError ? getErrorMessage(update.error) : null}
          fieldErrors={update.isError && isApiError(update.error) ? update.error.fieldErrors : {}}
          onSubmit={(v) => update.mutate({ id: editing.id, ...v })}
          onClose={() => !update.isPending && setEditing(null)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Hapus prompt ini?"
          message={
            <>
              Prompt <strong>{deleting.title}</strong> akan dihapus dari daftar Anda.
            </>
          }
          confirmLabel="Ya, Hapus"
          danger
          busy={remove.isPending}
          error={remove.isError ? getErrorMessage(remove.error) : null}
          onConfirm={() => remove.mutate(deleting.id)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </section>
  );
};
