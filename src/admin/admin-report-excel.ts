import ExcelJS from 'exceljs';

export type AdminReportExcelRow = {
  reference: string;
  startsAt: string;
  endsAt: string;
  partySize: number;
  status: string;
  source: string;
  checkedInAt: string | null;
};

export type AdminReportExcelSummary = {
  from: string;
  to: string;
  timezone: string;
  reservationCount: number;
  activeCount: number;
  cancellationCount: number;
  guestSeats: number;
  checkedInCount: number;
  attendanceGuests: number;
  pendingCheckInCount: number;
  noShowCount: number;
  webBookings: number;
  walkInBookings: number;
  checkInRatePercent: number | null;
  todayDate: string;
  todayReservationCount: number;
  todayGuestSeats: number;
  todayCheckedInCount: number;
  todayAttendanceGuests: number;
  todayPendingCheckInCount: number;
};

export async function buildAdminReportWorkbook(
  summary: AdminReportExcelSummary,
  rows: AdminReportExcelRow[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Iturrieta Admin';
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 32 },
    { header: 'Value', key: 'value', width: 24 },
  ];
  styleHeaderRow(summarySheet.getRow(1));

  const summaryRows: Array<[string, string | number]> = [
    ['Report from', summary.from],
    ['Report to', summary.to],
    ['Timezone', summary.timezone],
    ['Total bookings', summary.reservationCount],
    ['Active (non-cancelled)', summary.activeCount],
    ['Cancellations', summary.cancellationCount],
    ['Guest seats', summary.guestSeats],
    ['Checked in', summary.checkedInCount],
    ['Attendance (guests)', summary.attendanceGuests],
    ['Awaiting check-in', summary.pendingCheckInCount],
    ['No-shows', summary.noShowCount],
    ['Online bookings', summary.webBookings],
    ['Walk-in / phone', summary.walkInBookings],
    ['Check-in rate %', summary.checkInRatePercent ?? '—'],
    ['Today (date)', summary.todayDate],
    ['Today bookings', summary.todayReservationCount],
    ['Today guests expected', summary.todayGuestSeats],
    ['Today checked in', summary.todayCheckedInCount],
    ['Today attendance', summary.todayAttendanceGuests],
    ['Today awaiting check-in', summary.todayPendingCheckInCount],
  ];
  for (const [metric, value] of summaryRows) {
    summarySheet.addRow({ metric, value });
  }

  const bookingsSheet = workbook.addWorksheet('Bookings');
  bookingsSheet.columns = [
    { header: 'Reference', key: 'reference', width: 16 },
    { header: 'Starts', key: 'startsAt', width: 22 },
    { header: 'Ends', key: 'endsAt', width: 22 },
    { header: 'Party', key: 'partySize', width: 8 },
    { header: 'Status', key: 'status', width: 18 },
    { header: 'Source', key: 'source', width: 12 },
    { header: 'Checked in at', key: 'checkedInAt', width: 22 },
  ];
  styleHeaderRow(bookingsSheet.getRow(1));

  for (const row of rows) {
    bookingsSheet.addRow({
      reference: row.reference,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      partySize: row.partySize,
      status: row.status,
      source: row.source,
      checkedInAt: row.checkedInAt ?? '',
    });
  }

  bookingsSheet.autoFilter = {
    from: 'A1',
    to: `G${Math.max(1, rows.length + 1)}`,
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2D4A3E' },
  };
  row.alignment = { vertical: 'middle' };
}
