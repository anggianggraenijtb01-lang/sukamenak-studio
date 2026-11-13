import type { Capability, ProviderName } from '../../providers/types.js';

export interface SeedModel {
  name: string;
  provider: ProviderName;
  capability: Capability;
  model_id: string;
  base_url?: string;
  /** Name of the environment variable that holds the key; never the key itself. */
  api_key_env?: string;
  is_active: boolean;
  is_default: boolean;
  priority: number;
  notes?: string;
}

const MOCK: SeedModel[] = (
  [
    ['Mock Vision', 'vision', 'mock-vision-1'],
    ['Mock Text', 'text', 'mock-text-1'],
    ['Mock Text-to-Image', 't2i', 'mock-t2i-1'],
    ['Mock Image-to-Image', 'i2i', 'mock-i2i-1'],
  ] as const
).map(([name, capability, model_id]) => ({
  name,
  provider: 'mock' as const,
  capability,
  model_id,
  is_active: true,
  is_default: true,
  priority: 100,
  notes: 'Key-less deterministic provider for development and tests (default per PRD open question Q-01).',
}));

const NOTE = 'PRD section 7 testing candidate. Inactive until its API key variable is set and the model is tested; verify model_id against the provider docs before activating.';

const candidate = (
  name: string,
  provider: ProviderName,
  capability: Capability,
  model_id: string,
  api_key_env: string,
  base_url?: string,
  priority = 200,
): SeedModel => ({ name, provider, capability, model_id, api_key_env, base_url, is_active: false, is_default: false, priority, notes: NOTE });

const OPENAI = 'https://api.openai.com/v1';
const DEEPSEEK = 'https://api.deepseek.com';
const ARK = 'https://ark.ap-southeast.bytepluses.com/api/v3';

/** PRD section 7 testing candidates. All inactive: admins enable them after testing. */
const CANDIDATES: SeedModel[] = [
  candidate('DeepSeek V4.1 Flash (text)', 'openai_compat', 'text', 'deepseek-v4.1-flash', 'DEEPSEEK_API_KEY', DEEPSEEK),
  candidate('Gemini Flash (vision)', 'gemini', 'vision', 'gemini-flash-latest', 'GEMINI_API_KEY'),
  candidate('Gemini Flash (text)', 'gemini', 'text', 'gemini-flash-latest', 'GEMINI_API_KEY'),
  candidate('Gemini Nano Banana 2 (t2i)', 'gemini', 't2i', 'gemini-3.1-flash-image-preview', 'GEMINI_API_KEY'),
  candidate('Gemini Nano Banana 2 (i2i)', 'gemini', 'i2i', 'gemini-3.1-flash-image-preview', 'GEMINI_API_KEY'),
  candidate('DALL-E 3 (t2i)', 'openai_compat', 't2i', 'dall-e-3', 'OPENAI_API_KEY', OPENAI),
  candidate('FLUX.1 schnell (t2i)', 'fal', 't2i', 'fal-ai/flux/schnell', 'FAL_KEY'),
  candidate('FLUX.1 dev (t2i)', 'fal', 't2i', 'fal-ai/flux/dev', 'FAL_KEY'),
  candidate('FLUX.1 dev (i2i)', 'fal', 'i2i', 'fal-ai/flux/dev/image-to-image', 'FAL_KEY'),
  candidate('Stable Diffusion 3.5 (t2i)', 'fal', 't2i', 'fal-ai/stable-diffusion-v35-large', 'FAL_KEY'),
  candidate('Qwen-Image (t2i)', 'fal', 't2i', 'fal-ai/qwen-image', 'FAL_KEY'),
  candidate('DeepFloyd IF (t2i)', 'fal', 't2i', 'fal-ai/if', 'FAL_KEY'),
  candidate('Imagen (t2i)', 'gemini', 't2i', 'imagen-4.0-generate-001', 'GEMINI_API_KEY'),
  candidate('Seedream (t2i)', 'openai_compat', 't2i', 'seedream-4-0-250828', 'ARK_API_KEY', ARK),
  candidate('Seedream (i2i)', 'openai_compat', 'i2i', 'seedream-4-0-250828', 'ARK_API_KEY', ARK),
];

export const SEED_MODELS: readonly SeedModel[] = [...MOCK, ...CANDIDATES];
