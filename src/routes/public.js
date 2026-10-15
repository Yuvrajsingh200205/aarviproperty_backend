const router = require('express').Router();
const mongoose = require('mongoose');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const Project = require('../models/Project');
const Category = require('../models/Category');
const Location = require('../models/Location');
const Developer = require('../models/Developer');
const Blog = require('../models/Blog');
const Testimonial = require('../models/Testimonial');
const Award = require('../models/Award');
const Settings = require('../models/Settings');
const Enquiry = require('../models/Enquiry');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const env = require('../config/env');
const { toSlug } = require('../utils/slug');
const { parsePaging, escapeRegex } = require('../utils/crud');
const { notifyEnquiry } = require('../utils/mailer');

const PROJECT_TYPES = Project.PROJECT_TYPES;
// An id that can never match a real document (an unknown filter value must yield 0 results, not "unset").
const NO_MATCH = () => new mongoose.Types.ObjectId();
const LIST_FIELDS =
  'name slug category projectType location developer sector configuration size priceLabel status heroImage isNewLaunch isFeatured reraNo shortDescription order createdAt';
const POPULATE = [
  { path: 'category', select: 'name slug' },
  { path: 'location', select: 'name slug' },
  { path: 'developer', select: 'name slug logo' },
];

const sortMap = {
  latest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  name: { name: 1 },
  featured: { isFeatured: -1, order: 1, createdAt: -1 },
};

// ---------- Site settings ----------
router.get(
  '/settings',
  asyncHandler(async (_req, res) => {
    const doc = await Settings.getSite();
    res.json({ success: true, data: doc });
  })
);

// ---------- Filters / navigation metadata ----------
router.get(
  '/meta',
  asyncHandler(async (_req, res) => {
    const [categories, locations, developers] = await Promise.all([
      Category.find({}).sort({ order: 1, name: 1 }).lean(),
      Location.find({}).sort({ order: 1, name: 1 }).lean(),
      Developer.find({ published: true }).sort({ order: 1, name: 1 }).select('name slug logo').lean(),
    ]);
    res.json({ success: true, data: { categories, locations, developers, projectTypes: PROJECT_TYPES } });
  })
);

