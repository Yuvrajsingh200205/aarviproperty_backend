const mongoose = require('mongoose');
const { slugPlugin } = require('../utils/slug');

const developerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    logo: { type: String, default: '' },
    tagline: { type: String, default: '' },
    description: { type: String, default: '' },
    website: { type: String, default: '' },
    order: { type: Number, default: 0 },
    showOnHome: { type: Boolean, default: true },
    published: { type: Boolean, default: true },
  },
  { timestamps: true }
);
developerSchema.plugin(slugPlugin, { sourceField: 'name' });

module.exports = mongoose.model('Developer', developerSchema);
