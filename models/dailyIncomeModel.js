const mongoose = require('mongoose');

const dailyIncomeSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    unique: true
  },
  totalIncome: {
    type: Number,
    required: true,
    default: 0
  },
  billCount: {
    type: Number,
    default: 0
  },
  paymentMethods: {
    cash: { type: Number, default: 0 },
    card: { type: Number, default: 0 },
    upi: { type: Number, default: 0 }
  }
}, { timestamps: true });

module.exports = mongoose.model('DailyIncome', dailyIncomeSchema);