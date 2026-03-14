const express = require("express");
const router  = express.Router();
const Game    = require("../models/Game");
const Player  = require("../models/Player");

function generateCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

router.post("/create", async (req, res) => {
  try {
    const { playerName, lobbyName, maxPlayers, totalRounds } = req.body;
    console.log("CREATE BODY:", req.body);
    if (!playerName || !lobbyName)
      return res.status(400).json({ error: "playerName and lobbyName required" });

    let code, exists = true;
    while (exists) { code = generateCode(); exists = await Game.findOne({ code }); }

    const player = await Player.create({ name: playerName.trim(), lobbyCode: code });
    const game   = await Game.create({
      lobbyName:   lobbyName.trim(),
      code,
      maxPlayers:  maxPlayers  || 8,
      totalRounds: totalRounds || 3,
      hostId:      player._id,
      players:     [player._id],
      status:      "waiting",
    });
    await game.populate("players", "name score role");
    res.status(201).json({ success: true, game, playerId: player._id });
  } catch (err) {
    console.error("Create error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/join", async (req, res) => {
  try {
    const { playerName, code } = req.body;
    console.log("JOIN BODY:", req.body);
    if (!playerName || !code)
      return res.status(400).json({ error: "playerName and code required" });

    const game = await Game.findOne({ code: code.toUpperCase().trim() });
    console.log("FOUND GAME:", game ? game.code : "NOT FOUND", "STATUS:", game?.status);

    if (!game)                                   return res.status(404).json({ error: "Room not found" });
    if (game.status !== "waiting")               return res.status(400).json({ error: "Game already started" });
    if (game.players.length >= game.maxPlayers)  return res.status(400).json({ error: "Room is full" });

    const player = await Player.create({ name: playerName.trim(), lobbyCode: game.code });
    game.players.push(player._id);
    await game.save();
    await game.populate("players", "name score role");

    const io = req.app.get("io");
    io.to(game.code).emit("lobbyUpdated", { game });

    res.json({ success: true, game, playerId: player._id });
  } catch (err) {
    console.error("Join error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/:code", async (req, res) => {
  try {
    const game = await Game.findOne({ code: req.params.code.toUpperCase() })
      .populate("players", "name score role");
    if (!game) return res.status(404).json({ error: "Game not found" });
    res.json({ success: true, game });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;