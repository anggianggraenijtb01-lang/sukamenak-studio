import React from 'react';
import { Link } from 'react-router-dom';
import { Banner } from './ui';

/**
 * The repository is public, so seeding installs neutral stand-in core prompts and the real ones are entered by an admin.
 * Production refuses to generate from a stand-in, so an admin has to be able to see which active prompts still are one.
 * Only keys are shown here, never any part of a prompt.
 */
export const StandInPromptBanner: React.FC<{ keys: readonly string[]; showLink?: boolean }> = ({ keys, showLink = false }) => {
  if (keys.length === 0) return null;
  return (
    <div data-testid="stand-in-banner">
      <Banner kind="warning">
        Peringatan: {keys.length} core prompt aktif masih berupa prompt pengganti ({keys.join(', ')}). Di produksi, pembuatan gambar dari template yang
        memakainya ditolak sampai prompt asli dikirim dan diaktifkan.
        {showLink && (
          <>
            {' '}
            <Link to="/admin/core-prompt" className="underline">
              Buka Core Prompt Manager
            </Link>
          </>
        )}
      </Banner>
    </div>
  );
};
