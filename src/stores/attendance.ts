import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import {
  addAttendanceScan,
  clearAttendanceScans,
  clearAttendanceScansForPeriod,
  deleteAttendanceScan,
  listAttendanceScans,
  setAttendanceScanError,
} from '@/db';
import type { AttendanceScanRecord } from '@/db';
import http from '@/http/axios';
import type { AttendancePeriod } from '@/types/attendance';

export type AttendanceScanLog = AttendanceScanRecord;

export type RecordScanResult =
  | { ok: true; log: AttendanceScanLog }
  | { ok: false; error: string };

export type PreviewScanResult =
  | { ok: true; employeeId: number; employeeName: string }
  | { ok: false; error: string };

export interface SubmitSummary {
  total: number;
  successCount: number;
  failureCount: number;
}

// Canonical period order so the batch upload walks shifts predictably:
// morning → afternoon → OT, in/out paired.
const PERIOD_ORDER: AttendancePeriod[] = [
  'p1_in',
  'p1_out',
  'p2_in',
  'p2_out',
  'p3_in',
  'p3_out',
];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// Pause between scans so the user can perceive the per-item progress —
// without it, fast networks would blow through the list before the
// indicator on each row has a chance to render.
const SUBMIT_STEP_DELAY_MS = 400;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
  const selectedPeriod = ref<AttendancePeriod>('p1_in');
  const scans = ref<AttendanceScanLog[]>([]);
  const currentProjectId = ref<string | null>(null);
  const isLoading = ref(false);
  // Submission state for the batch upload to `attendance/single`.
  // `submittingScanId` is the scan currently in-flight; the period buttons
  // and the cross icon both key off it.
  const isSubmitting = ref(false);
  const submittingScanId = ref<number | null>(null);
  // Derived from the in-flight scan so the period buttons can show which
  // shift/direction is currently being uploaded — distinct from
  // `selectedPeriod`, which is the user's (or auto-walked) view selection.
  const submittingPeriod = computed<AttendancePeriod | null>(() => {
    if (submittingScanId.value === null) return null;
    return scans.value.find((s) => s.id === submittingScanId.value)?.period ?? null;
  });

  function selectPeriod(period: AttendancePeriod): void {
    selectedPeriod.value = period;
  }

  async function loadScans(projectId: string): Promise<void> {
    isLoading.value = true;
    try {
      scans.value = await listAttendanceScans(projectId);
    } finally {
      isLoading.value = false;
    }
  }

  function previewScan(value: string): PreviewScanResult {
    const parsed = parseEmployeePayload(value);
    if (!parsed) {
      return { ok: false, error: 'Invalid QR — expected JSON with "id" and "name".' };
    }
    return { ok: true, employeeId: parsed.employeeId, employeeName: parsed.employeeName };
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

  // POST every recorded scan to `attendance/single`, one at a time, walking
  // periods in canonical order. Per-item status is exposed via
  // `submittingScanId` (in-flight) and `submitResults` (final).
  //
  // Contract: the batch ALWAYS runs to completion. Each scan is wrapped in
  // its own try/catch so a network/server failure on one scan never aborts
  // the rest — the failed scan is marked 'error' and the loop moves on.
  async function submitAllScans(): Promise<SubmitSummary> {
    const empty: SubmitSummary = { total: 0, successCount: 0, failureCount: 0 };
    if (isSubmitting.value || !currentProjectId.value) return empty;

    const ordered = scans.value
      .filter((s) => s.id !== undefined)
      .slice()
      .sort((a, b) => {
        const pa = PERIOD_ORDER.indexOf(a.period);
        const pb = PERIOD_ORDER.indexOf(b.period);
        if (pa !== pb) return pa - pb;
        return a.createdAt - b.createdAt;
      });

    if (ordered.length === 0) return empty;

    const projectIdNum = Number(currentProjectId.value);
    isSubmitting.value = true;

    let successCount = 0;
    let failureCount = 0;

    // Patch a single scan's submitErrorMsg in the reactive list so the
    // prepend icon and inline error update without a full reload. `null`
    // clears the field (e.g. before a retry).
    const patchLocalError = (id: number, errorMsg: string | null): void => {
      scans.value = scans.value.map((s) => {
        if (s.id !== id) return s;
        if (!errorMsg) {
          const { submitErrorMsg: _drop, ...rest } = s;
          return rest as AttendanceScanLog;
        }
        return { ...s, submitErrorMsg: errorMsg };
      });
    };

    try {
      let first = true;
      for (const scan of ordered) {
        // Pace the batch so the UI can render per-item progress between
        // requests. Skip the first iteration so submission feels responsive.
        if (!first) await delay(SUBMIT_STEP_DELAY_MS);
        first = false;
        // Wrap the entire iteration body in try/catch — including state
        // assignments and date formatting — so nothing inside a single
        // iteration can break the loop. Failures are recorded and we move on.
        const id = scan.id as number;
        try {
          // Walk the period selector forward so the user can watch each
          // shift/direction tab light up as its scans are processed.
          selectedPeriod.value = scan.period;
          submittingScanId.value = id;
          // Wipe any stale error message from a prior attempt so retries
          // present a clean slate; we'll re-mark it below if this attempt
          // also fails. Local UI updates first, persistence is best-effort.
          if (scan.submitErrorMsg) {
            patchLocalError(id, null);
            void setAttendanceScanError(id, null);
          }
          const d = new Date(scan.createdAt);
          const date = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
          const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
          await http.post('attendance/single', {
            project_id: projectIdNum,
            employee_id: scan.employeeId,
            period: scan.period,
            date,
            time,
          });
          successCount++;
        } catch (e) {
          try {
            console.error('submitAllScans: scan failed', { id, error: e });
            // The axios response interceptor already extracts {message} from
            // JSON error bodies and surfaces it on the rejection. Fall back
            // to a generic message if anything unexpected was thrown.
            const errorMsg =
              (e && typeof e === 'object' && 'message' in e
                ? String((e as { message: unknown }).message)
                : null) ?? 'Submit failed.';
            patchLocalError(id, errorMsg);
            await setAttendanceScanError(id, errorMsg);
          } catch {
            // Swallow any error from logging/state — the batch must keep going.
          }
          failureCount++;
        }
      }
    } finally {
      submittingScanId.value = null;
      isSubmitting.value = false;
    }

    return { total: ordered.length, successCount, failureCount };
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
    scans,
    currentProjectId,
    isLoading,
    isSubmitting,
    submittingScanId,
    submittingPeriod,
    selectPeriod,
    previewScan,
    recordScan,
    removeScan,
    clearScans,
    clearScansForCurrentPeriod,
    loadScans,
    setProject,
    submitAllScans,
  };
});
