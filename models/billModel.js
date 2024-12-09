const mongoose = require('mongoose');

const billSchema = new mongoose.Schema({
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    cost: {
      type: Number,
      required: true
    }
  }],
  totalCost: {
    type: Number,
    required: true
  },
  billNumber: {
    type: String,
    unique: true
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'cancelled'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'upi'],
    required: true
  }
}, { timestamps: true });

// Generate unique bill number before saving
billSchema.pre('save', async function(next) {
  if (!this.billNumber) {
    // Generate bill number based on timestamp and random number
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.billNumber = `BILL-${timestamp}-${random}`;
  }
  next();
});

module.exports = mongoose.model('Bill', billSchema); 