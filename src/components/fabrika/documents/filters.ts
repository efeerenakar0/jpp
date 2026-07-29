import type { DocumentCategory } from '@/lib/document-center/types';
import type { DocumentRecordDTO, DocumentTemplateDTO } from './types';

export function filterDocumentTemplates(
  templates: DocumentTemplateDTO[],
  input: {
    query: string;
    category: 'ALL' | DocumentCategory;
    favoritesOnly: boolean;
  }
) {
  const normalized = input.query.toLocaleLowerCase('tr-TR');
  return templates.filter((template) => {
    const matchesQuery =
      !normalized ||
      `${template.name} ${template.description} ${template.tags.join(' ')}`
        .toLocaleLowerCase('tr-TR')
        .includes(normalized);
    return (
      matchesQuery &&
      (input.category === 'ALL' || template.category === input.category) &&
      (!input.favoritesOnly || template.favorite)
    );
  });
}

export function filterDocumentRecords(
  documents: DocumentRecordDTO[],
  input: {
    tab: 'catalog' | 'drafts' | 'completed' | 'archive';
    query: string;
    archiveStatus: 'ALL' | 'ARCHIVED' | 'CANCELLED' | 'DELETED';
    fromDate: string;
    toDate: string;
  }
) {
  const normalized = input.query.toLocaleLowerCase('tr-TR');
  return documents.filter((document) => {
    const matchesQuery =
      !normalized ||
      `${document.title} ${document.documentNumber} ${document.template.name}`
        .toLocaleLowerCase('tr-TR')
        .includes(normalized);
    const updated = new Date(document.updatedAt).getTime();
    const matchesFrom =
      !input.fromDate ||
      updated >= new Date(`${input.fromDate}T00:00:00`).getTime();
    const matchesTo =
      !input.toDate ||
      updated <= new Date(`${input.toDate}T23:59:59`).getTime();
    const matchesTab =
      input.tab === 'drafts'
        ? document.status === 'DRAFT' && !document.deletedAt
        : input.tab === 'completed'
          ? document.status === 'GENERATED' && !document.deletedAt
          : input.tab === 'archive'
            ? Boolean(document.deletedAt) ||
              ['ARCHIVED', 'CANCELLED'].includes(document.status)
            : false;
    const matchesArchive =
      input.tab !== 'archive' ||
      input.archiveStatus === 'ALL' ||
      (input.archiveStatus === 'DELETED'
        ? Boolean(document.deletedAt)
        : document.status === input.archiveStatus && !document.deletedAt);
    return (
      matchesQuery &&
      matchesFrom &&
      matchesTo &&
      matchesTab &&
      matchesArchive
    );
  });
}
