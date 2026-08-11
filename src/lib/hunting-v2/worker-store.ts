import type {
  ParsedListingDetail,
  ParsedSearchListing,
} from './types';
import type {
  HuntWorkerJob,
  HuntWorkerProgress,
} from './worker-protocol';

export type HuntWorkerDirective = 'CONTINUE' | 'CANCEL' | 'PAUSE';
export type HuntWorkerOutcome =
  | 'COMPLETED'
  | 'PARTIAL'
  | 'SOURCE_CHALLENGE'
  | 'FAILED';

export interface HuntWorkerStore {
  claim(): Promise<HuntWorkerJob | null>;
  control(jobId: string): Promise<HuntWorkerDirective>;
  discover(
    jobId: string,
    items: ParsedSearchListing[],
    progress: HuntWorkerProgress
  ): Promise<void>;
  detail(
    jobId: string,
    detail: ParsedListingDetail,
    progress: HuntWorkerProgress
  ): Promise<void>;
  progress(
    jobId: string,
    progress: HuntWorkerProgress,
    error?: { code: 'REQUEST_FAILED'; summary?: string }
  ): Promise<void>;
  finish(
    jobId: string,
    outcome: HuntWorkerOutcome,
    progress: HuntWorkerProgress,
    errorSummary?: string
  ): Promise<void>;
}
