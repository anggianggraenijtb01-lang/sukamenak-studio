/**
 * Public and creator endpoints (backend/docs/API.md section 2).
 * One typed function per endpoint. Every function takes an optional AbortSignal where it is a read, so it can be
 * passed straight from a React Query `queryFn({ signal })`.
 */
import { apiClient, saveBlob } from './client';
import type {
  AnalyzePromptRequest,
  CreateGenerationRequest,
  CreateGenerationResponse,
  CreatePromptRequest,
  DeleteMeResponse,
  DeletedResponse,
  GalleryItem,
  GalleryListQuery,
  Generation,
  HealthResponse,
  ImprovePromptRequest,
  ImprovePromptResponse,
  LibraryReference,
  LibraryReferencesQuery,
  MeResponse,
  MyDataExport,
  MyGenerationsQuery,
  MyReferencesQuery,
  Page,
  PromptAnalysis,
  PromptDeletedResponse,
  Reference,
  SavedPrompt,
  Session,
  TemplateDetail,
  TemplateListItem,
  TemplateListQuery,
  TutorialDetail,
  TutorialListItem,
  TutorialListQuery,
  UpdateMeRequest,
  UpdateMeResponse,
  UpdatePromptRequest,
  UploadReferenceInput,
  PageParams,
  VersionResponse,
} from './types';

// ---- system ---------------------------------------------------------------------------------------------

export const getHealth = (signal?: AbortSignal) => apiClient.request<HealthResponse>('/health', { auth: false, signal });
export const getVersion = (signal?: AbortSignal) => apiClient.request<VersionResponse>('/meta/version', { auth: false, signal });

// ---- profile (/me) --------------------------------------------------------------------------------------

/** `GET /me`: the user plus today's usage (`usage.remaining_today` is the real remaining daily limit). */
export const getMe = (signal?: AbortSignal) => apiClient.get<MeResponse>('/me', undefined, signal);

/**
 * `PATCH /me`. When the password changed the server answers with a fresh `session` (every other session is
 * revoked): it is applied to the client automatically, so the caller does not have to do anything.
 */
export async function updateMe(body: UpdateMeRequest): Promise<UpdateMeResponse> {
  const res = await apiClient.patch<UpdateMeResponse>('/me', body);
  if (res.session) apiClient.setSession(res.session as Session);
  return res;
}

/** `GET /me/export`: everything stored about the user (UU PDP). */
export const getMyDataExport = (signal?: AbortSignal) => apiClient.get<MyDataExport>('/me/export', undefined, signal);

/** Fetches the export and saves it as `sukamenak-data-saya.json`. */
export async function downloadMyData(): Promise<void> {
  const data = await getMyDataExport();
  saveBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'sukamenak-data-saya.json');
}

/** `DELETE /me`: anonymises the account. Admins get `FORBIDDEN`. Clears the local session on success. */
export async function deleteMe(password: string): Promise<DeleteMeResponse> {
  const res = await apiClient.del<DeleteMeResponse>('/me', { password });
  apiClient.clearSession();
  return res;
}

// ---- templates (public) ---------------------------------------------------------------------------------

/** Published templates only. Public: works without a session. */
export const listTemplates = (query?: TemplateListQuery, signal?: AbortSignal) =>
  apiClient.request<TemplateListItem[]>('/templates', { query, signal, auth: false });

/** Template with its slots, text zones, example references and disclaimer (no prompt fields). */
export const getTemplate = (slug: string, signal?: AbortSignal) =>
  apiClient.request<TemplateDetail>(`/templates/${encodeURIComponent(slug)}`, { signal, auth: false });

// ---- gallery (public) -----------------------------------------------------------------------------------

export const listGallery = (query?: GalleryListQuery, signal?: AbortSignal): Promise<Page<GalleryItem>> =>
  apiClient.requestPage<GalleryItem>('/gallery', { query, signal, auth: false });

// ---- tutorials (public) ---------------------------------------------------------------------------------

export const listTutorials = (query?: TutorialListQuery, signal?: AbortSignal) =>
  apiClient.request<TutorialListItem[]>('/tutorials', { query, signal, auth: false });

export const getTutorial = (slug: string, signal?: AbortSignal) =>
  apiClient.request<TutorialDetail>(`/tutorials/${encodeURIComponent(slug)}`, { signal, auth: false });

