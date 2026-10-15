const mongoose = require('mongoose');
const asyncHandler = require('./asyncHandler');
const ApiError = require('./ApiError');

const PROTECTED = ['_id', '__v', 'createdAt', 'updatedAt', 'views'];
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parsePaging = (query, defLimit = 20, maxLimit = 100) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defLimit));
  return { page, limit, skip: (page - 1) * limit };
};

const clean = (body) => {
  const out = { ...body };
  PROTECTED.forEach((k) => delete out[k]);
  // empty string refs would fail ObjectId casting -> treat as "unset"
  Object.keys(out).forEach((k) => {
    if (out[k] === '' && mongoose.Types.ObjectId.isValid && ['category', 'location', 'developer', 'project'].includes(k)) {
      out[k] = null;
    }
  });
  return out;
};

/**
 * Builds a standard admin CRUD router handler set.
 * opts: { searchFields, populate, defaultSort, filters(query)->mongoFilter, beforeDelete(doc) }
 */
function crudHandlers(Model, opts = {}) {
  const {
    searchFields = ['name'],
    populate = '',
    defaultSort = { order: 1, createdAt: -1 },
    filters = () => ({}),
    beforeDelete,
    afterSave,
  } = opts;

  const list = asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePaging(req.query);
    const filter = { ...filters(req.query) };
    if (req.query.q) {
      const rx = new RegExp(escapeRegex(req.query.q.trim()), 'i');
      filter.$or = searchFields.map((f) => ({ [f]: rx }));
    }
    let sort = defaultSort;
    if (req.query.sort) {
      const desc = req.query.sort.startsWith('-');
      const field = req.query.sort.replace(/^-/, '');
      if (Model.schema.path(field)) sort = { [field]: desc ? -1 : 1 };
    }
    const [items, total] = await Promise.all([
      Model.find(filter).sort(sort).skip(skip).limit(limit).populate(populate).lean(),
      Model.countDocuments(filter),
    ]);
    res.json({ success: true, data: items, meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 } });
  });

  const getOne = asyncHandler(async (req, res) => {
    const doc = await Model.findById(req.params.id).populate(populate).lean();
    if (!doc) throw ApiError.notFound(`${Model.modelName} not found`);
    res.json({ success: true, data: doc });
  });

  const create = asyncHandler(async (req, res) => {
    const doc = new Model(clean(req.body));
    await doc.save();
    if (afterSave) await afterSave(doc);
    const out = await Model.findById(doc._id).populate(populate).lean();
    res.status(201).json({ success: true, data: out });
  });

  const update = asyncHandler(async (req, res) => {
    const doc = await Model.findById(req.params.id);
    if (!doc) throw ApiError.notFound(`${Model.modelName} not found`);
    doc.set(clean(req.body));
    await doc.save();
    if (afterSave) await afterSave(doc);
    const out = await Model.findById(doc._id).populate(populate).lean();
    res.json({ success: true, data: out });
  });

  const remove = asyncHandler(async (req, res) => {
    const doc = await Model.findById(req.params.id);
    if (!doc) throw ApiError.notFound(`${Model.modelName} not found`);
    if (beforeDelete) await beforeDelete(doc);
    await doc.deleteOne();
    res.json({ success: true, message: 'Deleted' });
  });

  return { list, getOne, create, update, remove };
}

module.exports = { crudHandlers, parsePaging, escapeRegex };
