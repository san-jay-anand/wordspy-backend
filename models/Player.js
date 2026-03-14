const mongoose = require("mongoose");

const playerSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true, maxlength: 20 },
  lobbyCode: { type: String, required: true },
  socketId:  { type: String, default: "" },
  role:      { type: String, enum: ["crewmate","impostor"], default: "crewmate" },
  score:     { type: Number, default: 0 },
  isOnline:  { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model("Player", playerSchema);