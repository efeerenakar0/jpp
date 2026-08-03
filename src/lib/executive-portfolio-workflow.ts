export const EXECUTIVE_WORKFLOW_STEPS = [
  'source',
  'portfolio',
  'review',
  'advertising',
  'marketing',
  'results',
] as const;

export type ExecutiveWorkflowStep = (typeof EXECUTIVE_WORKFLOW_STEPS)[number];
export type ExecutiveWorkflowSource = 'studio' | 'hunter';
export type ExecutiveMediaStatus =
  | 'queued'
  | 'uploading'
  | 'processing'
  | 'ready'
  | 'error';

export type ExecutivePortfolioMedia = {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: ExecutiveMediaStatus;
  error?: string;
  removed: boolean;
  restoredToOriginal: boolean;
  previewUrl?: string;
  originalUrl?: string;
  outputUrl?: string;
  attachedMediaId?: string;
};

export type ExecutivePortfolioDetails = {
  title: string;
  location: string;
  propertyType: string;
  price: string;
  description: string;
};

export type ExecutivePortfolioDraft = {
  id: string;
  studioBatchId: string | null;
  propertyId: string | null;
  source: ExecutiveWorkflowSource | null;
  currentStep: ExecutiveWorkflowStep;
  details: ExecutivePortfolioDetails;
  media: ExecutivePortfolioMedia[];
  coverMediaId: string | null;
  advertising: {
    skipped: boolean;
    posters: string[];
  };
  marketing: {
    countries: string[];
    channels: string[];
    copy: string;
  };
  updatedAt: string;
};

export type ExecutivePortfolioAction =
  | { type: 'choose-source'; source: ExecutiveWorkflowSource }
  | { type: 'go-to-step'; step: ExecutiveWorkflowStep }
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'update-details'; details: Partial<ExecutivePortfolioDetails> }
  | {
      type: 'add-media';
      media: Array<{
        id: string;
        name: string;
        size: number;
        previewUrl?: string;
      }>;
    }
  | {
      type: 'update-media';
      id: string;
      progress: number;
      status: ExecutiveMediaStatus;
      error?: string;
    }
  | { type: 'retry-media'; id: string }
  | {
      type: 'sync-studio-batch';
      batchId: string;
      media: ExecutivePortfolioMedia[];
    }
  | { type: 'set-property-id'; propertyId: string }
  | { type: 'select-cover'; id: string }
  | { type: 'remove-media'; id: string }
  | { type: 'restore-original'; id: string }
  | { type: 'set-advertising-skipped'; skipped: boolean }
  | { type: 'skip-advertising' }
  | {
      type: 'set-marketing';
      countries: string[];
      channels: string[];
      copy?: string;
    }
  | { type: 'replace-draft'; draft: ExecutivePortfolioDraft }
  | { type: 'reset' };

const STORAGE_VERSION = 1;

function nowIso() {
  return new Date().toISOString();
}

export function createExecutivePortfolioDraft(): ExecutivePortfolioDraft {
  return {
    id: `portfolio-${crypto.randomUUID()}`,
    studioBatchId: null,
    propertyId: null,
    source: null,
    currentStep: 'source',
    details: {
      title: '',
      location: '',
      propertyType: '',
      price: '',
      description: '',
    },
    media: [],
    coverMediaId: null,
    advertising: {
      skipped: false,
      posters: [],
    },
    marketing: {
      countries: [],
      channels: [],
      copy: '',
    },
    updatedAt: nowIso(),
  };
}

export function resolveExecutiveWorkflowEntryStep(
  draft: ExecutivePortfolioDraft,
  requestedStep: ExecutiveWorkflowStep
): ExecutiveWorkflowStep {
  if (!draft.source && requestedStep !== 'source') return 'source';
  if (
    !draft.propertyId &&
    ['review', 'advertising', 'marketing', 'results'].includes(requestedStep)
  ) {
    return 'portfolio';
  }
  return requestedStep;
}

function withUpdatedAt(
  draft: ExecutivePortfolioDraft,
  patch: Partial<ExecutivePortfolioDraft>
): ExecutivePortfolioDraft {
  return { ...draft, ...patch, updatedAt: nowIso() };
}

function adjacentStep(
  currentStep: ExecutiveWorkflowStep,
  direction: -1 | 1
): ExecutiveWorkflowStep {
  const currentIndex = EXECUTIVE_WORKFLOW_STEPS.indexOf(currentStep);
  const nextIndex = Math.min(
    EXECUTIVE_WORKFLOW_STEPS.length - 1,
    Math.max(0, currentIndex + direction)
  );
  return EXECUTIVE_WORKFLOW_STEPS[nextIndex];
}

