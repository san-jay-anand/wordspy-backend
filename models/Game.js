const mongoose = require("mongoose");

const descriptionSchema = new mongoose.Schema({
  playerId:   { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
  playerName: String,
  text:       String,
}, { _id: false });

const voteSchema = new mongoose.Schema({
  voterId:  { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
  targetId: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
}, { _id: false });

const roundSchema = new mongoose.Schema({
  roundNumber:    Number,
  secretWord:     String,
  descriptions:   [descriptionSchema],
  votes:          [voteSchema],
  eliminatedId:   { type: mongoose.Schema.Types.ObjectId, ref: "Player", default: null },
  eliminatedName: { type: String, default: null },
  wasImpostor:    { type: Boolean, default: false },
}, { _id: false });

const gameSchema = new mongoose.Schema({
  lobbyName:    { type: String, required: true },
  code:         { type: String, required: true, unique: true, uppercase: true },
  maxPlayers:   { type: Number, default: 8 },
  totalRounds:  { type: Number, default: 3 },
  hostId:       { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
  players:      [{ type: mongoose.Schema.Types.ObjectId, ref: "Player" }],
  impostorId:   { type: mongoose.Schema.Types.ObjectId, ref: "Player", default: null },
  status:       { type: String, enum: ["waiting","describing","voting","result","finished"], default: "waiting" },
  currentRound: { type: Number, default: 0 },
  rounds:       [roundSchema],
  submittedPlayers: [String],
  votedPlayers:     [String],
}, { timestamps: true });

module.exports = mongoose.model("Game", gameSchema);