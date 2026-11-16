/**
 * Query-key factory. Every React Query `useQuery` / `invalidateQueries` in the app MUST build its key here so the
 * creator and admin pages invalidate consistently.
 *
 * Shape: `[domain, ...]`. `xxx.all` is the prefix of a whole family: invalidating it refreshes every list and detail
 * below it. Lists carry their filters as the last element so each combination is cached on its own.
 *
 *   queryClient.invalidateQueries({ queryKey: queryKeys.generations.all })   // every generation list + detail
 *   queryClient.invalidateQueries({ queryKey: queryKeys.admin.users.lists() }) // admin user lists only
 */
import type {
  AdminAuditQuery,
  AdminDashboardQuery,
  AdminGalleryQuery,
  AdminGenerationsQuery,
  AdminModelsQuery,
  AdminReferencesQuery,
  AdminTemplatesQuery,
  AdminUsersQuery,
  CorePromptsQuery,
  GalleryListQuery,
  LibraryReferencesQuery,
  MyGenerationsQuery,
  MyReferencesQuery,
  PageParams,
  TemplateListQuery,
  TutorialListQuery,
} from './types';

const orEmpty = <T extends object>(q: T | undefined) => q ?? ({} as T);

export const queryKeys = {
  // ---- creator / public --------------------------------------------------------------------------------
  /** `GET /me`: user + today's usage. Invalidate after a generation finishes or the profile changes. */
  me: ['me'] as const,

  templates: {
    all: ['templates'] as const,
    lists: () => ['templates', 'list'] as const,
    list: (query?: TemplateListQuery) => ['templates', 'list', orEmpty(query)] as const,
    detail: (slug: string) => ['templates', 'detail', slug] as const,
  },

  gallery: {
    all: ['gallery'] as const,
    list: (query?: GalleryListQuery) => ['gallery', 'list', orEmpty(query)] as const,
  },

  tutorials: {
    all: ['tutorials'] as const,
    list: (query?: TutorialListQuery) => ['tutorials', 'list', orEmpty(query)] as const,
    detail: (slug: string) => ['tutorials', 'detail', slug] as const,
  },

  prompts: {
    all: ['prompts'] as const,
    list: (query?: PageParams) => ['prompts', 'list', orEmpty(query)] as const,
    detail: (id: string) => ['prompts', 'detail', id] as const,
  },

  references: {
    all: ['references'] as const,
    mine: (query?: MyReferencesQuery) => ['references', 'mine', orEmpty(query)] as const,
    library: (query?: LibraryReferencesQuery) => ['references', 'library', orEmpty(query)] as const,
  },

  generations: {
    all: ['generations'] as const,
    lists: () => ['generations', 'list'] as const,
    list: (query?: MyGenerationsQuery) => ['generations', 'list', orEmpty(query)] as const,
    detail: (id: string) => ['generations', 'detail', id] as const,
  },

  // ---- admin -------------------------------------------------------------------------------------------
  admin: {
    all: ['admin'] as const,

    users: {
      all: ['admin', 'users'] as const,
      lists: () => ['admin', 'users', 'list'] as const,
      list: (query?: AdminUsersQuery) => ['admin', 'users', 'list', orEmpty(query)] as const,
      detail: (id: string) => ['admin', 'users', 'detail', id] as const,
    },

    models: {
      all: ['admin', 'models'] as const,
      lists: () => ['admin', 'models', 'list'] as const,
      list: (query?: AdminModelsQuery) => ['admin', 'models', 'list', orEmpty(query)] as const,
      detail: (id: string) => ['admin', 'models', 'detail', id] as const,
    },

    corePrompts: {
      all: ['admin', 'core-prompts'] as const,
      lists: () => ['admin', 'core-prompts', 'list'] as const,
      list: (query?: CorePromptsQuery) => ['admin', 'core-prompts', 'list', orEmpty(query)] as const,
      versions: (key: string) => ['admin', 'core-prompts', 'versions', key] as const,
      detail: (id: string) => ['admin', 'core-prompts', 'detail', id] as const,
    },

    templates: {
      all: ['admin', 'templates'] as const,
      lists: () => ['admin', 'templates', 'list'] as const,
      list: (query?: AdminTemplatesQuery) => ['admin', 'templates', 'list', orEmpty(query)] as const,
      /** Slots, text zones and readiness live inside the detail: invalidate it after any slot / zone change. */
      detail: (id: string) => ['admin', 'templates', 'detail', id] as const,
    },

    references: {
      all: ['admin', 'references'] as const,
      lists: () => ['admin', 'references', 'list'] as const,
      list: (query?: AdminReferencesQuery) => ['admin', 'references', 'list', orEmpty(query)] as const,
      detail: (id: string) => ['admin', 'references', 'detail', id] as const,
    },

    settings: ['admin', 'settings'] as const,
    brandIdentity: ['admin', 'brand-identity'] as const,
    policy: ['admin', 'policy'] as const,

    generations: {
      all: ['admin', 'generations'] as const,
      lists: () => ['admin', 'generations', 'list'] as const,
      list: (query?: AdminGenerationsQuery) => ['admin', 'generations', 'list', orEmpty(query)] as const,
      detail: (id: string) => ['admin', 'generations', 'detail', id] as const,
    },

    gallery: {
      all: ['admin', 'gallery'] as const,
      list: (query?: AdminGalleryQuery) => ['admin', 'gallery', 'list', orEmpty(query)] as const,
    },

    audit: {
      all: ['admin', 'audit'] as const,
      list: (query?: AdminAuditQuery) => ['admin', 'audit', 'list', orEmpty(query)] as const,
    },

    dashboard: {
      all: ['admin', 'dashboard'] as const,
      summary: (query?: AdminDashboardQuery) => ['admin', 'dashboard', orEmpty(query)] as const,
    },
  },
} as const;
