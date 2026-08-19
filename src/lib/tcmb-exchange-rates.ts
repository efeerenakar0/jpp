const CURRENCY_CODES = ['USD', 'EUR', 'GBP', 'CHF', 'AED', 'SAR'] as const;

const CURRENCY_NAMES: Record<(typeof CURRENCY_CODES)[number], string> = {
  USD: 'ABD Doları',
  EUR: 'Euro',
  GBP: 'İngiliz Sterlini',
  CHF: 'İsviçre Frangı',
  AED: 'BAE Dirhemi',
  SAR: 'Suudi Arabistan Riyali',
};

function xmlTag(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match?.[1]?.trim() || '';
}

function decimalValue(value: string) {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function parseTcmbRates(xml: string) {
  const publishedDate = xml.match(/<Tarih_Date\b[^>]*\bTarih="([^"]+)"/i)?.[1] || null;

  const rates = CURRENCY_CODES.flatMap((code) => {
    const block = xml.match(
      new RegExp(
        `<Currency\\b[^>]*\\bCurrencyCode="${code}"[^>]*>([\\s\\S]*?)<\\/Currency>`,
        'i'
      )
    )?.[1];
    if (!block) return [];

    const unit = decimalValue(xmlTag(block, 'Unit')) || 1;
    const buying = decimalValue(xmlTag(block, 'ForexBuying'));
    const selling = decimalValue(xmlTag(block, 'ForexSelling'));
    if (!buying || !selling) return [];

    return [
      {
        code,
        name: CURRENCY_NAMES[code],
        buying: buying / unit,
        selling: selling / unit,
        unit,
      },
    ];
  });

  if (!publishedDate || rates.length < 3) {
    throw new Error('TCMB kur verisi doğrulanamadı.');
  }

  return { publishedDate, rates };
}
