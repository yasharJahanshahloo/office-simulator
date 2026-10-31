import fs from 'node:fs';
import path from 'node:path';
import { zipSync, strToU8 } from 'fflate';

/** Executable bit for unix unzip tools: (mode << 16) in the external attributes, with os = unix. */
const EXEC = { os: 3, attrs: 0o100755 << 16 };
const FILE = { os: 3, attrs: 0o100644 << 16 };

/**
 * The setup zip a registered employee receives: the reporter scripts, install.md for their
 * AI agent, the server URL, their personal credential, and the Claude plugin template
 * (Cowork and Desktop chat only run hooks from plugins). Files are read fresh on every
 * call, so a zip always carries the latest reporter version.
 */
export function buildSetupZip(opts: { reporterDir: string; serverUrl: string; credential: string }): Uint8Array {
  const read = (name: string) => fs.readFileSync(path.join(opts.reporterDir, name), 'utf8');
  const root = 'office-presence/';
  return zipSync({
    [root + 'install.md']: [strToU8(read('install.md').replaceAll('{{SERVER}}', opts.serverUrl)), FILE],
    [root + 'ping.sh']: [strToU8(read('ping.sh')), EXEC],
    [root + 'ping.ps1']: [strToU8(read('ping.ps1')), FILE],
    [root + 'server_url']: [strToU8(opts.serverUrl + '\n'), FILE],
    [root + 'credential']: [strToU8(opts.credential + '\n'), FILE],
    [root + 'claude-plugin/.claude-plugin/plugin.json']: [strToU8(read('claude-plugin/.claude-plugin/plugin.json')), FILE],
    [root + 'claude-plugin/hooks/hooks.json']: [strToU8(read('claude-plugin/hooks/hooks.json')), FILE],
  });
}
