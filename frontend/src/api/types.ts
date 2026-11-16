/**
 * Request / response types for every endpoint in backend/docs/API.md.
 * Field names mirror the API exactly (snake_case). Timestamps are ISO 8601 strings.
 *
 * There is deliberately no type for a core prompt body, a composed prompt or ciphertext: the API never
 * returns one and the frontend must never hold one.
 */

// ---------------------------------------------------------------------------------------------------
// Conventions
// ---------------------------------------------------------------------------------------------------

export type Uuid = string;
export type IsoDateTime = string;
/** Calendar date `YYYY-MM-DD` in the server's APP_TIMEZONE. */
export type DateString = string;

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

/** Paginated list: `data` becomes `items`, `meta` is the pagination block. */
export interface Page<T, M = PageMeta> {
  items: T[];
  meta: M;
}

export interface PageParams {
  page?: number;
  limit?: number;
}

/** Success envelope as sent by the server. */
export interface SuccessEnvelope<T, M = undefined> {
  status: 'success';
  message: string;
  data: T;
  meta?: M;
}

export interface FieldErrorDTO {
  field: string;
  message: string;
}

/** Error envelope as sent by the server. */
export interface ErrorEnvelope {
  status: 'error';
  message: string;
  error_code: string;
  errors?: FieldErrorDTO[];
}

// ---------------------------------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------------------------------

export type Role = 'creator' | 'admin';
export type TemplateCategory = 'poster' | 'psa' | 'social_post' | 'product_shot' | 'human_model';
/** `both` is only used by templates; a generation is always `i2i` or `t2i`. */
export type TemplateMode = 'i2i' | 't2i' | 'both';
export type GenerationMode = 'i2i' | 't2i';
export type TemplateSubject = 'product' | 'human_model';
export type TemplateStatus = 'draft' | 'published' | 'archived';
export type SlotType = 'text' | 'color' | 'select' | 'textarea';
export type SlotTarget = 'image' | 'overlay';
export type ReferenceRole =
  | 'product'
  | 'human_model'
  | 'font'
  | 'color'
  | 'lighting'
  | 'pose'
  | 'background'
  | 'style';
export type TextAlign = 'left' | 'center' | 'right';
export type TutorialLevel = 'pemula' | 'menengah' | 'mahir';
export type GenerationStatus = 'queued' | 'running' | 'done' | 'failed';
export type ProgressStep = 'analysis' | 'compose' | 'generate' | 'composite' | 'done';
export type ModelProvider = 'mock' | 'openai_compat' | 'gemini' | 'fal';
export type ModelCapability = 'vision' | 'text' | 't2i' | 'i2i';
export type ModerationLevel = 'lenient' | 'standard' | 'strict';
export type PromptSource = 'manual' | 'imported';

// ---------------------------------------------------------------------------------------------------
// System
// ---------------------------------------------------------------------------------------------------

export interface HealthResponse {
  status: 'ok';
  uptime_seconds: number;
  checks: { database: string; redis: string };
}

export interface VersionResponse {
  name: string;
  version: string;
  api: 'v1';
  environment: string;
}

// ---------------------------------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------------------------------

export interface User {
  id: Uuid;
  email: string;
  name: string;
  role: Role;
  last_login_at: IsoDateTime | null;
  created_at: IsoDateTime;
}

/** Answer of register, login and refresh (and `session` of a password change). */
export interface Session {
  user: User;
  access_token: string;
  token_type: 'Bearer';
  /** Lifetime of the access token in seconds. */
  expires_in: number;
}