// ---- prompt tools and saved prompts ---------------------------------------------------------------------

/** `POST /prompts/analyze`: deterministic score and suggestions. */
export const analyzePrompt = (body: AnalyzePromptRequest, signal?: AbortSignal) =>
  apiClient.post<PromptAnalysis>('/prompts/analyze', body, signal);

/** `POST /prompts/improve`: rate limited (10/min). Blocked terms answer `CONTENT_POLICY_VIOLATION`. */
export const improvePrompt = (body: ImprovePromptRequest, signal?: AbortSignal) =>
  apiClient.post<ImprovePromptResponse>('/prompts/improve', body, signal);

export const listPrompts = (query?: PageParams, signal?: AbortSignal): Promise<Page<SavedPrompt>> =>
  apiClient.getPage<SavedPrompt>('/prompts', query, signal);

/** Max 200 saved prompts per user. */
export const createPrompt = (body: CreatePromptRequest) => apiClient.post<SavedPrompt>('/prompts', body);
export const getPrompt = (id: string, signal?: AbortSignal) => apiClient.get<SavedPrompt>(`/prompts/${id}`, undefined, signal);
export const updatePrompt = (id: string, body: UpdatePromptRequest) => apiClient.patch<SavedPrompt>(`/prompts/${id}`, body);
export const deletePrompt = (id: string) => apiClient.del<PromptDeletedResponse>(`/prompts/${id}`);

// ---- references -----------------------------------------------------------------------------------------

/**
 * `POST /references` (multipart). `human_model` needs `consent_confirmed: true`.
 * Errors: `CONSENT_REQUIRED`, `TOO_MANY_REFERENCES`, `VALIDATION_ERROR`, `RATE_LIMIT_EXCEEDED`.
 */
export function uploadReference(input: UploadReferenceInput, signal?: AbortSignal): Promise<Reference> {
  const form = new FormData();
  form.append('role', input.role);
  if (input.label) form.append('label', input.label);
  if (input.consent_confirmed !== undefined) form.append('consent_confirmed', String(input.consent_confirmed));
  if (input.consent_note) form.append('consent_note', input.consent_note);
  // The file goes last so the text fields are available to the server before it reads the upload.
  form.append('file', input.file);
  return apiClient.upload<Reference>('/references', form, { signal });
}

export const listMyReferences = (query?: MyReferencesQuery, signal?: AbortSignal): Promise<Page<Reference>> =>
  apiClient.getPage<Reference>('/references/mine', query, signal);

/** Admin curated references any creator may reuse. */
export const listLibraryReferences = (query?: LibraryReferencesQuery, signal?: AbortSignal) =>
  apiClient.get<LibraryReference[]>('/references/library', query, signal);

export const deleteReference = (id: string) => apiClient.del<DeletedResponse>(`/references/${id}`);

// ---- generations ----------------------------------------------------------------------------------------

/**
 * `POST /generations` answers 202 `{ id, status: 'queued' }`. Poll with `useGenerationPolling(id)` (or
 * `getGeneration`) until `status` is `done` or `failed`.
 * Errors: `VALIDATION_ERROR`, `CONTENT_POLICY_VIOLATION`, `DAILY_LIMIT_REACHED`, `TOO_MANY_REFERENCES`,
 * `CONSENT_REQUIRED`, `RATE_LIMIT_EXCEEDED`, `NOT_FOUND`.
 */
export const createGeneration = (body: CreateGenerationRequest, signal?: AbortSignal) =>
  apiClient.post<CreateGenerationResponse>('/generations', body, signal);

export const getGeneration = (id: string, signal?: AbortSignal) => apiClient.get<Generation>(`/generations/${id}`, undefined, signal);

export const listGenerations = (query?: MyGenerationsQuery, signal?: AbortSignal): Promise<Page<Generation>> =>
  apiClient.getPage<Generation>('/generations', query, signal);

export const archiveGeneration = (id: string) => apiClient.post<Generation>(`/generations/${id}/archive`);

/** Soft delete: removes the files and hides gallery entries made from it. */
export const deleteGeneration = (id: string) => apiClient.del<DeletedResponse>(`/generations/${id}`);
