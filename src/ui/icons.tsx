/** Inline SVG icons (stroke-based, 24px grid). Decorative: always paired with a text label. */
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export const MapIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...base}>
    <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
    <path d="M9 4v14M15 6v14" />
  </svg>
);

export const PauseIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...base}>
    <path d="M8 5v14M16 5v14" />
  </svg>
);

export const HelpIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...base}>
    <rect x="3" y="6" width="18" height="12" rx="3" />
    <path d="M7 10h.01M11 10h.01M15 10h.01M8 14h8" />
  </svg>
);

export const SoundIcon = ({ muted }: { muted: boolean }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...base}>
    <path d="M4 9v6h4l5 4V5L8 9H4Z" />
    {muted ? <path d="m17 9 4 6M21 9l-4 6" /> : <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />}
  </svg>
);

export const BookIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...base}>
    <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

export const HeartIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...base}>
    <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z" />
  </svg>
);

export const NextIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" {...base}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export const Key = ({ children }: { children: React.ReactNode }) => (
  <kbd className="key" aria-hidden="true">
    {children}
  </kbd>
);
