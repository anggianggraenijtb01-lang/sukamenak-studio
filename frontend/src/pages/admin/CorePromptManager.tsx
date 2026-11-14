import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, Terminal, Play, ShieldCheck, KeyRound, EyeOff } from 'lucide-react';
import { adminActivateCorePrompt, adminCreateCorePrompt, adminTestRenderCorePrompt } from '../../api/admin';
import { getErrorMessage } from '../../api/errors';
import { queryKeys } from '../../api/queryKeys';
import type {
  CorePromptMeta,
  CorePromptTestRenderResponse,
  TemplateCategory,
  TemplateSubject,
} from '../../api/types';

// D3: minimal write-only wiring so the page compiles against the real API. The core prompt body is typed here, sent
// once to POST /admin/core-prompts and then dropped from state: no endpoint ever returns it. D3 builds the real UI
// (version list per key, activate, template selector for test-render) on src/api/admin.ts.
const BLANK_TOKEN = '[___]';

export const CorePromptManager: React.FC = () => {
  const queryClient = useQueryClient();
  const [editorContent, setEditorContent] = useState<string>('');
  const [promptKey, setPromptKey] = useState('product.poster');
  const [subject, setSubject] = useState<TemplateSubject>('product');
  const [publication, setPublication] = useState<TemplateCategory>('poster');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [created, setCreated] = useState<CorePromptMeta | null>(null);

  const [testRemarks, setTestRemarks] = useState('');
  const [testResult, setTestResult] = useState<CorePromptTestRenderResponse | null>(null);

  const placeholderCount = editorContent.split(BLANK_TOKEN).length - 1;

  const createMutation = useMutation({
    mutationFn: () => adminCreateCorePrompt({ key: promptKey.trim(), subject, publication, body: editorContent }),
    onSuccess: (meta) => {
      setCreated(meta);
      setEditorContent(''); // write-only: the plaintext leaves the view as soon as it is sent
      setStatusBanner(
        `Versi ${meta.version} dari "${meta.key}" tersimpan terenkripsi di server (${meta.blank_count} isian). Versi ini belum aktif.`
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.corePrompts.all });
    },
    onError: (err) => setStatusBanner(getErrorMessage(err)),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => adminActivateCorePrompt(id),
    onSuccess: (meta) => {
      setCreated(meta);
      setStatusBanner(`Versi ${meta.version} dari "${meta.key}" sekarang aktif.`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.corePrompts.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.templates.all });
    },
    onError: (err) => setStatusBanner(getErrorMessage(err)),
  });

  const testMutation = useMutation({
    mutationFn: () => adminTestRenderCorePrompt({ key: promptKey.trim(), remarks: testRemarks || undefined }),
    onSuccess: (res) => setTestResult(res),
    onError: (err) => {
      setTestResult(null);
      setStatusBanner(getErrorMessage(err));
    },
  });

  const handleSaveEncrypted = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusBanner(null);
    if (!editorContent.includes(BLANK_TOKEN)) {
      setStatusBanner('Master prompt wajib memiliki minimal satu placeholder [___] untuk injeksi slot.');
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="space-y-5">
      {/* HEADER MENU CORE PROMPT MANAGER */}
      <div className="bg-gradient-to-r from-blue-50/90 via-[#EFF6FF] to-sky-50/60 rounded-3xl border border-[#BFDBFE] px-6 py-5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#F0F9FF] border border-[#BAE6FD] text-[#1E40AF] flex items-center justify-center">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-[#0F172A]">
                Core Prompt <span className="text-[#2563EB]">Manager (AES-256-GCM)</span>
              </h1>
            </div>
            <p className="text-xs text-[#64748B]">
              Write-Only Mode: Master prompt dienkripsi dengan placeholder bracket{' '}
              <code className="text-[#1E40AF] font-bold">[___]</code>.
            </p>
          </div>
        </div>

        <span className="px-3 py-1 rounded-full bg-[#F0F9FF] border border-[#0284C7] text-[#0F172A] text-xs font-mono font-bold inline-flex items-center gap-1.5">
          <EyeOff className="w-3.5 h-3.5 text-[#1E40AF]" />
          Write-Only Mode (AES-256-GCM)
        </span>
      </div>

      {statusBanner && (
        <div className="p-3 rounded-xl bg-[#F0F9FF] border border-[#0284C7] text-[#0F172A] text-xs font-bold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#1E40AF] shrink-0" />
          <span>{statusBanner}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <form
          onSubmit={handleSaveEncrypted}
          className="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-2xl p-5 space-y-3.5 shadow-2xs"
        >
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2.5">
            <span className="text-xs font-mono font-bold text-[#0F172A]">
              master_prompt_vault.aes256 (Write-Only)
            </span>
            <span className="text-[11px] font-mono text-[#0284C7] font-bold">
              Placeholder: {placeholderCount}x [___]
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              value={promptKey}
              onChange={(e) => setPromptKey(e.target.value)}
              aria-label="Key core prompt"
              placeholder="product.poster"
              className="w-full px-3 py-1.5 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] font-mono text-xs"
            />
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value as TemplateSubject)}
              aria-label="Subjek"
              className="w-full px-3 py-1.5 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] font-mono text-xs"
            >
              <option value="product">product</option>
              <option value="human_model">human_model</option>
            </select>
            <select
              value={publication}
              onChange={(e) => setPublication(e.target.value as TemplateCategory)}
              aria-label="Publikasi"
              className="w-full px-3 py-1.5 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] font-mono text-xs"
            >
              <option value="poster">poster</option>
              <option value="psa">psa</option>
              <option value="social_post">social_post</option>
              <option value="product_shot">product_shot</option>
              <option value="human_model">human_model</option>
            </select>
          </div>

          <textarea
            rows={8}
            value={editorContent}
            onChange={(e) => setEditorContent(e.target.value)}
            placeholder="Tulis core prompt versi baru. Gunakan [___] untuk setiap isian slot. Isi tidak pernah ditampilkan kembali."
            autoComplete="off"
            spellCheck={false}
            className="w-full p-3.5 rounded-xl bg-[#F8FAFC] border border-[#0F172A] font-mono text-xs text-[#0F172A] leading-relaxed focus:bg-white focus:outline-none focus:border-[#0284C7]"
          />

          {created && (
            <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] font-mono text-[11px] text-[#475569] space-y-1">
              <div className="flex items-center justify-between text-[#1E40AF] font-bold">
                <span className="inline-flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5" />
                  Versi terakhir ({created.key} v{created.version}):
                </span>
                <span>{created.is_active ? 'AKTIF' : 'BELUM AKTIF'}</span>
              </div>
              {!created.is_active && (
                <button
                  type="button"
                  disabled={activateMutation.isPending}
                  onClick={() => activateMutation.mutate(created.id)}
                  className="text-[#EA580C] font-bold hover:underline cursor-pointer disabled:opacity-60"
                >
                  Aktifkan versi ini
                </button>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
          >
            <Lock className="w-3.5 h-3.5" />
            {createMutation.isPending ? 'Mengirim...' : 'Kirim Versi Baru Master Prompt (Terenkripsi di Server)'}
          </button>
        </form>

        <div className="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-2xl p-5 space-y-3.5 shadow-2xs">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2.5">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[#1E40AF]" />
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#0F172A]">
                Test Render Preview [HIDDEN_CORE_PROMPT]
              </h2>
            </div>
            <Play className="w-3.5 h-3.5 text-[#EA580C]" />
          </div>

          <div className="space-y-2.5 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-[#475569] mb-1">
                Catatan uji (remarks):
              </label>
              <input
                type="text"
                value={testRemarks}
                onChange={(e) => setTestRemarks(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] font-mono text-xs"
              />
            </div>
            <button
              type="button"
              disabled={testMutation.isPending || !promptKey.trim()}
              onClick={() => testMutation.mutate()}
              className="w-full py-2 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white font-extrabold text-xs transition-colors cursor-pointer disabled:opacity-60"
            >
              {testMutation.isPending ? 'Menguji...' : `Uji Render "${promptKey.trim() || '...'}"`}
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-[#F0F9FF] border border-[#0284C7] font-mono text-xs text-[#0F172A] space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-[#0369A1] font-bold">
              <span>OUTPUT COMPILER (MASKED):</span>
              <span>
                {testResult
                  ? `v${testResult.core_prompt.version} - ${testResult.filled_count} terisi / ${testResult.empty_count} kosong`
                  : 'BELUM DIUJI'}
              </span>
            </div>
            <pre className="whitespace-pre-wrap text-[11px] leading-relaxed">
              {testResult ? testResult.masked_prompt : '[HIDDEN_CORE_PROMPT]'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
