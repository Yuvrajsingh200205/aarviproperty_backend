const mongoose = require('mongoose');

const awardSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    image: { type: String, default: '' },
    year: { type: String, default: '' },
    order: { type: Number, default: 0 },
    published: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Award', awardSchema);
