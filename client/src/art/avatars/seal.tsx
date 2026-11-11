import { Eye, OUTLINE, Shine, type AnimalProps } from './shared';

export function Seal({ base }: AnimalProps) {
  const line = '#313843';
  return (
    <g>
      {/* body */}
      <ellipse cx={50} cy={92} rx={32} ry={24} fill={base} stroke={line} strokeWidth={OUTLINE} />
      {/* flipper */}
      <path d="M22 86 C10 90 6 98 10 106 L30 98 Z" fill={base} stroke={line} strokeWidth={OUTLINE} strokeLinejoin="round" />
      {/* head */}
      <ellipse cx={50} cy={56} rx={26} ry={22} fill={base} stroke={line} strokeWidth={OUTLINE} />
      {/* ear */}
      <ellipse cx={27} cy={50} rx={3} ry={4.5} fill={line} />
      {/* muzzle */}
      <ellipse cx={56} cy={66} rx={15} ry={10.5} fill="#8b94a1" />
      <ellipse cx={64} cy={61} rx={5.2} ry={3.8} fill="#1f2328" />
      {/* whiskers */}
      <path d="M50 68 L36 66 M50 70 L38 74 M62 70 L76 68 M62 72 L74 78" stroke="#e8e8e8" strokeWidth={1.1} strokeLinecap="round" opacity={0.85} />
      <path d="M58 68 Q60 72 56 73" fill="none" stroke={line} strokeWidth={1.4} strokeLinecap="round" />
      <Eye cx={40} cy={52} r={4.4} />
      <Eye cx={62} cy={50} r={4.4} />
      <Shine d="M32 42 Q42 34 56 36" />
    </g>
  );
}
