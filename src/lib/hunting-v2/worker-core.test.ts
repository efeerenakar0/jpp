import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SourceChallengeError,
  processFixtureDocuments,
} from './worker-core';

const fixture = (name: string) =>
  readFileSync(join(__dirname, '__fixtures__', name), 'utf8');

describe('Avcı worker çekirdeği', () => {
  it('LIST ve DETAIL belgelerini görünür iletişim alanlarıyla işler', () => {
    const result = processFixtureDocuments({
      searchHtml: fixture('search-results.html'),
      searchUrl: 'https://fixture.local/search',
      detailDocuments: new Map([
        ['fixture-1001', fixture('listing-detail.html')],
      ]),
    });
    expect(result.discovered).toBe(2);
    expect(result.completed).toBe(1);
    expect(result.partial).toBe(1);
    expect(result.details[0]?.images).toHaveLength(2);
    expect(result.details[0]?.sellerName).toBe('Fixture İlan Sahibi');
    expect(result.details[0]?.phones).toEqual(['905000000000']);
  });

  it('challenge görünce aşmak yerine durdurur', () => {
    expect(() =>
      processFixtureDocuments({
        searchHtml: fixture('challenge.html'),
        searchUrl: 'https://fixture.local/search',
        detailDocuments: new Map(),
      })
    ).toThrow(SourceChallengeError);
  });
});
