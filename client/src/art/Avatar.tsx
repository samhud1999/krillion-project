import { useId } from 'react';
import type { AvatarId } from '@shared/types';
import { AVATARS, avatarById } from '@shared/theme';
import { ANIMALS } from './avatars/index';
import { luminance, mix } from './color';

export interface AvatarProps {
  id: AvatarId;
  size?: number;
  className?: string;
  /** accessible name; when omitted the image is decorative */
  title?: string;
  /** draw the coloured ring around the badge */
  ring?: boolean;
}

/** Order the join screen should show the avatars in: land → shore → sea. */
export const AVATAR_PREVIEW_ORDER: AvatarId[] = AVATARS.map((a) => a.id);

export function badgeColors(base: string): { badge: string; ring: string; shade: string } {
  const light = luminance(base) > 0.55;
  return light
    ? { badge: mix(base, '#0f4c5c', 0.72), ring: mix(base, '#f4f1e8', 0.3), shade: mix(base, '#0b1d2a', 0.85) }
    : { badge: mix(base, '#f4f1e8', 0.66), ring: mix(base, '#0b1d2a', 0.3), shade: mix(base, '#0b1d2a', 0.55) };
}

export function Avatar({ id, size = 48, className, title, ring = true }: AvatarProps) {
  const uid = useId().replace(/[:]/g, '');
  const clipId = `sck-av-${uid}`;
  const info = avatarById(id);
  const Animal = ANIMALS[id];
  const colors = badgeColors(info.color);
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      style={{ display: 'inline-block', verticalAlign: 'middle', overflow: 'visible' }}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <clipPath id={clipId}>
          <circle cx={50} cy={50} r={47} />
        </clipPath>
      </defs>
      {/* badge */}
      <circle cx={50} cy={50} r={47} fill={colors.badge} />
      {/* soft inner shade at the bottom so the animal sits in a bowl */}
      <ellipse cx={50} cy={78} rx={40} ry={16} fill={colors.shade} opacity={0.18} clipPath={`url(#${clipId})`} />
      <g clipPath={`url(#${clipId})`}>
        <Animal base={info.color} />
      </g>
      {ring ? <circle cx={50} cy={50} r={47} fill="none" stroke={colors.ring} strokeWidth={3} /> : null}
    </svg>
  );
}
