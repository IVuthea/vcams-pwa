import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  addAttendanceScan,
  clearAttendanceScans,
  clearAttendanceScansForPeriod,
  deleteAttendanceScan,
  listAttendanceScans,
} from '@/db';
import type { AttendanceScanRecord } from '@/db';
import type { AttendancePeriod } from '@/types/attendance';

export type AttendanceScanLog = AttendanceScanRecord;

export type RecordScanResult =
  | { ok: true; log: AttendanceScanLog }
  | { ok: false; error: string };

// QR payload shape: '{"id":21,"name":"Dara Song"}'. Returns null when the
// payload isn't JSON or is missing required fields — the caller decides
// whether to surface that as an error.
function parseEmployeePayload(value: string): {
  employeeId: number;
  employeeName: string;
} | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const obj = parsed as Record<string, unknown>;
    const idRaw = obj.id;
    const nameRaw = obj.name;
    const id = typeof idRaw === 'number' ? idRaw : Number(idRaw);
    if (!Number.isFinite(id)) return null;
    if (typeof nameRaw !== 'string' || nameRaw.trim().length === 0) return null;
    return { employeeId: id, employeeName: nameRaw };
  } catch {
    return null;
  }
}

// UI state for the Project Attendance screen. Kept in a store so the app bar
// (in AppLayout) can toggle the scanner dialog that lives inside the view.
export const useAttendanceStore = defineStore('attendance', () => {
  const selectedPeriod = ref<AttendancePeriod>('morning_in');
  const isScannerOpen = ref(false);
  const scans = ref<AttendanceScanLog[]>([]);
  const currentProjectId = ref<string | null>(null);
  const isLoading = ref(false);

  function selectPeriod(period: AttendancePeriod): void {
    selectedPeriod.value = period;
  }

  function openScanner(): void {
    isScannerOpen.value = true;
  }

  function closeScanner(): void {
    isScannerOpen.value = false;
  }

  async function loadScans(projectId: string): Promise<void> {
    isLoading.value = true;
    try {
      scans.value = await listAttendanceScans(projectId);
    } finally {
      isLoading.value = false;
    }
  }

  async function recordScan(value: string): Promise<RecordScanResult> {
    if (!currentProjectId.value) {
      return { ok: false, error: 'No project selected.' };
    }
    const parsed = parseEmployeePayload(value);
    if (!parsed) {
      return {
        ok: false,
        error: 'Invalid QR — expected JSON with "id" and "name".',
      };
    }
    const saved = await addAttendanceScan({
      projectId: currentProjectId.value,
      period: selectedPeriod.value,
      employeeId: parsed.employeeId,
      employeeName: parsed.employeeName,
    });
    if (!saved) {
      return { ok: false, error: 'Could not save scan — try again.' };
    }
    scans.value = [saved, ...scans.value];
    return { ok: true, log: saved };
  }

  async function removeScan(id?: number): Promise<void> {
    if (id === undefined) return;
    const ok = await deleteAttendanceScan(id);
    if (ok) {
      scans.value = scans.value.filter((s) => s.id !== id);
    }
  }

  async function clearScans(): Promise<void> {
    if (!currentProjectId.value) return;
    const ok = await clearAttendanceScans(currentProjectId.value);
    if (ok) {
      scans.value = [];
    }
  }

  async function clearScansForCurrentPeriod(): Promise<void> {
    if (!currentProjectId.value) return;
    const period = selectedPeriod.value;
    const ok = await clearAttendanceScansForPeriod(currentProjectId.value, period);
    if (ok) {
      scans.value = scans.value.filter((s) => s.period !== period);
    }
  }

  // Switching to a different project loads that project's persisted scans.
  async function setProject(id: string | null): Promise<void> {
    if (currentProjectId.value === id) return;
    currentProjectId.value = id;
    if (id) {
      await loadScans(id);
    } else {
      scans.value = [];
    }
  }

  return {
    selectedPeriod,
    isScannerOpen,
    scans,
    currentProjectId,
    isLoading,
    selectPeriod,
    openScanner,
    closeScanner,
    recordScan,
    removeScan,
    clearScans,
    clearScansForCurrentPeriod,
    loadScans,
    setProject,
  };
});
