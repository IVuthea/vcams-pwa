export type AttendancePeriod =
  | 'morning_in'
  | 'morning_out'
  | 'afternoon_in'
  | 'afternoon_out'
  | 'ot_in'
  | 'ot_out';

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
  { key: 'morning_in', shift: 'morning', direction: 'in', shiftLabel: 'Morning', directionLabel: 'In' },
  { key: 'morning_out', shift: 'morning', direction: 'out', shiftLabel: 'Morning', directionLabel: 'Out' },
  { key: 'afternoon_in', shift: 'afternoon', direction: 'in', shiftLabel: 'Afternoon', directionLabel: 'In' },
  { key: 'afternoon_out', shift: 'afternoon', direction: 'out', shiftLabel: 'Afternoon', directionLabel: 'Out' },
  { key: 'ot_in', shift: 'ot', direction: 'in', shiftLabel: 'Overtime', directionLabel: 'In' },
  { key: 'ot_out', shift: 'ot', direction: 'out', shiftLabel: 'Overtime', directionLabel: 'Out' },
];
