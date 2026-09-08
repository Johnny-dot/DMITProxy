import { startDemo } from './runtime.js';
import { DEMO_INVITE, DEMO_PASSWORD } from './fixtures.js';

const port = Number(process.env.DEMO_PORT || 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error('DEMO_PORT must be 1024–65535.');
const demo = await startDemo(port);
console.log(
  `\nPrism local demo: ${demo.url}\nUser: demo / ${DEMO_PASSWORD}\nAdmin: admin / ${DEMO_PASSWORD}\nInvite: ${DEMO_INVITE}\nSynthetic data only. Press Ctrl+C to stop.\n`,
);
async function shutdown() {
  await demo.close();
  process.exit(0);
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
