let tail: Promise<unknown> = Promise.resolve();

/**
 * Runs quota and billing read-modify-writes one at a time in this process, so parallel captures
 * and webhooks cannot both read the same count or credit balance. The API is one Next process.
 */
export function withBillingLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = tail.then(fn, fn);
  tail = run.catch(() => undefined);
  return run;
}
