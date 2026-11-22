import 'dotenv/config';
import { createApp } from './app.js';
import { closeAllPools, getAppPool } from './db/pool.js';

const PORT = Number(process.env.PORT || 5000);
const app = createApp({ appPool: getAppPool() });

const server = app.listen(PORT, () => {
  console.log(`[server] CuteCart API listening on http://127.0.0.1:${PORT}`);
});

async function shutdown(signal) {
  console.log(`[server] Received ${signal}, shutting down gracefully...`);
  server.close(async () => {
    await closeAllPools();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
