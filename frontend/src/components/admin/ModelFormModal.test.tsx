import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { AdminModel } from '../../api/types';
import { ok, stubApi } from '../../test/adminHarness';
import { ModelFormModal } from './ModelFormModal';

afterEach(() => vi.unstubAllGlobals());

const existing: AdminModel = {
  id: 'm1',
  name: 'Gemini Vision',
  provider: 'gemini',
  capability: 'vision',
  model_id: 'gemini-2.5-flash',
  base_url: null,
  api_key_env: 'GEMINI_API_KEY',
  requires_api_key: true,
  api_key_configured: false,
  is_default: false,
  is_active: false,
  usable: false,
  priority: 100,
  cost_per_call_usd: 0,
  timeout_ms: 60000,
  last_test_at: null,
  last_test_ok: null,
  notes: null,
  created_at: '2026-11-01T00:00:00Z',
  updated_at: '2026-11-01T00:00:00Z',
};

const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('ModelFormModal hints', () => {
  it('explains the allowed key variable names and rejects internal ones live', () => {
    render(<ModelFormModal onClose={() => undefined} onSaved={() => undefined} />);
    expect(screen.getByText(/DEEPSEEK_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY, FAL_KEY, ARK_API_KEY/, { selector: 'p' })).toBeTruthy();
    expect(screen.getByText(/PROVIDER_KEY_/, { selector: 'p' })).toBeTruthy();

    type(/api_key_env/, 'CORE_PROMPT_KEY');
    expect(screen.getByRole('alert').textContent).toMatch(/tidak diizinkan/);

    type(/api_key_env/, 'sk-live-123');
    expect(screen.getByRole('alert').textContent).toMatch(/bukan nilai API key|Jangan tempelkan nilai/);

    type(/api_key_env/, 'PROVIDER_KEY_AKUN_KEDUA');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('explains the https / public host rule for the base URL', () => {
    render(<ModelFormModal onClose={() => undefined} onSaved={() => undefined} />);
    expect(screen.getByText(/localhost, 127\.x, 10\.x/)).toBeTruthy();
    type(/Base URL/, 'http://localhost:11434');
    expect(screen.getByRole('alert').textContent).toMatch(/https/);
    type(/Base URL/, 'https://10.0.0.5/v1');
    expect(screen.getByRole('alert').textContent).toMatch(/publik/);
    type(/Base URL/, 'https://api.example.com/v1');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not call the API while the rules are violated', () => {
    const api = stubApi({ 'POST /admin/models': () => ok(existing, undefined, 201) });
    render(<ModelFormModal onClose={() => undefined} onSaved={() => undefined} />);
    type(/Nama tampilan/, 'Model Uji');
    type(/ID model di penyedia/, 'gpt-x');
    type(/Base URL/, 'https://api.example.com/v1');
    type(/api_key_env/, 'CORE_PROMPT_KEY');
    fireEvent.click(screen.getByRole('button', { name: 'Simpan Model' }));
    expect(api.calls).toHaveLength(0);
  });

  it('sends a valid model once and never contains a key value', async () => {
    const api = stubApi({ 'POST /admin/models': () => ok(existing, undefined, 201) });
    const onSaved = vi.fn();
    render(<ModelFormModal onClose={() => undefined} onSaved={onSaved} />);
    type(/Nama tampilan/, 'Model Uji');
    type(/ID model di penyedia/, 'gpt-x');
    type(/Base URL/, 'https://api.example.com/v1');
    type(/api_key_env/, 'PROVIDER_KEY_UJI');
    fireEvent.click(screen.getByRole('button', { name: 'Simpan Model' }));
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    const body = api.calls[0].body as Record<string, unknown>;
    expect(body).toMatchObject({ name: 'Model Uji', provider: 'openai_compat', capability: 't2i', api_key_env: 'PROVIDER_KEY_UJI', base_url: 'https://api.example.com/v1', is_active: false });
    expect(Object.keys(body).some((k) => /^(api_key|key|secret)$/.test(k))).toBe(false);
  });

  it('disables provider and capability when editing and only sends what changed', async () => {
    const api = stubApi({ 'PATCH /admin/models/m1': () => ok({ ...existing, priority: 5 }) });
    const onSaved = vi.fn();
    render(<ModelFormModal model={existing} onClose={() => undefined} onSaved={onSaved} />);
    expect((screen.getByLabelText(/^Provider/) as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText(/^Kemampuan/) as HTMLSelectElement).disabled).toBe(true);
    type(/Prioritas/, '5');
    fireEvent.click(screen.getByRole('button', { name: 'Simpan Perubahan' }));
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(api.calls[0].body).toEqual({ priority: 5 });
  });

  it('disables the key variable for the mock provider', () => {
    render(<ModelFormModal onClose={() => undefined} onSaved={() => undefined} />);
    fireEvent.change(screen.getByLabelText(/^Provider/), { target: { value: 'mock' } });
    expect((screen.getByLabelText(/api_key_env/) as HTMLInputElement).disabled).toBe(true);
  });
});
