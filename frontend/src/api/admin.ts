/**
 * Admin endpoints (backend/docs/API.md section 3), all under `/admin`. Every function name starts with `admin`.
 *
 * Reminders that shape the UI:
 *  - Core prompts are WRITE-ONLY. `adminCreateCorePrompt` sends a body; nothing ever returns it. Do not build UI that
 *    shows one. `adminTestRenderCorePrompt` answers with a mask.
 *  - Models store the NAME of an environment variable (`api_key_env`), never a key.
 *  - Temporary passwords (`adminCreateUser`, `adminResetUserPassword`) are returned once: show them and drop them.
 *  - A creator calling any of these gets `403 FORBIDDEN`.
 */
import { apiClient } from './client';
import type {
  AdminAuditQuery,
  AdminCreateGalleryFromGenerationRequest,
  AdminCreateGalleryFromUploadInput,
  AdminCreateModelRequest,
  AdminCreateSlotRequest,
  AdminCreateTemplateRequest,
  AdminCreateTextZoneRequest,
  AdminCreateUserRequest,
  AdminCreateUserResponse,
  AdminDashboard,
  AdminDashboardQuery,
  AdminDeactivateModelRequest,
  AdminFlagGenerationRequest,
  AdminGalleryItem,
  AdminGalleryQuery,
  AdminGeneration,
  AdminGenerationDetail,
  AdminGenerationFilters,
  AdminGenerationsQuery,
  AdminModel,
  AdminModelsQuery,
  AdminModelTestResult,
  AdminPingResponse,
  AdminReference,
  AdminReferencesQuery,
  AdminResetPasswordResponse,
  AdminRevokeSessionsResponse,
  AdminSettingsResponse,
  AdminTemplate,
  AdminTemplateDetail,
  AdminTemplateSlot,
  AdminTemplatesQuery,
  AdminTemplateTextZone,
  AdminUpdateBrandIdentityRequest,
  AdminUpdateGalleryRequest,
  AdminUpdateModelRequest,
  AdminUpdatePolicyRequest,
  AdminUpdateReferenceRequest,
  AdminUpdateSettingsRequest,
  AdminUpdateSlotRequest,
  AdminUpdateTemplateRequest,
  AdminUpdateTextZoneRequest,
  AdminUpdateUserRequest,
  AdminUploadReferenceInput,
  AdminUser,
  AdminUserDetail,
  AdminUsersMeta,
  AdminUsersQuery,
  AuditEntry,
  BrandIdentity,
  ContentPolicy,
  CorePromptMeta,
  CorePromptsQuery,
  CorePromptTestRenderRequest,
  CorePromptTestRenderResponse,
  DeletedResponse,
  CreateCorePromptRequest,
  Page,
} from './types';

const A = '/admin';

export const adminPing = (signal?: AbortSignal) => apiClient.get<AdminPingResponse>(`${A}/ping`, undefined, signal);

// ---- users ----------------------------------------------------------------------------------------------

/** `meta.warnings` / `meta.active_admins` appear when fewer than two active admins remain. */
export const adminListUsers = (query?: AdminUsersQuery, signal?: AbortSignal): Promise<Page<AdminUser, AdminUsersMeta>> =>
  apiClient.getPage<AdminUser, AdminUsersMeta>(`${A}/users`, query, signal);

/** Without `password` the server generates a temporary one and returns it once. */
export const adminCreateUser = (body: AdminCreateUserRequest) => apiClient.post<AdminCreateUserResponse>(`${A}/users`, body);
export const adminGetUser = (id: string, signal?: AbortSignal) => apiClient.get<AdminUserDetail>(`${A}/users/${id}`, undefined, signal);
/** Errors: `CANNOT_MODIFY_SELF`, `LAST_ADMIN`. */
export const adminUpdateUser = (id: string, body: AdminUpdateUserRequest) => apiClient.patch<AdminUser>(`${A}/users/${id}`, body);
/** Not allowed on yourself (`CANNOT_MODIFY_SELF`). Revokes all sessions of that user. */
export const adminResetUserPassword = (id: string) => apiClient.post<AdminResetPasswordResponse>(`${A}/users/${id}/reset-password`);
export const adminRevokeUserSessions = (id: string) => apiClient.post<AdminRevokeSessionsResponse>(`${A}/users/${id}/revoke-sessions`);
/** Soft delete + anonymisation. Errors: `CANNOT_MODIFY_SELF`, `LAST_ADMIN`. */
export const adminDeleteUser = (id: string) => apiClient.del<DeletedResponse>(`${A}/users/${id}`);

