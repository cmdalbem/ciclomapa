/**
 * Utilities for modal focus trap and Escape-to-close.
 * Use in custom modal overlays (not Ant Design Modal, which handles this itself).
 */

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function getFocusableElements(container) {
  if (!container || !container.querySelectorAll) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('disabled') && el.offsetParent !== null
  );
}

export function handleModalKeyDown(event, containerRef, onClose) {
  if (event.key === 'Escape') {
    event.preventDefault();
    onClose();
    return;
  }
  if (event.key !== 'Tab') return;
  const focusable = getFocusableElements(containerRef?.current);
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey) {
    if (document.activeElement === first) {
      event.preventDefault();
      last.focus();
    }
  } else {
    if (document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}

export function setupModalFocus(containerRef, previousActiveElementRef) {
  previousActiveElementRef.current = document.activeElement;
  const el = containerRef?.current;
  if (el) {
    el.focus();
    const focusable = getFocusableElements(el);
    if (focusable.length > 0) focusable[0].focus();
  }
}

export function restoreModalFocus(previousActiveElementRef) {
  const prev = previousActiveElementRef?.current;
  if (prev && typeof prev.focus === 'function') {
    prev.focus();
  }
}
