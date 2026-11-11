import { Eye, OUTLINE, Shine, type AnimalProps } from './shared';

function starPath(cx: number, cy: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (-90 + i * 36) * (Math.PI / 180);
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join(' L')} Z`;
}

export function Starfish({ base }: AnimalProps) {
  const line = '#9a4a36';
  const d = starPath(50, 54, 44, 19);
  const dots: [number, number][] = [
    [50, 22], [50, 32],
    [78, 42], [70, 46],
    [70, 80], [64, 72],
    [30, 80], [36, 72],
    [22, 42], [30, 46],
  ];
  return (
    <g>
      <path d={d} fill={base} stroke={line} strokeWidth={OUTLINE + 1} strokeLinejoin="round" />
      <path d={d} fill="none" stroke={base} strokeWidth={6} strokeLinejoin="round" opacity={0.0} />
      {dots.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.4} fill="#f3b19d" />
      ))}
      <Eye cx={44} cy={52} r={3.2} />
      <Eye cx={56} cy={52} r={3.2} />
      <path d="M45 60 Q50 64 55 60" fill="none" stroke={line} strokeWidth={1.8} strokeLinecap="round" />
      <Shine d="M44 30 Q48 24 52 30" width={2.5} />
    </g>
  );
}