// ---------- Home page aggregate ----------
router.get(
  '/home',
  asyncHandler(async (_req, res) => {
    const base = { published: true };
    const [settings, categories, newLaunch, locations, awards, testimonials, developers] = await Promise.all([
      Settings.getSite(),
      Category.find({ showInMenu: true }).sort({ order: 1, name: 1 }).lean(),
      Project.find({ ...base, isNewLaunch: true })
        .sort({ order: 1, createdAt: -1 })
        .limit(12)
        .select(LIST_FIELDS)
        .populate(POPULATE)
        .lean(),
      Location.find({ showOnHome: true }).sort({ order: 1, name: 1 }).lean(),
      Award.find({ published: true }).sort({ order: 1 }).lean(),
      Testimonial.find({ published: true }).sort({ order: 1, createdAt: -1 }).lean(),
      Developer.find({ published: true, showOnHome: true }).sort({ order: 1, name: 1 }).lean(),
    ]);

    // Category rows should not repeat the cards already shown in "New Launched" (fall back if that leaves nothing).
    const shownIds = newLaunch.map((p) => p._id);
    const sectionQuery = (cat, exclude) =>
      Project.find({ ...base, category: cat._id, ...(exclude ? { _id: { $nin: shownIds } } : {}) })
        .sort({ isFeatured: -1, order: 1, createdAt: -1 })
        .limit(8)
        .select(LIST_FIELDS)
        .populate(POPULATE)
        .lean();
    const sections = await Promise.all(
      categories.map(async (cat) => {
        let projects = await sectionQuery(cat, true);
        if (!projects.length) projects = await sectionQuery(cat, false);
        return { category: cat, projects };
      })
    );

    const locationCounts = await Project.aggregate([
      { $match: { ...base, location: { $ne: null } } },
      { $group: { _id: '$location', count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(locationCounts.map((c) => [String(c._id), c.count]));
    const locs = locations.map((l) => ({ ...l, projectCount: countMap[String(l._id)] || 0 }));

    res.json({
      success: true,
      data: {
        settings,
        newLaunch,
        sections: sections.filter((s) => s.projects.length > 0),
        locations: locs,
        awards,
        testimonials,
        developers,
      },
    });
  })
);

// ---------- Projects ----------
async function buildProjectFilter(q) {
  const filter = { published: true };

  if (q.property) {
    const slug = toSlug(q.property);
    const cat = await Category.findOne({ $or: [{ slug }, { name: new RegExp(`^${escapeRegex(q.property.replace(/-/g, ' '))}$`, 'i') }] }).lean();
    filter.category = cat ? cat._id : NO_MATCH();
  }
  if (q.location) {
    const slug = toSlug(q.location);
    const loc = await Location.findOne({ slug }).lean();
    filter.location = loc ? loc._id : NO_MATCH();
  }
  if (q.projecttype) {
    const type = PROJECT_TYPES.find((t) => toSlug(t) === toSlug(q.projecttype));
    filter.projectType = type || '__none__';
  }
  if (q.developer) {
    const dev = await Developer.findOne({ slug: toSlug(q.developer) }).lean();
    filter.developer = dev ? dev._id : NO_MATCH();
  }
  if (q.featured === 'true') filter.isFeatured = true;
  if (q.slugs) {
    const list = String(q.slugs).split(',').map((x) => x.trim()).filter(Boolean).slice(0, 60);
    filter.slug = { $in: list };
  }

  if (q.search && q.search.trim()) {
    const rx = new RegExp(escapeRegex(q.search.trim().slice(0, 80)), 'i');
    const devs = await Developer.find({ name: rx }).select('_id').lean();
    const locs = await Location.find({ name: rx }).select('_id').lean();
    filter.$or = [
      { name: rx },
      { sector: rx },
      { configuration: rx },
      { size: rx },
      { developer: { $in: devs.map((d) => d._id) } },
      { location: { $in: locs.map((l) => l._id) } },
    ];
  }
  return filter;
}

router.get(
  '/projects',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePaging(req.query, 12, 60);
    const filter = await buildProjectFilter(req.query);
    const sort = sortMap[req.query.sort] || sortMap.featured;
    const [items, total] = await Promise.all([
      Project.find(filter).sort(sort).skip(skip).limit(limit).select(LIST_FIELDS).populate(POPULATE).lean(),
      Project.countDocuments(filter),
    ]);
    res.json({ success: true, data: items, meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 } });
  })
);

router.get(
  '/projects/:slug',
  asyncHandler(async (req, res) => {
    const project = await Project.findOneAndUpdate(
      { slug: req.params.slug, published: true },
      { $inc: { views: 1 } },
      { returnDocument: 'after', timestamps: false }
    )
      .populate([...POPULATE.slice(0, 2), { path: 'developer' }])
      .lean();
    if (!project) throw ApiError.notFound('Project not found');

    const relatedOr = [
      project.location?._id && { location: project.location._id },
      project.developer?._id && { developer: project.developer._id },
      project.category?._id && { category: project.category._id },
    ].filter(Boolean);
    const related = await Project.find({
      published: true,
      _id: { $ne: project._id },
      ...(relatedOr.length ? { $or: relatedOr } : {}),
    })
      .sort({ isFeatured: -1, createdAt: -1 })
      .limit(6)
      .select(LIST_FIELDS)
      .populate(POPULATE)
      .lean();

    res.json({ success: true, data: { ...project, related } });
  })
);

// ---------- Developers ----------
router.get(
  '/developers',
  asyncHandler(async (_req, res) => {
    const devs = await Developer.find({ published: true }).sort({ order: 1, name: 1 }).lean();
    const counts = await Project.aggregate([
      { $match: { published: true, developer: { $ne: null } } },
      { $group: { _id: '$developer', count: { $sum: 1 } } },
    ]);
    const map = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));
    res.json({ success: true, data: devs.map((d) => ({ ...d, projectCount: map[String(d._id)] || 0 })) });
  })
);

