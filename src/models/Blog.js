const mongoose = require('mongoose');
const { slugPlugin } = require('../utils/slug');

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    excerpt: { type: String, default: '' },
    content: { type: String, default: '' }, // markdown
    image: { type: String, default: '' },
    author: { type: String, default: 'Aarvi Property' },
    tags: [{ type: String, trim: true }],
    published: { type: Boolean, default: true, index: true },
    publishedAt: { type: Date, default: Date.now },
    seoTitle: { type: String, default: '' },
    seoDescription: { type: String, default: '' },
  },
  { timestamps: true }
);
blogSchema.plugin(slugPlugin, { sourceField: 'title' });

module.exports = mongoose.model('Blog', blogSchema);
