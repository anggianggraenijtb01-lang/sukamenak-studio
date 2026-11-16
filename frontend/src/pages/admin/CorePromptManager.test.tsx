import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { fail, ok, pageMeta, renderWithProviders, stubApi } from '../../test/adminHarness';
import { CorePromptManager } from './CorePromptManager';

const SECRET = 'ZZ-SECRET-BODY-MARKER describe the product on a plain background [___] soft studio light';

const meta = (over: Record<string, unknown> = {}) => ({
  id: 'cp-1',
  key: 'product.poster',
  version: 1,
  subject: 'product',
  publication: 'poster',
  blank_count: 1,
  is_active: true,
  is_placeholder: false,
  templates_using: 2,
  created_at: '2026-11-01T03:00:00Z',
  created_by: { id: 'a1', name: 'Admin Utama' },
  ...over,
});

const listRoutes = (items = [meta()]) => ({
  'GET /admin/core-prompts': () => ok(items, pageMeta(items.length)),
  'GET /admin/templates': () => ok([], pageMeta(0)),
});

afterEach(() => vi.unstubAllGlobals());

const fillForm = (body: string, key = 'product.poster') => {
  fireEvent.change(screen.getByLabelText('Key'), { target: { value: key } });
  fireEvent.change(screen.getByLabelText(/Isi master prompt/), { target: { value: body } });
};

describe('CorePromptManager is write-only', () => {
  it('sends the body once, empties the textarea and never renders it', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const api = stubApi({
      ...listRoutes(),
      'POST /admin/core-prompts': () => ok(meta({ id: 'cp-2', version: 2, is_active: false }), undefined, 201),
    });
    renderWithProviders(<CorePromptManager />);
    await screen.findByText('v1');

    fillForm(SECRET);
    expect((screen.getByLabelText(/Isi master prompt/) as HTMLTextAreaElement).value).toBe(SECRET);
    fireEvent.click(screen.getByRole('button', { name: /Kirim Versi Baru Master Prompt/ }));

    const last = await screen.findByTestId('last-version');
    expect(last.textContent).toContain('product.poster v2');

    const posts = api.calls.filter((c) => c.method === 'POST' && c.path === '/admin/core-prompts');
    expect(posts).toHaveLength(1);
    expect((posts[0].body as { body: string }).body).toBe(SECRET);

    // The field is cleared and the text appears nowhere in the page.
    expect((screen.getByLabelText(/Isi master prompt/) as HTMLTextAreaElement).value).toBe('');
    expect(document.body.textContent).not.toContain('ZZ-SECRET-BODY-MARKER');
    expect(document.body.innerHTML).not.toContain('ZZ-SECRET-BODY-MARKER');
    // Nothing is persisted in the browser.
    expect(setItem).not.toHaveBeenCalled();
  });

  it('shows only metadata and the masked literal in the versions list and the test render', async () => {
    stubApi({
      ...listRoutes([meta(), meta({ id: 'cp-0', version: 2, is_active: false })]),
      'POST /admin/core-prompts/test-render': () =>
        ok({
          masked_prompt: '[HIDDEN_CORE_PROMPT]',
          core_prompt: { id: 'cp-1', key: 'product.poster', version: 1, blank_count: 2 },
          template: null,
          blanks: [
            { index: 1, slot_key: 'blank_1', status: 'filled', source: 'slot_values' },
            { index: 2, slot_key: 'blank_2', status: 'empty', source: 'none' },
          ],
          filled_count: 1,
          empty_count: 1,
          sanitized_values: { blank_1: 'Keripik' },
          sanitized_remarks: null,
          remarks_dropped: false,
        }),
    });
    renderWithProviders(<CorePromptManager />);
    const group = await screen.findByTestId('group-product.poster');
    expect(within(group).getByText('v2')).toBeTruthy();
    expect(within(group).getAllByRole('columnheader').map((h) => h.textContent)).not.toContain('Isi');

    fireEvent.click(await screen.findByRole('button', { name: /Uji Render/ }));
    const out = await screen.findByTestId('masked-output');
    await waitFor(() => expect(out.textContent).toContain('1 terisi / 1 kosong'));
    expect(out.textContent).toContain('[HIDDEN_CORE_PROMPT]');
    expect(screen.getByText('Terisi')).toBeTruthy();
    expect(screen.getByText('Kosong')).toBeTruthy();
  });

  it('explains BLANK_SLOT_MISMATCH when activating a version', async () => {
    stubApi({
      ...listRoutes([meta({ is_active: false })]),
      'POST /admin/core-prompts/cp-1/activate': () => fail(422, 'BLANK_SLOT_MISMATCH'),
    });
    renderWithProviders(<CorePromptManager />);
    fireEvent.click(await screen.findByRole('button', { name: 'Aktifkan product.poster versi 1' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Aktifkan' }));
    const alert = await within(dialog).findByRole('alert');
    expect(alert.textContent).toMatch(/jumlah slot ber-blank/);
    expect(alert.textContent).not.toContain('server text that must never be shown');
  });

  it('explains UNKNOWN_PLACEHOLDER on create without echoing text, and keeps the field for correction', async () => {
    stubApi({
      ...listRoutes(),
      'POST /admin/core-prompts': () =>
        fail(422, 'UNKNOWN_PLACEHOLDER', [{ field: 'body', message: 'Placeholder yang diizinkan: subject_lock, negative, text_zone, aspect_ratio, brand_palette' }]),
    });
    renderWithProviders(<CorePromptManager />);
    await screen.findByText('v1');
    fillForm(SECRET.replace('soft', '{{bogus}} soft'));
    fireEvent.click(screen.getByRole('button', { name: /Kirim Versi Baru Master Prompt/ }));

    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0));
    const text = screen.getAllByRole('alert').map((a) => a.textContent).join(' ');
    expect(text).toMatch(/placeholder .*tidak dikenal/i);
    expect(text).toContain('subject_lock');
    expect(text).not.toContain('bogus');
  });

  it('blocks a body without any blank before sending anything', async () => {
    const api = stubApi(listRoutes());
    renderWithProviders(<CorePromptManager />);
    await screen.findByText('v1');
    fillForm('Describe the product on a plain background with soft light and nothing else');
    fireEvent.click(screen.getByRole('button', { name: /Kirim Versi Baru Master Prompt/ }));
    expect((await screen.findAllByText(/minimal satu placeholder/)).length).toBeGreaterThan(0);
    expect(api.calls.some((c) => c.method === 'POST')).toBe(false);
  });
});

