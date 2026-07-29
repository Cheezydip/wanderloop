import express from 'express';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';
import { protect, JWT_SECRET } from '../middleware/authMiddleware.js';

const router = express.Router();
const googleClient = new OAuth2Client();

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

function getAutoAvatarUrl(name, email) {
  const seed = encodeURIComponent((name || email || 'Traveler').trim());
  return `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}&backgroundColor=0d9488,0f766e,14b8a6,065f46`;
}

// POST /api/auth/google - Authenticate using Google ID Token or Access Token
router.post('/auth/google', async (req, res) => {
  try {
    const { credential, accessToken } = req.body;

    if (!credential && !accessToken) {
      return res.status(400).json({ error: 'Missing Google authorization token' });
    }

    if (!User.db || User.db.readyState !== 1) {
      return res.status(503).json({
        error: 'Database connection failed. Please check MONGODB_URI in .env.',
      });
    }

    let googleId, email, name, picture;

    if (credential) {
      const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
      const verifyOptions = { idToken: credential };
      if (googleClientId) {
        verifyOptions.audience = googleClientId;
      }

      const ticket = await googleClient.verifyIdToken(verifyOptions);
      const payload = ticket.getPayload();

      googleId = payload.sub;
      email = payload.email;
      name = payload.name || payload.given_name || 'Traveler';
      picture = payload.picture;
    } else if (accessToken) {
      const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!userinfoRes.ok) {
        return res.status(400).json({ error: 'Failed to fetch user profile from Google' });
      }
      const payload = await userinfoRes.json();
      googleId = payload.sub;
      email = payload.email;
      name = payload.name || 'Traveler';
      picture = payload.picture;
    }

    if (!email) {
      return res.status(400).json({ error: 'Google account did not return a valid email address' });
    }

    const lowercaseEmail = email.toLowerCase().trim();
    const fallbackAvatar = picture || getAutoAvatarUrl(name, lowercaseEmail);

    // Find existing user by googleId or email
    let user = await User.findOne({ googleId });

    if (!user) {
      user = await User.findOne({ email: lowercaseEmail });
      if (user) {
        user.googleId = googleId;
        if (!user.avatar) {
          user.avatar = fallbackAvatar;
        }
        await user.save();
      }
    }

    if (!user) {
      user = await User.create({
        name: name.trim(),
        email: lowercaseEmail,
        googleId,
        avatar: fallbackAvatar,
      });
    } else if (picture && user.avatar !== picture) {
      user.avatar = picture;
      await user.save();
    }

    generateTokenAndSetCookie(res, user._id);

    return res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar || fallbackAvatar,
      wishlist: user.wishlist || [],
    });
  } catch (error) {
    console.error('[auth/google error]:', error);
    return res.status(400).json({ error: error.message || 'Google authentication failed' });
  }
});

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

    const autoAvatar = getAutoAvatarUrl(name, email);

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      avatar: autoAvatar,
    });

    generateTokenAndSetCookie(res, user._id);

    return res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar || autoAvatar,
      wishlist: user.wishlist || [],
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

    if (!user.password) {
      return res.status(400).json({
        error: 'This account was created using Google Sign-In. Please click "Continue with Google" to log in.',
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.avatar) {
      user.avatar = getAutoAvatarUrl(user.name, user.email);
      await user.save();
    }

    generateTokenAndSetCookie(res, user._id);

    return res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      wishlist: user.wishlist || [],
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
router.get('/auth/me', protect, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authorized' });
    }
    const user = req.user;
    if (!user.avatar) {
      user.avatar = getAutoAvatarUrl(user.name, user.email);
      await user.save();
    }
    return res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      wishlist: user.wishlist || [],
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve profile' });
  }
});

// PUT /api/auth/profile - Update username / email / password
router.put('/auth/profile', protect, async (req, res) => {
  try {
    const { name, email, avatar, currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (avatar && typeof avatar === 'string') {
      user.avatar = avatar.trim();
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
      avatar: user.avatar || '',
      wishlist: user.wishlist || [],
      message: 'Profile updated successfully!',
    });
  } catch (error) {
    console.error('[PUT /api/auth/profile error]:', error);
    return res.status(500).json({ error: error.message || 'Failed to update profile' });
  }
});

// GET /api/auth/wishlist
router.get('/auth/wishlist', protect, async (req, res) => {
  try {
    if (!User.db || User.db.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection failed' });
    }
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
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Destination name is required' });
    }

    if (!User.db || User.db.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection failed' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.wishlist = user.wishlist || [];

    const existingIndex = user.wishlist.findIndex(
      (item) => item.name.toLowerCase().trim() === name.toLowerCase().trim()
    );

    if (existingIndex !== -1) {
      // Update existing item notes/country
      if (country) user.wishlist[existingIndex].country = country;
      if (notes) user.wishlist[existingIndex].notes = notes;
      if (category) user.wishlist[existingIndex].category = category;
    } else {
      const newItem = {
        id: `w-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: name.trim(),
        category: category || 'General',
        country: country || '',
        notes: notes || '',
        addedAt: new Date(),
      };
      user.wishlist.unshift(newItem);
    }

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
    if (!User.db || User.db.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection failed' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const target = decodeURIComponent(req.params.id).trim().toLowerCase();

    user.wishlist = (user.wishlist || []).filter((item) => {
      if (!item) return false;
      const itemId = item.id ? String(item.id).trim().toLowerCase() : '';
      const itemMongoId = item._id ? String(item._id).trim().toLowerCase() : '';
      const itemName = item.name ? String(item.name).trim().toLowerCase() : '';

      if (itemId && itemId === target) return false;
      if (itemMongoId && itemMongoId === target) return false;
      if (itemName && itemName === target) return false;

      return true;
    });

    await user.save();
    return res.json(user.wishlist);
  } catch (error) {
    console.error('[DELETE /api/auth/wishlist/:id error]:', error);
    return res.status(500).json({ error: 'Failed to remove item from wishlist' });
  }
});

export default router;
