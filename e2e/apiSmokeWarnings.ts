import { test, type TestInfo } from '@playwright/test';

/** Collected during a run; summarized in `flushApiSmokeWarnings`. */
export const apiSmokeWarnings: string[] = [];

const OUTAGE_MESSAGE =
  /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ECONNRESET|ECONNABORTED|socket hang up|network error/i;

/** Connection failures and overloaded gateways — not auth/config mistakes. */
export function isHttpOutageStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export function isOutageMessage(message: string): boolean {
  return OUTAGE_MESSAGE.test(message) || /HTTP 5\d\d/.test(message) || /HTTP 429/.test(message);
}

/** True when an error (incl. aggregated Overpass mirror lists) looks like infra outage. */
export function isApiOutage(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (isOutageMessage(msg)) {
    return true;
  }
  const detailLines = msg
    .split('\n')
    .slice(1)
    .filter((line) => {
      const t = line.trim();
      return t.length > 0 && !t.startsWith('Call log:') && !t.startsWith('- →');
    });
  if (detailLines.length > 0) {
    return detailLines.every((line) => isOutageMessage(line));
  }
  return false;
}

export function formatErr(err: unknown): string {
  if (err instanceof Error) {
    return err.message.split('\n')[0] || err.message;
  }
  return String(err);
}

/**
 * Record that a third-party API was unreachable and surface it loudly in logs/CI.
 * Call before `test.skip()` so the job stays green but reviewers get notified.
 */
export function warnApiUnavailable(
  testInfo: TestInfo,
  service: string,
  detail: string
): void {
  const message = `${service} unavailable — ${detail}`;
  apiSmokeWarnings.push(message);

  testInfo.annotations.push({
    type: 'warning',
    description: message,
  });

  console.warn(`\n[api-smoke] WARNING: ${message}\n`);

  if (process.env.GITHUB_ACTIONS) {
    const escaped = message
      .replace(/%/g, '%25')
      .replace(/\r/g, '%0D')
      .replace(/\n/g, '%0A');
    console.log(`::warning title=API smoke (${service})::${escaped}`);
  }
}

/** Warn, then skip the current test (CI stays green). */
export function skipIfUnavailable(testInfo: TestInfo, service: string, detail: string): void {
  warnApiUnavailable(testInfo, service, detail);
  test.skip(true, `${service} unavailable; see WARNING annotations / CI annotations`);
}

/** Skip when the HTTP status indicates outage (5xx / 429). */
export function skipIfHttpOutage(
  testInfo: TestInfo,
  service: string,
  endpoint: string,
  status: number,
  bodySnippet?: string
): void {
  if (!isHttpOutageStatus(status)) {
    return;
  }
  const extra = bodySnippet ? ` — ${bodySnippet.replace(/\s+/g, ' ').slice(0, 120)}` : '';
  skipIfUnavailable(testInfo, service, `${endpoint} HTTP ${status}${extra}`);
}

export async function withApiOutageSkip(
  testInfo: TestInfo,
  service: string,
  endpoint: string,
  run: () => Promise<void>
): Promise<void> {
  try {
    await run();
  } catch (err) {
    if (isApiOutage(err)) {
      skipIfUnavailable(testInfo, service, `${endpoint} (${formatErr(err)})`);
    }
    throw err;
  }
}

/** Emit a single summary line when any dependency was skipped as unreachable. */
export function flushApiSmokeWarnings(): void {
  if (apiSmokeWarnings.length === 0) {
    return;
  }

  const bulletList = apiSmokeWarnings.map((w) => `  - ${w}`).join('\n');
  console.warn(
    `\n[api-smoke] ${apiSmokeWarnings.length} third-party API(s) were unreachable (tests skipped):\n${bulletList}\n`
  );

  if (process.env.GITHUB_ACTIONS) {
    const summary = apiSmokeWarnings.join('; ');
    const escaped = summary
      .replace(/%/g, '%25')
      .replace(/\r/g, '%0D')
      .replace(/\n/g, '%0A');
    console.log(
      `::warning title=API smoke summary::${apiSmokeWarnings.length} unreachable — ${escaped}`
    );
  }
}
