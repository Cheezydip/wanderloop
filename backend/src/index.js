import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import healthRouter from './routes/health.js';
import routingRouter from './routes/routing.js';
import geocodingRouter from './routes/geocoding.js';
import poiRouter from './routes/poi.js';
import lodgingRouter from './routes/lodging.js';
import chatRouter from './routes/chat.js';

// Load environment variables from project root .env - triggers watch key reload
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

// Self-healing: Decode ORS_API_KEY if it is in Base64 JWT format
let apiKey = process.env.ORS_API_KEY;
if (apiKey && apiKey.startsWith('eyJ')) {
  try {
    const decoded = JSON.parse(Buffer.from(apiKey, 'base64').toString('utf-8'));
    if (decoded.org && decoded.id) {
      process.env.ORS_API_KEY = `${decoded.org}${decoded.id}`;
      console.log('[server]: Automatically decoded and reconstructed ORS_API_KEY from Base64 JWT.');
    }
  } catch (err) {
    console.error('[server]: Failed to decode ORS_API_KEY JWT:', err);
  }
}

const app = express();
const PORT = process.env.PORT || 3001;

// CORS setup
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? false 
    : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// Routes
app.use('/api', healthRouter);
app.use('/api', routingRouter);
app.use('/api', geocodingRouter);
app.use('/api', poiRouter);
app.use('/api', lodgingRouter);
app.use('/api', chatRouter);

app.listen(PORT, () => {
  console.log(`[server]: Wanderloop backend listening at http://localhost:${PORT}`);
});
