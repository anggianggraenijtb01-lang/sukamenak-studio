import type { CSSProperties, FC } from 'react';
import { AbsoluteFill, Easing, Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { VideoRenderProps, VideoTextZone } from './types';

const FALLBACK_BRAND = '#1800ad';

/**
 * A text zone is a *reveal* target, not text to draw again.
 *
 * The poster handed to this composition has already been through the pipeline's composite stage, so its
 * slot text is baked into the image. Drawing that text again produced a visible double image (the baked
 * copy behind the animated one), so each zone instead starts covered by a soft dark scrim that clears:
 * the existing text sharpens into focus and nothing is drawn twice.
 */
const ZoneReveal: FC<{ zone: VideoTextZone }> = ({ zone }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  const revealFrames = Math.max(10, Math.round(fps * 0.7));
  const progress = interpolate(frame, [zone.delay, zone.delay + revealFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  if (progress >= 1) return null;

  const style: CSSProperties = {
    position: 'absolute',
    // A little larger than the zone, so text that wraps to its edge is covered too.
    left: Math.max(0, (zone.x - 0.02) * width),
    top: Math.max(0, (zone.y - 0.015) * height),
    width: Math.min(width, (zone.w + 0.04) * width),
    height: Math.min(height, (zone.h + 0.03) * height),
    backdropFilter: `blur(${((1 - progress) * 14).toFixed(1)}px)`,
    backgroundColor: `rgba(6, 8, 20, ${(0.45 * (1 - progress)).toFixed(3)})`,
    borderRadius: Math.round(height * 0.01),
    pointerEvents: 'none',
  };
  return <div style={style} aria-hidden />;
};

/**
 * A finished poster animated into a 9:16 reel.
 *
 * The poster keeps its own aspect ratio (`contain`, never cropped: its baked-in text lives inside its own
 * text zones and cropping would cut it), while a blurred, darkened copy of the same image fills the rest
 * of the canvas so there are no empty bands. On top: a slow zoom, each text zone revealed rather than
 * redrawn, a brand-coloured progress line, then a short fade to the brand colour.
 *
 * No footage generation, no LLM call: everything comes from props the backend already had, and none
 * of it is a prompt.
 */
export const StoryPromo: FC<VideoRenderProps> = ({ posterDataUri, palette, zones, watermark, brandName }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();

  const brand = palette[0] ?? FALLBACK_BRAND;
  const accent = palette[1] ?? '#ffffff';

  const zoom = interpolate(frame, [0, durationInFrames], [1.0, 1.035], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });
  const backdropScale = interpolate(frame, [0, durationInFrames], [1.12, 1.2], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });

  // Fade to brand colour in the last ~0.6 s.
  const outroFrames = Math.min(Math.round(fps * 0.6), Math.round(durationInFrames / 4));
  const outro = interpolate(frame, [durationInFrames - outroFrames, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // A 3 px line along the very bottom: never covers a text zone and shows the reel is playing.
  const lineWidth = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: 'clamp' });

  if (!posterDataUri) return <AbsoluteFill style={{ backgroundColor: brand }} />;

  return (
    <AbsoluteFill style={{ backgroundColor: '#0b0b12' }}>
      {/* Blurred fill: the same poster, enlarged and dimmed, so the vertical canvas has no empty bands. */}
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <Img
          src={posterDataUri}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'blur(38px) brightness(0.42) saturate(1.15)',
            transform: `scale(${backdropScale})`,
          }}
        />
      </AbsoluteFill>

      {/* The poster itself, whole and un-cropped, slowly zooming. Its text is inside its own zones. */}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Img
          src={posterDataUri}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            transform: `scale(${zoom})`,
            filter: 'drop-shadow(0 24px 60px rgba(0,0,0,0.45))',
          }}
        />
      </AbsoluteFill>

      {zones.map((zone) => (
        <ZoneReveal key={zone.key} zone={zone} />
      ))}

      {watermark && (
        <div
          style={{
            position: 'absolute',
            right: Math.round(width * 0.05),
            bottom: Math.round(height * 0.035),
            fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
            fontSize: Math.round(height * 0.016),
            fontWeight: 600,
            color: accent,
            opacity: 0.7,
            letterSpacing: '0.5px',
            textShadow: '0 2px 10px rgba(0,0,0,0.5)',
          }}
        >
          {brandName}
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          height: 3,
          width: `${lineWidth * 100}%`,
          backgroundColor: brand,
        }}
      />

      <AbsoluteFill style={{ backgroundColor: brand, opacity: outro }} />
    </AbsoluteFill>
  );
};
