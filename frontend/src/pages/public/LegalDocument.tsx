import React from 'react';
import { Link } from 'react-router-dom';
import { FileWarning } from 'lucide-react';

export interface LegalSection {
  id: string;
  title: string;
  body: React.ReactNode;
}

interface LegalDocumentProps {
  title: string;
  intro: string;
  updated: string;
  sections: LegalSection[];
  /** The sibling document, linked at the bottom. */
  other: { to: string; label: string };
}

/** Marks a statement the team still has to confirm before release (visible to reviewers and readers). */
export const Todo: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <mark className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[0.85em] font-semibold not-italic">[Perlu dikonfirmasi: {children}]</mark>
);

export const DRAFT_LABEL = 'Versi draf – perlu ditinjau sebelum rilis';

/** Shared page shell of the privacy policy and the terms of service. */
export const LegalDocument: React.FC<LegalDocumentProps> = ({ title, intro, updated, sections, other }) => (
  <div className="bg-[#F8FAFC] py-10 sm:py-14 px-4 sm:px-6">
    <article className="max-w-3xl mx-auto space-y-8">
      <header className="space-y-4">
        <div role="note" className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900">
          <FileWarning className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-xs sm:text-sm leading-relaxed">
            <strong className="block font-black">{DRAFT_LABEL}</strong>
            Dokumen ini disusun dari cara kerja sistem saat ini dan belum ditinjau oleh pihak hukum. Bagian bertanda <Todo>contoh</Todo> masih harus dipastikan.
          </div>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-[#0F172A] tracking-tight">{title}</h1>
        <p className="text-sm sm:text-base text-[#475569] leading-relaxed">{intro}</p>
        <p className="text-xs text-slate-500 font-semibold">Terakhir diperbarui: {updated} (draf)</p>
      </header>

      <nav aria-label="Daftar isi" className="bg-white rounded-3xl border border-[#E2E8F0] p-5 sm:p-6 shadow-xs">
        <h2 className="text-xs font-black uppercase tracking-wider text-[#2563EB] mb-3">Daftar Isi</h2>
        <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-[#1E40AF] font-semibold list-decimal pl-5">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="hover:underline">
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="space-y-6">
        {sections.map((s, i) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="bg-white rounded-3xl border border-[#E2E8F0] p-6 sm:p-8 shadow-xs scroll-mt-28 space-y-3">
            <h2 id={`${s.id}-title`} className="text-lg sm:text-xl font-black text-[#0F172A]">
              {i + 1}. {s.title}
            </h2>
            <div className="text-sm text-[#334155] leading-relaxed space-y-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1.5 [&_a]:text-[#1E40AF] [&_a]:font-semibold [&_a:hover]:underline">
              {s.body}
            </div>
          </section>
        ))}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <Link to={other.to} className="font-bold text-[#1E40AF] hover:underline">
          {other.label}
        </Link>
        <Link to="/" className="font-semibold text-slate-500 hover:text-[#1E40AF]">
          Kembali ke Beranda
        </Link>
      </footer>
    </article>
  </div>
);