router.get(
  '/developers/:slug',
  asyncHandler(async (req, res) => {
    const developer = await Developer.findOne({ slug: req.params.slug, published: true }).lean();
    if (!developer) throw ApiError.notFound('Developer not found');
    const projects = await Project.find({ published: true, developer: developer._id })
      .sort({ isFeatured: -1, order: 1, createdAt: -1 })
      .select(LIST_FIELDS)
      .populate(POPULATE)
      .lean();
    res.json({ success: true, data: { ...developer, projects } });
  })
);

// ---------- Blogs ----------
router.get(
  '/blogs',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePaging(req.query, 12, 50);
    const filter = { published: true, publishedAt: { $lte: new Date() } };
    const [items, total] = await Promise.all([
      Blog.find(filter).sort({ publishedAt: -1 }).skip(skip).limit(limit).select('-content').lean(),
      Blog.countDocuments(filter),
    ]);
    res.json({ success: true, data: items, meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 } });
  })
);

router.get(
  '/blogs/:slug',
  asyncHandler(async (req, res) => {
    const blog = await Blog.findOne({ slug: req.params.slug, published: true }).lean();
    if (!blog) throw ApiError.notFound('Blog not found');
    const recent = await Blog.find({ published: true, _id: { $ne: blog._id } })
      .sort({ publishedAt: -1 })
      .limit(4)
      .select('title slug image publishedAt')
      .lean();
    res.json({ success: true, data: { ...blog, recent } });
  })
);

// ---------- Enquiries ----------
const enquiryLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: env.isTest ? 1000 : Number(process.env.ENQUIRY_RATE_LIMIT) || 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again in a few minutes' },
});

const phoneRegex = /^[+()\-\s\d]{7,18}$/;
const enquirySchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(80),
  phone: z.string().trim().regex(phoneRegex, 'Please enter a valid phone number'),
  email: z.union([z.string().trim().email('Please enter a valid email'), z.literal('')]).optional().default(''),
  message: z.string().trim().max(2000).optional().default(''),
  enquiryType: z.string().trim().max(60).optional().default('Quick Enquiry'),
  enquiryFor: z.string().trim().max(120).optional().default(''),
  projectSlug: z.string().trim().max(200).optional(),
  pageUrl: z.string().trim().max(500).optional().default(''),
  website: z.string().optional(), // honeypot, must stay empty
});

router.post(
  '/enquiries',
  enquiryLimiter,
  asyncHandler(async (req, res) => {
    const data = enquirySchema.parse(req.body);
    // Bots fill hidden fields; pretend success without storing anything.
    if (data.website) return res.status(201).json({ success: true, message: 'Thank you! We will contact you shortly.' });

    let project = null;
    if (data.projectSlug) project = await Project.findOne({ slug: data.projectSlug }).select('name').lean();

    const enquiry = await Enquiry.create({
      name: data.name,
      phone: data.phone,
      email: data.email,
      message: data.message,
      enquiryType: data.enquiryType,
      enquiryFor: data.enquiryFor,
      project: project?._id,
      projectName: project?.name || '',
      pageUrl: data.pageUrl,
      ip: req.ip,
    });
    notifyEnquiry(enquiry); // intentionally not awaited
    res.status(201).json({ success: true, message: 'Thank you! We will contact you shortly.', id: enquiry._id });
  })
);

// ---------- Misc public lists ----------
router.get(
  '/testimonials',
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await Testimonial.find({ published: true }).sort({ order: 1, createdAt: -1 }).lean() });
  })
);
router.get(
  '/awards',
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await Award.find({ published: true }).sort({ order: 1 }).lean() });
  })
);

module.exports = router;
