import React, { useState } from 'react';
import { Lock, Terminal, Play, ShieldCheck, KeyRound, EyeOff } from 'lucide-react';
import {
  getDefaultWriteOnlySkeleton,
  renderTestCorePromptPreview,
} from '../../services/aesEncryption';
import { updateEncryptedCorePrompt } from '../../controllers/adminController';
import { useStudio } from '../../components/common/StudioContext';

export const CorePromptManager: React.FC = () => {
  const { lastEncryptedRecord, setLastEncryptedRecord } = useStudio();
  const [editorContent, setEditorContent] = useState<string>(getDefaultWriteOnlySkeleton());
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const [testTitle, setTestTitle] = useState('Keripik Tempe Bu Cantika');
  const [testSubject, setTestSubject] = useState('Produk UMKM');
  const [testVision, setTestVision] = useState('Soft Studio Key Light 45°, Slate Surface');
  const [testZone, setTestZone] = useState('Top Header + Bottom CTA');

  const previewResult = renderTestCorePromptPreview({
    title: testTitle,
    subjectType: testSubject,
    visionSummary: testVision,
    textZone: testZone,
  });

  const handleSaveEncrypted = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const record = await updateEncryptedCorePrompt(editorContent);
      setLastEncryptedRecord(record);
      setStatusBanner(
        `Master Prompt berhasil dienkripsi ulang dengan AES-256-GCM pada ${new Date(
          record.updatedAt
        ).toLocaleTimeString('id-ID')}. Plaintext dihapus dari view (Write-Only Mode).`
      );
    } catch (err) {
      setStatusBanner(err instanceof Error ? err.message : 'Gagal mengenkripsi prompt.');
    }
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
              Placeholder: {previewResult.placeholderCount}x [___]
            </span>
          </div>

          <textarea
            rows={8}
            value={editorContent}
            onChange={(e) => setEditorContent(e.target.value)}
            className="w-full p-3.5 rounded-xl bg-[#F8FAFC] border border-[#0F172A] font-mono text-xs text-[#0F172A] leading-relaxed focus:bg-white focus:outline-none focus:border-[#0284C7]"
          />

          <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] font-mono text-[11px] text-[#475569] space-y-1">
            <div className="flex items-center justify-between text-[#1E40AF] font-bold">
              <span className="inline-flex items-center gap-1">
                <KeyRound className="w-3.5 h-3.5" />
                Ciphertext Vault ({lastEncryptedRecord.algorithm}):
              </span>
              <span>IV: {lastEncryptedRecord.ivHex}</span>
            </div>
            <div className="truncate text-[#0F172A]">{lastEncryptedRecord.cipherTextHex}</div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            Enkripsi &amp; Overwrite Master Prompt (AES-256-GCM)
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
                Slot [1] Judul Uji:
              </label>
              <input
                type="text"
                value={testTitle}
                onChange={(e) => setTestTitle(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] font-mono text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-[#475569] mb-1">
                  Slot [2] Subjek:
                </label>
                <input
                  type="text"
                  value={testSubject}
                  onChange={(e) => setTestSubject(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#475569] mb-1">
                  Slot [4] Text Zone:
                </label>
                <input
                  type="text"
                  value={testZone}
                  onChange={(e) => setTestZone(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] font-mono text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#475569] mb-1">
                Slot [3] Profil Vision:
              </label>
              <input
                type="text"
                value={testVision}
                onChange={(e) => setTestVision(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] font-mono text-xs"
              />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#F0F9FF] border border-[#0284C7] font-mono text-xs text-[#0F172A] space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-[#0369A1] font-bold">
              <span>OUTPUT COMPILER (MASKED):</span>
              <span>{previewResult.encryptedStatus}</span>
            </div>
            <pre className="whitespace-pre-wrap text-[11px] leading-relaxed">
              {previewResult.maskedView}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
