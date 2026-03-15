const jwt  = require("jsonwebtoken");
const User = require("../models/User");
const connectDB = require("../lib/mongodb");

const JWT_SECRET = process.env.JWT_SECRET || "wordspy_secret_key_change_in_production";

module.exports = async function authMiddleware(req, res, next) {
  try {
    await connectDB();
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token provided" });

    const decoded = jwt.verify(token, JWT_SECRET);
    const user    = await User.findById(decoded.userId).select("-password");
    if (!user) return res.status(401).json({ error: "User not found" });

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};