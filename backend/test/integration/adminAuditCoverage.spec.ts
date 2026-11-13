import { describe, expect, it } from 'vitest';
import { pool } from '../helpers/api.js';
import { as, coreBody, expectNoSecretsInAudit, loginSeedAdmin, png, suffix, useSeededDatabase } from '../helpers/admin.js';
import { postGeneration, settle } from '../helpers/pipeline.js';
import { registerUser } from '../helpers/api.js';
import { collectApiRoutes } from '../helpers/routes.js';

useSeededDatabase();

type Admin = Awaited<ReturnType<typeof loginSeedAdmin>>;

/**
 * Every mutating admin route, in dependency order, with the audit action it must write. The table is cross-checked against
 * the routes registered in the live Express stack, so adding a mutating route without an audit mapping fails this spec.
 */
describe('every mutating admin route writes an audit row without secrets', () => {
  it('covers the whole route table', async () => {
    const admin: Admin = await loginSeedAdmin();
    const sfx = suffix();
    const ctx: Record<string, string> = {};
    const mockModel = (capability: string) => ({ name: `Audit ${capability} ${suffix()}`, provider: 'mock', capability, model_id: 'mock-audit' });

    type Step = () => Promise<{ status: number; action: string; entityId?: string }>;
    const steps: Record<string, Step> = {
      'POST /admin/users': async () => {
        const r = await as(admin).post('/users', { email: `audit.cov.${sfx}@test.local`, name: 'Audit Cov' });
        ctx.user = r.body.data.user.id;
        return { status: r.status, action: 'user.create', entityId: ctx.user };
      },
      'PATCH /admin/users/:id': async () => ({ status: (await as(admin).patch(`/users/${ctx.user}`, { name: 'Audit Cov 2' })).status, action: 'user.update', entityId: ctx.user }),
      'POST /admin/users/:id/reset-password': async () => ({ status: (await as(admin).post(`/users/${ctx.user}/reset-password`)).status, action: 'user.reset_password', entityId: ctx.user }),
      'POST /admin/users/:id/revoke-sessions': async () => ({ status: (await as(admin).post(`/users/${ctx.user}/revoke-sessions`)).status, action: 'user.revoke_sessions', entityId: ctx.user }),
      'DELETE /admin/users/:id': async () => ({ status: (await as(admin).del(`/users/${ctx.user}`)).status, action: 'user.delete', entityId: ctx.user }),

      'POST /admin/models': async () => {
        const r = await as(admin).post('/models', mockModel('text'));
        ctx.model = r.body.data.id;
        return { status: r.status, action: 'model.create', entityId: ctx.model };
      },
      'PATCH /admin/models/:id': async () => ({ status: (await as(admin).patch(`/models/${ctx.model}`, { priority: 5 })).status, action: 'model.update', entityId: ctx.model }),
      'POST /admin/models/:id/activate': async () => ({ status: (await as(admin).post(`/models/${ctx.model}/activate`)).status, action: 'model.activate', entityId: ctx.model }),
      'POST /admin/models/:id/test': async () => ({ status: (await as(admin).post(`/models/${ctx.model}/test`)).status, action: 'model.test', entityId: ctx.model }),
      'POST /admin/models/:id/set-default': async () => ({ status: (await as(admin).post(`/models/${ctx.model}/set-default`)).status, action: 'model.set_default', entityId: ctx.model }),
      'POST /admin/models/:id/deactivate': async () => {
        const original = (await pool.query<{ id: string }>("SELECT id FROM model_configs WHERE name = 'Mock Text'")).rows[0] as { id: string };
        await as(admin).post(`/models/${original.id}/set-default`);
        return { status: (await as(admin).post(`/models/${ctx.model}/deactivate`)).status, action: 'model.deactivate', entityId: ctx.model };
      },
      'DELETE /admin/models/:id': async () => ({ status: (await as(admin).del(`/models/${ctx.model}`)).status, action: 'model.delete', entityId: ctx.model }),

      'POST /admin/core-prompts': async () => {
        ctx.key = `test.aud_${sfx}`;
        const r = await as(admin).post('/core-prompts', { key: ctx.key, subject: 'product', publication: 'poster', body: coreBody(2, `ZQAUD${sfx}`) });
        ctx.core = r.body.data.id;
        return { status: r.status, action: 'core_prompt.create', entityId: ctx.core };
      },
      'POST /admin/core-prompts/:id/activate': async () => ({ status: (await as(admin).post(`/core-prompts/${ctx.core}/activate`)).status, action: 'core_prompt.activate', entityId: ctx.core }),
      'POST /admin/core-prompts/test-render': async () => ({ status: (await as(admin).post('/core-prompts/test-render', { key: ctx.key, slot_values: {} })).status, action: 'core_prompt.test_render', entityId: ctx.core }),

      'POST /admin/templates': async () => {
        const r = await as(admin).post('/templates', { slug: `aud-${sfx}`, name: 'Audit Tpl', category: 'poster', mode: 'both', subject: 'product', core_prompt_key: ctx.key });
        ctx.tpl = r.body.data.id;
        return { status: r.status, action: 'template.create', entityId: ctx.tpl };
      },
      'POST /admin/templates/:id/slots': async () => {
        const r = await as(admin).post(`/templates/${ctx.tpl}/slots`, { key: 'product', label: 'Produk', blank_index: 1 });
        ctx.slot = r.body.data.id;
        await as(admin).post(`/templates/${ctx.tpl}/slots`, { key: 'color', label: 'Warna', blank_index: 2 });
        const title = await as(admin).post(`/templates/${ctx.tpl}/slots`, { key: 'title', label: 'Judul' });
        ctx.titleSlot = title.body.data.id;
        return { status: r.status, action: 'template_slot.create', entityId: ctx.slot };
      },
      'PATCH /admin/templates/:id/slots/:slotId': async () => ({ status: (await as(admin).patch(`/templates/${ctx.tpl}/slots/${ctx.slot}`, { label: 'Produk utama' })).status, action: 'template_slot.update', entityId: ctx.slot }),
      'POST /admin/templates/:id/text-zones': async () => {
        const r = await as(admin).post(`/templates/${ctx.tpl}/text-zones`, { slot_key: 'title', x: 0.1, y: 0.1, w: 0.8, h: 0.2 });
        ctx.zone = r.body.data.id;
        return { status: r.status, action: 'template_zone.create', entityId: ctx.zone };
      },
      'PATCH /admin/templates/:id/text-zones/:zoneId': async () => ({ status: (await as(admin).patch(`/templates/${ctx.tpl}/text-zones/${ctx.zone}`, { align: 'left' })).status, action: 'template_zone.update', entityId: ctx.zone }),
      'DELETE /admin/templates/:id/text-zones/:zoneId': async () => ({ status: (await as(admin).del(`/templates/${ctx.tpl}/text-zones/${ctx.zone}`)).status, action: 'template_zone.delete', entityId: ctx.zone }),
      'PATCH /admin/templates/:id': async () => ({ status: (await as(admin).patch(`/templates/${ctx.tpl}`, { name: 'Audit Tpl 2' })).status, action: 'template.update', entityId: ctx.tpl }),
      'POST /admin/templates/:id/preview': async () => ({ status: (await as(admin).upload(`/templates/${ctx.tpl}/preview`, await png())).status, action: 'template.preview_upload', entityId: ctx.tpl }),
      'POST /admin/templates/:id/publish': async () => ({ status: (await as(admin).post(`/templates/${ctx.tpl}/publish`)).status, action: 'template.publish', entityId: ctx.tpl }),
      'POST /admin/templates/:id/unpublish': async () => ({ status: (await as(admin).post(`/templates/${ctx.tpl}/unpublish`)).status, action: 'template.unpublish', entityId: ctx.tpl }),
      'POST /admin/templates/:id/archive': async () => ({ status: (await as(admin).post(`/templates/${ctx.tpl}/archive`)).status, action: 'template.archive', entityId: ctx.tpl }),
      'DELETE /admin/templates/:id/slots/:slotId': async () => ({ status: (await as(admin).del(`/templates/${ctx.tpl}/slots/${ctx.titleSlot}`)).status, action: 'template_slot.delete', entityId: ctx.titleSlot }),
      'DELETE /admin/templates/:id': async () => ({ status: (await as(admin).del(`/templates/${ctx.tpl}`)).status, action: 'template.delete', entityId: ctx.tpl }),

      'POST /admin/references': async () => {
        const r = await as(admin).upload('/references', await png(), { role: 'style', label: 'Audit' });
        ctx.ref = r.body.data.id;
        return { status: r.status, action: 'reference.create', entityId: ctx.ref };
      },
      'PATCH /admin/references/:id': async () => ({ status: (await as(admin).patch(`/references/${ctx.ref}`, { label: 'Audit 2' })).status, action: 'reference.update', entityId: ctx.ref }),
      'DELETE /admin/references/:id': async () => ({ status: (await as(admin).del(`/references/${ctx.ref}`)).status, action: 'reference.delete', entityId: ctx.ref }),

      'PATCH /admin/settings': async () => ({ status: (await as(admin).patch('/settings', { max_references: 5 })).status, action: 'settings.update' }),
      'PATCH /admin/brand-identity': async () => ({ status: (await as(admin).patch('/brand-identity', { name: 'Audit Brand' })).status, action: 'brand.update' }),
      'POST /admin/brand-identity/logo': async () => ({ status: (await as(admin).upload('/brand-identity/logo', await png())).status, action: 'brand.logo_upload' }),
      'PATCH /admin/policy': async () => ({ status: (await as(admin).patch('/policy', { moderation_level: 'strict' })).status, action: 'policy.update' }),

      'POST /admin/generations/:id/flag': async () => {
        const user = await registerUser();
        const g = await postGeneration(user, { template_slug: 'poster-kegiatan-organisasi', slot_values: { title: 'Bazar', date_venue: 'Balai Desa' } });
        ctx.gen = g.body.data.id;
        await settle(user, ctx.gen as string);
        return { status: (await as(admin).post(`/generations/${ctx.gen}/flag`, { flagged: true, note: 'cek' })).status, action: 'generation.flag', entityId: ctx.gen };
      },
      'GET /admin/generations/export.csv': async () => ({ status: (await as(admin).get('/generations/export.csv')).status, action: 'generation.export' }),

      'POST /admin/gallery': async () => {
        const r = await as(admin).post('/gallery', { generation_id: ctx.gen, title: 'Audit galeri' });
        ctx.gallery = r.body.data.id;
        return { status: r.status, action: 'gallery.create', entityId: ctx.gallery };
      },
      'PATCH /admin/gallery/:id': async () => ({ status: (await as(admin).patch(`/gallery/${ctx.gallery}`, { is_featured: true })).status, action: 'gallery.update', entityId: ctx.gallery }),
      'DELETE /admin/gallery/:id': async () => ({ status: (await as(admin).del(`/gallery/${ctx.gallery}`)).status, action: 'gallery.delete', entityId: ctx.gallery }),
    };

    // 1. The table matches the live route table: nothing mutating is missing, nothing is invented.
    const { routes, problems } = collectApiRoutes();
    expect(problems).toEqual([]);
    const mutating = routes
      .filter((r) => r.path.startsWith('/admin') && r.method !== 'get')
      .map((r) => `${r.method.toUpperCase()} /api/v1${r.path}`.replace('/api/v1', ''));
    const audited = [...mutating, 'GET /admin/generations/export.csv'].sort();
    expect(Object.keys(steps).sort()).toEqual(audited);

    // 2. Each one writes an audit row (right action, this admin, an ip, and a diff without secrets).
    for (const [route, step] of Object.entries(steps)) {
      const before = Number((await pool.query('SELECT count(*)::int AS n FROM audit_logs')).rows[0].n);
      const result = await step();
      expect(result.status, route).toBeLessThan(300);
      const rows = (
        await pool.query<{ actor_id: string; action: string; entity_id: string | null; ip: string | null; diff: unknown }>(
          'SELECT actor_id, action, entity_id, ip, diff FROM audit_logs ORDER BY created_at, id OFFSET $1',
          [before],
        )
      ).rows;
      const mine = rows.filter((r) => r.action === result.action);
      expect(mine.length, `${route} -> ${result.action}`).toBeGreaterThanOrEqual(1);
      const row = (result.entityId ? mine.find((r) => r.entity_id === result.entityId) : mine.at(-1)) as (typeof rows)[number];
      expect(row, `${route}: no audit row for entity ${String(result.entityId)}`).toBeTruthy();
      expect(row.actor_id, route).toBe(admin.id);
      expect(row.ip, route).toBeTruthy();
      expectNoSecretsInAudit(rows, [`ZQAUD${sfx}`]);
    }
  });
});
