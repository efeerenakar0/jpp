const ISTANBUL_TIME_ZONE = 'Europe/Istanbul';
const UNEXPECTED_SCRIPT_PATTERN =
  /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/u;

export type AppointmentSignal = {
  requested: boolean;
  proposedDate: Date | null;
  proposedTime: string | null;
};

function normalizeTurkish(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replaceAll('ı', 'i');
}

function getIstanbulDateParts(referenceDate: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ISTANBUL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(referenceDate);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function createStableDate(year: number, month: number, day: number): Date | null {
  const candidate = new Date(Date.UTC(year, month - 1, day, 9));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return candidate;
}

function getRelativeDate(referenceDate: Date, dayOffset: number): Date {
  const { year, month, day } = getIstanbulDateParts(referenceDate);
  return new Date(Date.UTC(year, month - 1, day + dayOffset, 9));
}

function extractExplicitDate(text: string, referenceDate: Date): Date | null {
  const match = text.match(/\b(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\b/);
  if (!match) {
    return null;
  }

  const { year: currentYear, month: currentMonth, day: currentDay } =
    getIstanbulDateParts(referenceDate);
  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = match[3]
    ? Number(match[3].length === 2 ? `20${match[3]}` : match[3])
    : currentYear;

  if (
    !match[3] &&
    (month < currentMonth || (month === currentMonth && day < currentDay))
  ) {
    year += 1;
  }

  return createStableDate(year, month, day);
}

function extractTime(normalizedText: string): string | null {
  const textWithoutDates = normalizedText.replace(
    /\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b/g,
    ' '
  );
  const clockMatch = textWithoutDates.match(
    /\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/
  );
  if (clockMatch) {
    return `${clockMatch[1].padStart(2, '0')}:${clockMatch[2]}`;
  }

  const hourMatch = textWithoutDates.match(/\bsaat\s+([01]?\d|2[0-3])\b/);
  return hourMatch ? `${hourMatch[1].padStart(2, '0')}:00` : null;
}

export function extractAppointmentSignal(
  text: string,
  referenceDate = new Date()
): AppointmentSignal {
  const normalizedText = normalizeTurkish(text);
  const requested =
    /\b(randevu|gorus\w*|gorebilir\w*|gosterebilir\w*|ziyaret\w*|toplanti)\b/.test(
      normalizedText
    ) ||
    /\b(ofise|ofisiniz|yaniniza)\s+(gel|gelebilir|ugra)/.test(normalizedText);

  if (!requested) {
    return { requested: false, proposedDate: null, proposedTime: null };
  }

  const proposedDate = normalizedText.includes('yarin')
    ? getRelativeDate(referenceDate, 1)
    : normalizedText.includes('bugun')
      ? getRelativeDate(referenceDate, 0)
      : extractExplicitDate(normalizedText, referenceDate);

  return {
    requested: true,
    proposedDate,
    proposedTime: extractTime(normalizedText),
  };
}

export function needsCustomerReplyRepair(content: string): boolean {
  return (
    UNEXPECTED_SCRIPT_PATTERN.test(content) ||
    /\b(approximately|available|appointment|tomorrow)\b/i.test(content)
  );
}
