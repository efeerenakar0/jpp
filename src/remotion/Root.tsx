import { Composition } from 'remotion';
import { PortfolioPromoVideo } from './portfolio-video/PortfolioPromoVideo';
import {
  PORTFOLIO_PROMO_VIDEO_DURATION,
  PORTFOLIO_PROMO_VIDEO_FPS,
  PORTFOLIO_PROMO_VIDEO_HEIGHT,
  PORTFOLIO_PROMO_VIDEO_ID,
  PORTFOLIO_PROMO_VIDEO_WIDTH,
} from './portfolio-video/constants';
import { PORTFOLIO_PROMO_VIDEO_FIXTURE_PROPS } from './portfolio-video/fixture';

export function RemotionRoot() {
  return (
    <Composition
      id={PORTFOLIO_PROMO_VIDEO_ID}
      component={PortfolioPromoVideo}
      durationInFrames={PORTFOLIO_PROMO_VIDEO_DURATION}
      fps={PORTFOLIO_PROMO_VIDEO_FPS}
      width={PORTFOLIO_PROMO_VIDEO_WIDTH}
      height={PORTFOLIO_PROMO_VIDEO_HEIGHT}
      defaultProps={PORTFOLIO_PROMO_VIDEO_FIXTURE_PROPS}
    />
  );
}
