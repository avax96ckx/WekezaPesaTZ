interface BadgeIconProps {
  type?: string;
  size?: number;
}

export const BADGE_OPTIONS = [
  { id: "blue_burst", label: "Bluu Classic", color: "#1DA1F2" },
  { id: "blue_deep", label: "Bluu Giza", color: "#0077B6" },
  { id: "blue_royal", label: "Bluu Mfalme", color: "#1565C0" },
  { id: "blue_sky", label: "Bluu Angani", color: "#29B6F6" },
  { id: "green_burst", label: "Kijani", color: "#4CAF50" },
  { id: "green_lime", label: "Kijani Kibichi", color: "#00C853" },
  { id: "green_teal", label: "Teal", color: "#009688" },
  { id: "gold_burst", label: "Dhahabu", color: "#FFB300" },
  { id: "gold_orange", label: "Chungwa", color: "#FF6D00" },
  { id: "gold_amber", label: "Amber", color: "#FF8F00" },
  { id: "purple_burst", label: "Zambarau", color: "#7B1FA2" },
  { id: "indigo_burst", label: "Indigo", color: "#3949AB" },
  { id: "violet_burst", label: "Violet", color: "#6200EA" },
  { id: "red_burst", label: "Nyekundu", color: "#E53935" },
  { id: "pink_burst", label: "Pink", color: "#E91E63" },
  { id: "black_burst", label: "Nyeusi", color: "#212121" },
  { id: "slate_burst", label: "Kijivu", color: "#37474F" },
  { id: "multi_rainbow", label: "Rangi Nyingi", color: "#FF6B6B" },
  { id: "multi_ocean", label: "Bahari", color: "#0066FF" },
  { id: "multi_sunset", label: "Machweo", color: "#FF4500" },
];

const legacyMap: Record<string, string> = {
  blue: "blue_burst", blue_circle: "blue_burst", blue_star: "blue_burst",
  lightblue: "blue_sky", light_blue: "blue_sky",
  blue_smooth: "blue_royal", circle_blue: "blue_deep",
  green: "green_burst", green_circle: "green_burst", green_star: "green_lime",
  green_smooth: "green_lime", circle_green: "green_teal",
  gold: "gold_burst", gold_circle: "gold_burst", gold_star: "gold_burst",
  gold_smooth: "gold_orange", circle_gold: "gold_amber",
  purple: "purple_burst", purple_circle: "purple_burst",
  red: "red_burst", red_circle: "red_burst",
  black_circle: "black_burst", black_smooth: "slate_burst",
  circle_grey: "slate_burst", outline_blue: "blue_sky",
  outline_green: "green_teal", outline_gold: "gold_amber",
  pink_circle: "pink_burst",
};

const GRADIENTS: Record<string, [string, string]> = {
  multi_rainbow: ["#FF6B6B", "#4ECDC4"],
  multi_ocean: ["#0066FF", "#00D4FF"],
  multi_sunset: ["#FF4500", "#FFB300"],
};

/**
 * Generates a smooth rounded-notch verification badge path (like Twitter/Facebook/Telegram).
 * The shape has N outer bumps and N inner "notches" creating a seal/medal shape.
 * cx, cy = center; outerR = outer radius; innerR = inner notch radius; n = number of bumps
 */
function sealPath(cx: number, cy: number, outerR: number, innerR: number, n: number): string {
  const points: string[] = [];
  const total = n * 2;
  for (let i = 0; i < total; i++) {
    const angle = (Math.PI * 2 * i) / total - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    points.push(`${i === 0 ? "M" : "L"}${x.toFixed(3)},${y.toFixed(3)}`);
  }
  points.push("Z");
  return points.join(" ");
}

export default function BadgeIcon({ type = "blue_burst", size = 18 }: BadgeIconProps) {
  const resolvedType = legacyMap[type] || type;
  const badge = BADGE_OPTIONS.find(b => b.id === resolvedType) || BADGE_OPTIONS[0];
  const c = badge.color;
  const isGradient = resolvedType in GRADIENTS;
  const gradId = `grad_${resolvedType.replace(/[^a-z0-9]/g, "_")}_${size}`;

  const cx = size / 2;
  const cy = size / 2;
  // Outer radius slightly inside the viewbox, inner radius creates the notch depth
  const outerR = size * 0.46;
  const innerR = size * 0.36;
  // 16 bumps = 32 points (matches the reference image exactly)
  const badgePath = sealPath(cx, cy, outerR, innerR, 16);

  // Checkmark proportional to size
  const ck = size * 0.18;
  const checkX1 = cx - ck * 0.9;
  const checkY1 = cy + ck * 0.1;
  const checkX2 = cx - ck * 0.15;
  const checkY2 = cy + ck * 0.85;
  const checkX3 = cx + ck * 1.1;
  const checkY3 = cy - ck * 0.8;
  const strokeW = Math.max(1.4, size * 0.085);

  const fill = isGradient ? `url(#${gradId})` : c;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
      {isGradient && (() => {
        const [c1, c2] = GRADIENTS[resolvedType];
        return (
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={c1} />
              <stop offset="100%" stopColor={c2} />
            </linearGradient>
          </defs>
        );
      })()}
      {/* Badge seal shape */}
      <path d={badgePath} fill={fill} />
      {/* White checkmark */}
      <polyline
        points={`${checkX1},${checkY1} ${checkX2},${checkY2} ${checkX3},${checkY3}`}
        stroke="white"
        strokeWidth={strokeW}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
