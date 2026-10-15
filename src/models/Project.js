const mongoose = require('mongoose');
const { slugPlugin } = require('../utils/slug');

const PROJECT_TYPES = ['New Launch', 'Rental', 'Resale'];

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    projectType: { type: String, enum: PROJECT_TYPES, default: 'New Launch', index: true },
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', index: true },
    developer: { type: mongoose.Schema.Types.ObjectId, ref: 'Developer', index: true },
    sector: { type: String, default: '', trim: true },
    address: { type: String, default: '', trim: true },
    reraNo: { type: String, default: '', trim: true },
    configuration: { type: String, default: '', trim: true }, // e.g. 3/4/5 BHK
    size: { type: String, default: '', trim: true }, // e.g. 2150-3900 Sqft
    priceLabel: { type: String, default: 'On Request', trim: true },
    status: { type: String, default: '', trim: true }, // e.g. Under Construction
    possession: { type: String, default: '', trim: true },
    shortDescription: { type: String, default: '' },
    overview: { type: String, default: '' }, // markdown
    heroImage: { type: String, default: '' },
    gallery: [{ type: String }],
    brochure: { type: String, default: '' },
    sitePlan: { type: String, default: '' },
    floorPlans: [{ title: String, image: String }],
    videoUrl: { type: String, default: '' },
    mapUrl: { type: String, default: '' },
    amenities: [{ type: String, trim: true }],
    highlights: [{ type: String, trim: true }],
    landmarks: [{ name: { type: String, trim: true }, distance: { type: String, trim: true } }],
    faqs: [{ question: { type: String, trim: true }, answer: { type: String } }],
    isFeatured: { type: Boolean, default: false },
    isNewLaunch: { type: Boolean, default: false },
    published: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    seoTitle: { type: String, default: '' },
    seoDescription: { type: String, default: '' },
  },
  { timestamps: true }
);
projectSchema.plugin(slugPlugin, { sourceField: 'name' });
projectSchema.index({ name: 'text', sector: 'text', configuration: 'text', shortDescription: 'text' });

module.exports = mongoose.model('Project', projectSchema);
module.exports.PROJECT_TYPES = PROJECT_TYPES;
