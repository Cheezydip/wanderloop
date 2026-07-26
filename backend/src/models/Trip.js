import mongoose from 'mongoose';

const stopSchema = new mongoose.Schema(
  {
    id: String,
    name: String,
    lat: Number,
    lng: Number,
    timeEstimate: String,
    costEstimate: Number,
    rationale: String,
    order: Number,
    category: String,
  },
  { _id: false }
);

const daySchema = new mongoose.Schema(
  {
    id: String,
    dayNumber: Number,
    colorHue: String,
    stops: [stopSchema],
  },
  { _id: false }
);

const tripSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tripId: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    budget: {
      type: Number,
      default: 25000,
    },
    currency: {
      type: String,
      default: 'JPY',
    },
    days: [daySchema],
    budgetItems: [mongoose.Schema.Types.Mixed],
    selectedHomestaysByDay: mongoose.Schema.Types.Mixed,
    selectedHomestayId: String,
  },
  {
    timestamps: true,
  }
);

const Trip = mongoose.models.Trip || mongoose.model('Trip', tripSchema);
export default Trip;
