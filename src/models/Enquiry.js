const mongoose = require('mongoose');

const ENQUIRY_STATUSES = ['new', 'contacted', 'qualified', 'closed', 'spam'];

const enquirySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, default: '', trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    message: { type: String, default: '' },
    enquiryType: { type: String, default: 'Quick Enquiry', trim: true }, // Quick Enquiry | Instant Callback | Contact Form | Brochure Download
    enquiryFor: { type: String, default: '', trim: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    projectName: { type: String, default: '' },
    pageUrl: { type: String, default: '' },
    status: { type: String, enum: ENQUIRY_STATUSES, default: 'new', index: true },
    notes: { type: String, default: '' },
    ip: { type: String, default: '' },
  },
  { timestamps: true }
);
enquirySchema.index({ createdAt: -1 });

module.exports = mongoose.model('Enquiry', enquirySchema);
module.exports.ENQUIRY_STATUSES = ENQUIRY_STATUSES;
