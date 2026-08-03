type PropertyCandidate = {
  id: string;
  referenceCode: string | null;
  title: string;
  location: string | null;
};

function normalized(value: string | null | undefined) {
  return (value || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9çğıöşü]+/giu, ' ')
    .trim();
}

function usefulTokens(value: string) {
  return new Set(
    normalized(value)
      .split(/\s+/u)
      .filter((token) => token.length >= 3)
      .filter(
        (token) =>
          ![
            'icin',
            'görmek',
            'gormek',
            'istiyorum',
            'randevu',
            'gösterim',
            'gosterim',
            'ev',
            'daire',
            'villa',
          ].includes(token)
      )
  );
}

export function resolvePropertyCandidates(
  message: string,
  properties: PropertyCandidate[]
):
  | { status: 'RESOLVED'; propertyId: string; candidates: PropertyCandidate[] }
  | { status: 'AMBIGUOUS'; propertyId: null; candidates: PropertyCandidate[] }
  | { status: 'NOT_FOUND'; propertyId: null; candidates: PropertyCandidate[] } {
  const messageNormalized = normalized(message);
  const explicit = properties.filter((property) => {
    const code = normalized(property.referenceCode);
    return code.length > 0 && messageNormalized.includes(code);
  });
  if (explicit.length === 1) {
    return {
      status: 'RESOLVED',
      propertyId: explicit[0].id,
      candidates: explicit,
    };
  }
  if (explicit.length > 1) {
    return { status: 'AMBIGUOUS', propertyId: null, candidates: explicit };
  }

  const messageTokens = usefulTokens(message);
  const scored = properties
    .map((property) => {
      const title = normalized(property.title);
      const location = normalized(property.location);
      const tokens = usefulTokens(`${property.title} ${property.location || ''}`);
      let score = 0;
      for (const token of messageTokens) {
        if (
          tokens.has(token) ||
          [...tokens].some(
            (candidate) =>
              (token.length >= 4 && candidate.startsWith(token)) ||
              (candidate.length >= 4 && token.startsWith(candidate))
          )
        ) {
          score += 1;
        }
      }
      if (title.length >= 8 && messageNormalized.includes(title)) score += 20;
      if (location.length >= 6 && messageNormalized.includes(location)) score += 6;
      return { property, score };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score);

  if (scored.length === 0) {
    return { status: 'NOT_FOUND', propertyId: null, candidates: [] };
  }
  const topScore = scored[0].score;
  const top = scored
    .filter(({ score }) => score === topScore)
    .map(({ property }) => property);
  if (top.length !== 1 || topScore < 2) {
    const candidates = scored
      .filter(({ score }) => score >= Math.max(1, topScore - 1))
      .slice(0, 5)
      .map(({ property }) => property);
    return { status: 'AMBIGUOUS', propertyId: null, candidates };
  }
  return { status: 'RESOLVED', propertyId: top[0].id, candidates: top };
}

export function propertyClarificationText(
  candidates: PropertyCandidate[]
) {
  if (candidates.length === 0) {
    return 'Gösterim istediğiniz portföyü kesinleştiremedim. Lütfen portföy kodunu veya ilanın tam başlığını yazın.';
  }
  const options = candidates
    .slice(0, 5)
    .map(
      (property, index) =>
        `${index + 1}) ${property.referenceCode || 'Kodsuz'} — ${property.title}${
          property.location ? ` (${property.location})` : ''
        }`
    )
    .join('\n');
  return `Hangi portföy için gösterim istiyorsunuz? Lütfen portföy kodunu yazın:\n${options}`;
}
