import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { protect, JWT_SECRET } from '../middleware/authMiddleware.js';

const router = express.Router();

function generateTokenAndSetCookie(res, userId) {
  const token = jwt.sign({ id: userId }, JWT_SECRET, {
    expiresIn: '30d',
  });

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });

  return token;
}

// POST /api/auth/signup
router.post('/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Please provide name, email, and password' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if database is connected
    if (!User.db || User.db.readyState !== 1) {
      return res.status(503).json({
        error: 'Database connection failed. Please check your MONGODB_URI connection string in .env and ensure 0.0.0.0/0 is added under Network Access in MongoDB Atlas.',
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
    });

    generateTokenAndSetCookie(res, user._id);

    return res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email,
    });
  } catch (error) {
    console.error('[auth/signup error]:', error);
    return res.status(500).json({ error: error.message || 'Failed to create user account' });
  }
});

// POST /api/auth/login
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password' });
    }

    // Check if database is connected
    if (!User.db || User.db.readyState !== 1) {
      return res.status(503).json({
        error: 'Database connection failed. Please check your MONGODB_URI in .env and ensure 0.0.0.0/0 is added under Network Access in MongoDB Atlas.',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    generateTokenAndSetCookie(res, user._id);

    return res.json({
      id: user._id,
      name: user.name,
      email: user.email,
    });
  } catch (error) {
    console.error('[auth/login error]:', error);
    return res.status(500).json({ error: error.message || 'Login failed due to a server error' });
  }
});

// POST /api/auth/logout
router.post('/auth/logout', (req, res) => {
  res.cookie('token', '', {
    httpOnly: true,
    expires: new Date(0),
  });
  return res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/me
router.get('/auth/me', protect, (req, res) => {
  return res.json({
    id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    wishlist: req.user.wishlist || [],
  });
});

// PUT /api/auth/profile - Update username / email / password
router.put('/auth/profile', protect, async (req, res) => {
  try {
    const { name, email, currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (name && name.trim()) {
      user.name = name.trim();
    }

    if (email && email.trim() && email.toLowerCase() !== user.email) {
      const newEmail = email.toLowerCase().trim();
      const existing = await User.findOne({ email: newEmail });
      if (existing && existing._id.toString() !== user._id.toString()) {
        return res.status(400).json({ error: 'An account with this email address already exists' });
      }
      user.email = newEmail;
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long' });
      }
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required to set a new password' });
      }

      const isMatch = await user.matchPassword(currentPassword);
      if (!isMatch) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      user.password = newPassword;
    }

    await user.save();

    return res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      wishlist: user.wishlist || [],
      message: 'Profile updated successfully!',
    });
  } catch (error) {
    console.error('[PUT /api/auth/profile error]:', error);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

// GET /api/auth/wishlist
router.get('/auth/wishlist', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    return res.json(user?.wishlist || []);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch wishlist' });
  }
});

// POST /api/auth/wishlist - Add destination to wishlist
router.post('/auth/wishlist', protect, async (req, res) => {
  try {
    const { name, category, country, notes } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Destination name is required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const newItem = {
      id: `w-${Date.now()}`,
      name: name.trim(),
      category: category || 'General',
      country: country || '',
      notes: notes || '',
      addedAt: new Date(),
    };

    user.wishlist = user.wishlist || [];
    user.wishlist.unshift(newItem);
    await user.save();

    return res.status(201).json(user.wishlist);
  } catch (error) {
    console.error('[POST /api/auth/wishlist error]:', error);
    return res.status(500).json({ error: 'Failed to add item to wishlist' });
  }
});

// DELETE /api/auth/wishlist/:id - Remove item from wishlist
router.delete('/auth/wishlist/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.wishlist = (user.wishlist || []).filter((item) => item.id !== req.params.id);
    await user.save();

    return res.json(user.wishlist);
  } catch (error) {
    console.error('[DELETE /api/auth/wishlist/:id error]:', error);
    return res.status(500).json({ error: 'Failed to remove item from wishlist' });
  }
});

export default router;
