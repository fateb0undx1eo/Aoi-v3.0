import type { CSSProperties } from "react";

export function CoolIcon({
  icon,
  size = 24,
  fill = false,
  strokeWidth = 2,
  className,
  style,
}: {
  icon: string;
  size?: number;
  fill?: boolean;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ flexShrink: 0, ...style }}
    >
      <use href={`/sprite.svg#${icon}`} />
    </svg>
  );
}
