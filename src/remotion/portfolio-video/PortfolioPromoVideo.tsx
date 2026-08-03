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
  PortfolioVideoStoryboard,
} from '@/lib/portfolio-video/types';

const colors = {
  ink: '#04131d',
  emerald: '#37d89a',
  cream: '#f7f4ed',
  slate: '#b8c5cd',
  gold: '#dcb56d',
};

function safePhoto(storyboard: PortfolioVideoStoryboard, index: number) {
  if (!storyboard.photoUrls.length) return null;
  return storyboard.photoUrls[index % storyboard.photoUrls.length] ?? null;
}

function PhotoLayer({
  src,
  frame,
  intensity = 0.5,
  motion = 'ZOOM',
}: {
  src: string | null;
  frame: number;
  intensity?: number;
  motion?: PortfolioVideoStoryboard['direction']['photoMotion'];
}) {
  const progress = interpolate(frame, [0, 150], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });
  const scale = motion === 'STILL'
    ? 1.025
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

function BrandMark({ storyboard, dark = false }: { storyboard: PortfolioVideoStoryboard; dark?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, color: dark ? colors.ink : colors.cream }}>
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

function AnimatedIn({ children, delay = 0, distance = 60 }: { children: ReactNode; delay?: number; distance?: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 110, mass: 0.8 } });
  return (
    <div style={{ opacity: progress, transform: `translateY(${(1 - progress) * distance}px)` }}>
      {children}
    </div>
  );
}

function SceneFrame({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <AbsoluteFill
      style={{
        padding: '118px 86px 104px',
        fontFamily: 'Arial, Helvetica, sans-serif',
        color: colors.cream,
        ...style,
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

function HookScene({ storyboard }: PortfolioPromoVideoProps) {
  const frame = useCurrentFrame();
  const photo = safePhoto(storyboard, 0);
  const headlineSize = storyboard.title.length > 48 ? 74 : 92;
  return (
    <AbsoluteFill>
      <PhotoLayer src={photo} frame={frame} intensity={storyboard.direction.effectIntensity} motion={storyboard.direction.photoMotion} />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(3,15,23,.18), rgba(3,15,23,.35) 42%, rgba(3,15,23,.96))' }} />
      <SceneFrame style={{ justifyContent: 'space-between' }}>
        <AnimatedIn><BrandMark storyboard={storyboard} /></AnimatedIn>
        <div>
          <AnimatedIn delay={5}>
            <div style={{ width: 110, height: 8, borderRadius: 8, background: colors.emerald, marginBottom: 32 }} />
          </AnimatedIn>
          <AnimatedIn delay={8} distance={90}>
            <div style={{ fontSize: headlineSize, lineHeight: 1.02, fontWeight: 820, letterSpacing: -3, maxWidth: 900 }}>
              {storyboard.title}
            </div>
          </AnimatedIn>
          <AnimatedIn delay={14}>
            <div style={{ marginTop: 32, fontSize: 34, color: colors.slate, lineHeight: 1.35 }}>
              {storyboard.scenes[0].body}
            </div>
          </AnimatedIn>
        </div>
      </SceneFrame>
    </AbsoluteFill>
  );
}

function GalleryScene({ storyboard }: PortfolioPromoVideoProps) {
  const frame = useCurrentFrame();
  const count = Math.max(1, storyboard.photoUrls.length);
  const slotDuration = Math.max(1, Math.floor(150 / count));
  const slot = Math.min(count - 1, Math.floor(frame / slotDuration));
  const localSlotFrame = frame % slotDuration;
  const transition = storyboard.direction.galleryTransition;
  const opacity = transition === 'CUT'
    ? 1
    : interpolate(localSlotFrame, [0, Math.min(7, slotDuration / 3), Math.max(8, slotDuration - 5), slotDuration], [0, 1, 1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
  const slideX = transition === 'SLIDE'
    ? interpolate(localSlotFrame, [0, Math.min(10, slotDuration / 2)], [110, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
      })
    : 0;
  return (
    <AbsoluteFill style={{ background: colors.ink }}>
      <div style={{ position: 'absolute', inset: '92px 58px 330px', borderRadius: 34, overflow: 'hidden' }}>
        <div style={{ opacity, transform: `translateX(${slideX}px)`, width: '100%', height: '100%' }}>
          <PhotoLayer src={safePhoto(storyboard, slot)} frame={localSlotFrame} intensity={storyboard.direction.effectIntensity} motion={storyboard.direction.photoMotion} />
        </div>
      </div>
      <SceneFrame style={{ justifyContent: 'flex-end' }}>
        <AnimatedIn>
          <div style={{ fontSize: 30, textTransform: 'uppercase', letterSpacing: 5, color: colors.emerald, fontWeight: 800 }}>
            {storyboard.scenes[1].headline}
          </div>
          <div style={{ marginTop: 18, fontSize: 42, lineHeight: 1.32, maxWidth: 870, color: colors.cream }}>
            {storyboard.scenes[1].body}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 30 }}>
            {Array.from({ length: count }).map((_, index) => (
              <div key={index} style={{ width: index === slot ? 70 : 22, height: 8, borderRadius: 8, background: index === slot ? colors.emerald : '#38505d' }} />
            ))}
          </div>
        </AnimatedIn>
      </SceneFrame>
    </AbsoluteFill>
  );
}

function FeaturesScene({ storyboard }: PortfolioPromoVideoProps) {
  const frame = useCurrentFrame();
  const features = storyboard.featureLabels.length ? storyboard.featureLabels : storyboard.detailLabels;
  return (
    <AbsoluteFill>
      <PhotoLayer src={safePhoto(storyboard, 1)} frame={frame} intensity={0.22} motion={storyboard.direction.photoMotion} />
      <AbsoluteFill style={{ background: 'linear-gradient(135deg, rgba(3,18,27,.97), rgba(3,18,27,.72))' }} />
      <SceneFrame>
        <BrandMark storyboard={storyboard} />
        <div style={{ marginTop: 'auto', marginBottom: 'auto' }}>
          <AnimatedIn>
            <div style={{ color: colors.gold, fontSize: 30, fontWeight: 800, letterSpacing: 4, textTransform: 'uppercase' }}>
              Öne çıkanlar
            </div>
            <div style={{ fontSize: 70, fontWeight: 820, lineHeight: 1.08, marginTop: 22, marginBottom: 52 }}>
              Yaşam kalitesini<br />yükselten detaylar
            </div>
          </AnimatedIn>
          <div style={{ display: 'grid', gap: 18 }}>
            {features.slice(0, 5).map((feature, index) => (
              <AnimatedIn key={feature} delay={8 + index * 4} distance={36}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '22px 26px', border: '1px solid rgba(255,255,255,.16)', borderRadius: 18, background: 'rgba(8,30,43,.72)', fontSize: 35 }}>
                  <span style={{ width: 14, height: 14, borderRadius: 99, background: colors.emerald, flex: '0 0 auto' }} />
                  {feature}
                </div>
              </AnimatedIn>
            ))}
          </div>
        </div>
      </SceneFrame>
    </AbsoluteFill>
  );
}

function DetailsScene({ storyboard }: PortfolioPromoVideoProps) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <PhotoLayer src={safePhoto(storyboard, 2)} frame={frame} intensity={0.18} motion={storyboard.direction.photoMotion} />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(2,13,20,.35), rgba(2,13,20,.94))' }} />
      <SceneFrame style={{ justifyContent: 'flex-end' }}>
        <AnimatedIn>
          {storyboard.showLocation && (
            <div style={{ fontSize: 34, color: colors.emerald, fontWeight: 750, marginBottom: 24 }}>● {storyboard.locationLabel}</div>
          )}
          {storyboard.showPrice && storyboard.priceLabel ? (
            <div style={{ fontSize: 92, fontWeight: 850, letterSpacing: -3 }}>{storyboard.priceLabel}</div>
          ) : (
            <div style={{ fontSize: 74, fontWeight: 820, lineHeight: 1.08 }}>{storyboard.title}</div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 36 }}>
            {storyboard.detailLabels.map((detail) => (
              <span key={detail} style={{ padding: '16px 22px', borderRadius: 99, background: 'rgba(255,255,255,.12)', fontSize: 30, fontWeight: 650 }}>
                {detail}
              </span>
            ))}
          </div>
        </AnimatedIn>
      </SceneFrame>
    </AbsoluteFill>
  );
}

