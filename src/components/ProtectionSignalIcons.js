import React from 'react';

/** Three vertical bars (left → right); inactive bars at 30% opacity. */
const PROTECTION_SIGNAL_DIM = 0.2;

function protectionSignalSvg(level) {
  const [left, middle, right] =
    level === 1
      ? [1, PROTECTION_SIGNAL_DIM, PROTECTION_SIGNAL_DIM]
      : level === 2
        ? [1, 1, PROTECTION_SIGNAL_DIM]
        : [1, 1, 1];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="inline-block w-3 h-3 flex-shrink-0 align-middle opacity-90"
      stroke="currentColor"
      fill="currentColor"
      strokeWidth={0}
      aria-hidden
    >
      <path fill="none" d="M0 0h24v24H0z" />
      <rect x="5" y="14" width="3" height="6" fill="currentColor" opacity={left} />
      <rect x="11" y="9" width="3" height="11" fill="currentColor" opacity={middle} />
      <rect x="17" y="4" width="3" height="16" fill="currentColor" opacity={right} />
    </svg>
  );
}

export const IconSignal1 = () => protectionSignalSvg(1);
export const IconSignal2 = () => protectionSignalSvg(2);
export const IconSignal3 = () => protectionSignalSvg(3);
