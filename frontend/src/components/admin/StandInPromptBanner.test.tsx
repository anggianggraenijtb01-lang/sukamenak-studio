import React from 'react';
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/adminHarness';
import { StandInPromptBanner } from './StandInPromptBanner';

describe('StandInPromptBanner', () => {
  it('renders nothing when no active prompt is a stand-in', () => {
    renderWithProviders(<StandInPromptBanner keys={[]} />);
    expect(screen.queryByTestId('stand-in-banner')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('warns with the keys and nothing else, and has no link unless asked', () => {
    renderWithProviders(<StandInPromptBanner keys={['product.poster', 'product.psa']} />);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByTestId('stand-in-banner').textContent).toContain('2 core prompt aktif masih berupa prompt pengganti (product.poster, product.psa)');
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('links to the Core Prompt Manager when asked', () => {
    renderWithProviders(<StandInPromptBanner keys={['product.poster']} showLink />);
    expect(screen.getByRole('link', { name: 'Buka Core Prompt Manager' }).getAttribute('href')).toBe('/admin/core-prompt');
  });
});
