import { describe, expect, it } from 'vitest';
import { documentTemplates } from '../../../lib/document-center/catalog';
import type { DocumentRecordDTO, DocumentTemplateDTO } from './types';
import {
  filterDocumentRecords,
  filterDocumentTemplates,
} from './filters';

const templates = documentTemplates.map(
  (template, index) =>
    ({
      ...template,
      favorite: index === 0,
    }) satisfies DocumentTemplateDTO
);

function record(
  status: DocumentRecordDTO['status'],
  options: Partial<DocumentRecordDTO> = {}
): DocumentRecordDTO {
  return {
    publicId: `${status}-id`,
    documentNumber: `JAS-${status}`,
    title: `${status} belgesi`,
    status,
    legalStatus: 'DRAFT',
    templateKey: 'kapora-teslim-belgesi',
    templateVersion: 1,
    versionGroupId: 'group',
    versionNumber: 1,
    generatedAt: null,
    archivedAt: null,
    cancelledAt: null,
    deletedAt: null,
    createdAt: '2026-07-10T10:00:00.000Z',
    updatedAt: '2026-07-10T10:00:00.000Z',
    createdByName: 'Patron',
    lastEditedByName: 'Patron',
    template: {
      name: 'Kapora teslim belgesi',
      category: 'SALES',
      description: 'Kapora',
    },
    ...options,
  };
}

describe('Belge Merkezi filtreleri', () => {
  it('Türkçe arama ve kategori filtresini birlikte uygular', () => {
    const result = filterDocumentTemplates(templates, {
      query: 'kapora',
      category: 'SALES',
      favoritesOnly: false,
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((template) => template.category === 'SALES')).toBe(true);
    expect(
      result.some((template) => template.name === 'Kapora teslim belgesi')
    ).toBe(true);
  });

  it('yalnızca favori şablonları döndürebilir', () => {
    const result = filterDocumentTemplates(templates, {
      query: '',
      category: 'ALL',
      favoritesOnly: true,
    });
    expect(result).toHaveLength(1);
    expect(result[0].favorite).toBe(true);
  });

  it('taslak, tamamlanan ve çöp kayıtlarını doğru sekmeye ayırır', () => {
    const documents = [
      record('DRAFT'),
      record('GENERATED'),
      record('ARCHIVED'),
      record('CANCELLED', {
        publicId: 'deleted-id',
        deletedAt: '2026-07-11T10:00:00.000Z',
      }),
    ];
    expect(
      filterDocumentRecords(documents, {
        tab: 'drafts',
        query: '',
        archiveStatus: 'ALL',
        fromDate: '',
        toDate: '',
      })
    ).toHaveLength(1);
    expect(
      filterDocumentRecords(documents, {
        tab: 'completed',
        query: '',
        archiveStatus: 'ALL',
        fromDate: '',
        toDate: '',
      })
    ).toHaveLength(1);
    expect(
      filterDocumentRecords(documents, {
        tab: 'archive',
        query: '',
        archiveStatus: 'DELETED',
        fromDate: '',
        toDate: '',
      })
    ).toHaveLength(1);
  });
});
