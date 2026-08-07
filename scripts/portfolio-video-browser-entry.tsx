import { canRenderMediaOnWeb, renderMediaOnWeb } from '@remotion/web-renderer';
import { GeneratedPortfolioVideo } from '../src/remotion/portfolio-video/GeneratedPortfolioVideo';
import {
  GENERATED_PORTFOLIO_VIDEO_FIXTURE_FACTS,
  GENERATED_PORTFOLIO_VIDEO_FIXTURE_PLAN,
} from '../src/remotion/portfolio-video/generated-fixture';

const inputProps = {
  plan: GENERATED_PORTFOLIO_VIDEO_FIXTURE_PLAN,
  facts: GENERATED_PORTFOLIO_VIDEO_FIXTURE_FACTS,
};

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
    width: GENERATED_PORTFOLIO_VIDEO_FIXTURE_PLAN.width,
    height: GENERATED_PORTFOLIO_VIDEO_FIXTURE_PLAN.height,
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
      id: 'GeneratedPortfolioVideoBrowserFixture',
      component: GeneratedPortfolioVideo,
      defaultProps: inputProps,
      durationInFrames: GENERATED_PORTFOLIO_VIDEO_FIXTURE_PLAN.durationSeconds * GENERATED_PORTFOLIO_VIDEO_FIXTURE_PLAN.fps,
      fps: GENERATED_PORTFOLIO_VIDEO_FIXTURE_PLAN.fps,
      width: GENERATED_PORTFOLIO_VIDEO_FIXTURE_PLAN.width,
      height: GENERATED_PORTFOLIO_VIDEO_FIXTURE_PLAN.height,
    },
    inputProps,
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
