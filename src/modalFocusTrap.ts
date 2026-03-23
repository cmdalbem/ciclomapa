/**
 * Utilities for modal focus trap and Escape-to-close.
 * Use in custom modal overlays (not Ant Design Modal, which handles this itself).
 */

import type { MutableRefObject, RefObject } from 'react';

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function getFocusableElements(container: ParentNode | null | undefined): HTMLElement[] {
  if (!container || !('querySelectorAll' in container)) return [];
  return Array.from(
    (container as HTMLElement).querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
}

export function handleModalKeyDown(
  event: KeyboardEvent,
  containerRef: RefObject<HTMLElement | null> | undefined,
  onClose: () => void
): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    onClose();
    return;
  }
  if (event.key !== 'Tab') return;
  const focusable = getFocusableElements(containerRef?.current ?? null);
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey) {
    if (document.activeElement === first) {
      event.preventDefault();
      last.focus();
    }
  } else if (document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function setupModalFocus(
  containerRef: RefObject<HTMLElement | null>,
  previousActiveElementRef: MutableRefObject<Element | null>
): void {
  previousActiveElementRef.current = document.activeElement;
  const el = containerRef?.current;
  if (el) {
    el.focus();
    const focusable = getFocusableElements(el);
    if (focusable.length > 0) focusable[0].focus();
  }
}

export function restoreModalFocus(
  previousActiveElementRef: MutableRefObject<Element | null>
): void {
  const prev = previousActiveElementRef?.current;
  if (prev && typeof (prev as HTMLElement).focus === 'function') {
    (prev as HTMLElement).focus();
  }
}
