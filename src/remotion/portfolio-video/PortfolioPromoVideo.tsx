import type { CSSProperties, ReactNode } from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type {
  PortfolioPromoVideoProps,
  PortfolioVideoScene,
  PortfolioVideoStoryboard,
} from '@/lib/portfolio-video/types';

const paletteColors: Record<
  PortfolioVideoStoryboard['palette'],
  { ink: string; emerald: string; cream: string; slate: string; gold: string }
> = {
  MIDNIGHT_CYAN: {
    ink: '#04131d',
    emerald: '#26d9ff',
    cream: '#f7fbff',
    slate: '#b8c5cd',
    gold: '#7cecff',
  },
  EDITORIAL_GOLD: {
    ink: '#15100a',
    emerald: '#dcb56d',
    cream: '#fff8ea',
    slate: '#d8cbb5',
    gold: '#f4c970',
  },
  WARM_SAND: {
    ink: '#241812',
    emerald: '#e79a66',
    cream: '#fff7ee',
    slate: '#ddc8b8',
    gold: '#f2bb77',
  },
  CLEAN_WHITE: {
    ink: '#0d1920',
    emerald: '#13a77a',
    cream: '#ffffff',
    slate: '#cbd6dc',
    gold: '#6ac7af',
  },
  BOLD_CORAL: {
    ink: '#150b17',
    emerald: '#ff5e76',
    cream: '#fff6f8',
    slate: '#d9c4cc',
    gold: '#ffbd65',
  },
};

const typographyFamilies: Record<PortfolioVideoStoryboard['typography'], string> = {
  MODERN: 'Arial, Helvetica, sans-serif',
  EDITORIAL: 'Georgia, Times New Roman, serif',
  FRIENDLY: 'Trebuchet MS, Arial, sans-serif',
  MINIMAL: 'Helvetica Neue, Arial, sans-serif',
};

function safePhoto(storyboard: PortfolioVideoStoryboard, index: number) {
  if (!storyboard.photoUrls.length) return null;
  return storyboard.photoUrls[index % storyboard.photoUrls.length] ?? null;
}

function PhotoLayer({
  src,
  frame,
  duration,
  intensity = 0.5,
  motion = 'ZOOM',
}: {
  src: string | null;
  frame: number;
  duration: number;
  intensity?: number;
  motion?: PortfolioVideoScene['photoMotion'];
}) {
  const progress = interpolate(frame, [0, Math.max(1, duration)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });
  const scale = motion === 'STILL'
    ? 1.02
    : motion === 'PAN'
      ? 1.08 + intensity * 0.025
      : 1.03 + progress * intensity * 0.08;
  const translateX = motion === 'PAN' ? interpolate(progress, [0, 1], [-28, 28]) : 0;
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#0b2533' }}>
      {src ? (
        <Img
          src={src}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `translate3d(${translateX}px, 0, 0) scale(${scale})`,
          }}
        />
      ) : (
        <AbsoluteFill
          style={{
            background:
              'radial-gradient(circle at 70% 20%, rgba(55,216,154,.28), transparent 34%), linear-gradient(145deg, #123448, #06141e 62%)',
          }}
        />
      )}
    </AbsoluteFill>
  );
}

function BrandMark({ storyboard }: { storyboard: PortfolioVideoStoryboard }) {
  const colors = paletteColors[storyboard.palette];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, color: colors.cream }}>
      {storyboard.companyLogoUrl ? (
        <Img
          src={storyboard.companyLogoUrl}
          style={{ width: 68, height: 68, objectFit: 'contain', borderRadius: 14 }}
        />
      ) : (
        <div
          style={{
            width: 64,
            height: 64,
            display: 'grid',
            placeItems: 'center',
            border: `2px solid ${colors.emerald}`,
            borderRadius: 18,
            fontWeight: 800,
            color: colors.emerald,
            fontSize: 26,
          }}
        >
          {storyboard.companyName.slice(0, 1).toLocaleUpperCase('tr-TR')}
        </div>
      )}
      <div style={{ fontSize: 28, fontWeight: 750, letterSpacing: 0.4 }}>{storyboard.companyName}</div>
    </div>
  );
}