describe('CorePromptManager tells an admin which active prompts are still stand-ins', () => {
  it('warns about the keys whose active version is a stand-in and marks that version', async () => {
    stubApi(listRoutes([meta({ is_placeholder: true }), meta({ id: 'cp-5', key: 'product.psa', publication: 'psa', is_placeholder: false })]));
    renderWithProviders(<CorePromptManager />);
    const banner = await screen.findByTestId('stand-in-banner');
    expect(banner.textContent).toContain('1 core prompt aktif masih berupa prompt pengganti');
    expect(banner.textContent).toContain('product.poster');
    expect(banner.textContent).not.toContain('product.psa');

    expect(within(screen.getByTestId('group-product.poster')).getByText('Pengganti')).toBeTruthy();
    expect(within(screen.getByTestId('group-product.psa')).queryByText('Pengganti')).toBeNull();
  });

  it('shows no warning once the active version is a real prompt, but still marks the old stand-in in the history', async () => {
    stubApi(listRoutes([meta({ id: 'cp-2', version: 2, is_placeholder: false }), meta({ id: 'cp-1', version: 1, is_active: false, is_placeholder: true })]));
    renderWithProviders(<CorePromptManager />);
    await screen.findByText('v2');
    expect(screen.queryByTestId('stand-in-banner')).toBeNull();
    expect(within(screen.getByTestId('group-product.poster')).getAllByText('Pengganti')).toHaveLength(1);
  });
});
