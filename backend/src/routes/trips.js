import express from 'express';
import mongoose from 'mongoose';
import Trip from '../models/Trip.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// POST /api/trips - Save or update a trip in MongoDB Atlas
router.post('/trips', protect, async (req, res) => {
  try {
    const {
      tripId,
      title,
      budget,
      currency,
      days,
      budgetItems,
      selectedHomestaysByDay,
      selectedHomestayId,
    } = req.body;

    if (!tripId || !title) {
      return res.status(400).json({ error: 'tripId and title are required' });
    }

    if (!Trip.db || Trip.db.readyState !== 1) {
      return res.status(503).json({ error: 'Database is not connected.' });
    }

    // Upsert trip for logged-in user
    const updatedTrip = await Trip.findOneAndUpdate(
      { userId: req.user._id, tripId },
      {
        userId: req.user._id,
        tripId,
        title,
        budget: budget || 25000,
        currency: currency || 'JPY',
        days: days || [],
        budgetItems: budgetItems || [],
        selectedHomestaysByDay: selectedHomestaysByDay || {},
        selectedHomestayId: selectedHomestayId || null,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json(updatedTrip);
  } catch (error) {
    console.error('[POST /api/trips error]:', error);
    return res.status(500).json({ error: 'Failed to save trip to MongoDB Atlas' });
  }
});

// GET /api/trips - Fetch all saved trips for current user
router.get('/trips', protect, async (req, res) => {
  try {
    const trips = await Trip.find({ userId: req.user._id }).sort({ updatedAt: -1 });
    return res.json(trips);
  } catch (error) {
    console.error('[GET /api/trips error]:', error);
    return res.status(500).json({ error: 'Failed to fetch trips from database' });
  }
});

// GET /api/trips/:id - Fetch single trip by tripId
router.get('/trips/:id', protect, async (req, res) => {
  try {
    const targetId = req.params.id;
    const isObjectId = mongoose.Types.ObjectId.isValid(targetId);
    const query = {
      userId: req.user._id,
      ...(isObjectId
        ? { $or: [{ tripId: targetId }, { _id: targetId }] }
        : { tripId: targetId }),
    };

    const trip = await Trip.findOne(query);

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    return res.json(trip);
  } catch (error) {
    console.error('[GET /api/trips/:id error]:', error);
    return res.status(500).json({ error: 'Failed to load trip' });
  }
});

// DELETE /api/trips/:id - Delete a saved trip
router.delete('/trips/:id', protect, async (req, res) => {
  try {
    const targetId = req.params.id;
    const isObjectId = mongoose.Types.ObjectId.isValid(targetId);
    const query = {
      userId: req.user._id,
      ...(isObjectId
        ? { $or: [{ tripId: targetId }, { _id: targetId }] }
        : { tripId: targetId }),
    };

    const trip = await Trip.findOneAndDelete(query);

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found or unauthorized' });
    }

    return res.json({ message: 'Trip deleted successfully', tripId: targetId });
  } catch (error) {
    console.error('[DELETE /api/trips/:id error]:', error);
    return res.status(500).json({ error: 'Failed to delete trip' });
  }
});

export default router;
