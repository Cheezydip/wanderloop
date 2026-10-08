import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './config/db.js';
import healthRouter from './routes/health.js';
import routingRouter from './routes/routing.js';
import geocodingRouter from './routes/geocoding.js';
import poiRouter from './routes/poi.js';
import lodgingRouter from './routes/lodging.js';
import chatRouter from './routes/chat.js';
import authRouter from './routes/auth.js';
import tripsRouter from './routes/trips.js';

// Load environment variables from project root .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const providerPort = process.env.PORT;
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Connect to MongoDB Atlas / Local Database
connectDB();

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
const PORT = providerPort || process.env.PORT || 3001;

// CORS setup
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or server-to-server)
        if (!origin) return callback(null, true);
        if (
          origin.endsWith('.vercel.app') ||
          origin.endsWith('.onrender.com') ||
          origin.includes('localhost') ||
          (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL)
        ) {
          return callback(null, true);
        }
        return callback(null, true);
      }
    : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Routes
app.get('/', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'Wanderloop Backend' });
});
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api', healthRouter);
app.use('/api', routingRouter);
app.use('/api', geocodingRouter);
app.use('/api', poiRouter);
app.use('/api', lodgingRouter);
app.use('/api', chatRouter);
app.use('/api', authRouter);
app.use('/api', tripsRouter);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server]: Wanderloop backend listening at http://0.0.0.0:${PORT}`);
});