// ---- models ---------------------------------------------------------------------------------------------

export const adminListModels = (query?: AdminModelsQuery, signal?: AbortSignal): Promise<Page<AdminModel>> =>
  apiClient.getPage<AdminModel>(`${A}/models`, query, signal);
export const adminCreateModel = (body: AdminCreateModelRequest) => apiClient.post<AdminModel>(`${A}/models`, body);
export const adminGetModel = (id: string, signal?: AbortSignal) => apiClient.get<AdminModel>(`${A}/models/${id}`, undefined, signal);
/** `provider` and `capability` are immutable. */
export const adminUpdateModel = (id: string, body: AdminUpdateModelRequest) => apiClient.patch<AdminModel>(`${A}/models/${id}`, body);
/** The default model cannot be deleted (`409 NO_MODEL_AVAILABLE`). */
export const adminDeleteModel = (id: string) => apiClient.del<DeletedResponse>(`${A}/models/${id}`);
/** The target must be active. Takes effect on the next generation. */
export const adminSetDefaultModel = (id: string) => apiClient.post<AdminModel>(`${A}/models/${id}/set-default`);
export const adminActivateModel = (id: string) => apiClient.post<AdminModel>(`${A}/models/${id}/activate`);
/** Deactivating the default needs `new_default_id`. */
export const adminDeactivateModel = (id: string, body?: AdminDeactivateModelRequest) =>
  apiClient.post<AdminModel>(`${A}/models/${id}/deactivate`, body ?? {});
/** One tiny real provider call (may bill a very small amount). Rate limited (10/min). */
export const adminTestModel = (id: string) => apiClient.post<AdminModelTestResult>(`${A}/models/${id}/test`);

// ---- core prompts (write-only) --------------------------------------------------------------------------

export const adminListCorePrompts = (query?: CorePromptsQuery, signal?: AbortSignal): Promise<Page<CorePromptMeta>> =>
  apiClient.getPage<CorePromptMeta>(`${A}/core-prompts`, query, signal);
/** All versions of a key, newest first. */
export const adminListCorePromptVersions = (key: string, signal?: AbortSignal) =>
  apiClient.get<CorePromptMeta[]>(`${A}/core-prompts/versions`, { key }, signal);
export const adminGetCorePrompt = (id: string, signal?: AbortSignal) =>
  apiClient.get<CorePromptMeta>(`${A}/core-prompts/${id}`, undefined, signal);
/**
 * Creates a new (inactive) version. The body is sent once and never read back; keep it in component state only
 * until the request is sent. Errors never echo the text: `VALIDATION_ERROR`, `UNKNOWN_PLACEHOLDER`.
 */
export const adminCreateCorePrompt = (body: CreateCorePromptRequest) => apiClient.post<CorePromptMeta>(`${A}/core-prompts`, body);
/** Errors: `BLANK_SLOT_MISMATCH` when a published template would no longer match. Idempotent. */
export const adminActivateCorePrompt = (id: string) => apiClient.post<CorePromptMeta>(`${A}/core-prompts/${id}/activate`);
/** Dry run: answers with `[HIDDEN_CORE_PROMPT]` and per-blank status. Rate limited (10/min). */
export const adminTestRenderCorePrompt = (body: CorePromptTestRenderRequest) =>
  apiClient.post<CorePromptTestRenderResponse>(`${A}/core-prompts/test-render`, body);

// ---- templates, slots, text zones -----------------------------------------------------------------------

export const adminListTemplates = (query?: AdminTemplatesQuery, signal?: AbortSignal): Promise<Page<AdminTemplate>> =>
  apiClient.getPage<AdminTemplate>(`${A}/templates`, query, signal);
export const adminCreateTemplate = (body: AdminCreateTemplateRequest) => apiClient.post<AdminTemplateDetail>(`${A}/templates`, body);
export const adminGetTemplate = (id: string, signal?: AbortSignal) =>
  apiClient.get<AdminTemplateDetail>(`${A}/templates/${id}`, undefined, signal);
/** A published template is re-validated on save; a failing edit is rolled back with the publish error code. */
export const adminUpdateTemplate = (id: string, body: AdminUpdateTemplateRequest) =>
  apiClient.patch<AdminTemplateDetail>(`${A}/templates/${id}`, body);
