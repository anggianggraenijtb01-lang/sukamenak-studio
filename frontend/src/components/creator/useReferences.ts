/**
 * The references picked for one generation: photos uploaded right away (so thumbnails and ids are ready before
 * the user presses "Buat"), plus references picked from the admin library or from the user's earlier uploads
 * (no re-upload). Capacity is checked here; the server re-checks it (`TOO_MANY_REFERENCES`).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { uploadReference, deleteReference } from '../../api/creator';
import { getErrorMessage, isApiError } from '../../api/errors';
import type { LibraryReference, Reference, ReferenceRole } from '../../api/types';

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export interface PickedRef {
  /** Local key (stable while the upload runs). */
  key: string;
  /** Server id, set once the reference exists. */
  id: string | null;
  role: ReferenceRole;
  /** Thumbnail: a local object URL while/after uploading, else the signed URL of the server. */
  url: string;
  label: string | null;
  source: 'upload' | 'library' | 'mine';
  status: 'uploading' | 'ready' | 'error';
  error?: string;
}

export interface UploadProblem {
  code?: string;
  message: string;
}

/** Returns why a file cannot be uploaded, or null when it can. Pure, unit tested. */
export function checkImageFile(file: { type: string; size: number; name?: string }): string | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) return 'Format foto harus JPG, PNG, atau WebP.';
  if (file.size > MAX_UPLOAD_BYTES) return 'Ukuran foto maksimal 8 MB.';
  if (file.size === 0) return 'File foto kosong.';
  return null;
}

let counter = 0;
const nextKey = () => `ref-${Date.now().toString(36)}-${counter++}`;

export function useReferences(maxRefs: number) {
  const [refs, setRefs] = useState<PickedRef[]>([]);
  const [problem, setProblem] = useState<UploadProblem | null>(null);
  const refsRef = useRef(refs);
  refsRef.current = refs;
  const maxRef = useRef(maxRefs);
  maxRef.current = maxRefs;
  const objectUrls = useRef(new Set<string>());

  useEffect(() => {
    const urls = objectUrls.current;
    return () => {
      for (const u of urls) URL.revokeObjectURL(u);
      urls.clear();
    };
  }, []);

  const patch = useCallback((key: string, change: Partial<PickedRef>) => {
    setRefs((prev) => prev.map((r) => (r.key === key ? { ...r, ...change } : r)));
  }, []);

  /** Uploads each file with `role`. `consent` must be true for the human_model role. */
  const upload = useCallback(
    async (files: File[], role: ReferenceRole, consent: boolean) => {
      setProblem(null);
      if (role === 'human_model' && !consent) {
        setProblem({ code: 'CONSENT_REQUIRED', message: 'Centang pernyataan persetujuan terlebih dahulu sebelum mengunggah foto orang.' });
        return;
      }
      for (const file of files) {
        const invalid = checkImageFile(file);
        if (invalid) {
          setProblem({ message: `${file.name}: ${invalid}` });
          continue;
        }
        if (refsRef.current.filter((r) => r.status !== 'error').length >= maxRef.current) {
          setProblem({ code: 'TOO_MANY_REFERENCES', message: `Maksimal ${maxRef.current} foto referensi per desain. Hapus salah satu untuk menambah yang baru.` });
          break;
        }
        const key = nextKey();
        const local = URL.createObjectURL(file);
        objectUrls.current.add(local);
        const entry: PickedRef = { key, id: null, role, url: local, label: file.name.slice(0, 80), source: 'upload', status: 'uploading' };
        refsRef.current = [...refsRef.current, entry];
        setRefs(refsRef.current);
        try {
          const saved = await uploadReference({
            file,
            role,
            label: entry.label ?? undefined,
            consent_confirmed: role === 'human_model' ? true : undefined,
          });
          patch(key, { id: saved.id, status: 'ready' });
        } catch (err) {
          const message = getErrorMessage(err);
          patch(key, { status: 'error', error: message });
          setProblem({ code: isApiError(err) ? err.code : undefined, message });
        }
      }
    },
    [patch],
  );

  /** Adds an existing reference (library or the user's own) without uploading anything. */
  const addExisting = useCallback((ref: LibraryReference | Reference, source: 'library' | 'mine') => {
    setProblem(null);
    const current = refsRef.current;
    if (current.some((r) => r.id === ref.id)) return;
    if (current.filter((r) => r.status !== 'error').length >= maxRef.current) {
      setProblem({ code: 'TOO_MANY_REFERENCES', message: `Maksimal ${maxRef.current} foto referensi per desain. Hapus salah satu untuk menambah yang baru.` });
      return;
    }
    const entry: PickedRef = { key: nextKey(), id: ref.id, role: ref.role, url: ref.url, label: ref.label, source, status: 'ready' };
    refsRef.current = [...current, entry];
    setRefs(refsRef.current);
  }, []);

  /** Drops a reference from the selection. A photo uploaded in this session is also deleted on the server. */
  const remove = useCallback((key: string) => {
    const target = refsRef.current.find((r) => r.key === key);
    if (!target) return;
    refsRef.current = refsRef.current.filter((r) => r.key !== key);
    setRefs(refsRef.current);
    setProblem(null);
    if (target.url.startsWith('blob:')) {
      URL.revokeObjectURL(target.url);
      objectUrls.current.delete(target.url);
    }
    if (target.source === 'upload' && target.id) void deleteReference(target.id).catch(() => undefined);
  }, []);

  /** A reference that was deleted elsewhere (Unggahan Saya) leaves the selection too. */
  const forget = useCallback((id: string) => {
    refsRef.current = refsRef.current.filter((r) => r.id !== id);
    setRefs(refsRef.current);
  }, []);

  return {
    refs,
    problem,
    clearProblem: () => setProblem(null),
    upload,
    addExisting,
    remove,
    forget,
    uploading: refs.some((r) => r.status === 'uploading'),
    ready: refs.filter((r): r is PickedRef & { id: string } => r.status === 'ready' && r.id !== null),
  };
}
