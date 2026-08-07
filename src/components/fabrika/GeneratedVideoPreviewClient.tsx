"use client";

import { Player } from '@remotion/player';
import type { AiVideoPlan } from '@/lib/portfolio-video/ai-video-types';
import { GeneratedPortfolioVideo, type GeneratedPortfolioVideoFacts } from '@/remotion/portfolio-video/GeneratedPortfolioVideo';

export default function GeneratedVideoPreviewClient({ plan, facts }: { plan: AiVideoPlan; facts: GeneratedPortfolioVideoFacts }) {
  return (
    <Player
      component={GeneratedPortfolioVideo}
      inputProps={{ plan, facts }}
      durationInFrames={plan.durationSeconds * plan.fps}
      fps={plan.fps}
      compositionWidth={plan.width}
      compositionHeight={plan.height}
      controls
      loop
      initiallyMuted
      acknowledgeRemotionLicense
      style={{ width: '100%', height: '100%', background: plan.theme.background }}
    />
  );
}
