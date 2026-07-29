import {
  detectSourceChallenge,
  parseListingDetailHtml,
  parseSearchResultsHtml,
} from './parsers';
import type { ParsedListingDetail } from './types';

export class SourceChallengeError extends Error {
  constructor(message = 'Kaynak güvenlik doğrulaması gösterdi.') {
    super(message);
    this.name = 'SourceChallengeError';
  }
}

export function assertNoSourceChallenge(html: string) {
  if (detectSourceChallenge(html)) throw new SourceChallengeError();
}

export function processFixtureDocuments(input: {
  searchHtml: string;
  searchUrl: string;
  detailDocuments: ReadonlyMap<string, string>;
}) {
  assertNoSourceChallenge(input.searchHtml);
  const list = parseSearchResultsHtml(input.searchHtml, input.searchUrl);
  const details: ParsedListingDetail[] = [];
  let partial = 0;
  for (const listing of list.listings) {
    const html = input.detailDocuments.get(listing.sourceListingId);
    if (!html) {
      partial += 1;
      continue;
    }
    assertNoSourceChallenge(html);
    details.push(parseListingDetailHtml(html, listing.sourceUrl));
  }
  return {
    discovered: list.listings.length,
    completed: details.length,
    partial,
    details,
    nextPageUrl: list.nextPageUrl,
  };
}
