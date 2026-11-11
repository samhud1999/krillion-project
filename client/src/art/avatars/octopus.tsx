import { Eye, OUTLINE, Shine, type AnimalProps } from './shared';

export function Octopus({ base }: AnimalProps) {
  const line = '#4c2b5e';
  const arms =
    'M30 64 C20 76 8 80 12 96 ' +
    'M38 70 C34 84 22 92 28 106 ' +
    'M48 72 C50 86 40 96 46 108 ' +
    'M58 72 C58 88 70 94 64 108 ' +
    'M68 68 C76 82 90 86 86 100 ' +
    'M74 60 C86 68 98 70 96 84';
  return (
    <g>
      <path d={arms} fill="none" stroke={line} strokeWidth={11} strokeLinecap="round" />
      <path d={arms} fill="none" stroke={base} strokeWidth={8} strokeLinecap="round" />
      {/* suckers */}
      <g fill="#c9a0e0" opacity={0.9}>
        <circle cx={22} cy={74} r={1.6} />
        <circle cx={14} cy={88} r={1.6} />
        <circle cx={34} cy={82} r={1.6} />
        <circle cx={28} cy={96} r={1.6} />
        <circle cx={48} cy={88} r={1.6} />
        <circle cx={60} cy={88} r={1.6} />
        <circle cx={78} cy={78} r={1.6} />
        <circle cx={86} cy={92} r={1.6} />
        <circle cx={90} cy={70} r={1.6} />
      </g>
      {/* head */}
      <ellipse cx={50} cy={48} rx={27} ry={25} fill={base} stroke={line} strokeWidth={OUTLINE} />
      <ellipse cx={50} cy={36} rx={14} ry={7} fill="#9a6ab3" opacity={0.55} />
      {/* eyes */}
      <circle cx={40} cy={52} r={6.4} fill="#e8dff0" />
      <circle cx={60} cy={52} r={6.4} fill="#e8dff0" />
      <Eye cx={40} cy={52} r={3.8} />
      <Eye cx={60} cy={52} r={3.8} />
      <path d="M46 64 Q50 67 54 64" fill="none" stroke={line} strokeWidth={1.6} strokeLinecap="round" />
      <Shine d="M30 36 Q38 26 50 26" />
    </g>
  );
}