export function executivePortfolioReducer(
  draft: ExecutivePortfolioDraft,
  action: ExecutivePortfolioAction
): ExecutivePortfolioDraft {
  switch (action.type) {
    case 'choose-source':
      return withUpdatedAt(draft, {
        source: action.source,
        currentStep: 'portfolio',
      });
    case 'go-to-step':
      return withUpdatedAt(draft, { currentStep: action.step });
    case 'next':
      return withUpdatedAt(draft, {
        currentStep: adjacentStep(draft.currentStep, 1),
      });
    case 'back':
      return withUpdatedAt(draft, {
        currentStep: adjacentStep(draft.currentStep, -1),
      });
    case 'update-details':
      return withUpdatedAt(draft, {
        details: { ...draft.details, ...action.details },
      });
    case 'add-media': {
      const knownIds = new Set(draft.media.map((item) => item.id));
      const incoming = action.media
        .filter((item) => !knownIds.has(item.id))
        .map((item) => ({
          ...item,
          progress: 0,
          status: 'queued' as const,
          removed: false,
          restoredToOriginal: false,
        }));
      return withUpdatedAt(draft, { media: [...draft.media, ...incoming] });
    }
    case 'update-media':
      return withUpdatedAt(draft, {
        media: draft.media.map((item) =>
          item.id === action.id
            ? {
                ...item,
                progress: Math.min(100, Math.max(0, action.progress)),
                status: action.status,
                error: action.error,
              }
            : item
        ),
      });
    case 'retry-media':
      return withUpdatedAt(draft, {
        media: draft.media.map((item) =>
          item.id === action.id
            ? { ...item, progress: 0, status: 'queued', error: undefined }
            : item
        ),
      });
    case 'sync-studio-batch':
      return withUpdatedAt(draft, {
        studioBatchId: action.batchId,
        media: action.media,
        coverMediaId: action.media.some(
          (media) => media.id === draft.coverMediaId && !media.removed
        )
          ? draft.coverMediaId
          : null,
      });
    case 'set-property-id':
      return withUpdatedAt(draft, { propertyId: action.propertyId });
    case 'select-cover':
      return draft.media.some((item) => item.id === action.id && !item.removed)
        ? withUpdatedAt(draft, { coverMediaId: action.id })
        : draft;
    case 'remove-media':
      return withUpdatedAt(draft, {
        coverMediaId:
          draft.coverMediaId === action.id ? null : draft.coverMediaId,
        media: draft.media.map((item) =>
          item.id === action.id ? { ...item, removed: true } : item
        ),
      });
    case 'restore-original':
      return withUpdatedAt(draft, {
        media: draft.media.map((item) =>
          item.id === action.id
            ? {
                ...item,
                removed: false,
                restoredToOriginal: true,
                error: undefined,
              }
            : item
        ),
      });
    case 'set-advertising-skipped':
      return withUpdatedAt(draft, {
        advertising: { ...draft.advertising, skipped: action.skipped },
      });
    case 'skip-advertising':
      return withUpdatedAt(draft, {
        currentStep: 'marketing',
        advertising: { ...draft.advertising, skipped: true },
      });
    case 'set-marketing':
      return withUpdatedAt(draft, {
        marketing: {
          countries: [...action.countries],
          channels: [...action.channels],
          copy: action.copy ?? draft.marketing.copy ?? '',
        },
      });
    case 'replace-draft':
      return action.draft;
    case 'reset':
      return createExecutivePortfolioDraft();
  }
}

export function serializeExecutivePortfolioDraft(
  draft: ExecutivePortfolioDraft
): string {
  const persistedDraft: ExecutivePortfolioDraft = {
    ...draft,
    media: draft.media.map((media) => {
      const persistedMedia = { ...media };
      delete persistedMedia.previewUrl;
      return persistedMedia;
    }),
  };
  return JSON.stringify({ version: STORAGE_VERSION, draft: persistedDraft });
}

function isDraft(value: unknown): value is ExecutivePortfolioDraft {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ExecutivePortfolioDraft>;
  return (
    typeof candidate.id === 'string' &&
    (candidate.source === null ||
      candidate.source === 'studio' ||
      candidate.source === 'hunter') &&
    EXECUTIVE_WORKFLOW_STEPS.includes(
      candidate.currentStep as ExecutiveWorkflowStep
    ) &&
    Boolean(candidate.details && typeof candidate.details === 'object') &&
    Array.isArray(candidate.media) &&
    Boolean(candidate.advertising && typeof candidate.advertising === 'object') &&
    Boolean(candidate.marketing && typeof candidate.marketing === 'object') &&
    typeof candidate.updatedAt === 'string'
  );
}

export function deserializeExecutivePortfolioDraft(
  serialized: string | null
): ExecutivePortfolioDraft | null {
  if (!serialized) return null;
  try {
    const value = JSON.parse(serialized) as {
      version?: number;
      draft?: unknown;
    };
    if (value.version !== STORAGE_VERSION || !isDraft(value.draft)) return null;
    return {
      ...value.draft,
      studioBatchId:
        typeof value.draft.studioBatchId === 'string'
          ? value.draft.studioBatchId
          : null,
      propertyId:
        typeof value.draft.propertyId === 'string'
          ? value.draft.propertyId
          : null,
      marketing: {
        ...value.draft.marketing,
        copy:
          typeof value.draft.marketing.copy === 'string'
            ? value.draft.marketing.copy
            : '',
      },
    };
  } catch {
    return null;
  }
}