function Reveal({
  children,
  at,
  animation,
}: {
  children: ReactNode;
  at: number;
  animation: PortfolioVideoScene['overlays'][number]['animation'];
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const value = spring({
    frame: frame - at,
    fps,
    config: animation === 'POP'
      ? { damping: 11, stiffness: 180, mass: 0.65 }
      : { damping: 18, stiffness: 110, mass: 0.8 },
  });
  const opacity = animation === 'TYPE'
    ? interpolate(frame - at, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : value;
  const transform = animation === 'POP'
    ? `scale(${0.72 + value * 0.28})`
    : animation === 'SLIDE_UP'
      ? `translateY(${(1 - value) * 70}px)`
      : 'none';
  return <div style={{ opacity, transform }}>{children}</div>;
}

function instagramLabel(value: string | null) {
  if (!value) return '@instagram';
  const cleaned = value.replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, '').replace(/[/?#].*$/, '');
  return cleaned ? `@${cleaned.replace(/^@/, '')}` : value;
}

function OverlayContent({
  storyboard,
  scene,
  overlay,
}: {
  storyboard: PortfolioVideoStoryboard;
  scene: PortfolioVideoScene;
  overlay: PortfolioVideoScene['overlays'][number];
}) {
  const colors = paletteColors[storyboard.palette];
  switch (overlay.type) {
    case 'BRAND':
      return <BrandMark storyboard={storyboard} />;
    case 'TITLE':
      return (
        <div style={{ fontSize: storyboard.title.length > 48 ? 70 : 88, lineHeight: 1.03, fontWeight: 850, letterSpacing: -3 }}>
          {overlay.text || scene.headline || storyboard.title}
        </div>
      );
    case 'DESCRIPTION':
      return (
        <div>
          {scene.headline && <div style={{ color: colors.emerald, fontSize: 28, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase' }}>{scene.headline}</div>}
          {scene.body && <div style={{ marginTop: 16, fontSize: 38, lineHeight: 1.32 }}>{overlay.text || scene.body}</div>}
        </div>
      );
    case 'PRICE':
      return storyboard.showPrice && storyboard.priceLabel ? (
        <div style={{ display: 'inline-block', padding: '28px 38px', borderRadius: 24, background: 'rgba(4,19,29,.88)', border: `2px solid ${colors.emerald}`, fontSize: 82, fontWeight: 900, letterSpacing: -3 }}>
          {overlay.text || storyboard.priceLabel}
        </div>
      ) : null;
    case 'LOCATION':
      return storyboard.showLocation ? (
        <div style={{ fontSize: 34, color: colors.emerald, fontWeight: 800 }}>● {overlay.text || storyboard.locationLabel}</div>
      ) : null;
    case 'DETAILS':
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
          {storyboard.detailLabels.map((detail) => (
            <span key={detail} style={{ padding: '16px 22px', borderRadius: 99, background: 'rgba(255,255,255,.14)', fontSize: 30, fontWeight: 700 }}>{detail}</span>
          ))}
        </div>
      );
    case 'FEATURES':
      return (
        <div>
          <div style={{ color: colors.gold, fontSize: 28, fontWeight: 850, letterSpacing: 4, textTransform: 'uppercase' }}>{scene.headline || 'Öne çıkanlar'}</div>
          <div style={{ display: 'grid', gap: 16, marginTop: 28 }}>
            {(storyboard.featureLabels.length ? storyboard.featureLabels : storyboard.detailLabels).slice(0, 5).map((feature) => (
              <div key={feature} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '20px 24px', border: '1px solid rgba(255,255,255,.18)', borderRadius: 18, background: 'rgba(8,30,43,.75)', fontSize: 33 }}>
                <span style={{ width: 13, height: 13, borderRadius: 99, background: colors.emerald }} />{feature}
              </div>
            ))}
          </div>
        </div>
      );
    case 'CONTACT':
      return (
        <div style={{ padding: '30px 34px', borderRadius: 26, background: 'rgba(255,255,255,.94)', color: colors.ink, boxShadow: '0 22px 60px rgba(0,0,0,.2)' }}>
          <div style={{ fontSize: 42, fontWeight: 850 }}>{overlay.text || storyboard.advisorName}</div>
          {storyboard.advisorPhone && <div style={{ fontSize: 34, marginTop: 14 }}>{storyboard.advisorPhone}</div>}
          {storyboard.advisorEmail && <div style={{ fontSize: 27, marginTop: 8, color: '#476054' }}>{storyboard.advisorEmail}</div>}
        </div>
      );
    case 'INSTAGRAM':
      return (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 20, padding: '24px 32px', borderRadius: 99, background: 'linear-gradient(100deg, #fd1d1d, #c13584, #833ab4)', boxShadow: '0 18px 50px rgba(193,53,132,.3)', fontSize: 38, fontWeight: 900 }}>
          <span style={{ fontSize: 45 }}>◎</span>{instagramLabel(overlay.text || storyboard.instagramUrl)}
        </div>
      );
    case 'CUSTOM':
      return overlay.text ? <div style={{ fontSize: 46, lineHeight: 1.2, fontWeight: 820 }}>{overlay.text}</div> : null;
  }
}

function ScenePhotos({ storyboard, scene }: { storyboard: PortfolioVideoStoryboard; scene: PortfolioVideoScene }) {
  const frame = useCurrentFrame();
  const duration = scene.toFrame - scene.fromFrame;
  const indices = scene.photoIndices.length ? scene.photoIndices : [0];
  const slotDuration = Math.max(1, Math.floor(duration / indices.length));
  const slot = Math.min(indices.length - 1, Math.floor(frame / slotDuration));
  const localFrame = frame % slotDuration;
  const opacity = scene.transition === 'CUT'
    ? 1
    : interpolate(localFrame, [0, Math.min(8, slotDuration / 3)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const slideX = scene.transition === 'SLIDE'
    ? interpolate(localFrame, [0, Math.min(12, slotDuration / 2)], [120, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
    : 0;
  const content = (
    <div style={{ opacity, transform: `translateX(${slideX}px)`, width: '100%', height: '100%' }}>
      <PhotoLayer
        src={safePhoto(storyboard, indices[slot] ?? 0)}
        frame={localFrame}
        duration={slotDuration}
        intensity={storyboard.direction.effectIntensity}
        motion={scene.photoMotion}
      />
    </div>
  );
  if (scene.layout === 'FRAMED') {
    return <div style={{ position: 'absolute', inset: '90px 58px 310px', overflow: 'hidden', borderRadius: 36, boxShadow: '0 30px 80px rgba(0,0,0,.36)' }}>{content}</div>;
  }
  return <AbsoluteFill>{content}</AbsoluteFill>;
}

const positionStyle: Record<PortfolioVideoScene['overlays'][number]['position'], CSSProperties> = {
  TOP: { top: 106 },
  CENTER: { top: '50%', transform: 'translateY(-50%)' },
  BOTTOM: { bottom: 108 },
};

function PlannedScene({ storyboard, scene }: { storyboard: PortfolioVideoStoryboard; scene: PortfolioVideoScene }) {
  const frame = useCurrentFrame();
  const colors = paletteColors[storyboard.palette];
  const sceneOpacity = interpolate(frame, [0, 7], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const grouped = (['TOP', 'CENTER', 'BOTTOM'] as const).map((position) => ({
    position,
    overlays: scene.overlays.filter((overlay) => overlay.position === position),
  }));
  return (
    <AbsoluteFill style={{ background: colors.ink, opacity: sceneOpacity, fontFamily: typographyFamilies[storyboard.typography], color: colors.cream }}>
      <ScenePhotos storyboard={storyboard} scene={scene} />
      <AbsoluteFill style={{ background: scene.layout === 'FRAMED' ? 'linear-gradient(180deg, rgba(3,15,23,.18), rgba(3,15,23,.96))' : scene.type === 'CONTACT' ? 'linear-gradient(180deg, rgba(3,15,23,.35), rgba(3,15,23,.93))' : 'linear-gradient(180deg, rgba(3,15,23,.12), rgba(3,15,23,.42) 48%, rgba(3,15,23,.9))' }} />
      {grouped.map(({ position, overlays }) => overlays.length ? (
        <div key={position} style={{ position: 'absolute', left: 82, right: 82, display: 'grid', gap: 22, ...positionStyle[position] }}>
          {overlays.map((overlay, index) => (
            <Reveal key={`${overlay.type}-${index}`} at={overlay.revealAtFrame} animation={overlay.animation}>
              <OverlayContent storyboard={storyboard} scene={scene} overlay={overlay} />
            </Reveal>
          ))}
        </div>
      ) : null)}
    </AbsoluteFill>
  );
}

export function PortfolioPromoVideo({ storyboard }: PortfolioPromoVideoProps) {
  const colors = paletteColors[storyboard.palette];
  return (
    <AbsoluteFill style={{ background: colors.ink }}>
      {storyboard.scenes.map((scene) => (
        <Sequence key={scene.id} from={scene.fromFrame} durationInFrames={scene.toFrame - scene.fromFrame} premountFor={15}>
          <PlannedScene storyboard={storyboard} scene={scene} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
