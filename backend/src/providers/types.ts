export type Capability = 'vision' | 'text' | 't2i' | 'i2i';
export type ProviderName = 'mock' | 'openai_compat' | 'gemini' | 'fal';

/** Row of `model_configs` as providers see it. `api_key_env` is a variable NAME, never a key. */
export interface ModelConfigRecord {
  id: string;
  name: string;
  provider: ProviderName;
  capability: Capability;
  model_id: string;
  base_url: string | null;
  api_key_env: string | null;
  is_default: boolean;
  is_active: boolean;
  priority: number;
  cost_per_call_usd: string;
  timeout_ms: number;
}

export interface ImproveTextResult {
  text: string;
  /** `model` when an LLM produced the text, `heuristic` for deterministic rule-based output. */
  source: 'model' | 'heuristic';
  costUsd: number;
}

export interface ProviderCallOptions {
  /** Aborts the call (job timeout / shutdown). Combined with the model's own `timeout_ms`. */
  signal?: AbortSignal;
}

/** One image handed to a provider. The raw bytes are sent as an image, never described in words. */
export interface ImageInput {
  data: Buffer;
  mime: string;
}

export interface AnalyzeReferenceInput {
  image: ImageInput;
  /** Reference role, for example `color` or `lighting`. */
  role: string;
  /** Full instruction sent with the image ("extract ONLY <role>, ignore the rest"). */
  instruction: string;
}

export interface AnalyzeReferenceResult {
  description: string;
  costUsd: number;
}

export interface EmptyZone {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GenerateImageInput {
  /** Final composed prompt. Secret: never log it or put it in an error message. */
  prompt: string;
  mode: 'i2i' | 't2i';
  /** Every reference, in order. i2i sends all of them to the model as images. */
  references: ImageInput[];
  aspectRatio: string;
  width: number;
  height: number;
  /**
   * Fractions of the canvas the application will overlay text on. Real models are told through the
   * prompt; only the key-less mock provider uses this to keep those areas flat and empty.
   */
  emptyZones?: EmptyZone[];
}

export interface GenerateImageResult {
  image: Buffer;
  mime: string;
  costUsd: number;
  /** Number of references actually sent to the model as images (single-image endpoints report 1). */
  referencesUsed: number;
}

/**
 * What a provider adapter can do. Every method is optional: the registry only routes a capability
 * to adapters that implement the matching method.
 */
export interface ProviderAdapter {
  readonly name: ProviderName;
  improveText?(config: ModelConfigRecord, input: { text: string }, opts?: ProviderCallOptions): Promise<ImproveTextResult>;
  /** Vision: describe ONE aspect (the reference's role) of an image. */
  analyzeReference?(config: ModelConfigRecord, input: AnalyzeReferenceInput, opts?: ProviderCallOptions): Promise<AnalyzeReferenceResult>;
  /** t2i / i2i: returns one image. */
  generateImage?(config: ModelConfigRecord, input: GenerateImageInput, opts?: ProviderCallOptions): Promise<GenerateImageResult>;
}
