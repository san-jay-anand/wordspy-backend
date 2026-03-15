// backend/routes/auth.js
const express = require("express");
const router  = express.Router();
const jwt     = require("jsonwebtoken");
const User    = require("../models/User");
const auth    = require("../middleware/auth");

const JWT_SECRET = process.env.JWT_SECRET || "wordspy_secret_key_change_in_production";

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: "Username and password required" });
    if (username.length < 3)
      return res.status(400).json({ error: "Username must be at least 3 characters" });
    if (password.length < 6)
      return res.status(400).json({ error: "Password must be at least 6 characters" });

    const exists = await User.findOne({ username: username.trim() });
    if (exists) return res.status(400).json({ error: "Username already taken" });

    const user  = await User.create({ username: username.trim(), password });
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        _id:          user._id,
        username:     user.username,
        totalScore:   user.totalScore,
        gamesPlayed:  user.gamesPlayed,
        gamesWon:     user.gamesWon,
        crewmateWins: user.crewmateWins,
        impostorWins: user.impostorWins,
      }
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: "Username and password required" });

    const user = await User.findOne({ username: username.trim() });
    if (!user) return res.status(400).json({ error: "Invalid username or password" });

    const match = await user.comparePassword(password);
    if (!match) return res.status(400).json({ error: "Invalid username or password" });

    const token = generateToken(user._id);
    res.json({
      success: true,
      token,
      user: {
        _id:          user._id,
        username:     user.username,
        totalScore:   user.totalScore,
        gamesPlayed:  user.gamesPlayed,
        gamesWon:     user.gamesWon,
        crewmateWins: user.crewmateWins,
        impostorWins: user.impostorWins,
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/profile — get current user profile
router.get("/profile", auth, async (req, res) => {
  try {
    res.json({ success: true, user: req.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/leaderboard — top 20 players
router.get("/leaderboard", async (req, res) => {
  try {
    const players = await User.find()
      .select("username totalScore gamesPlayed gamesWon crewmateWins impostorWins")
      .sort({ totalScore: -1 })
      .limit(20);
    res.json({ success: true, players });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/update-stats — called after each game ends
router.post("/update-stats", auth, async (req, res) => {
  try {
    const { scoreEarned, won, role } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.totalScore  += scoreEarned || 0;
    user.gamesPlayed += 1;
    if (won) {
      user.gamesWon += 1;
      if (role === "impostor") user.impostorWins += 1;
      else                     user.crewmateWins += 1;
    }
    await user.save();

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;