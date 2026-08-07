import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@remotion/player', () => ({
  Player: (props: Record<string, unknown>) => (
    <div
      data-duration={String(props.durationInFrames)}
      data-fps={String(props.fps)}
      data-width={String(props.compositionWidth)}
      data-height={String(props.compositionHeight)}
    />
  ),
}));

import GeneratedVideoPreviewClient from './GeneratedVideoPreviewClient';
import {
  GENERATED_PORTFOLIO_VIDEO_FIXTURE_FACTS,
  GENERATED_PORTFOLIO_VIDEO_FIXTURE_PLAN,
} from '@/remotion/portfolio-video/generated-fixture';

describe('GeneratedVideoPreviewClient', () => {
  it('passes the validated plan dimensions and duration to Remotion Player', () => {
    const html = renderToStaticMarkup(
      <GeneratedVideoPreviewClient
        plan={GENERATED_PORTFOLIO_VIDEO_FIXTURE_PLAN}
        facts={GENERATED_PORTFOLIO_VIDEO_FIXTURE_FACTS}
      />
    );
    expect(html).toContain('data-duration="450"');
    expect(html).toContain('data-fps="30"');
    expect(html).toContain('data-width="1080"');
    expect(html).toContain('data-height="1920"');
  });
});
