const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide product name'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Please provide product category']
  },
  costPrice: {
    type: Number,
    required: [true, 'Please provide cost price']
  },
  currentStock: {
    type: Number,
    required: [true, 'Please provide current stock'],
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema); 