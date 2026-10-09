const W = 1600;
const H = 900;

const traces = [
  {
    amp: 90,
    cycles: 2,
    y: 0.5,
    speed: 60,
    width: 2,
    opacity: 0.55,
    color: "var(--trace-1)",
  },
  {
    amp: 55,
    cycles: 3,
    y: 0.53,
    speed: 85,
    width: 1.5,
    opacity: 0.35,
    color: "var(--trace-2)",
  },
  {
    amp: 140,
    cycles: 1,
    y: 0.47,
    speed: 120,
    width: 1,
    opacity: 0.25,
    color: "var(--trace-2)",
  },
  {
    amp: 30,
    cycles: 5,
    y: 0.6,
    speed: 45,
    width: 1,
    opacity: 0.2,
    color: "var(--trace-1)",
  },
];

function sinePath(amp: number, cycles: number, y: number) {
  const points = [];
  for (let x = 0; x <= W * 2; x += 8) {
    points.push(
      `${x},${(H * y + amp * Math.sin((x / W) * cycles * 2 * Math.PI)).toFixed(1)}`,
    );
  }
  return `M${points.join("L")}`;
}

export function Wallpaper() {
  return (
    <div className="wallpaper" aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g filter="url(#glow)" fill="none" strokeLinecap="round">
          {traces.map((t, i) => (
            <path
              key={i}
              className="trace"
              d={sinePath(t.amp, t.cycles, t.y)}
              stroke={t.color}
              strokeWidth={t.width}
              opacity={t.opacity}
              style={{ animationDuration: `${t.speed}s` }}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