/** Only unpublished templates. */
export const adminDeleteTemplate = (id: string) => apiClient.del<DeletedResponse>(`${A}/templates/${id}`);
/** Errors: `CORE_PROMPT_REQUIRED`, `BLANK_SLOT_MISMATCH`, `CONTENT_POLICY_VIOLATION` (psa disclaimer), `VALIDATION_ERROR`. */
export const adminPublishTemplate = (id: string) => apiClient.post<AdminTemplateDetail>(`${A}/templates/${id}/publish`);
export const adminUnpublishTemplate = (id: string) => apiClient.post<AdminTemplateDetail>(`${A}/templates/${id}/unpublish`);
export const adminArchiveTemplate = (id: string) => apiClient.post<AdminTemplateDetail>(`${A}/templates/${id}/archive`);

/** Replaces the preview image (multipart field `file`). */
export function adminUploadTemplatePreview(id: string, file: File | Blob, signal?: AbortSignal): Promise<AdminTemplateDetail> {
  const form = new FormData();
  form.append('file', file);
  return apiClient.upload<AdminTemplateDetail>(`${A}/templates/${id}/preview`, form, { signal });
}

export const adminCreateSlot = (templateId: string, body: AdminCreateSlotRequest) =>
  apiClient.post<AdminTemplateSlot>(`${A}/templates/${templateId}/slots`, body);
export const adminUpdateSlot = (templateId: string, slotId: string, body: AdminUpdateSlotRequest) =>
  apiClient.patch<AdminTemplateSlot>(`${A}/templates/${templateId}/slots/${slotId}`, body);
/** Deleting a slot deletes its text zone. */
export const adminDeleteSlot = (templateId: string, slotId: string) =>
  apiClient.del<DeletedResponse>(`${A}/templates/${templateId}/slots/${slotId}`);

export const adminCreateTextZone = (templateId: string, body: AdminCreateTextZoneRequest) =>
  apiClient.post<AdminTemplateTextZone>(`${A}/templates/${templateId}/text-zones`, body);
export const adminUpdateTextZone = (templateId: string, zoneId: string, body: AdminUpdateTextZoneRequest) =>
  apiClient.patch<AdminTemplateTextZone>(`${A}/templates/${templateId}/text-zones/${zoneId}`, body);
export const adminDeleteTextZone = (templateId: string, zoneId: string) =>
  apiClient.del<DeletedResponse>(`${A}/templates/${templateId}/text-zones/${zoneId}`);

// ---- reference library ----------------------------------------------------------------------------------

export const adminListReferences = (query?: AdminReferencesQuery, signal?: AbortSignal): Promise<Page<AdminReference>> =>
  apiClient.getPage<AdminReference>(`${A}/references`, query, signal);

/** `human_model` requires a non-empty `consent_note` (`CONSENT_REQUIRED`). */
export function adminUploadReference(input: AdminUploadReferenceInput, signal?: AbortSignal): Promise<AdminReference> {
  const form = new FormData();
  form.append('role', input.role);
  if (input.label) form.append('label', input.label);
  if (input.consent_note) form.append('consent_note', input.consent_note);
  if (input.template_id) form.append('template_id', input.template_id);
  if (input.template_slug) form.append('template_slug', input.template_slug);
  form.append('file', input.file);
  return apiClient.upload<AdminReference>(`${A}/references`, form, { signal });
}

export const adminGetReference = (id: string, signal?: AbortSignal) =>
  apiClient.get<AdminReference>(`${A}/references/${id}`, undefined, signal);
export const adminUpdateReference = (id: string, body: AdminUpdateReferenceRequest) =>
  apiClient.patch<AdminReference>(`${A}/references/${id}`, body);
export const adminDeleteReference = (id: string) => apiClient.del<DeletedResponse>(`${A}/references/${id}`);

// ---- settings, brand identity, content policy -----------------------------------------------------------

export const adminGetSettings = (signal?: AbortSignal) => apiClient.get<AdminSettingsResponse>(`${A}/settings`, undefined, signal);
/** Unknown keys are rejected. Applies on the next request. */
export const adminUpdateSettings = (body: AdminUpdateSettingsRequest) =>
  apiClient.patch<AdminSettingsResponse>(`${A}/settings`, body);

export const adminGetBrandIdentity = (signal?: AbortSignal) => apiClient.get<BrandIdentity>(`${A}/brand-identity`, undefined, signal);
export const adminUpdateBrandIdentity = (body: AdminUpdateBrandIdentityRequest) =>
  apiClient.patch<BrandIdentity>(`${A}/brand-identity`, body);
