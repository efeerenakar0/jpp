import React from 'react';
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type { AiVideoPlan } from '@/lib/portfolio-video/ai-video-types';
import { resolveSceneVisualSpec } from '@/lib/portfolio-video/visual-language';

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

export type GeneratedPortfolioVideoProps = {
  plan: AiVideoPlan;
  facts: GeneratedPortfolioVideoFacts;
};

type Scene = AiVideoPlan['scenes'][number];

const fontFamilies = {
  MODERN: 'Inter, ui-sans-serif, system-ui, sans-serif',
  EDITORIAL: 'Georgia, Times New Roman, serif',
  BOLD: 'Arial Black, Inter, sans-serif',
  MINIMAL: 'Helvetica Neue, Arial, sans-serif',
} as const;

export function resolveVideoFact(ref: string, facts: GeneratedPortfolioVideoFacts) {
  const map: Record<string, string | null | undefined> = {
    TITLE: facts.title,
    REFERENCE: facts.referenceCode,
    PRICE: facts.priceLabel,
    LOCATION: facts.location,
    ROOMS: facts.roomCount,
    AREA: facts.areaLabel,
    COMPANY_NAME: facts.companyName,
    FEATURE_1: facts.features[0],
    FEATURE_2: facts.features[1],
    FEATURE_3: facts.features[2],
    FEATURE_4: facts.features[3],
    FEATURE_5: facts.features[4],
  };
  return map[ref] || null;
}

function sceneUrls(scene: Scene, facts: GeneratedPortfolioVideoFacts) {
  const assetMap = new Map(facts.assets.map((asset) => [asset.assetId, asset.url]));
  const requested = scene.assetIds
    .map((id) => assetMap.get(id))
    .filter((url): url is string => Boolean(url));
  const fallback = facts.assets.map((asset) => asset.url).filter(Boolean);
  if (!requested.length) return fallback.slice(0, scene.helper === 'KenBurns' ? 4 : 2);
  if (scene.helper !== 'KenBurns' && scene.helper !== 'SplitScreen') return requested;
  return [...new Set([...requested, ...fallback])].slice(0, scene.helper === 'KenBurns' ? 4 : 2);
}

function SceneImage({
  url,
  motion,
  durationInFrames,
  position = 'center',
}: {
  url: string | null;
  motion: Scene['motion'];
  durationInFrames: number;
  position?: string;
}) {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, Math.max(1, durationInFrames)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const zoom = motion === 'ZOOM_OUT'
    ? 1.14 - progress * 0.14
    : motion === 'STILL'
      ? 1.025
      : 1.03 + progress * 0.13;
  const x = motion === 'PAN_LEFT'
    ? 7 - progress * 14
    : motion === 'PAN_RIGHT'
      ? -7 + progress * 14
      : 0;
  const y = motion === 'FLOAT' ? Math.sin(progress * Math.PI) * -2.4 : 0;

  return url ? (
    <Img
      src={url}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        objectPosition: position,
        transform: `translate3d(${x}%, ${y}%, 0) scale(${zoom})`,
        filter: 'saturate(1.04) contrast(1.03)',
      }}
    />
  ) : null;
}

