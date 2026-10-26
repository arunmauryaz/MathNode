import React from 'react';

interface MathIconProps {
  name?: string;
  size?: number;
  className?: string;
}

export const MathIcon: React.FC<MathIconProps> = ({
  name = 'function',
  size = 14,
  className = ''
}) => {
  const normalized = (name || 'function').toLowerCase().trim();

  // If a raw SVG string is provided in the .mnode file
  if (normalized.startsWith('<svg') || normalized.startsWith('<?xml')) {
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 ${className}`}
        style={{ width: size, height: size }}
        dangerouslySetInnerHTML={{ __html: name }}
      />
    );
  }

  const s = size;

  switch (normalized) {
    case 'add':
    case 'plus':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      );

    case 'multiply':
    case 'cross':
    case 'times':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      );

    case 'divide':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <circle cx="12" cy="6" r="1.5" fill="currentColor" />
          <line x1="5" y1="12" x2="19" y2="12" />
          <circle cx="12" cy="18" r="1.5" fill="currentColor" />
        </svg>
      );

    case 'sigma':
    case 'sum':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M19 4H5l7 8-7 8h14" />
        </svg>
      );

    case 'delta':
    case 'laplacian':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M12 4L3 20h18L12 4z" />
        </svg>
      );

    case 'integral':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M14 5a3 3 0 0 0-3 3v8a3 3 0 0 1-3 3" />
        </svg>
      );

    case 'derivative':
    case 'partial':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M14.5 4c-3 0-5 2-5 5.5 0 2.5 1.5 4.5 4 4.5 3 0 4.5-2 4.5-5 0-3-1.5-5-3.5-5z" />
          <path d="M9.5 9.5C8 10.5 7 12 7 14c0 3 2.5 6 6 6 2 0 4-1 5-2.5" />
        </svg>
      );

    case 'matrix':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M7 4H4v16h3" />
          <path d="M17 4h3v16h-3" />
          <circle cx="8.5" cy="8.5" r="1" fill="currentColor" />
          <circle cx="15.5" cy="8.5" r="1" fill="currentColor" />
          <circle cx="8.5" cy="15.5" r="1" fill="currentColor" />
          <circle cx="15.5" cy="15.5" r="1" fill="currentColor" />
        </svg>
      );

    case 'vector':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <line x1="5" y1="19" x2="19" y2="5" />
          <polyline points="12 5 19 5 19 12" />
        </svg>
      );

    case 'pi':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <line x1="4" y1="7" x2="20" y2="7" />
          <path d="M9 7v11c0 1-1 2-2 2" />
          <path d="M16 7v13" />
        </svg>
      );

    case 'sqrt':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M3 14l3 6 4-16h11" />
        </svg>
      );

    case 'slider':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <line x1="4" y1="12" x2="20" y2="12" />
          <circle cx="10" cy="12" r="3" fill="currentColor" />
        </svg>
      );

    case 'data':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
      );

    case 'output':
    case 'display':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <rect x="3" y="4" width="18" height="13" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      );

    case 'function':
    default:
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M8 18c2 0 3-1 3-3V7c0-2-1-3-3-3" />
          <line x1="5" y1="11" x2="14" y2="11" />
          <path d="M15 16l4 4" />
          <path d="M19 16l-4 4" />
        </svg>
      );
  }
};
