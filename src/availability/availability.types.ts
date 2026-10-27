export type BookingPolicy = {
  timezone: string;
  minNoticeMinutes: number;
  maxAdvanceDays: number;
  minPartySize: number;
  maxPartySize: number;
  defaultDurationMinutes: number;
  turnoverBufferMinutes: number;
};

export type ResolvedShift = {
  id: string;
  name: string;
  startsAtLocal: string;
  endsAtLocal: string;
  durationMinutes: number;
};

export type TimeSlot = {
  shiftId: string;
  shiftName: string;
  startsAt: Date;
  endsAt: Date;
};

export type TableDefinition = {
  id: string;
  areaId: string;
  label: string;
  minCapacity: number;
  maxCapacity: number;
  bookable: boolean;
};

export type ReservationBlock = {
  tableId: string;
  startsAt: Date;
  endsAt: Date;
};

export type BlockWindow = {
  tableId: string | null;
  areaId: string | null;
  startsAt: Date;
  endsAt: Date;
};

export const CAPACITY_RESERVATION_STATUSES = new Set([
  'PENDING_PAYMENT',
  'PENDING_CONFIRMATION',
  'CONFIRMED',
  'CHECKED_IN',
]);
