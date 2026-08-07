export type PortfolioVideoRenderStatus =
  | 'IDLE'
  | 'CHECKING'
  | 'RENDERING'
  | 'SUCCESS'
  | 'ERROR'
  | 'CANCELLED';

export type PortfolioVideoRenderState = {
  status: PortfolioVideoRenderStatus;
  progress: number;
  estimatedTimeMs: number | null;
  downloadUrl: string | null;
  error: string | null;
};

export type PortfolioVideoRenderAction =
  | { type: 'CHECK' }
  | { type: 'START' }
  | { type: 'PROGRESS'; progress: number; estimatedTimeMs: number | null }
  | { type: 'SUCCESS'; downloadUrl: string }
  | { type: 'ERROR'; error: string }
  | { type: 'CANCEL' }
  | { type: 'RESET' };

export const initialPortfolioVideoRenderState: PortfolioVideoRenderState = {
  status: 'IDLE',
  progress: 0,
  estimatedTimeMs: null,
  downloadUrl: null,
  error: null,
};

export function shouldRequestFreshPortfolioVideoPlan(input: {
  hasDirectedStoryboard: boolean;
  forceNewVariation: boolean;
}) {
  return input.forceNewVariation || !input.hasDirectedStoryboard;
}

export function portfolioVideoRenderReducer(
  state: PortfolioVideoRenderState,
  action: PortfolioVideoRenderAction
): PortfolioVideoRenderState {
  switch (action.type) {
    case 'CHECK':
      return { ...initialPortfolioVideoRenderState, status: 'CHECKING' };
    case 'START':
      return { ...initialPortfolioVideoRenderState, status: 'RENDERING' };
    case 'PROGRESS':
      if (state.status !== 'RENDERING') return state;
      return {
        ...state,
        progress: Math.min(1, Math.max(0, action.progress)),
        estimatedTimeMs: action.estimatedTimeMs,
      };
    case 'SUCCESS':
      return {
        status: 'SUCCESS',
        progress: 1,
        estimatedTimeMs: 0,
        downloadUrl: action.downloadUrl,
        error: null,
      };
    case 'ERROR':
      return {
        ...initialPortfolioVideoRenderState,
        status: 'ERROR',
        error: action.error,
      };
    case 'CANCEL':
      return { ...initialPortfolioVideoRenderState, status: 'CANCELLED' };
    case 'RESET':
      return initialPortfolioVideoRenderState;
  }
}

export function toPortfolioVideoRenderError(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'Video oluşturma işlemi iptal edildi.';
  }
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/webcodecs|codec|unsupported|can.?render/i.test(message)) {
    return 'Bu tarayıcı MP4 oluşturmayı desteklemiyor. Güncel Chrome veya Edge ile yeniden deneyin.';
  }
  if (/memory|allocation|out of memory/i.test(message)) {
    return 'Tarayıcı belleği yetersiz kaldı. Daha az fotoğraf seçip yeniden deneyin.';
  }
  return message.trim() || 'Video oluşturulamadı. Lütfen yeniden deneyin.';
}
