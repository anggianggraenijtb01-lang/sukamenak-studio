import { describe, expect, it } from 'vitest';
import { validateApiKeyEnv, validateBaseUrl, validateModelProviderFields } from './modelRules';

describe('validateApiKeyEnv', () => {
  it.each(['DEEPSEEK_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'FAL_KEY', 'ARK_API_KEY', 'PROVIDER_KEY_AKUN_KEDUA', 'PROVIDER_KEY_X1'])('accepts %s', (name) => {
    expect(validateApiKeyEnv(name)).toBeNull();
  });

  it.each(['CORE_PROMPT_KEY', 'JWT_ACCESS_SECRET', 'DATABASE_URL', 'S3_SECRET_ACCESS_KEY', 'PROVIDER_KEY_', 'PROVIDER_KEYX'])('refuses the internal or unknown name %s', (name) => {
    expect(validateApiKeyEnv(name)).toMatch(/tidak diizinkan/);
  });

  it('refuses a pasted key value or a lower-case name as "not a variable name"', () => {
    expect(validateApiKeyEnv('sk-proj-abc123')).toMatch(/nama variabel lingkungan/i);
    expect(validateApiKeyEnv('gemini_api_key')).toMatch(/nama variabel lingkungan/i);
    expect(validateApiKeyEnv('1GEMINI_KEY')).toMatch(/nama variabel lingkungan/i);
  });
});

describe('validateBaseUrl', () => {
  it('accepts a public https host', () => {
    expect(validateBaseUrl('https://api.openai.com/v1')).toBeNull();
    expect(validateBaseUrl('https://llm.example.co.id:8443/v1/')).toBeNull();
  });

  it.each([
    ['http://api.example.com/v1', /https/],
    ['https://localhost:11434', /publik/],
    ['https://foo.localhost/v1', /publik/],
    ['https://printer.local/v1', /publik/],
    ['https://svc.internal/v1', /publik/],
    ['https://127.0.0.1/v1', /publik/],
    ['https://10.1.2.3/v1', /publik/],
    ['https://172.16.0.9/v1', /publik/],
    ['https://192.168.1.10/v1', /publik/],
    ['https://169.254.169.254/latest', /publik/],
    ['https://[::1]/v1', /publik/],
    ['https://[fd00::1]/v1', /publik/],
    ['https://[::ffff:7f00:1]/v1', /publik/],
    ['https://2130706433/v1', /publik/],
    ['https://user:pass@api.example.com/v1', /username atau password/],
    ['https://api.example.com/v1?key=abc', /query/],
    ['https://api.example.com/v1#frag', /query|fragment/],
    ['not a url', /bukan url/i],
  ])('refuses %s', (url, expected) => {
    expect(validateBaseUrl(url)).toMatch(expected);
  });

  it('does not treat public look-alike addresses as private', () => {
    expect(validateBaseUrl('https://172.32.0.1/v1')).toBeNull();
    expect(validateBaseUrl('https://8.8.8.8/v1')).toBeNull();
  });
});

describe('validateModelProviderFields', () => {
  it('mock provider takes no key', () => {
    expect(validateModelProviderFields({ provider: 'mock', api_key_env: '', base_url: '' })).toEqual({});
    expect(validateModelProviderFields({ provider: 'mock', api_key_env: 'GEMINI_API_KEY', base_url: '' }).api_key_env).toMatch(/mock/);
  });

  it('real providers need a key variable, openai_compat also a base url', () => {
    expect(validateModelProviderFields({ provider: 'gemini', api_key_env: '', base_url: '' }).api_key_env).toMatch(/Wajib/);
    expect(validateModelProviderFields({ provider: 'gemini', api_key_env: 'GEMINI_API_KEY', base_url: '' })).toEqual({});
    expect(validateModelProviderFields({ provider: 'openai_compat', api_key_env: 'OPENAI_API_KEY', base_url: '' }).base_url).toMatch(/Wajib/);
    expect(validateModelProviderFields({ provider: 'openai_compat', api_key_env: 'OPENAI_API_KEY', base_url: 'https://api.openai.com/v1' })).toEqual({});
  });
});
