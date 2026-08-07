import React from 'react';
import { AbsoluteFill, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { AiVideoPlan } from '@/lib/portfolio-video/ai-video-types';

export type GeneratedPortfolioVideoFacts = {
  title: string;
  referenceCode: string | null;
  location: string | null;
  priceLabel: string | null;
  roomCount: string | null;
  areaLabel: string | null;
  features: string[];
  companyName: string;
  companyLogoUrl: string | null;
  advisorName: string;
  advisorPhone: string | null;
  assets: Array<{ assetId: string; url: string }>;
};

export type GeneratedPortfolioVideoProps = { plan: AiVideoPlan; facts: GeneratedPortfolioVideoFacts };

const fontFamilies = {
  MODERN: 'Inter, ui-sans-serif, system-ui, sans-serif',
  EDITORIAL: 'Georgia, Times New Roman, serif',
  BOLD: 'Arial Black, Inter, sans-serif',
  MINIMAL: 'Helvetica Neue, Arial, sans-serif',
} as const;

export function resolveVideoFact(ref: string, facts: GeneratedPortfolioVideoFacts) {
  const map: Record<string, string | null | undefined> = {
    TITLE: facts.title, REFERENCE: facts.referenceCode, PRICE: facts.priceLabel,
    LOCATION: facts.location, ROOMS: facts.roomCount, AREA: facts.areaLabel,
    COMPANY_NAME: facts.companyName,
    FEATURE_1: facts.features[0], FEATURE_2: facts.features[1], FEATURE_3: facts.features[2],
    FEATURE_4: facts.features[3], FEATURE_5: facts.features[4],
  };
  return map[ref] || null;
}

function SceneImage({ url, motion }: { url: string | null; motion: string }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const scale = motion === 'ZOOM_OUT' ? 1.12 - progress * 0.12 : motion === 'STILL' ? 1.02 : 1 + progress * 0.12;
  const x = motion === 'PAN_LEFT' ? `${8 - progress * 16}%` : motion === 'PAN_RIGHT' ? `${-8 + progress * 16}%` : '0%';
  return url ? <Img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `translateX(${x}) scale(${scale})` }} /> : null;
}

function SceneFrame({ scene, plan, facts }: { scene: AiVideoPlan['scenes'][number]; plan: AiVideoPlan; facts: GeneratedPortfolioVideoFacts }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 110 }, durationInFrames: Math.min(24, scene.durationInFrames) });
  const exit = interpolate(frame, [Math.max(0, scene.durationInFrames - 12), scene.durationInFrames], [1, 0], { extrapolateLeft: 'clamp' });
  const opacity = Math.min(enter, exit);
  const assetMap = new Map(facts.assets.map((asset) => [asset.assetId, asset.url]));
  const urls = scene.assetIds.map((id) => assetMap.get(id)).filter((url): url is string => Boolean(url));
  const factLabels = scene.factRefs.map((ref) => resolveVideoFact(ref, facts)).filter((value): value is string => Boolean(value));
  const image = urls[0] ?? facts.assets[0]?.url ?? null;
  const align = scene.layout === 'LEFT' ? 'flex-start' : scene.layout === 'RIGHT' ? 'flex-end' : 'center';
  const isGrid = scene.helper === 'FeatureGrid' || scene.layout === 'GRID';
  const isSplit = scene.helper === 'SplitScreen' || scene.layout === 'SPLIT';
  return (
    <AbsoluteFill style={{ background: plan.theme.background, color: plan.theme.text, fontFamily: fontFamilies[plan.theme.font], overflow: 'hidden', opacity }}>
      {isSplit && urls.length > 1 ? (
        <AbsoluteFill style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {urls.slice(0, 2).map((url) => <SceneImage key={url} url={url} motion={scene.motion} />)}
        </AbsoluteFill>
      ) : <SceneImage url={image} motion={scene.motion} />}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, transparent 25%, ${plan.theme.background}ee 100%)` }} />
      <AbsoluteFill style={{ padding: plan.format === '9:16' ? 84 : 64, justifyContent: scene.helper === 'Hero' ? 'center' : 'flex-end', alignItems: align, transform: `translateY(${(1 - enter) * 40}px)` }}>
        <div style={{ width: isGrid ? '100%' : '88%', maxWidth: 1280, textAlign: align === 'center' ? 'center' : align === 'flex-end' ? 'right' : 'left' }}>
          {scene.helper === 'LogoOutro' && facts.companyLogoUrl ? <Img src={facts.companyLogoUrl} style={{ width: 150, height: 150, objectFit: 'contain', margin: align === 'center' ? '0 auto 24px' : '0 0 24px' }} /> : null}
          <div style={{ width: 72, height: 7, borderRadius: 99, background: plan.theme.accent, margin: align === 'center' ? '0 auto 24px' : '0 0 24px auto' }} />
          {scene.headline ? <h1 style={{ margin: 0, fontSize: plan.format === '9:16' ? 86 : 66, lineHeight: 1.02, letterSpacing: -2 }}>{scene.headline}</h1> : null}
          {scene.body ? <p style={{ fontSize: 34, lineHeight: 1.3, margin: '24px 0 0', color: `${plan.theme.text}dd` }}>{scene.body}</p> : null}
          <div style={{ display: 'grid', gridTemplateColumns: isGrid ? 'repeat(2, minmax(0, 1fr))' : '1fr', gap: 14, marginTop: 30 }}>
            {factLabels.map((label) => <div key={label} style={{ padding: '18px 22px', border: `1px solid ${plan.theme.accent}77`, background: `${plan.theme.surface}dd`, borderRadius: 18, fontSize: 30, fontWeight: 700 }}>{label}</div>)}
          </div>
          {scene.helper === 'CTA' || scene.helper === 'LogoOutro' ? <p style={{ marginTop: 28, fontSize: 28 }}>{facts.advisorName}{facts.advisorPhone ? ` · ${facts.advisorPhone}` : ''}</p> : null}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

export function PropertyImage(props: Parameters<typeof SceneFrame>[0]) { return <SceneFrame {...props} />; }
export function Hero(props: Parameters<typeof SceneFrame>[0]) { return <SceneFrame {...props} />; }
export function PriceCard(props: Parameters<typeof SceneFrame>[0]) { return <SceneFrame {...props} />; }
export function FeatureGrid(props: Parameters<typeof SceneFrame>[0]) { return <SceneFrame {...props} />; }
export function LocationCard(props: Parameters<typeof SceneFrame>[0]) { return <SceneFrame {...props} />; }
export function CTA(props: Parameters<typeof SceneFrame>[0]) { return <SceneFrame {...props} />; }
export function LogoOutro(props: Parameters<typeof SceneFrame>[0]) { return <SceneFrame {...props} />; }
export function KenBurns(props: Parameters<typeof SceneFrame>[0]) { return <SceneFrame {...props} />; }
export function SplitScreen(props: Parameters<typeof SceneFrame>[0]) { return <SceneFrame {...props} />; }

export function GeneratedVideoRuntime({ plan, facts }: GeneratedPortfolioVideoProps) {
  return <AbsoluteFill style={{ background: plan.theme.background }}>{plan.scenes.map((scene) => <Sequence key={scene.id} from={scene.startFrame} durationInFrames={scene.durationInFrames} premountFor={15}><SceneFrame scene={scene} plan={plan} facts={facts} /></Sequence>)}</AbsoluteFill>;
}

export function GeneratedPortfolioVideo(props: GeneratedPortfolioVideoProps) {
  return <GeneratedVideoRuntime {...props} />;
}
