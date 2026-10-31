import { BaleApi } from './bale';
import { Bot } from './bot';
import { config } from './config';
import { CredentialCodec } from './credential';
import { Store } from './db';
import { createHttpServer } from './http';
import { Presence } from './presence';

const store = new Store(config.dbFile);
const codec = new CredentialCodec(config.credentialKeyHex);
const presence = new Presence(store);

let bot: Bot | null = null;
if (config.botToken) {
  bot = new Bot({
    api: new BaleApi(config.baleApiBase, config.botToken),
    store,
    codec,
    adminIds: config.adminIds,
    allowlistFile: config.allowlistFile,
    reporterDir: config.reporterDir,
    publicUrl: config.publicUrl,
    onSeatsChanged: () => presence.publish(),
  });
  void bot.run();
  console.log(`[bot] polling Bale (${config.adminIds.size} admin(s))`);
} else {
  console.warn('[bot] BALE_BOT_TOKEN not set; bot disabled');
}

const server = createHttpServer({
  store,
  codec,
  presence,
  webDist: config.webDist,
  onTestPing: (userId, tool) => void bot?.notifyConnected(userId, tool),
});

// States expire with time (working → idle → away), so re-evaluate periodically;
// a forced heartbeat also keeps idle proxies from closing the SSE stream.
setInterval(() => presence.publish(), 15_000);
setInterval(() => presence.publish(true), 30_000);

server.listen(config.port, () => {
  console.log(`[http] listening on :${config.port} (public ${config.publicUrl})`);
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    bot?.stop();
    server.close();
    process.exit(0);
  });
}
