const mongoose = require('mongoose');

const stat = new mongoose.Schema({ value: String, label: String }, { _id: false });

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'site', unique: true },
    siteName: { type: String, default: 'Aarvi Property' },
    tagline: { type: String, default: 'Your trusted real estate advisor' },
    logo: { type: String, default: '' },
    favicon: { type: String, default: '' },
    phones: [{ type: String }],
    whatsapp: { type: String, default: '' }, // digits with country code
    emails: [{ type: String }],
    address: { type: String, default: '' },
    mapLink: { type: String, default: '' },
    mapEmbed: { type: String, default: '' },
    workingHours: { type: String, default: '' },
    reraNo: { type: String, default: '' },
    social: {
      facebook: { type: String, default: '' },
      instagram: { type: String, default: '' },
      linkedin: { type: String, default: '' },
      twitter: { type: String, default: '' },
      youtube: { type: String, default: '' },
    },
    hero: {
      title: { type: String, default: 'Empowering you to make life’s biggest move' },
      subtitle: { type: String, default: 'Residential, commercial and plotted properties handpicked by experts.' },
      image: { type: String, default: '' },
    },
    stats: { type: [stat], default: [] },
    sectionTitles: {
      newLaunch: { type: String, default: 'New Launched Properties' },
      residential: { type: String, default: 'Residential Properties' },
      commercial: { type: String, default: 'Commercial Properties' },
      plots: { type: String, default: 'Residential Plots' },
      locations: { type: String, default: 'Locations' },
      awards: { type: String, default: 'Awards & Recognitions' },
      testimonials: { type: String, default: 'Happy Customers' },
      developers: { type: String, default: 'Developers' },
    },
    about: {
      heading: { type: String, default: 'About Us' },
      intro: { type: String, default: '' },
      mission: { type: String, default: '' },
      vision: { type: String, default: '' },
      body: { type: String, default: '' },
      image: { type: String, default: '' },
    },
    privacyPolicy: { type: String, default: '' },
    terms: { type: String, default: '' },
    footerText: { type: String, default: '' },
    seoTitle: { type: String, default: 'Aarvi Property | Real Estate Consultants' },
    seoDescription: { type: String, default: '' },
  },
  { timestamps: true }
);

settingsSchema.statics.getSite = async function getSite() {
  let doc = await this.findOne({ key: 'site' });
  if (!doc) doc = await this.create({ key: 'site' });
  return doc;
};

module.exports = mongoose.model('Settings', settingsSchema);
