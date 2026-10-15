const mongoose = require('mongoose');
const { slugPlugin } = require('../utils/slug');

const locationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    city: { type: String, default: 'Gurugram', trim: true },
    image: { type: String, default: '' },
    description: { type: String, default: '' },
    order: { type: Number, default: 0 },
    showOnHome: { type: Boolean, default: true },
  },
  { timestamps: true }
);
locationSchema.plugin(slugPlugin, { sourceField: 'name' });

module.exports = mongoose.model('Location', locationSchema);