export interface RegisterRequest {
  email: string;
  /** 8 to 72 bytes. */
  password: string;
  /** 2 to 80 characters. */
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LogoutResponse {
  logged_out: true;
}

// ---------------------------------------------------------------------------------------------------
// Profile (/me)
// ---------------------------------------------------------------------------------------------------

export interface Usage {
  date: DateString;
  daily_limit: number;
  used_today: number;
  in_flight: number;
  remaining_today: number;
}

export interface MeResponse {
  user: User;
  usage: Usage;
}

export interface UpdateMeRequest {
  name?: string;
  /** Required together with `new_password`. */
  current_password?: string;
  new_password?: string;
}

export interface UpdateMeResponse {
  user: User;
  /** Present when the password changed: a fresh session, every other session is revoked. */
  session?: Session;
}

export interface DeleteMeRequest {
  password: string;
}

export interface DeleteMeResponse {
  deleted: true;
}

/** `GET /me/export`: everything stored about the user (UU PDP). Only the top-level sections are typed. */
export interface MyDataExport {
  exported_at: IsoDateTime;
  profile: User;
  generations: Array<Record<string, unknown>>;
  saved_prompts: Array<Record<string, unknown>>;
  prompt_improvements: Array<Record<string, unknown>>;
  daily_usage: Array<{ date: DateString; success_count: number }>;
}

/** Answer of most `DELETE` endpoints. */
export interface DeletedResponse {
  id: Uuid;
}

/** Answer of `DELETE /prompts/:id`. */
export interface PromptDeletedResponse {
  deleted: boolean;
}

// ---------------------------------------------------------------------------------------------------
// Catalog (public)
// ---------------------------------------------------------------------------------------------------

export interface TemplateListQuery {
  category?: TemplateCategory;
  mode?: TemplateMode;
  subject?: TemplateSubject;
  search?: string;
}

export interface TemplateListItem {
  id: Uuid;
  slug: string;
  name: string;
  description: string;
  category: TemplateCategory;
  mode: TemplateMode;
  subject: TemplateSubject;
  /** For example `4:5`. */
  aspect_ratio: string;
  requires_consent: boolean;
  preview_url: string | null;
}

export interface SlotOption {
  value: string;
  label: string;
}

export interface TemplateSlot {
  key: string;
  label: string;
  type: SlotType;
  /** `image` steers the picture, `overlay` is pasted as text into a text zone. */
  target: SlotTarget;
  required: boolean;
  default_value: string | null;
  /** Present for `select` slots. */
  options: SlotOption[] | null;
  max_length: number | null;
  reference_role: ReferenceRole | null;
}

export interface TemplateTextZone {
  slot_key: string;
  /** Fractions of the canvas, 0 to 1. */
  x: number;
  y: number;
  w: number;
  h: number;
  align: TextAlign;
  font_family: string;
  font_weight: number;
  font_size_ratio: number;
  /** `#rgb`, `#rrggbb`, `brand` or `brand:N`. */
  color: string;
  max_lines: number;
}

export interface TemplateExampleReference {
  id: Uuid;
  role: ReferenceRole;
  label: string | null;
  url: string | null;
}

export interface TemplateDetail extends TemplateListItem {
  slots: TemplateSlot[];
  text_zones: TemplateTextZone[];
  example_references: TemplateExampleReference[];
  disclaimer: string | null;
}

export interface GalleryListQuery extends PageParams {
  /** Template slug. */
  template?: string;
  featured?: boolean;
}

export interface GalleryItem {
  id: Uuid;
  title: string;
  image_url: string;
  /** Built from slot values and remarks only. */
  display_prompt: string;
  is_featured: boolean;
  template: { slug: string; name: string; category: TemplateCategory } | null;
  created_at: IsoDateTime;
}

export interface TutorialListQuery {
  level?: TutorialLevel;
}

export interface TutorialListItem {
  id: Uuid;
  slug: string;
  title: string;
  summary: string;
  level: TutorialLevel;
}

export type TutorialSectionKind = 'what_to_do' | 'do' | 'dont' | 'tip' | 'example';

export interface TutorialSection {
  id: Uuid;
  kind: TutorialSectionKind;
  title: string;
  body_md: string;
}

export type VisualBreakdownAspect = 'style' | 'color' | 'gradient' | 'angle' | 'lighting' | 'composition';

export interface VisualBreakdown {
  id: Uuid;
  aspect: VisualBreakdownAspect;
  title: string;
  description: string;
  /** A teaching snippet, unrelated to the hidden core prompts. */
  prompt_fragment: string;
  example_url: string | null;
}

export interface TutorialDetail extends TutorialListItem {
  sections: TutorialSection[];
  visual_breakdowns: VisualBreakdown[];
}

// ---------------------------------------------------------------------------------------------------
// Prompt tools and saved prompts
// ---------------------------------------------------------------------------------------------------

export interface AnalyzePromptRequest {
  /** 1 to 4000 characters. */
  text: string;
}

/** Deterministic analysis. Only the top-level keys are documented, nested shapes are left open. */
export interface PromptAnalysis {
  score: number;
  word_count: number;
  char_count: number;
  breakdown: unknown;
  filler_words: string[];
  repeated_terms: unknown[];
  covered_aspects: string[];
  missing_aspects: string[];
  suggestions: string[];
}

export interface ImprovePromptRequest {
  text: string;
}

export interface ImprovePromptResponse {
  improved_text: string;
  score_before: number;
  score_after: number;
  source: 'model' | 'heuristic';
  suggestions: string[];
}

export interface SavedPrompt {
  id: Uuid;
  title: string;
  body: string;
  source: PromptSource;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface CreatePromptRequest {
  title: string;
  body: string;
  source?: PromptSource;
}

export interface UpdatePromptRequest {
  title?: string;
  body?: string;
}

// ---------------------------------------------------------------------------------------------------
// References (creator)
// ---------------------------------------------------------------------------------------------------

export interface UploadReferenceInput {
  /** jpeg / png / webp, max 8 MB. */
  file: File | Blob;
  role: ReferenceRole;
  label?: string;
  /** Required (true) for role `human_model`. */
  consent_confirmed?: boolean;
  consent_note?: string;
}

export interface Reference {
  id: Uuid;
  role: ReferenceRole;
  label: string | null;
  url: string;
  width: number;
  height: number;
  /** Set for `human_model` references (7 days). */
  expires_at: IsoDateTime | null;
  created_at: IsoDateTime;
}

export interface MyReferencesQuery extends PageParams {
  role?: ReferenceRole;
}

export interface LibraryReferencesQuery {
  role?: ReferenceRole;
  /** Template slug. */
  template?: string;
}

export interface LibraryReference {
  id: Uuid;
  role: ReferenceRole;
  label: string | null;
  url: string;
  /** `null` for curated entries without stored dimensions. */
  width: number | null;
  height: number | null;
  template_slug: string | null;
}

// ---------------------------------------------------------------------------------------------------
// Generations (creator)
// ---------------------------------------------------------------------------------------------------

export interface CreateGenerationRequest {
  /** Exactly one of `template_slug` and `template_id`. */
  template_slug?: string;
  template_id?: Uuid;
  mode?: GenerationMode;
  slot_values?: Record<string, string>;
  /** Up to 1000 characters. */
  remarks?: string;
  /** Up to 12. */
  reference_ids?: Uuid[];
  consent_confirmed?: boolean;
}

export interface CreateGenerationResponse {
  id: Uuid;
  status: 'queued';
}

export interface Generation {
  id: Uuid;
  status: GenerationStatus;
  progress_step: ProgressStep | null;
  template: { id: Uuid; slug: string; name: string } | null;
  mode: GenerationMode;
  subject: TemplateSubject;
  publication: TemplateCategory;
  slot_values: Record<string, string>;
  remarks: string | null;
  references: Array<{ id: Uuid; role: ReferenceRole }>;
  used_reference_image: boolean;
  reference_count_used: number;
  composited_text: boolean;
  degraded: boolean;
  /** Set only when `status` is `failed`. */
  error_code: string | null;
  /** Signed, expiring URL. Set only when `status` is `done`. */
  result_url: string | null;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  archived: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface MyGenerationsQuery extends PageParams {
  status?: GenerationStatus;
  archived?: boolean | 'all';
}

// ---------------------------------------------------------------------------------------------------
// Admin: users
// ---------------------------------------------------------------------------------------------------

export interface AdminUser {
  id: Uuid;
  email: string;
  name: string;
  role: Role;
  is_active: boolean;
  /** `null` uses the global default. */
  daily_limit_override: number | null;
  last_login_at: IsoDateTime | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface AdminUserDetail extends AdminUser {
  usage: Usage;
}

/** Present when fewer than two active admins remain. */
export interface AdminUsersMeta extends PageMeta {
  active_admins?: number;
  warnings?: string[];
}

export interface AdminUsersQuery extends PageParams {
  /** Name or email. */
  search?: string;
  role?: Role;
  active?: boolean;
}

export interface AdminCreateUserRequest {
  email: string;
  name: string;
  role?: Role;
  password?: string;
  daily_limit_override?: number | null;
}

export interface AdminCreateUserResponse {
  user: AdminUser;
  /** Shown once, only when no password was supplied. */
  temporary_password?: string;
}

export interface AdminUpdateUserRequest {
  name?: string;
  role?: Role;
  is_active?: boolean;
  daily_limit_override?: number | null;
}

export interface AdminResetPasswordResponse {
  user: AdminUser;
  /** Shown once. */
  temporary_password: string;
}

export interface AdminRevokeSessionsResponse {
  id: Uuid;
  revoked_sessions: number;
}

// ---------------------------------------------------------------------------------------------------
// Admin: models
// ---------------------------------------------------------------------------------------------------

export interface AdminModel {
  id: Uuid;
  name: string;
  provider: ModelProvider;
  capability: ModelCapability;
  model_id: string;
  base_url: string | null;
  /** The NAME of a server environment variable, never a key. */
  api_key_env: string | null;
  requires_api_key: boolean;
  api_key_configured: boolean;
  is_default: boolean;
  is_active: boolean;
  usable: boolean;
  priority: number;
  cost_per_call_usd: number;
  timeout_ms: number;
  last_test_at: IsoDateTime | null;
  last_test_ok: boolean | null;
  notes: string | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface AdminModelsQuery extends PageParams {
  capability?: ModelCapability;
  provider?: ModelProvider;
  active?: boolean;
}

export interface AdminCreateModelRequest {
  name: string;
  provider: ModelProvider;
  capability: ModelCapability;
  model_id: string;
  base_url?: string | null;
  /** Variable name: `^[A-Z][A-Z0-9_]*$`, one of the allowed provider variables or `PROVIDER_KEY_*`. */
  api_key_env?: string | null;
  priority?: number;
  cost_per_call_usd?: number;
  timeout_ms?: number;
  notes?: string | null;
  is_active?: boolean;
}

/** `provider` and `capability` are immutable. */
export interface AdminUpdateModelRequest {
  name?: string;
  model_id?: string;
  base_url?: string | null;
  api_key_env?: string | null;
  priority?: number;
  cost_per_call_usd?: number;
  timeout_ms?: number;
  notes?: string | null;
}

export interface AdminDeactivateModelRequest {
  /** Required when deactivating the default model. */
  new_default_id?: Uuid;
}

export interface AdminModelTestResult {
  ok: boolean;
  latency_ms: number | null;
  error_code: string | null;
  /** A fixed sanitised sentence. */
  error: string | null;
  tested_at: IsoDateTime;
  model: { id: Uuid; name: string } & Record<string, unknown>;
}

// ---------------------------------------------------------------------------------------------------
// Admin: core prompts (write-only: metadata only, no body)
// ---------------------------------------------------------------------------------------------------

export interface CorePromptMeta {
  id: Uuid;
  key: string;
  version: number;
  subject: TemplateSubject;
  publication: TemplateCategory;
  blank_count: number;
  is_active: boolean;
  /** Still the neutral stand-in the seed installs (the repository is public), not a real prompt. Never the text itself. */
  is_placeholder: boolean;
  templates_using: number;
  created_at: IsoDateTime;
  created_by: { id: Uuid; name: string } | null;
}

export interface CorePromptsQuery extends PageParams {
  key?: string;
  active?: boolean;
}

/** Write-only payload: the body is sent to the server and never read back. */
export interface CreateCorePromptRequest {
  /** For example `product.poster`. */
  key: string;
  subject: TemplateSubject;
  publication: TemplateCategory;
  /** 20 to 8000 characters. */
  body: string;
}

export interface CorePromptTestRenderRequest {
  /** Exactly one of `key` and `id`. */
  key?: string;
  id?: Uuid;
  template_slug?: string;
  slot_values?: Record<string, string>;
  remarks?: string;
}

export interface CorePromptTestRenderResponse {
  /** Always the literal `[HIDDEN_CORE_PROMPT]`. */
  masked_prompt: string;
  core_prompt: { id: Uuid; key: string; version: number; blank_count: number };
  template: { id: Uuid; slug: string; name: string } | null;
  blanks: Array<{ index: number; slot_key: string; status: 'filled' | 'empty'; source: string }>;
  filled_count: number;
  empty_count: number;
  sanitized_values: Record<string, string>;
  sanitized_remarks: string | null;
  remarks_dropped: boolean;
}

// ---------------------------------------------------------------------------------------------------
// Admin: templates, slots, text zones
// ---------------------------------------------------------------------------------------------------

export interface AdminTemplate {
  id: Uuid;
  slug: string;
  name: string;
  description: string;
  category: TemplateCategory;
  mode: TemplateMode;
  subject: TemplateSubject;
  aspect_ratio: string;
  /** Only the key name. */
  core_prompt_key: string;
  status: TemplateStatus;
  sort_order: number;
  preview_url: string | null;
  slot_count: number;
  zone_count: number;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface AdminTemplatesQuery extends PageParams {
  status?: TemplateStatus;
  category?: TemplateCategory;
  search?: string;
}

export interface AdminTemplateSlot {
  id: Uuid;
  key: string;
  label: string;
  type: SlotType;
  blank_index: number | null;
  required: boolean;
  default_value: string | null;
  options: SlotOption[] | null;
  max_length: number | null;
  vision_role: ReferenceRole | null;
  source_hint: string | null;
  sort_order: number;
}

export interface AdminTemplateTextZone {
  id: Uuid;
  slot_key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  align: TextAlign;
  font_family: string;
  font_weight: number;
  font_size_ratio: number;
  color: string;
  max_lines: number;
}

export interface TemplateReadiness {
  publishable: boolean;
  issues: Array<{ code: string; message: string }>;
}

export interface AdminTemplateDetail extends AdminTemplate {
  slots: AdminTemplateSlot[];
  text_zones: AdminTemplateTextZone[];
  readiness: TemplateReadiness;
}

export interface AdminCreateTemplateRequest {
  slug: string;
  name: string;
  description?: string;
  category: TemplateCategory;
  mode: TemplateMode;
  subject: TemplateSubject;
  /** Default `4:5`. */
  aspect_ratio?: string;
  core_prompt_key: string;
  sort_order?: number;
}

export type AdminUpdateTemplateRequest = Partial<AdminCreateTemplateRequest>;

export interface AdminCreateSlotRequest {
  key: string;
  label: string;
  type?: SlotType;
  blank_index?: number | null;
  required?: boolean;
  default_value?: string | null;
  /** Required for `select`. */
  options?: SlotOption[] | null;
  max_length?: number | null;
  vision_role?: ReferenceRole | null;
  source_hint?: string | null;
  sort_order?: number;
}

export type AdminUpdateSlotRequest = Partial<AdminCreateSlotRequest>;

export interface AdminCreateTextZoneRequest {
  slot_key: string;
  /** Fractions: `x + w <= 1`, `y + h <= 1`. */
  x: number;
  y: number;
  w: number;
  h: number;
  align?: TextAlign;
  font_family?: string;
  font_weight?: number;
  font_size_ratio?: number;
  color?: string;
  max_lines?: number;
}

export type AdminUpdateTextZoneRequest = Partial<AdminCreateTextZoneRequest>;

// ---------------------------------------------------------------------------------------------------
// Admin: reference library
// ---------------------------------------------------------------------------------------------------

export interface AdminReference {
  id: Uuid;
  role: ReferenceRole;
  label: string | null;
  consent_note: string | null;
  template: { id: Uuid; slug: string; name: string } | null;
  url: string;
  width: number | null;
  height: number | null;
  bytes: number;
  created_at: IsoDateTime;
}

export interface AdminReferencesQuery extends PageParams {
  role?: ReferenceRole;
  /** Template slug. */
  template?: string;
  /** Label. */
  search?: string;
}

export interface AdminUploadReferenceInput {
  file: File | Blob;
  role: ReferenceRole;
  label?: string;
  /** Required (non-empty) for `human_model`. */
  consent_note?: string;
  template_id?: Uuid;
  template_slug?: string;
}

export interface AdminUpdateReferenceRequest {
  role?: ReferenceRole;
  label?: string | null;
  consent_note?: string | null;
  template_id?: Uuid | null;
}

// ---------------------------------------------------------------------------------------------------
// Admin: settings, brand identity, content policy
// ---------------------------------------------------------------------------------------------------

export interface AppSettings {
  language: 'id' | 'en';
  default_daily_limit: number;
  watermark_enabled: boolean;
  max_references: number;
}

export interface AdminSettingsResponse {
  settings: AppSettings;
  /** Describes each key (shape not part of the contract). */
  schema: unknown;
  updated_at: IsoDateTime | null;
}

export type AdminUpdateSettingsRequest = Partial<AppSettings>;
// `PATCH /admin/settings` answers with the same object as `GET /admin/settings` (AdminSettingsResponse).

export interface BrandIdentity {
  id: Uuid;
  name: string;
  /** `#rrggbb` colours. */
  palette: string[];
  font_family: string;
  disclaimer: string | null;
  logo_url: string | null;
  updated_at: IsoDateTime;
}

export interface AdminUpdateBrandIdentityRequest {
  name?: string;
  /** At most 12 colours. */
  palette?: string[];
  font_family?: string;
  disclaimer?: string | null;
}

export interface PolicyDisclaimers {
  poster?: string | null;
  psa?: string | null;
  social_post?: string | null;
  product_shot?: string | null;
  human_model?: string | null;
}

export interface ContentPolicy {
  id: Uuid;
  name: string;
  blocked_terms: string[];
  moderation_level: ModerationLevel;
  disclaimers: Record<string, string>;
  updated_at: IsoDateTime;
}

export interface AdminUpdatePolicyRequest {
  /** At most 1000; the server normalises them. */
  blocked_terms?: string[];
  moderation_level?: ModerationLevel;
  /** `null` or empty removes a category's disclaimer, except `psa`. */
  disclaimers?: PolicyDisclaimers;
}

// ---------------------------------------------------------------------------------------------------
// Admin: generations log
// ---------------------------------------------------------------------------------------------------

export interface AdminGenerationFilters {
  status?: GenerationStatus;
  /** User id. */
  user?: Uuid;
  /** Template id. */
  template?: Uuid;
  /** Model id (vision or image). */
  model?: Uuid;
  mode?: GenerationMode;
  from?: DateString;
  to?: DateString;
  degraded?: boolean;
  flagged?: boolean;
}

export interface AdminGenerationsQuery extends AdminGenerationFilters, PageParams {}

export interface AdminGeneration {
  id: Uuid;
  status: GenerationStatus;
  progress_step: ProgressStep | null;
  user: { id: Uuid; name: string; email: string } | null;
  template: { id: Uuid; slug: string; name: string } | null;
  mode: GenerationMode;
  subject: TemplateSubject;
  publication: TemplateCategory;
  used_reference_image: boolean;
  reference_count_used: number;
  composited_text: boolean;
  degraded: boolean;
  error_code: string | null;
  total_cost_usd: number;
  duration_ms: number | null;
  models: { vision: { id: Uuid; name: string } | null; image: { id: Uuid; name: string } | null };
  flagged: boolean;
  created_at: IsoDateTime;
}

export type GenerationStage = 'analysis' | 'compose' | 'generate' | 'composite';

export interface AdminGenerationTimelineEntry {
  stage: GenerationStage;
  status: 'started' | 'ok' | 'degraded' | 'failed';
  duration_ms: number | null;
  cost_usd: number | null;
  model: { id: Uuid; name: string } | null;
  error_code: string | null;
  /** Sanitised. */
  error_message: string | null;
  at: IsoDateTime;
}

export interface AdminGenerationDetail extends AdminGeneration {
  consent_confirmed: boolean;
  reference_roles: ReferenceRole[];
  flag_note: string | null;
  flagged_at: IsoDateTime | null;
  archived: boolean;
  purged: boolean;
  deleted_by_user: boolean;
  result_url: string | null;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
  updated_at: IsoDateTime;
  timeline: AdminGenerationTimelineEntry[];
}

export interface AdminFlagGenerationRequest {
  flagged: boolean;
  /** Up to 500 characters. */
  note?: string;
}

// ---------------------------------------------------------------------------------------------------
// Admin: gallery curation
// ---------------------------------------------------------------------------------------------------

export interface AdminGalleryItem {
  id: Uuid;
  title: string;
  display_prompt: string;
  image_url: string;
  is_featured: boolean;
  is_hidden: boolean;
  sort_order: number;
  generation_id: Uuid | null;
  template: { id: Uuid; slug: string; name: string } | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface AdminGalleryQuery extends PageParams {
  hidden?: boolean;
  featured?: boolean;
  /** Template slug. */
  template?: string;
  /** Title. */
  search?: string;
}

/** Curate an existing finished generation. */
export interface AdminCreateGalleryFromGenerationRequest {
  generation_id: Uuid;
  title: string;
  is_featured?: boolean;
  is_hidden?: boolean;
  sort_order?: number;
}

/** Upload an image straight into the gallery (multipart). */
export interface AdminCreateGalleryFromUploadInput {
  file: File | Blob;
  template_id?: Uuid;
  template_slug?: string;
  title: string;
  /** Sent as a JSON string. */
  slot_values: Record<string, string>;
  remarks?: string;
  is_featured?: boolean;
  is_hidden?: boolean;
  sort_order?: number;
}

export interface AdminUpdateGalleryRequest {
  title?: string;
  display_prompt?: string;
  is_featured?: boolean;
  is_hidden?: boolean;
  sort_order?: number;
}

// ---------------------------------------------------------------------------------------------------
// Admin: dashboard and audit
// ---------------------------------------------------------------------------------------------------

export interface AdminDashboard {
  window: { days: number; timezone: string };
  totals: {
    generations: number;
    done: number;
    failed: number;
    in_progress: number;
    /** `done / (done + failed)`, `null` when there is nothing to divide. */
    success_rate: number | null;
    total_cost_usd: number;
    avg_cost_usd: number;
    avg_duration_ms: number | null;
    used_reference_image_rate: number | null;
    degraded_rate: number | null;
    active_users: number;
  };
  failures_by_error_code: Array<{ error_code: string; count: number }>;
  /** One entry per day, zero filled. */
  daily: Array<{
    date: DateString;
    generations: number;
    done: number;
    failed: number;
    success_rate: number | null;
    cost_usd: number;
    avg_duration_ms: number | null;
    active_users: number;
  }>;
  models: Array<{
    capability: ModelCapability;
    active_count: number;
    default: {
      id: Uuid;
      name: string;
      provider: ModelProvider;
      model_id: string;
      last_test_at: IsoDateTime | null;
      last_test_ok: boolean | null;
    } | null;
  }>;
  counts: {
    published_templates: number;
    published_tutorials: number;
    active_admins: number;
    active_creators: number;
  };
  core_prompts: {
    active_count: number;
    /** Keys whose active prompt is still a stand-in: production refuses to generate from these. */
    placeholder_active_keys: string[];
  };
}

export interface AdminDashboardQuery {
  /** 1 to 90, default 30. */
  days?: number;
}

export interface AdminAuditQuery extends PageParams {
  actor?: Uuid;
  action?: string;
  entity?: string;
  entity_id?: string;
  from?: DateString;
  to?: DateString;
}

export interface AuditEntry {
  id: Uuid;
  actor: { id: Uuid; name: string; email: string } | null;
  action: string;
  entity: string;
  entity_id: string | null;
  /** Changed field names with `{ from, to }` values; never secrets. */
  diff: Record<string, unknown> | null;
  ip: string | null;
  created_at: IsoDateTime;
}

export interface AdminPingResponse {
  pong: true;
  actor_id: Uuid;
}