/** Replaces the logo (multipart field `file`). */
export function adminUploadBrandLogo(file: File | Blob, signal?: AbortSignal): Promise<BrandIdentity> {
  const form = new FormData();
  form.append('file', file);
  return apiClient.upload<BrandIdentity>(`${A}/brand-identity/logo`, form, { signal });
}

export const adminGetPolicy = (signal?: AbortSignal) => apiClient.get<ContentPolicy>(`${A}/policy`, undefined, signal);
/** The `psa` disclaimer can never be empty. Takes effect on the next generation request. */
export const adminUpdatePolicy = (body: AdminUpdatePolicyRequest) => apiClient.patch<ContentPolicy>(`${A}/policy`, body);

// ---- generations log ------------------------------------------------------------------------------------

/** Newest first. No prompt, slot values or remarks are ever included. */
export const adminListGenerations = (query?: AdminGenerationsQuery, signal?: AbortSignal): Promise<Page<AdminGeneration>> =>
  apiClient.getPage<AdminGeneration>(`${A}/generations`, query, signal);
export const adminGetGeneration = (id: string, signal?: AbortSignal) =>
  apiClient.get<AdminGenerationDetail>(`${A}/generations/${id}`, undefined, signal);
export const adminFlagGeneration = (id: string, body: AdminFlagGenerationRequest) =>
  apiClient.post<AdminGenerationDetail>(`${A}/generations/${id}/flag`, body);

/**
 * URL of the CSV export for the given filters (absolute). NOTE: the endpoint needs the Bearer header, so this URL
 * cannot be used as a plain `<a href>`: use `adminDownloadGenerationsCsv`, which fetches with the token.
 */
export const adminGenerationsCsvUrl = (filters?: AdminGenerationFilters) => apiClient.absoluteUrl(`${A}/generations/export.csv`, filters);

/** Authenticated download of the CSV export (capped at 100 000 rows by the server). */
export const adminDownloadGenerationsCsv = (filters?: AdminGenerationFilters, signal?: AbortSignal) =>
  apiClient.download(`${A}/generations/export.csv`, { query: filters, filename: 'generations.csv', signal });

// ---- gallery curation -----------------------------------------------------------------------------------

/** Includes hidden items. */
export const adminListGallery = (query?: AdminGalleryQuery, signal?: AbortSignal): Promise<Page<AdminGalleryItem>> =>
  apiClient.getPage<AdminGalleryItem>(`${A}/gallery`, query, signal);

/** From a finished generation (`done`, not purged). `display_prompt` is built by the server. */
export const adminCreateGalleryFromGeneration = (body: AdminCreateGalleryFromGenerationRequest) =>
  apiClient.post<AdminGalleryItem>(`${A}/gallery`, body);

/** From an uploaded image plus a template (multipart). */
export function adminCreateGalleryFromUpload(input: AdminCreateGalleryFromUploadInput, signal?: AbortSignal): Promise<AdminGalleryItem> {
  const form = new FormData();
  if (input.template_id) form.append('template_id', input.template_id);
  if (input.template_slug) form.append('template_slug', input.template_slug);
  form.append('title', input.title);
  form.append('slot_values', JSON.stringify(input.slot_values));
  if (input.remarks) form.append('remarks', input.remarks);
  if (input.is_featured !== undefined) form.append('is_featured', String(input.is_featured));
  if (input.is_hidden !== undefined) form.append('is_hidden', String(input.is_hidden));
  if (input.sort_order !== undefined) form.append('sort_order', String(input.sort_order));
  form.append('file', input.file);
  return apiClient.upload<AdminGalleryItem>(`${A}/gallery`, form, { signal });
}

/** `title` and `display_prompt` are re-validated (no placeholders, no core prompt text, no blocked terms). */
export const adminUpdateGalleryItem = (id: string, body: AdminUpdateGalleryRequest) =>
  apiClient.patch<AdminGalleryItem>(`${A}/gallery/${id}`, body);
export const adminDeleteGalleryItem = (id: string) => apiClient.del<DeletedResponse>(`${A}/gallery/${id}`);

// ---- dashboard and audit --------------------------------------------------------------------------------

export const adminGetDashboard = (query?: AdminDashboardQuery, signal?: AbortSignal) =>
  apiClient.get<AdminDashboard>(`${A}/dashboard`, query, signal);

/** Read only, newest first. */
export const adminListAudit = (query?: AdminAuditQuery, signal?: AbortSignal): Promise<Page<AuditEntry>> =>
  apiClient.getPage<AuditEntry>(`${A}/audit`, query, signal);
