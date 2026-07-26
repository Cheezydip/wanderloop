import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'wanderloop_secret_jwt_key_2026';

export async function protect(req, res, next) {
  try {
    let token = req.cookies?.token;

    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ error: 'Not authorized, no token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ error: 'User account not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('[authMiddleware]: JWT verification failed:', error.message);
    return res.status(401).json({ error: 'Not authorized, token invalid or expired' });
  }
}
