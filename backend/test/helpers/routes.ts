import type { Router } from 'express';
import { ADMIN_MOUNTS, adminRouter } from '../../src/modules/admin/routes.js';
import { createApiRouter } from '../../src/modules/index.js';

export interface RouteLike {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  /** Path relative to `/api/v1` (admin routes start with `/admin`) with `:param` placeholders. */
  path: string;
}

interface LayerLike {
  slash?: boolean;
  handle: unknown;
  matchers?: ((path: string) => unknown)[];
  route?: { path: string; methods: Record<string, boolean> };
}

export const stackOf = (router: unknown): LayerLike[] => ((router as { stack?: LayerLike[] }).stack ?? []) as LayerLike[];
export const isRouter = (handle: unknown): handle is Router =>
  typeof handle === 'function' && Array.isArray((handle as { stack?: unknown }).stack);
export const layerMatches = (layer: LayerLike, path: string): boolean => (layer.matchers ?? []).some((m) => Boolean(m(path)));

/** Mount prefixes of `createApiRouter()` (everything not listed here is an unknown mount and fails the walk). */
const API_PREFIXES = ['/auth', '/me', '/templates', '/gallery', '/tutorials', '/prompts', '/references', '/generations', '/files', '/admin'];

function routesOf(layers: LayerLike[], prefix: string, problems: string[]): RouteLike[] {
  const out: RouteLike[] = [];
  for (const layer of layers) {
    if (layer.route) {
      for (const method of Object.keys(layer.route.methods)) {
        const sub = layer.route.path === '/' ? '' : layer.route.path;
        out.push({ method: method as RouteLike['method'], path: `${prefix}${sub}` || '/' });
      }
    } else if (isRouter(layer.handle)) {
      problems.push(`unexpected nested router under "${prefix}"`);
    }
  }
  return out;
}

/** Every route of the whole API, read from the registered Express stacks. */
export function collectApiRoutes(): { routes: RouteLike[]; problems: string[] } {
  const problems: string[] = [];
  const routes: RouteLike[] = [];
  for (const layer of stackOf(createApiRouter())) {
    if (layer.route) {
      routes.push(...routesOf([layer], '', problems));
    } else if (isRouter(layer.handle)) {
      if (layer.handle === adminRouter) {
        for (const sub of stackOf(adminRouter)) {
          if (sub.route) routes.push(...routesOf([sub], '/admin', problems));
          else if (isRouter(sub.handle)) {
            const mount = ADMIN_MOUNTS.find(([, r]) => r === sub.handle);
            if (!mount) problems.push('unlisted router mounted on the admin router');
            else routes.push(...routesOf(stackOf(sub.handle), `/admin${mount[0]}`, problems));
          }
        }
        continue;
      }
      const prefix = layer.slash ? '' : API_PREFIXES.filter((p) => layerMatches(layer, `${p}/probe`));
      if (Array.isArray(prefix) && prefix.length !== 1) {
        problems.push(`cannot determine the mount path of a router (candidates: ${prefix.join(', ') || 'none'})`);
        continue;
      }
      routes.push(...routesOf(stackOf(layer.handle), Array.isArray(prefix) ? (prefix[0] as string) : prefix, problems));
    }
  }
  return { routes, problems };
}
