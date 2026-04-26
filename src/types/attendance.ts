export type AttendancePeriod = 'p1_in' | 'p1_out' | 'p2_in' | 'p2_out' | 'p3_in' | 'p3_out';

export type AttendanceDirection = 'in' | 'out';
export type AttendanceShift = 'morning' | 'afternoon' | 'ot';

export interface AttendancePeriodMeta {
  key: AttendancePeriod;
  shift: AttendanceShift;
  direction: AttendanceDirection;
  shiftLabel: string;
  directionLabel: string;
}

export const ATTENDANCE_PERIODS: AttendancePeriodMeta[] = [
  { key: 'p1_in', shift: 'morning', direction: 'in', shiftLabel: 'Morning', directionLabel: 'In' },
  {
    key: 'p1_out',
    shift: 'morning',
    direction: 'out',
    shiftLabel: 'Morning',
    directionLabel: 'Out',
  },
  {
    key: 'p2_in',
    shift: 'afternoon',
    direction: 'in',
    shiftLabel: 'Afternoon',
    directionLabel: 'In',
  },
  {
    key: 'p2_out',
    shift: 'afternoon',
    direction: 'out',
    shiftLabel: 'Afternoon',
    directionLabel: 'Out',
  },
  { key: 'p3_in', shift: 'ot', direction: 'in', shiftLabel: 'Overtime', directionLabel: 'In' },
  { key: 'p3_out', shift: 'ot', direction: 'out', shiftLabel: 'Overtime', directionLabel: 'Out' },
];
