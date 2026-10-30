// Shared setup for ui-check.mjs and ui-check-brain.mjs: a throwaway seeded user and a Chromium with the built extension.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';

export const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
export const BASE = process.env.API_BASE ?? 'http://localhost:3100';
export const OUT = process.env.UI_CHECK_OUT ?? '/tmp/sb-ui-check';
export const demo = JSON.parse(readFileSync(`${ROOT}/fixtures/seed/demo.json`, 'utf8'));
const EXT = `${ROOT}/apps/extension/.output/chrome-mv3`;

export const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });

/** Runs a script from apps/web/scripts. tsx loads apps/web/.env.local; values in this process's environment win. */
export function webScript(script, ...args) {
  execFileSync('pnpm', ['exec', 'tsx', '--env-file-if-exists=.env.local', `scripts/${script}`, ...args], { cwd: `${ROOT}/apps/web`, stdio: ['ignore', 'ignore', 'inherit'] });
}

export const api = (user, route, init = {}) => fetch(BASE + route, { ...init, headers: { 'x-user-id': user } });

/** Seeds `<prefix>-<timestamp>`, opens Chromium, runs `body`, and always deletes the user. */
export async function withUser(prefix, body) {
  mkdirSync(OUT, { recursive: true });
  const user = `${prefix}-${Date.now()}`;
  console.log(`seeding ${user} against ${BASE}`);
  try {
    webScript('seed.ts', '--user', user);
    const ctx = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), 'sb-ui-check-')), {
      executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(),
      headless: true,
      acceptDownloads: true,
      args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--headless=new'],
      viewport: { width: 1100, height: 900 },
    });
    try {
      await body({ ctx, user });
    } finally {
      await ctx.close();
    }
  } finally {
    const res = await api(user, '/api/me', { method: 'DELETE' });
    console.log(`cleanup: deleted ${user} (HTTP ${res.status})`);
  }
}
