export type TableTier = 'STANDARD' | 'PREMIUM' | 'GROUP';

/** Resolves tier from DB column when present; otherwise infers from seed labels (T1/T2/G1). */
export function resolveTableTier(input: {
  label: string;
  maxCapacity: number;
  tableTier?: string | null;
}): TableTier {
  if (input.tableTier === 'PREMIUM' || input.tableTier === 'GROUP') {
    return input.tableTier;
  }
  const label = input.label.trim().toUpperCase();
  if (label.startsWith('G')) {
    return 'GROUP';
  }
  if (label === 'T2' || input.maxCapacity >= 8) {
    return 'PREMIUM';
  }
  return 'STANDARD';
}
