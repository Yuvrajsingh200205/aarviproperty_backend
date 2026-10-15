const mongoose = require('mongoose');

const testimonialSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    designation: { type: String, default: '', trim: true },
    text: { type: String, required: true },
    rating: { type: Number, min: 1, max: 5, default: 5 },
    avatar: { type: String, default: '' },
    link: { type: String, default: '' },
    order: { type: Number, default: 0 },
    published: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Testimonial', testimonialSchema);
