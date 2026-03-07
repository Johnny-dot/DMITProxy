import 'dotenv/config';
import './logger.js';
import { createServer } from 'node:http';
import { createApp } from './app.js';

const PORT = parseInt(process.env.SERVER_PORT ?? '3001');
const app = createApp();

createServer(app).listen(PORT, () => {
  console.log(`[Prism] Server running on http://localhost:${PORT}`);
});
