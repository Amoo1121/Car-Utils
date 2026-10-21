import { useId } from "react";

export function BrandMark({ size = 36 }: { size?: number }) {
  // Unique gradient ids: a hidden duplicate (e.g. desktop sidebar on mobile) must not break the visible one.
  const id = useId().replaceAll(":", "");
  return (
    <svg aria-hidden="true" className="brand-mark" height={size} viewBox="0 0 64 64" width={size}>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#1f2a25" />
          <stop offset="1" stopColor="#0b0f0d" />
        </linearGradient>
        <linearGradient id={`${id}-arc`} x1="0" x2="1" y1="1" y2="0">
          <stop offset="0" stopColor="#14b88a" />
          <stop offset="1" stopColor="#b9f27c" />
        </linearGradient>
      </defs>
      <rect fill={`url(#${id}-bg)`} height="64" rx="16" width="64" />
      {/* Speedometer arc */}
      <path d="M14 42a18 18 0 1 1 36 0" fill="none" stroke="#2c3933" strokeLinecap="round" strokeWidth="6" />
      <path d="M14 42a18 18 0 0 1 30.7-12.7" fill="none" stroke={`url(#${id}-arc)`} strokeLinecap="round" strokeWidth="6" />
      <circle cx="32" cy="42" fill="#e9f5ef" r="4" />
      <path d="M32 42 43 30" stroke="#e9f5ef" strokeLinecap="round" strokeWidth="3.5" />
    </svg>
  );
}
