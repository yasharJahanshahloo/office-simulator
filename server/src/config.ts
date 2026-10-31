import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');

function list(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const dataDir = path.resolve(process.env.DATA_DIR ?? path.join(repoRoot, 'server/data'));

export const config = {
  port: Number(process.env.PORT ?? 8090),
  publicUrl: (process.env.PUBLIC_URL ?? 'http://localhost:8090').replace(/\/+$/, ''),
  botToken: process.env.BALE_BOT_TOKEN ?? '',
  baleApiBase: (process.env.BALE_API_BASE ?? 'https://tapi.bale.ai').replace(/\/+$/, ''),
  adminIds: new Set(list(process.env.ADMIN_IDS)),
  credentialKeyHex: process.env.CREDENTIAL_KEY ?? '',
  dataDir,
  dbFile: path.join(dataDir, 'office.sqlite'),
  /** One Bale user id per line; `#` starts a comment. Re-read on every check. */
  allowlistFile: path.join(dataDir, 'allowlist.txt'),
  webDist: path.resolve(process.env.WEB_DIST ?? path.join(repoRoot, 'web/dist')),
  reporterDir: path.resolve(process.env.REPORTER_DIR ?? path.join(repoRoot, 'reporter')),
};
