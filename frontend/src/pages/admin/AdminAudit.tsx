import React, { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { adminListAudit, adminListUsers } from '../../api/admin';
import { queryKeys } from '../../api/queryKeys';
import type { AdminAuditQuery, AuditEntry } from '../../api/types';
import { formatDateTime, shortId } from '../../components/admin/format';
import { useDebouncedValue } from '../../components/admin/hooks';
import { Badge, EmptyState, ErrorState, Field, LoadingBlock, PageHeader, Pagination, btnSecondary, inputCls, selectCls } from '../../components/admin/ui';

const PAGE_SIZE = 25;

/** Actions the API documents (backend/docs/API.md 3.11); the filter also accepts free text. */
export const KNOWN_ACTIONS = [
  'user.create',
  'user.update',
  'user.reset_password',
  'user.revoke_sessions',
  'user.delete',
  'model.create',
  'model.update',
  'model.delete',
  'model.activate',
  'model.deactivate',
  'model.set_default',
  'model.test',
  'core_prompt.create',
  'core_prompt.activate',
  'core_prompt.test_render',
  'template.create',
  'template.update',
  'template.delete',
  'template.publish',
  'template.unpublish',
  'template.archive',
  'template.preview_upload',
  'template_slot.create',
  'template_slot.update',
  'template_slot.delete',
  'template_zone.create',
  'template_zone.update',
  'template_zone.delete',
  'reference.create',
  'reference.update',
  'reference.delete',
  'settings.update',
  'brand.update',
  'brand.logo_upload',
  'policy.update',
  'generation.flag',
  'generation.export',
  'gallery.create',
  'gallery.update',
  'gallery.delete',
] as const;

export const KNOWN_ENTITIES = [
  'user',
  'model_config',
  'core_prompt',
  'template',
  'template_slot',
  'text_zone',
  'reference_asset',
  'app_settings',
  'brand_identity',
  'content_policy',
  'generation',
  'gallery_item',
] as const;

const isFromTo = (v: unknown): v is { from: unknown; to: unknown } => !!v && typeof v === 'object' && 'from' in v && 'to' in v;

const show = (v: unknown): string => {
  if (v === null || v === undefined) return 'kosong';
  if (typeof v === 'string') return v === '' ? '""' : v;
  return JSON.stringify(v);
};

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** The API groups changed fields under `changed: { field: { from, to } }`; show those one per line. */
export function flattenDiff(diff: Record<string, unknown>): Array<[string, unknown]> {
  const rows: Array<[string, unknown]> = [];
  for (const [key, value] of Object.entries(diff)) {
    if (isRecord(value) && Object.keys(value).length > 0 && Object.values(value).every(isFromTo)) {
      for (const [field, pair] of Object.entries(value)) rows.push([field, pair]);
    } else {
      rows.push([key, value]);
    }
  }
  return rows;
}

/** Diff exactly as returned (already secret-free): `{ from, to }` pairs become "a -> b", anything else is shown as JSON. */
export const DiffView: React.FC<{ diff: AuditEntry['diff'] }> = ({ diff }) => {
  if (!diff || Object.keys(diff).length === 0) return <span className="text-slate-500">-</span>;
  return (
    <ul className="space-y-0.5 font-mono text-[11px]">
      {flattenDiff(diff).map(([key, value]) => (
        <li key={key} className="break-words">
          <span className="font-bold text-[#0F172A]">{key}</span>
          {': '}
          {isFromTo(value) ? (
            <>
              <span className="text-red-600">{show(value.from)}</span> <span className="text-slate-500">&rarr;</span> <span className="text-emerald-700">{show(value.to)}</span>
            </>
          ) : (
            <span className="text-slate-600">{show(value)}</span>
          )}
        </li>
      ))}
    </ul>
  );
};

export const AdminAudit: React.FC = () => {
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const debouncedAction = useDebouncedValue(action.trim());
  const debouncedEntity = useDebouncedValue(entity.trim());
  const rangeInvalid = !!from && !!to && from > to;
  const query: AdminAuditQuery = {
    page,
    limit: PAGE_SIZE,
    actor: actor || undefined,
    action: debouncedAction || undefined,
    entity: debouncedEntity || undefined,
    from: from || undefined,
    to: to || undefined,
  };

  const audit = useQuery({
    queryKey: queryKeys.admin.audit.list(query),
    queryFn: ({ signal }) => adminListAudit(query, signal),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    enabled: !rangeInvalid,
  });
  const admins = useQuery({
    queryKey: queryKeys.admin.users.list({ role: 'admin', limit: 100 }),
    queryFn: ({ signal }) => adminListUsers({ role: 'admin', limit: 100 }, signal),
    staleTime: 60_000,
  });

  const setFilter = (apply: () => void) => {
    apply();
    setPage(1);
  };
  const anyFilter = !!(actor || action || entity || from || to);

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        icon={<ScrollText className="w-6 h-6" />}
        title={
          <>
            Audit <span className="text-[#2563EB]">Log Admin</span>
          </>
        }
        description="Catatan baca-saja semua perubahan yang dilakukan admin. Tidak dapat diubah atau dihapus; perbedaan nilai tidak memuat rahasia."
      />

      <section aria-label="Filter audit" className="bg-white/85 backdrop-blur-md rounded-3xl border border-slate-200/90 p-5 shadow-xs">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Field label="Pelaku (admin)" htmlFor="a-actor">
            <select id="a-actor" value={actor} onChange={(e) => setFilter(() => setActor(e.target.value))} className={selectCls}>
              <option value="">Semua admin</option>
              {admins.data?.items.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Aksi" htmlFor="a-action">
            <input id="a-action" list="audit-actions" value={action} onChange={(e) => setFilter(() => setAction(e.target.value))} placeholder="mis. model.create" className={`${inputCls} font-mono`} autoComplete="off" />
            <datalist id="audit-actions">
              {KNOWN_ACTIONS.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </Field>
          <Field label="Entitas" htmlFor="a-entity">
            <input id="a-entity" list="audit-entities" value={entity} onChange={(e) => setFilter(() => setEntity(e.target.value))} placeholder="mis. template" className={`${inputCls} font-mono`} autoComplete="off" />
            <datalist id="audit-entities">
              {KNOWN_ENTITIES.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </Field>
          <Field label="Dari tanggal" htmlFor="a-from" error={rangeInvalid ? 'Tanggal awal harus sebelum tanggal akhir.' : null}>
            <input id="a-from" type="date" value={from} onChange={(e) => setFilter(() => setFrom(e.target.value))} className={inputCls} />
          </Field>
          <Field label="Sampai tanggal" htmlFor="a-to">
            <input id="a-to" type="date" value={to} onChange={(e) => setFilter(() => setTo(e.target.value))} className={inputCls} />
          </Field>
          <div className="flex items-end">
            <button
              type="button"
              disabled={!anyFilter}
              onClick={() => {
                setActor('');
                setAction('');
                setEntity('');
                setFrom('');
                setTo('');
                setPage(1);
              }}
              className={btnSecondary}
            >
              Atur ulang filter
            </button>
          </div>
        </div>
      </section>

      <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        {audit.isPending && !rangeInvalid && <LoadingBlock label="Memuat audit log..." />}
        {audit.isError && !audit.data && <ErrorState error={audit.error} onRetry={() => void audit.refetch()} title="Audit log tidak dapat dimuat" />}
        {audit.data && audit.data.items.length === 0 && <EmptyState icon={<ScrollText className="w-6 h-6" />} title="Tidak ada catatan audit yang cocok" hint="Ubah atau atur ulang filter." />}
        {audit.data && audit.data.items.length > 0 && (
          <div className={`overflow-x-auto ${audit.isFetching ? 'opacity-70' : ''}`} tabIndex={0} role="region" aria-label="Tabel audit log (geser untuk melihat kolom lain)">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-slate-200 text-slate-600 font-bold">
                  <th className="py-3.5 px-5">Waktu</th>
                  <th className="py-3.5 px-5">Pelaku</th>
                  <th className="py-3.5 px-5">Aksi</th>
                  <th className="py-3.5 px-5">Entitas</th>
                  <th className="py-3.5 px-5">Perubahan</th>
                  <th className="py-3.5 px-5">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 align-top">
                {audit.data.items.map((a) => (
                  <tr key={a.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="py-3 px-5 font-mono text-[11px] text-slate-500 whitespace-nowrap">{formatDateTime(a.created_at)}</td>
                    <td className="py-3 px-5">
                      <div className="font-bold text-[#0F172A]">{a.actor?.name ?? 'Sistem'}</div>
                      {a.actor && <div className="text-[11px] text-slate-500">{a.actor.email}</div>}
                    </td>
                    <td className="py-3 px-5">
                      <Badge tone="blue" className="!normal-case !tracking-normal font-mono">
                        {a.action}
                      </Badge>
                    </td>
                    <td className="py-3 px-5 font-mono text-[11px]">
                      {a.entity}
                      {a.entity_id && <span className="block text-slate-500">{shortId(a.entity_id)}</span>}
                    </td>
                    <td className="py-3 px-5 max-w-md">
                      <DiffView diff={a.diff} />
                    </td>
                    <td className="py-3 px-5 font-mono text-[11px] text-slate-500">{a.ip ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Pagination meta={audit.data?.meta} onPage={setPage} busy={audit.isFetching} noun="catatan" />
    </div>
  );
};
export default AdminAudit;
