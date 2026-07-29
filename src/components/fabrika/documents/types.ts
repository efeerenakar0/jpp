import type {
  DocumentContextDTO,
  DocumentTemplateDefinition,
  DocumentValues,
} from '@/lib/document-center/types';

export type DocumentTemplateDTO = DocumentTemplateDefinition & {
  favorite: boolean;
};

export type DocumentRecordDTO = {
  publicId: string;
  documentNumber: string;
  title: string;
  status: 'DRAFT' | 'GENERATED' | 'ARCHIVED' | 'CANCELLED';
  legalStatus: 'DRAFT' | 'COMPANY_APPROVED' | 'LEGAL_REVIEWED' | 'NEEDS_UPDATE';
  templateKey: string;
  templateVersion: number;
  versionGroupId: string;
  versionNumber: number;
  generatedAt: string | null;
  archivedAt: string | null;
  cancelledAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdByName: string;
  lastEditedByName: string;
  values?: DocumentValues;
  templateSnapshot?: DocumentTemplateDefinition;
  renderedSnapshot?: unknown;
  template: {
    name: string;
    category: string;
    description: string;
  };
};

export type DocumentCenterPayload = {
  templates: DocumentTemplateDTO[];
  documents: DocumentRecordDTO[];
  context: DocumentContextDTO;
};

export type WizardDocument = DocumentRecordDTO & {
  values: DocumentValues;
  templateSnapshot: DocumentTemplateDefinition;
};
