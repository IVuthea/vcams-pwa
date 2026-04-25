import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';

export interface ScanRecord {
  id?: number;
  value: string;
  createdAt: number;
}

export interface AuthUser {
  id?: number | string;
  email: string;
  [key: string]: unknown;
}

export interface StoredAuth {
  token: string;
  user?: AuthUser;
}

interface CubeScannerDB extends DBSchema {
  scans: {
    key: number;
    value: ScanRecord;
    indexes: {
      createdAt: number;
      value: string;
    };
  };
  auth: {
    key: string;
    value: StoredAuth;
  };
}

const DB_NAME = 'cube-scanner';
const DB_VERSION = 2;
const AUTH_KEY = 'current';

let dbPromise: Promise<IDBPDatabase<CubeScannerDB>> | null = null;

function getDB(): Promise<IDBPDatabase<CubeScannerDB>> {
  if (!dbPromise) {
    dbPromise = openDB<CubeScannerDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const store = db.createObjectStore('scans', {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('createdAt', 'createdAt');
          store.createIndex('value', 'value');
        }
        if (oldVersion < 2) {
          db.createObjectStore('auth');
        }
      },
    });
  }
  return dbPromise;
}

export async function addScan(value: string): Promise<ScanRecord | null> {
  try {
    const db = await getDB();
    const record: ScanRecord = { value, createdAt: Date.now() };
    const id = await db.add('scans', record);
    return { ...record, id: id as number };
  } catch (e) {
    console.error('addScan failed', e);
    return null;
  }
}

export async function listScans(limit = 10): Promise<ScanRecord[]> {
  try {
    const db = await getDB();
    const tx = db.transaction('scans', 'readonly');
    const index = tx.store.index('createdAt');
    const results: ScanRecord[] = [];
    let cursor = await index.openCursor(null, 'prev');
    while (cursor && results.length < limit) {
      results.push(cursor.value);
      cursor = await cursor.continue();
    }
    await tx.done;
    return results;
  } catch (e) {
    console.error('listScans failed', e);
    return [];
  }
}

export async function deleteScan(id: number): Promise<boolean> {
  try {
    const db = await getDB();
    await db.delete('scans', id);
    return true;
  } catch (e) {
    console.error('deleteScan failed', e);
    return false;
  }
}

export async function clearScans(): Promise<boolean> {
  try {
    const db = await getDB();
    await db.clear('scans');
    return true;
  } catch (e) {
    console.error('clearScans failed', e);
    return false;
  }
}

export async function getStoredAuth(): Promise<StoredAuth | null> {
  try {
    const db = await getDB();
    const found = await db.get('auth', AUTH_KEY);
    return found ?? null;
  } catch (e) {
    console.error('getStoredAuth failed', e);
    return null;
  }
}

export async function setStoredAuth(auth: StoredAuth): Promise<boolean> {
  try {
    const db = await getDB();
    // JSON roundtrip strips Vue reactive Proxies, functions, and undefined
    // values so IndexedDB's structured clone never sees something it can't
    // serialize (DataCloneError).
    const plain: StoredAuth = JSON.parse(JSON.stringify(auth));
    await db.put('auth', plain, AUTH_KEY);
    return true;
  } catch (e) {
    console.error('setStoredAuth failed', e);
    return false;
  }
}

export async function clearStoredAuth(): Promise<boolean> {
  try {
    const db = await getDB();
    await db.delete('auth', AUTH_KEY);
    return true;
  } catch (e) {
    console.error('clearStoredAuth failed', e);
    return false;
  }
}
