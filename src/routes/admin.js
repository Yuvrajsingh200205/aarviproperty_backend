const router = require('express').Router();
const { z } = require('zod');
const { requireAuth } = require('../middleware/auth');
const { upload, persistUploads } = require('../middleware/upload');
const { crudHandlers, parsePaging, escapeRegex } = require('../utils/crud');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const Project = require('../models/Project');
const Category = require('../models/Category');
const Location = require('../models/Location');
const Developer = require('../models/Developer');
const Blog = require('../models/Blog');
const Testimonial = require('../models/Testimonial');
const Award = require('../models/Award');
const Enquiry = require('../models/Enquiry');
const Settings = require('../models/Settings');

router.use(requireAuth);

const mount = (path, handlers) => {
  router.get(`/${path}`, handlers.list);
  router.post(`/${path}`, handlers.create);
  router.get(`/${path}/:id`, handlers.getOne);
  router.put(`/${path}/:id`, handlers.update);
  router.delete(`/${path}/:id`, handlers.remove);
};

// ---------- Dashboard ----------
router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const since = new Date();
    since.setDate(since.getDate() - 13);
    since.setHours(0, 0, 0, 0);
    const [projects, published, categories, developers, locations, blogs, enquiries, newEnquiries, recent, daily, topProjects] =
      await Promise.all([
        Project.countDocuments(),
        Project.countDocuments({ published: true }),
        Category.countDocuments(),
        Developer.countDocuments(),
        Location.countDocuments(),
        Blog.countDocuments(),
        Enquiry.countDocuments(),
        Enquiry.countDocuments({ status: 'new' }),
        Enquiry.find().sort({ createdAt: -1 }).limit(6).lean(),
        Enquiry.aggregate([
          { $match: { createdAt: { $gte: since } } },
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ]),
        Project.find().sort({ views: -1 }).limit(5).select('name slug views').lean(),
      ]);
    res.json({
      success: true,
      data: { projects, published, categories, developers, locations, blogs, enquiries, newEnquiries, recent, daily, topProjects },
    });
  })
);

// ---------- Content CRUD ----------
mount(
  'projects',
  crudHandlers(Project, {
    searchFields: ['name', 'sector', 'configuration', 'reraNo'],
    populate: [
      { path: 'category', select: 'name slug' },
      { path: 'location', select: 'name slug' },
      { path: 'developer', select: 'name slug' },
    ],
    defaultSort: { createdAt: -1 },
    filters: (q) => {
      const f = {};
      if (q.category) f.category = q.category;
      if (q.location) f.location = q.location;
      if (q.developer) f.developer = q.developer;
      if (q.projectType) f.projectType = q.projectType;
      if (q.published === 'true' || q.published === 'false') f.published = q.published === 'true';
      return f;
    },
  })
);

mount(
  'categories',
  crudHandlers(Category, {
    beforeDelete: async (doc) => {
      const n = await Project.countDocuments({ category: doc._id });
      if (n) throw new ApiError(409, `Cannot delete: ${n} project(s) use this category. Reassign them first.`);
    },
  })
);

mount(
  'locations',
  crudHandlers(Location, {
    beforeDelete: async (doc) => {
      await Project.updateMany({ location: doc._id }, { $set: { location: null } });
    },
  })
);

mount(
  'developers',
  crudHandlers(Developer, {
    beforeDelete: async (doc) => {
      await Project.updateMany({ developer: doc._id }, { $set: { developer: null } });
    },
  })
);

mount(
  'blogs',
  crudHandlers(Blog, {
    searchFields: ['title', 'excerpt'],
    defaultSort: { publishedAt: -1 },
  })
);
mount('testimonials', crudHandlers(Testimonial, { searchFields: ['name', 'text'] }));
mount('awards', crudHandlers(Award, { searchFields: ['title'] }));

// ---------- Enquiries / leads ----------
const enquiryFilter = (q) => {
  const f = {};
  if (q.status) f.status = q.status;
  if (q.enquiryType) f.enquiryType = q.enquiryType;
  return f;
};
const enquiryHandlers = crudHandlers(Enquiry, {
  searchFields: ['name', 'phone', 'email', 'projectName', 'message'],
  defaultSort: { createdAt: -1 },
  filters: enquiryFilter,
});

router.get(
  '/enquiries/export.csv',
  asyncHandler(async (req, res) => {
    const filter = enquiryFilter(req.query);
    if (req.query.q) {
      const rx = new RegExp(escapeRegex(req.query.q), 'i');
      filter.$or = ['name', 'phone', 'email', 'projectName', 'message'].map((f) => ({ [f]: rx }));
    }
    const rows = await Enquiry.find(filter).sort({ createdAt: -1 }).limit(10000).lean();
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
    // Prefix formula-like cells so spreadsheets never execute user input.
    const safe = (v) => (/^[=+\-@]/.test(String(v ?? '')) ? `'${v}` : v);
    const header = ['Date', 'Name', 'Phone', 'Email', 'Type', 'Interested In', 'Project', 'Status', 'Message', 'Page'];
    const lines = rows.map((r) =>
      [
        new Date(r.createdAt).toISOString(),
        r.name,
        r.phone,
        r.email,
        r.enquiryType,
        r.enquiryFor,
        r.projectName,
        r.status,
        r.message,
        r.pageUrl,
      ]
        .map((v) => esc(safe(v)))
        .join(',')
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="enquiries.csv"');
    res.send([header.join(','), ...lines].join('\n'));
  })
);
router.get('/enquiries', enquiryHandlers.list);
router.get('/enquiries/:id', enquiryHandlers.getOne);
router.put(
  '/enquiries/:id',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        status: z.enum(Enquiry.ENQUIRY_STATUSES).optional(),
        notes: z.string().max(5000).optional(),
      })
      .parse(req.body);
    const doc = await Enquiry.findByIdAndUpdate(req.params.id, body, { returnDocument: 'after', runValidators: true });
    if (!doc) throw ApiError.notFound('Enquiry not found');
    res.json({ success: true, data: doc });
  })
);
router.delete('/enquiries/:id', enquiryHandlers.remove);

// ---------- Site settings ----------
router.get(
  '/settings',
  asyncHandler(async (_req, res) => res.json({ success: true, data: await Settings.getSite() }))
);
router.put(
  '/settings',
  asyncHandler(async (req, res) => {
    const doc = await Settings.getSite();
    const body = { ...req.body };
    ['_id', '__v', 'key', 'createdAt', 'updatedAt'].forEach((k) => delete body[k]);
    doc.set(body);
    await doc.save();
    res.json({ success: true, data: doc });
  })
);

// ---------- File upload ----------
const fileResult = (f) => ({ url: f.url || `/uploads/${f.filename}`, filename: f.filename, size: f.size, mimetype: f.mimetype });
router.post('/upload', upload.single('file'), persistUploads, (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file received (field name must be "file")');
  res.status(201).json({ success: true, data: fileResult(req.file) });
});
router.post('/upload-multiple', upload.array('files', 20), persistUploads, (req, res) => {
  if (!req.files?.length) throw ApiError.badRequest('No files received (field name must be "files")');
  res.status(201).json({ success: true, data: req.files.map(fileResult) });
});

module.exports = router;
