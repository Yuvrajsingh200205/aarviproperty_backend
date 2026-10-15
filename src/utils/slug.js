const slugify = require('slugify');

const toSlug = (value) =>
  slugify(String(value || ''), { lower: true, strict: true, trim: true });

// Mongoose plugin: fills `slug` from `sourceField` and keeps it unique.
function slugPlugin(schema, { sourceField = 'name' } = {}) {
  schema.add({ slug: { type: String, index: true, unique: true, trim: true } });
  schema.pre('validate', async function ensureSlug() {
    if (this.slug) this.slug = toSlug(this.slug);
    if (!this.slug && this[sourceField]) this.slug = toSlug(this[sourceField]);
    if (!this.slug) this.slug = `item-${Date.now()}`;
    if (this.isNew || this.isModified('slug')) {
      const Model = this.constructor;
      const base = this.slug;
      let candidate = base;
      let n = 1;
      // eslint-disable-next-line no-await-in-loop
      while (await Model.exists({ slug: candidate, _id: { $ne: this._id } })) {
        n += 1;
        candidate = `${base}-${n}`;
      }
      this.slug = candidate;
    }
  });
}

module.exports = { toSlug, slugPlugin };