function BrandMark({ facts, accent, compact = false }: {
  facts: GeneratedPortfolioVideoFacts;
  accent: string;
  compact?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 13 : 18 }}>
      {facts.companyLogoUrl ? (
        <Img
          src={facts.companyLogoUrl}
          style={{
            width: compact ? 54 : 88,
            height: compact ? 54 : 88,
            objectFit: 'contain',
            borderRadius: compact ? 14 : 22,
          }}
        />
      ) : (
        <div style={{
          display: 'grid',
          width: compact ? 48 : 78,
          height: compact ? 48 : 78,
          placeItems: 'center',
          border: `2px solid ${accent}`,
          borderRadius: compact ? 14 : 22,
          color: accent,
          fontSize: compact ? 20 : 32,
          fontWeight: 900,
        }}>
          {facts.companyName.slice(0, 1).toLocaleUpperCase('tr-TR')}
        </div>
      )}
      <div>
        <div style={{ fontSize: compact ? 22 : 30, fontWeight: 850, letterSpacing: compact ? 0 : 1 }}>
          {facts.companyName}
        </div>
        {!compact ? (
          <div style={{ marginTop: 5, color: accent, fontSize: 18, fontWeight: 750, letterSpacing: 3, textTransform: 'uppercase' }}>
            Gayrimenkul
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FactChip({ value, accent, surface, large = false }: {
  value: string;
  accent: string;
  surface: string;
  large?: boolean;
}) {
  return (
    <div style={{
      padding: large ? '22px 28px' : '16px 20px',
      border: `1px solid ${accent}66`,
      borderRadius: large ? 24 : 18,
      background: `${surface}e8`,
      boxShadow: '0 18px 50px rgba(0,0,0,.24)',
      fontSize: large ? 38 : 27,
      fontWeight: 800,
      lineHeight: 1.15,
      backdropFilter: 'blur(18px)',
    }}>
      {value}
    </div>
  );
}

function transitionStyle(scene: Scene, frame: number) {
  const duration = resolveSceneVisualSpec(scene, '9:16').transitionFrames;
  const enter = interpolate(frame, [0, duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const leave = interpolate(
    frame,
    [Math.max(0, scene.durationInFrames - duration), scene.durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const visibility = Math.min(enter, leave);

  if (scene.transition === 'SLIDE') {
    return { opacity: visibility, transform: `translate3d(${(1 - enter) * 7}%, 0, 0)` };
  }
  if (scene.transition === 'WIPE') {
    return { opacity: leave, clipPath: `inset(0 ${(1 - enter) * 100}% 0 0 round 28px)` };
  }
  if (scene.transition === 'SCALE') {
    return { opacity: visibility, transform: `scale(${0.94 + enter * 0.06})` };
  }
  if (scene.transition === 'CUT') return { opacity: 1 };
  return { opacity: visibility };
}

function BackgroundImage({ scene, urls, overlay = true }: {
  scene: Scene;
  urls: string[];
  overlay?: boolean;
}) {
  return (
    <>
      <AbsoluteFill>
        <SceneImage
          url={urls[0] ?? null}
          motion={scene.motion}
          durationInFrames={scene.durationInFrames}
        />
      </AbsoluteFill>
      {overlay ? (
        <AbsoluteFill style={{
          background: 'linear-gradient(180deg, rgba(1,8,14,.12) 0%, rgba(1,8,14,.2) 38%, rgba(1,8,14,.94) 100%)',
        }} />
      ) : null}
      <AbsoluteFill style={{ boxShadow: 'inset 0 0 180px rgba(0,0,0,.32)' }} />
    </>
  );
}

function SceneContent({
  scene,
  plan,
  facts,
  urls,
  factLabels,
  enter,
}: {
  scene: Scene;
  plan: AiVideoPlan;
  facts: GeneratedPortfolioVideoFacts;
  urls: string[];
  factLabels: string[];
  enter: number;
}) {
  const spec = resolveSceneVisualSpec(scene, plan.format);
  const accent = plan.theme.accent;
  const surface = plan.theme.surface;
  const headlineStyle: React.CSSProperties = {
    margin: 0,
    fontSize: spec.headlineSize,
    lineHeight: 0.98,
    letterSpacing: -2.2,
    textWrap: 'balance',
  };
  const bodyStyle: React.CSSProperties = {
    maxWidth: 820,
    margin: '24px 0 0',
    color: `${plan.theme.text}d9`,
    fontSize: spec.bodySize,
    lineHeight: 1.34,
    textWrap: 'balance',
  };
  const contentBase: React.CSSProperties = {
    padding: `${spec.safePaddingY}px ${spec.safePaddingX}px`,
    transform: `translate3d(0, ${(1 - enter) * 44}px, 0)`,
  };

  if (spec.composition === 'DUAL_FRAME') {
    return (
      <AbsoluteFill style={{ padding: spec.safePaddingX, gap: 22 }}>
        <div style={{ display: 'grid', flex: 1, gridTemplateColumns: '1.04fr .96fr', gap: 18, minHeight: 0 }}>
          {[urls[0], urls[1] ?? urls[0]].map((url, index) => (
            <div key={`${url}-${index}`} style={{ position: 'relative', overflow: 'hidden', borderRadius: 34, border: `1px solid ${accent}44` }}>
              <SceneImage url={url ?? null} motion={index === 0 ? scene.motion : 'ZOOM_OUT'} durationInFrames={scene.durationInFrames} />
              <AbsoluteFill style={{ boxShadow: 'inset 0 0 90px rgba(0,0,0,.28)' }} />
            </div>
          ))}
        </div>
        <div style={{ ...contentBase, position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <h1 style={headlineStyle}>{scene.headline}</h1>
          {scene.body ? <p style={bodyStyle}>{scene.body}</p> : null}
        </div>
      </AbsoluteFill>
    );
  }

  if (spec.composition === 'FEATURE_MATRIX') {
    return (
      <>
        <BackgroundImage scene={scene} urls={urls} />
        <AbsoluteFill style={{ ...contentBase, justifyContent: 'flex-end' }}>
          <div style={{ maxWidth: spec.maxContentWidth }}>
            <div style={{ marginBottom: 26, color: accent, fontSize: 20, fontWeight: 800, letterSpacing: 4, textTransform: 'uppercase' }}>Öne çıkanlar</div>
            <h1 style={headlineStyle}>{scene.headline || facts.title}</h1>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, marginTop: 34 }}>
              {factLabels.slice(0, 4).map((label, index) => (
                <div key={`${label}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '22px 24px', border: `1px solid ${accent}55`, borderRadius: 24, background: `${surface}e8`, fontSize: 29, fontWeight: 750 }}>
                  <span style={{ display: 'grid', width: 38, height: 38, placeItems: 'center', borderRadius: 12, color: plan.theme.background, background: accent, fontSize: 19, fontWeight: 950 }}>{index + 1}</span>
                  {label}
                </div>
              ))}
            </div>
          </div>
        </AbsoluteFill>
      </>
    );
  }

  if (spec.composition === 'PRICE_SPOTLIGHT') {
    const price = factLabels.find((label) => label === facts.priceLabel) ?? facts.priceLabel;
    const details = factLabels.filter((label) => label !== price).slice(0, 3);
    return (
      <>
        <BackgroundImage scene={scene} urls={urls} />
        <AbsoluteFill style={{ ...contentBase, justifyContent: 'flex-end' }}>
          <div style={{ width: '100%', maxWidth: spec.maxContentWidth, padding: '38px 40px', border: `1px solid ${accent}77`, borderRadius: spec.cardRadius, background: `linear-gradient(135deg, ${surface}f2, ${plan.theme.background}e8)`, boxShadow: '0 30px 90px rgba(0,0,0,.42)' }}>
            <div style={{ color: accent, fontSize: 19, fontWeight: 850, letterSpacing: 4, textTransform: 'uppercase' }}>Seçkin fırsat</div>
            {price ? <div style={{ marginTop: 14, fontSize: plan.format === '9:16' ? 86 : 74, fontWeight: 900, letterSpacing: -3 }}>{price}</div> : <h1 style={{ ...headlineStyle, marginTop: 18 }}>{scene.headline}</h1>}
            {scene.body ? <p style={bodyStyle}>{scene.body}</p> : null}
            {details.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 28 }}>{details.map((label, index) => <FactChip key={`${label}-${index}`} value={label} accent={accent} surface={surface} />)}</div> : null}
          </div>
        </AbsoluteFill>
      </>
    );
  }

  if (spec.composition === 'LOCATION_EDITORIAL') {
    const location = factLabels.find((label) => label === facts.location) ?? facts.location;
    return (
      <>
        <BackgroundImage scene={scene} urls={urls} />
        <AbsoluteFill style={{ ...contentBase, justifyContent: 'space-between' }}>
          <BrandMark facts={facts} accent={accent} compact />
          <div style={{ maxWidth: spec.maxContentWidth }}>
            <div style={{ display: 'grid', width: 96, height: 96, placeItems: 'center', marginBottom: 28, border: `2px solid ${accent}`, borderRadius: '50% 50% 50% 12%', color: accent, background: `${surface}dd`, transform: 'rotate(-45deg)' }}>
              <span style={{ width: 22, height: 22, border: `4px solid ${accent}`, borderRadius: '50%', transform: 'rotate(45deg)' }} />
            </div>
            <div style={{ color: accent, fontSize: 20, fontWeight: 850, letterSpacing: 4, textTransform: 'uppercase' }}>Konum</div>
            <h1 style={{ ...headlineStyle, marginTop: 16 }}>{location || scene.headline || facts.title}</h1>
            {scene.body ? <p style={bodyStyle}>{scene.body}</p> : null}
          </div>
        </AbsoluteFill>
      </>
    );
  }

  if (spec.composition === 'KEN_BURNS_GALLERY') {
    return (
      <>
        <BackgroundImage scene={scene} urls={urls} />
        <AbsoluteFill style={{ ...contentBase, justifyContent: 'space-between' }}>
          <BrandMark facts={facts} accent={accent} compact />
          <div style={{ maxWidth: spec.maxContentWidth }}>
            <div style={{ color: accent, fontSize: 19, fontWeight: 850, letterSpacing: 4, textTransform: 'uppercase' }}>Portföy turu</div>
            {scene.headline ? <h1 style={{ ...headlineStyle, marginTop: 16 }}>{scene.headline}</h1> : null}
            {scene.body ? <p style={bodyStyle}>{scene.body}</p> : null}
            {urls.length > 1 ? (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(3, urls.length - 1)}, minmax(0, 1fr))`, gap: 14, marginTop: 30 }}>
                {urls.slice(1, 4).map((url, index) => (
                  <div key={`${url}-${index}`} style={{ position: 'relative', overflow: 'hidden', aspectRatio: '1.38', border: `1px solid ${accent}55`, borderRadius: 18, boxShadow: '0 14px 34px rgba(0,0,0,.3)' }}>
                    <SceneImage url={url} motion={index % 2 === 0 ? 'ZOOM_IN' : 'PAN_RIGHT'} durationInFrames={scene.durationInFrames} />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </AbsoluteFill>
      </>
    );
  }

  if (spec.composition === 'CONTACT_GLASS' || spec.composition === 'BRAND_FINALE') {
    const finale = spec.composition === 'BRAND_FINALE';
    return (
      <>
        <BackgroundImage scene={scene} urls={urls} />
        <AbsoluteFill style={{ background: finale ? `${plan.theme.background}d9` : 'rgba(0,0,0,.18)' }} />
        <AbsoluteFill style={{ ...contentBase, alignItems: finale ? 'center' : 'stretch', justifyContent: 'center', textAlign: finale ? 'center' : 'left' }}>
          <div style={{ width: '100%', maxWidth: finale ? 820 : spec.maxContentWidth, padding: finale ? '54px 48px' : '44px', border: `1px solid ${accent}66`, borderRadius: 38, background: `${surface}e8`, boxShadow: '0 34px 100px rgba(0,0,0,.45)', backdropFilter: 'blur(24px)' }}>
            <div style={{ display: 'flex', justifyContent: finale ? 'center' : 'flex-start' }}><BrandMark facts={facts} accent={accent} /></div>
            <div style={{ width: 74, height: 6, margin: finale ? '34px auto' : '34px 0', borderRadius: 99, background: accent }} />
            <h1 style={headlineStyle}>{scene.headline || (finale ? 'Yeni yaşamınız burada başlıyor' : 'Detaylı bilgi ve randevu')}</h1>
            {scene.body ? <p style={{ ...bodyStyle, marginInline: finale ? 'auto' : undefined }}>{scene.body}</p> : null}
            <div style={{ marginTop: 34, color: accent, fontSize: 31, fontWeight: 850 }}>{facts.advisorName}</div>
            {facts.advisorPhone ? <div style={{ marginTop: 8, fontSize: 27, fontWeight: 650, letterSpacing: 1 }}>{facts.advisorPhone}</div> : null}
          </div>
        </AbsoluteFill>
      </>
    );
  }

  const editorial = spec.composition === 'EDITORIAL_HERO';
  const pureImage = spec.composition === 'CINEMATIC_IMAGE';
  return (
    <>
      <BackgroundImage scene={scene} urls={urls} overlay={!pureImage || Boolean(scene.headline || scene.body)} />
      <AbsoluteFill style={{ ...contentBase, justifyContent: 'space-between' }}>
        {editorial ? <BrandMark facts={facts} accent={accent} compact /> : <div />}
        <div style={{ maxWidth: spec.maxContentWidth }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22, color: accent, fontSize: 19, fontWeight: 850, letterSpacing: 4, textTransform: 'uppercase' }}>
            <span style={{ width: 58, height: 5, borderRadius: 99, background: accent }} />
            {editorial ? 'Özel portföy' : 'Keşfedin'}
          </div>
          {scene.headline ? <h1 style={headlineStyle}>{scene.headline}</h1> : null}
          {scene.body ? <p style={bodyStyle}>{scene.body}</p> : null}
          {factLabels.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 28 }}>{factLabels.slice(0, 3).map((label, index) => <FactChip key={`${label}-${index}`} value={label} accent={accent} surface={surface} />)}</div> : null}
        </div>
      </AbsoluteFill>
    </>
  );
}

function SceneFrame({ scene, plan, facts }: {
  scene: Scene;
  plan: AiVideoPlan;
  facts: GeneratedPortfolioVideoFacts;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({
    frame,
    fps,
    config: { damping: 22, stiffness: 92, mass: 0.85 },
    durationInFrames: Math.min(28, scene.durationInFrames),
  });
  const urls = sceneUrls(scene, facts);
  const factLabels = scene.factRefs
    .map((ref) => resolveVideoFact(ref, facts))
    .filter((value): value is string => Boolean(value));

  return (
    <AbsoluteFill style={{
      overflow: 'hidden',
      color: plan.theme.text,
      background: plan.theme.background,
      fontFamily: fontFamilies[plan.theme.font],
      ...transitionStyle(scene, frame),
    }}>
      <SceneContent
        scene={scene}
        plan={plan}
        facts={facts}
        urls={urls}
        factLabels={factLabels}
        enter={enter}
      />
      <AbsoluteFill style={{ pointerEvents: 'none', border: `1px solid ${plan.theme.accent}22`, boxShadow: 'inset 0 0 120px rgba(0,0,0,.14)' }} />
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
  return (
    <AbsoluteFill style={{ background: plan.theme.background }}>
      {plan.scenes.map((scene) => (
        <Sequence
          key={scene.id}
          from={scene.startFrame}
          durationInFrames={scene.durationInFrames}
          premountFor={18}
        >
          <SceneFrame scene={scene} plan={plan} facts={facts} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

export function GeneratedPortfolioVideo(props: GeneratedPortfolioVideoProps) {
  return <GeneratedVideoRuntime {...props} />;
}