function ContactScene({ storyboard }: PortfolioPromoVideoProps) {
  const frame = useCurrentFrame();
  const pulse = interpolate(Math.sin(frame / 6), [-1, 1], [0.96, 1.04]);
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(145deg, #edf8f3, #d8eee4)' }}>
      <SceneFrame style={{ color: colors.ink, justifyContent: 'space-between' }}>
        <BrandMark storyboard={storyboard} dark />
        <div>
          <AnimatedIn>
            <div style={{ color: '#177c59', fontSize: 30, fontWeight: 850, letterSpacing: 4, textTransform: 'uppercase' }}>Gösterim planlayın</div>
            <div style={{ marginTop: 24, fontSize: 84, lineHeight: 1.05, fontWeight: 860, letterSpacing: -3 }}>
              {storyboard.scenes[4].headline}
            </div>
          </AnimatedIn>
          <AnimatedIn delay={9}>
            <div style={{ marginTop: 62, padding: '34px 38px', borderRadius: 28, background: '#ffffff', boxShadow: '0 22px 60px rgba(6,40,28,.12)' }}>
              <div style={{ fontSize: 38, fontWeight: 800 }}>{storyboard.advisorName}</div>
              {storyboard.advisorPhone && <div style={{ fontSize: 34, marginTop: 18, color: '#315849' }}>{storyboard.advisorPhone}</div>}
              {storyboard.advisorEmail && <div style={{ fontSize: 27, marginTop: 10, color: '#557166' }}>{storyboard.advisorEmail}</div>}
            </div>
          </AnimatedIn>
        </div>
        <div style={{ transform: `scale(${pulse})`, display: 'inline-flex', alignSelf: 'flex-start', padding: '22px 34px', borderRadius: 99, background: colors.emerald, color: colors.ink, fontSize: 30, fontWeight: 850 }}>
          Hemen iletişime geçin
        </div>
      </SceneFrame>
    </AbsoluteFill>
  );
}

export function PortfolioPromoVideo(props: PortfolioPromoVideoProps) {
  const { storyboard } = props;
  const components = [HookScene, GalleryScene, FeaturesScene, DetailsScene, ContactScene];
  return (
    <AbsoluteFill style={{ background: colors.ink }}>
      {storyboard.scenes.map((scene, index) => {
        const Component = components[index];
        return (
          <Sequence key={scene.id} from={scene.fromFrame} durationInFrames={scene.toFrame - scene.fromFrame} premountFor={15}>
            <Component {...props} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
