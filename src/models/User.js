const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin'], default: 'admin' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, 10);
};
userSchema.methods.checkPassword = function checkPassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};
userSchema.methods.toJSON = function toJSON() {
  const o = this.toObject();
  delete o.passwordHash;
  delete o.__v;
  return o;
};

module.exports = mongoose.model('User', userSchema);
