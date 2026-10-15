const mongoose = require('mongoose');
const { slugPlugin } = require('../utils/slug');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    image: { type: String, default: '' },
    description: { type: String, default: '' },
    showInMenu: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    seoTitle: { type: String, default: '' },
    seoDescription: { type: String, default: '' },
  },
  { timestamps: true }
);
categorySchema.plugin(slugPlugin, { sourceField: 'name' });

module.exports = mongoose.model('Category', categorySchema);
