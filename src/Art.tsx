import { useId } from "react";
export function Logo() {
  return (
    <svg viewBox="0 0 40 40" fill="none">
      <path
        d="M20 2 25.5 14.5 38 20 25.5 25.5 20 38 14.5 25.5 2 20 14.5 14.5Z"
        fill="currentColor"
      />
      <path
        d="m20 12 2.5 5.5L28 20l-5.5 2.5L20 28l-2.5-5.5L12 20l5.5-2.5Z"
        fill="#15121f"
      />
    </svg>
  );
}
export function Landscape({ variant = "aurora" }: { variant?: string }) {
  const id = useId().replaceAll(":", "");
  const colors: Record<string, string[]> = {
    aurora: ["#171827", "#383a67", "#8d83c2", "#a49bdd", "#534c80", "#322b51"],
    rose: ["#271724", "#693e61", "#e3a8c5", "#f9c4d5", "#8f628b", "#50354c"],
    forest: ["#111f25", "#254d51", "#80c9ba", "#afdfcd", "#4b8b7e", "#244c45"],
    ocean: ["#111b30", "#2e5378", "#82c2db", "#b7e3ec", "#567f9c", "#294964"],
  };
  const c = colors[variant] || colors.aurora;
  const blocks = [];
  for (let z = 0; z < 13; z++)
    for (let x = 0; x < 14; x++) {
      const dx = x - 6.5,
        dz = z - 6;
      if ((dx * dx) / 52 + (dz * dz) / 35 > 1) continue;
      const h = Math.round(
        2 +
          Math.max(0, 5 - Math.sqrt((x - 7) ** 2 + (z - 5) ** 2)) * 0.9 +
          Math.sin(x * 2 + z),
      );
      const px = 770 + (x - z) * 27,
        py = 239 + (x + z) * 13 - h * 19;
      const bottom = 40 + h * 8;
      blocks.push(
        <g key={x + ":" + z}>
          <path
            d={`M${px},${py}l27,13 -27,13 -27,-13Z`}
            fill={(x + z) % 4 === 0 ? c[3] : c[2]}
          />
          <path
            d={`M${px - 27},${py + 13}l27,13 v${bottom} l-27,-13Z`}
            fill={c[4]}
          />
          <path
            d={`M${px},${py + 26}l27,-13 v${bottom} l-27,13Z`}
            fill={c[5]}
          />
          {(x * 7 + z * 3) % 11 === 0 && h >= 3 && (
            <g>
              <path d={`M${px - 3},${py + 6}v-54h6v54Z`} fill="#3d304d" />
              <path
                d={`M${px},${py - 103}l-30,48 19,-3 -25,33 36,10 36,-10 -25,-33 19,3Z`}
                fill={c[4]}
              />
              <path
                d={`M${px},${py - 103}v88l36,-10 -25,-33 19,3Z`}
                fill={c[2]}
              />
            </g>
          )}
        </g>,
      );
    }
  return (
    <svg
      className="landscape"
      viewBox="0 0 1200 570"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id + "bg"} x2="1" y2="1">
          <stop stopColor={c[0]} />
          <stop offset="1" stopColor={c[1]} />
        </linearGradient>
        <radialGradient id={id + "glow"}>
          <stop stopColor={c[2]} stopOpacity=".3" />
          <stop offset="1" stopColor={c[2]} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id + "moon"} x2=".5" y2="1">
          <stop stopColor={c[3]} />
          <stop offset="1" stopColor={c[2]} stopOpacity=".2" />
        </linearGradient>
      </defs>
      <path fill={"url(#" + id + "bg)"} d="M0 0h1200v570H0Z" />
      <ellipse
        cx="900"
        cy="200"
        rx="460"
        ry="330"
        fill={"url(#" + id + "glow)"}
      />
      <circle cx="939" cy="122" r="62" fill={"url(#" + id + "moon)"} />
      <path
        d="m435 390 100-128 42 51 97-125 119 159 45-56 145 139 100-180 117 189v131H400Z"
        fill={c[2]}
        opacity=".07"
      />
      <path
        d="m553 570 72-94 30 28 113-78 64 59 86-91 127 119 80-88 75 56v89Z"
        fill={c[2]}
        opacity=".07"
      />
      {Array.from({ length: 45 }, (_, n) => (
        <circle
          key={n}
          cx={400 + ((n * 173) % 790)}
          cy={25 + ((n * 91) % 340)}
          r={n % 7 === 0 ? 1.8 : 0.8}
          fill={c[3]}
          opacity={n % 4 === 0 ? 0.65 : 0.2}
        />
      ))}
      <g transform="translate(5 -12)">{blocks}</g>
      <path d="m1025 408 28-14 29 14-29 14Z" fill={c[2]} />
      <path d="m1025 408 28 14v30l-28-14Z" fill={c[4]} />
      <path d="m1053 422 29-14v30l-29 14Z" fill={c[5]} />
    </svg>
  );
}
