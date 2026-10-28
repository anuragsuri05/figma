import { get, set, del } from 'idb-keyval';
import type { DocumentData, FileMeta, VersionEntry } from '../model/types';
import { createDocument, uid } from '../model/defaults';

const FILES_KEY = 'myflow:files';

export async function listFiles(): Promise<FileMeta[]> {
  return (await get<FileMeta[]>(FILES_KEY)) ?? [];
}

async function saveFiles(files: FileMeta[]) {
  await set(FILES_KEY, files);
}

export async function createFile(name = 'Untitled', project = 'Drafts', doc?: DocumentData): Promise<FileMeta> {
  const id = uid('f');
  const now = Date.now();
  const meta: FileMeta = { id, name, createdAt: now, updatedAt: now, lastOpenedAt: now, starred: false, trashed: false, project };
  const d = doc ? { ...doc, id, name } : createDocument(id, name);
  await set('myflow:doc:' + id, d);
  const files = await listFiles();
  files.unshift(meta);
  await saveFiles(files);
  return meta;
}

export async function loadDoc(id: string): Promise<DocumentData | undefined> {
  return get<DocumentData>('myflow:doc:' + id);
}

export async function saveDoc(doc: DocumentData, thumbnail?: string) {
  await set('myflow:doc:' + doc.id, doc);
  const files = await listFiles();
  const f = files.find((x) => x.id === doc.id);
  if (f) {
    f.updatedAt = Date.now();
    f.name = doc.name;
    if (thumbnail) f.thumbnail = thumbnail;
    await saveFiles(files);
  }
}

export async function updateMeta(id: string, patch: Partial<FileMeta>) {
  const files = await listFiles();
  const f = files.find((x) => x.id === id);
  if (!f) return;
  Object.assign(f, patch);
  await saveFiles(files);
  if (patch.name) {
    const d = await loadDoc(id);
    if (d) { d.name = patch.name; await set('myflow:doc:' + id, d); }
  }
}

export async function duplicateFile(id: string): Promise<FileMeta | undefined> {
  const files = await listFiles();
  const f = files.find((x) => x.id === id);
  const d = await loadDoc(id);
  if (!f || !d) return;
  const meta = await createFile(f.name + ' (Copy)', f.project, d);
  if (f.thumbnail) await updateMeta(meta.id, { thumbnail: f.thumbnail });
  return meta;
}

export async function deleteFileForever(id: string) {
  const files = (await listFiles()).filter((f) => f.id !== id);
  await saveFiles(files);
  await del('myflow:doc:' + id);
  await del('myflow:versions:' + id);
}

export async function listVersions(id: string): Promise<VersionEntry[]> {
  return (await get<VersionEntry[]>('myflow:versions:' + id)) ?? [];
}

export async function addVersion(id: string, entry: VersionEntry) {
  const list = await listVersions(id);
  list.unshift(entry);
  // keep last 60 autosaves + all named
  let autos = 0;
  const kept = list.filter((v) => !v.auto || ++autos <= 60);
  await set('myflow:versions:' + id, kept);
}

export async function saveVersions(id: string, list: VersionEntry[]) {
  await set('myflow:versions:' + id, list);
}

export async function getPrefs<T>(fallback: T): Promise<T> {
  return { ...fallback, ...((await get<Partial<T>>('myflow:prefs')) ?? {}) };
}

export async function setPrefs<T>(p: T) {
  await set('myflow:prefs', p);
}
