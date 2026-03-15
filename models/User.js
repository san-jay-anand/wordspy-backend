// backend/models/User.js
const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const userSchema = new mongoose.Schema({
  username:    { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 20 },
  password:    { type: String, required: true, minlength: 6 },
  totalScore:  { type: Number, default: 0 },
  gamesPlayed: { type: Number, default: 0 },
  gamesWon:    { type: Number, default: 0 },
  // Track if won as crewmate or impostor
  crewmateWins: { type: Number, default: 0 },
  impostorWins: { type: Number, default: 0 },
  avatar:      { type: String, default: "" }, // initials color index
}, { timestamps: true });

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model("User", userSchema);