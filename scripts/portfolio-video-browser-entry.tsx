import { canRenderMediaOnWeb, renderMediaOnWeb } from '@remotion/web-renderer';
import { PortfolioPromoVideo } from '../src/remotion/portfolio-video/PortfolioPromoVideo';
import {
  PORTFOLIO_PROMO_VIDEO_DURATION,
  PORTFOLIO_PROMO_VIDEO_FPS,
  PORTFOLIO_PROMO_VIDEO_HEIGHT,
  PORTFOLIO_PROMO_VIDEO_ID,
  PORTFOLIO_PROMO_VIDEO_WIDTH,
} from '../src/remotion/portfolio-video/constants';
import { PORTFOLIO_PROMO_VIDEO_FIXTURE_PROPS } from '../src/remotion/portfolio-video/fixture';

declare global {
  interface Window {
    runPortfolioVideoBrowserVerification: () => Promise<{
      canRender: boolean;
      issues: string[];
      blobSize: number;
      blobType: string;
      finalProgress: number;
    }>;
  }
}

window.runPortfolioVideoBrowserVerification = async () => {
  const support = await canRenderMediaOnWeb({
    container: 'mp4',
    videoCodec: 'h264',
    audioCodec: null,
    width: PORTFOLIO_PROMO_VIDEO_WIDTH,
    height: PORTFOLIO_PROMO_VIDEO_HEIGHT,
    muted: true,
  });
  if (!support.canRender) {
    return {
      canRender: false,
      issues: support.issues.map((issue) => `${issue.type}: ${issue.message}`),
      blobSize: 0,
      blobType: '',
      finalProgress: 0,
    };
  }

  let finalProgress = 0;
  const result = await renderMediaOnWeb({
    composition: {
      id: PORTFOLIO_PROMO_VIDEO_ID,
      component: PortfolioPromoVideo,
      defaultProps: PORTFOLIO_PROMO_VIDEO_FIXTURE_PROPS,
      durationInFrames: PORTFOLIO_PROMO_VIDEO_DURATION,
      fps: PORTFOLIO_PROMO_VIDEO_FPS,
      width: PORTFOLIO_PROMO_VIDEO_WIDTH,
      height: PORTFOLIO_PROMO_VIDEO_HEIGHT,
    },
    inputProps: PORTFOLIO_PROMO_VIDEO_FIXTURE_PROPS,
    container: 'mp4',
    videoCodec: 'h264',
    audioCodec: null,
    muted: true,
    scale: 0.25,
    pageResponsiveness: 'high',
    onProgress: ({ progress }) => {
      finalProgress = progress;
    },
  });
  let blob: Blob;
  try {
    blob = await result.getBlob();
  } finally {
    result.internalState[Symbol.dispose]();
  }
  return {
    canRender: true,
    issues: support.issues.map((issue) => `${issue.type}: ${issue.message}`),
    blobSize: blob.size,
    blobType: blob.type,
    finalProgress,
  };
};
