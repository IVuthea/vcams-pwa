import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { AttendancePeriod } from '@/types/attendance';

export interface ScanRecord {
  id?: number;
  value: string;
  createdAt: number;
}

// 'failed' means the last upload to the admin attempted and threw; absent
// means the scan has not been submitted (or the previous attempt succeeded).
export type AttendanceSubmitStatus = 'failed';

export interface AttendanceScanRecord {
  id?: number;
  projectId: string;
  period: AttendancePeriod;
  employeeId: number;
  employeeName: string;
  createdAt: number;
  submitStatus?: AttendanceSubmitStatus;
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
  attendance_scans: {
    key: number;
    value: AttendanceScanRecord;
    indexes: {
      projectId: string;
      createdAt: number;
      // Compound index lets us list "all scans for project X, newest first"
      // without filtering in JS.
      projectId_createdAt: [string, number];
    };
  };
}

const DB_NAME = 'cube-scanner';
const DB_VERSION = 3;
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
        if (oldVersion < 3) {
          const store = db.createObjectStore('attendance_scans', {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('projectId', 'projectId');
          store.createIndex('createdAt', 'createdAt');
          store.createIndex('projectId_createdAt', ['projectId', 'createdAt']);
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

export async function addAttendanceScan(
  input: Omit<AttendanceScanRecord, 'id' | 'createdAt'> & { createdAt?: number },
): Promise<AttendanceScanRecord | null> {
  try {
    const db = await getDB();
    const record: AttendanceScanRecord = {
      projectId: input.projectId,
      period: input.period,
      employeeId: input.employeeId,
      employeeName: input.employeeName,
      createdAt: input.createdAt ?? Date.now(),
    };
    const id = await db.add('attendance_scans', record);
    return { ...record, id: id as number };
  } catch (e) {
    console.error('addAttendanceScan failed', e);
    return null;
  }
}

export async function listAttendanceScans(
  projectId: string,
  limit = 200,
): Promise<AttendanceScanRecord[]> {
  try {
    const db = await getDB();
    const tx = db.transaction('attendance_scans', 'readonly');
    const index = tx.store.index('projectId_createdAt');
    const results: AttendanceScanRecord[] = [];
    // Range covers all createdAt values for the given projectId; iterate in
    // reverse so newest comes first.
    const range = IDBKeyRange.bound([projectId, -Infinity], [projectId, Infinity]);
    let cursor = await index.openCursor(range, 'prev');
    while (cursor && results.length < limit) {
      results.push(cursor.value);
      cursor = await cursor.continue();
    }
    await tx.done;
    return results;
  } catch (e) {
    console.error('listAttendanceScans failed', e);
    return [];
  }
}

// Persist the submit-status flag on a single scan. `null` clears the flag
// (e.g., after a successful retry). Returns the updated record so callers
// can patch their in-memory list reactively.
export async function setAttendanceScanStatus(
  id: number,
  status: AttendanceSubmitStatus | null,
): Promise<AttendanceScanRecord | null> {
  try {
    const db = await getDB();
    const tx = db.transaction('attendance_scans', 'readwrite');
    const existing = await tx.store.get(id);
    if (!existing) {
      await tx.done;
      return null;
    }
    const next: AttendanceScanRecord = { ...existing };
    if (status === null) {
      delete next.submitStatus;
    } else {
      next.submitStatus = status;
    }
    await tx.store.put(next);
    await tx.done;
    return next;
  } catch (e) {
    console.error('setAttendanceScanStatus failed', e);
    return null;
  }
}

export async function deleteAttendanceScan(id: number): Promise<boolean> {
  try {
    const db = await getDB();
    await db.delete('attendance_scans', id);
    return true;
  } catch (e) {
    console.error('deleteAttendanceScan failed', e);
    return false;
  }
}

export async function clearAttendanceScans(projectId: string): Promise<boolean> {
  try {
    const db = await getDB();
    const tx = db.transaction('attendance_scans', 'readwrite');
    const index = tx.store.index('projectId');
    let cursor = await index.openCursor(IDBKeyRange.only(projectId));
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
    return true;
  } catch (e) {
    console.error('clearAttendanceScans failed', e);
    return false;
  }
}

export async function clearAttendanceScansForPeriod(
  projectId: string,
  period: AttendancePeriod,
): Promise<boolean> {
  try {
    const db = await getDB();
    const tx = db.transaction('attendance_scans', 'readwrite');
    const index = tx.store.index('projectId');
    let cursor = await index.openCursor(IDBKeyRange.only(projectId));
    while (cursor) {
      if (cursor.value.period === period) {
        await cursor.delete();
      }
      cursor = await cursor.continue();
    }
    await tx.done;
    return true;
  } catch (e) {
    console.error('clearAttendanceScansForPeriod failed', e);
    return false;
  }
}
