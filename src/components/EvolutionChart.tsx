import { Fragment } from 'react';

interface EvolutionChartProps {
  data: Array<{ date: string; value: number }>;
  yMin: number;
  yMax: number;
  yTicks: number[];
  formatY: (v: number) => string;
  color: string;
}

export default function EvolutionChart({
  data,
  yMin,
  yMax,
  yTicks,
  formatY,
  color,
}: EvolutionChartProps) {
  const padding = { top: 20, right: 15, bottom: 40, left: 38 };
  const svgW = 400;
  const svgH = 200;
  const chartW = svgW - padding.left - padding.right;
  const chartH = svgH - padding.top - padding.bottom;
  const n = data.length;
  const xStep = chartW / (n - 1);
  const yRange = yMax - yMin || 1;

  const pts = data.map((d, i) => ({
    x: padding.left + i * xStep,
    y: padding.top + chartH - ((d.value - yMin) / yRange) * chartH,
    date: d.date,
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${pts[pts.length - 1].x},${padding.top + chartH} L${pts[0].x},${padding.top + chartH} Z`;

  const maxLabels = 6;
  const labelInterval = n <= maxLabels ? 1 : Math.ceil(n / maxLabels);

  return (
    <div className="parent-evolution-chart">
      <svg viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="xMidYMid meet">
        {yTicks.map((tick) => {
          const y = padding.top + chartH - ((tick - yMin) / yRange) * chartH;
          return (
            <Fragment key={`y-${tick}`}>
              <line
                x1={padding.left}
                y1={y}
                x2={padding.left + chartW}
                y2={y}
                stroke="var(--border)"
                strokeWidth="1"
              />
              <text
                x={padding.left - 6}
                y={y + 1}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="10"
                fill="var(--text-muted)"
                fontFamily="Nunito, sans-serif"
              >
                {formatY(tick)}
              </text>
            </Fragment>
          );
        })}
        <path d={areaPath} fill={color} opacity="0.1" />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {pts.map((p, i) => (
          <Fragment key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r="4"
              fill="var(--surface)"
              stroke={color}
              strokeWidth="2"
            />
            {i % labelInterval === 0 && (
              <text
                x={p.x}
                y={padding.top + chartH + 16}
                textAnchor="middle"
                fontSize="9"
                fill="var(--text-light)"
                fontFamily="Nunito, sans-serif"
              >
                {p.date}
              </text>
            )}
          </Fragment>
        ))}
      </svg>
    </div>
  );
}
