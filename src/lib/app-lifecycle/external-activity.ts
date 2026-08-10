type ExternalActivityListener = (active: boolean) => void;

let activityDepth = 0;
const listeners = new Set<ExternalActivityListener>();

export function isExternalActivityActive() {
  return activityDepth > 0;
}

export function subscribeToExternalActivity(listener: ExternalActivityListener) {
  listeners.add(listener);
  listener(isExternalActivityActive());
  return () => {
    listeners.delete(listener);
  };
}

function notify() {
  const active = isExternalActivityActive();
  listeners.forEach((listener) => listener(active));
}

export function beginExternalActivity() {
  activityDepth += 1;
  if (activityDepth === 1) notify();
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    activityDepth = Math.max(0, activityDepth - 1);
    if (activityDepth === 0) notify();
  };
}

export async function runExternalActivity<T>(operation: () => Promise<T>) {
  const end = beginExternalActivity();
  try {
    return await operation();
  } finally {
    end();
  }
}
