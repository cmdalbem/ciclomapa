/** Pending service worker waiting to activate after a deploy. */
let pendingRegistration = null;

/** True after the user chooses to reload for an update (not on dismiss). */
let userRequestedReload = false;

const listeners = new Set();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

/** Called from index.js when a new service worker is installed and waiting. */
export function setPendingUpdate(registration) {
  const waiting = registration?.waiting;
  if (!waiting) return;
  pendingRegistration = registration;
  notifyListeners();
}

export function getPendingUpdate() {
  return pendingRegistration;
}

export function subscribeToPwaUpdate(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function applyPendingUpdate() {
  const waiting = pendingRegistration?.waiting;
  if (!waiting) {
    window.location.reload();
    return;
  }
  userRequestedReload = true;
  waiting.postMessage({ type: 'SKIP_WAITING' });
}

export function shouldReloadForSwUpdate() {
  return userRequestedReload;
}
