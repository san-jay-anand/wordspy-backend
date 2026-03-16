// backend/server.js — Add these two lines to your existing server.js

// 1. Add this require at the top with other requires:
// const authRoutes = require("./routes/auth");

// 2. Add this line after app.use("/api/game", gameRoutes):
// app.use("/api/auth", authRoutes);

// That's all you need to add! The rest of server.js stays the same.
// ============================================================
// FULL server.js with auth included:
// ============================================================
const express    = require("express");
const http       = require("http");
const { Server } = require("socket.io");
const mongoose   = require("mongoose");
const cors       = require("cors");
require("dotenv").config();

const gameRoutes        = require("./routes/game");
const authRoutes        = require("./routes/auth");       // ← NEW
const Game              = require("./models/Game");
const Player            = require("./models/Player");
const { getRandomWord } = require("./data/words");

const app        = express();
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET","POST"] },
  transports: ["polling"],
  allowEIO3: true,
});

app.use(cors({ origin: "*" }));
app.use(express.json());
app.set("io", io);

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/impostor_word_game";
mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  bufferCommands: false,
  maxPoolSize: 10,
})
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB:", err));

app.use("/api/game", gameRoutes);
app.use("/api/auth", authRoutes);                        // ← NEW
app.get("/health", (_, res) => res.json({ status: "ok" }));

const activeTimers = {};

function startDescriptionTimer(lobbyCode, durationMs = 60000) {
  if (activeTimers[lobbyCode]) clearTimeout(activeTimers[lobbyCode]);
  activeTimers[lobbyCode] = setTimeout(async () => {
    try {
      const game = await Game.findOne({ code: lobbyCode }).populate("players","name");
      if (!game || game.status !== "describing") return;
      const round = game.rounds[game.currentRound - 1];
      for (const player of game.players) {
        const alreadySubmitted = game.submittedPlayers.includes(player._id.toString());
        if (!alreadySubmitted) {
          round.descriptions.push({ playerId: player._id, playerName: player.name, text: "..." });
          game.submittedPlayers.push(player._id.toString());
        }
      }
      game.status = "voting";
      game.votedPlayers = [];
      await game.save();
      io.to(lobbyCode).emit("phaseChanged", {
        phase: "voting", descriptions: round.descriptions,
        round: game.currentRound, totalRounds: game.totalRounds,
      });
    } catch (err) { console.error("Timer error:", err); }
  }, durationMs);
}

io.on("connection", (socket) => {
  console.log(`🔌 Connected: ${socket.id}`);

  socket.on("joinLobbyRoom", async ({ lobbyCode, playerId }) => {
    socket.join(lobbyCode);
    socket.data.lobbyCode = lobbyCode;
    socket.data.playerId  = playerId;
    try {
      await Player.findByIdAndUpdate(playerId, { socketId: socket.id, isOnline: true });
      const game = await Game.findOne({ code: lobbyCode }).populate("players","name score role");
      if (game) io.to(lobbyCode).emit("lobbyUpdated", { game });
    } catch (err) { console.error("joinLobbyRoom error:", err); }
  });

  socket.on("startGame", async ({ lobbyCode, totalRounds }) => {
    try {
      const game = await Game.findOne({ code: lobbyCode }).populate("players","name");
      if (!game) return socket.emit("error", { message: "Game not found" });
      if (game.players.length < 2) return socket.emit("error", { message: "Need at least 2 players" });

      const impostorIndex = Math.floor(Math.random() * game.players.length);
      const impostor      = game.players[impostorIndex];
      await Player.updateMany({ lobbyCode }, { role: "crewmate" });
      await Player.findByIdAndUpdate(impostor._id, { role: "impostor" });

      game.totalRounds      = totalRounds || game.totalRounds;
      game.impostorId       = impostor._id;
      game.currentRound     = 1;
      game.status           = "describing";
      game.submittedPlayers = [];

      const word        = getRandomWord();
      const firstPlayer = game.players[0];
      game.rounds.push({ roundNumber: 1, secretWord: word, descriptions: [], votes: [] });
      await game.save();

      for (const player of game.players) {
        const pSocket    = findSocketByPlayerId(player._id.toString());
        const isImpostor = player._id.toString() === impostor._id.toString();
        if (pSocket) {
          pSocket.emit("gameStarted", {
            role:            isImpostor ? "impostor" : "crewmate",
            word:            isImpostor ? "IMPOSTOR" : word,
            round:           1,
            totalRounds:     game.totalRounds,
            players:         game.players,
            currentTurnId:   firstPlayer._id.toString(),
            currentTurnName: firstPlayer.name,
          });
        }
      }

      io.to(lobbyCode).emit("phaseChanged", {
        phase: "describing", round: 1,
        totalRounds: game.totalRounds, timerSeconds: 60,
        currentTurnId:   firstPlayer._id.toString(),
        currentTurnName: firstPlayer.name,
        descriptions:    [],
      });
    } catch (err) { console.error("startGame error:", err); }
  });

  socket.on("submitDescription", async ({ lobbyCode, playerId, text }) => {
    try {
      const game = await Game.findOne({ code: lobbyCode }).populate("players","name");
      if (!game || game.status !== "describing") return;
      if (game.submittedPlayers.includes(playerId)) return;

      const player = game.players.find(p => p._id.toString() === playerId);
      if (!player) return;

      const round = game.rounds[game.currentRound - 1];
      round.descriptions.push({ playerId, playerName: player.name, text: text.trim().slice(0,120) });
      game.submittedPlayers.push(playerId);
      await game.save();

      io.to(lobbyCode).emit("descriptionRevealed", {
        playerId, playerName: player.name,
        text: text.trim().slice(0,120),
        submitted: game.submittedPlayers.length,
        total:     game.players.length,
      });

      if (game.submittedPlayers.length >= game.players.length) {
        if (activeTimers[lobbyCode]) clearTimeout(activeTimers[lobbyCode]);
        game.status       = "voting";
        game.votedPlayers = [];
        await game.save();
        setTimeout(() => {
          io.to(lobbyCode).emit("phaseChanged", {
            phase: "voting", descriptions: round.descriptions,
            round: game.currentRound, totalRounds: game.totalRounds,
          });
        }, 2000);
        return;
      }

      const nextIndex  = game.submittedPlayers.length;
      const nextPlayer = game.players[nextIndex];
      io.to(lobbyCode).emit("turnChanged", {
        currentTurnId:   nextPlayer._id.toString(),
        currentTurnName: nextPlayer.name,
        descriptions:    round.descriptions,
      });
    } catch (err) { console.error("submitDescription error:", err); }
  });

  socket.on("castVote", async ({ lobbyCode, voterId, targetId }) => {
    try {
      const game = await Game.findOne({ code: lobbyCode }).populate("players","name score role");
      if (!game || game.status !== "voting") return;
      if (game.votedPlayers.includes(voterId)) return;

      const round = game.rounds[game.currentRound - 1];
      round.votes.push({ voterId, targetId });
      game.votedPlayers.push(voterId);

      io.to(lobbyCode).emit("voteUpdate", { voted: game.votedPlayers.length, total: game.players.length });

      if (game.votedPlayers.length >= game.players.length) {
        const tally = {};
        for (const v of round.votes) { tally[v.targetId] = (tally[v.targetId] || 0) + 1; }

        const eliminatedId     = Object.entries(tally).sort((a,b) => b[1]-a[1])[0][0];
        const eliminatedPlayer = await Player.findById(eliminatedId);
        const wasImpostor      = eliminatedId === game.impostorId.toString();

        round.eliminatedId   = eliminatedId;
        round.eliminatedName = eliminatedPlayer?.name || "Unknown";
        round.wasImpostor    = wasImpostor;

        if (wasImpostor) {
          for (const v of round.votes) {
            if (v.targetId.toString() === eliminatedId)
              await Player.findByIdAndUpdate(v.voterId, { $inc: { score: 1 } });
          }
        } else {
          await Player.findByIdAndUpdate(game.impostorId, { $inc: { score: 2 } });
        }

        await game.populate("players","name score role");
        const isLastRound  = game.currentRound >= game.totalRounds;

        if (isLastRound || wasImpostor) {
          game.status = "finished";
          await game.save();
          const impostorPlayer = await Player.findById(game.impostorId);
          io.to(lobbyCode).emit("gameOver", {
            impostorName: impostorPlayer?.name, impostorCaught: wasImpostor,
            players: game.players, round: game.currentRound,
            eliminatedName: round.eliminatedName, wasImpostor, tally,
          });
        } else {
          game.currentRound    += 1;
          game.status           = "describing";
          game.submittedPlayers = [];
          game.votedPlayers     = [];
          const newWord = getRandomWord();
          game.rounds.push({ roundNumber: game.currentRound, secretWord: newWord, descriptions: [], votes: [] });
          await game.save();

          io.to(lobbyCode).emit("roundResult", {
            eliminatedName: round.eliminatedName, wasImpostor, tally,
            round: game.currentRound - 1, players: game.players,
          });

          setTimeout(async () => {
            const updatedGame = await Game.findOne({ code: lobbyCode }).populate("players","name");
            const firstPlayer = updatedGame.players[0];
            for (const player of updatedGame.players) {
              const pSocket    = findSocketByPlayerId(player._id.toString());
              const isImpostor = player._id.toString() === updatedGame.impostorId.toString();
              if (pSocket) {
                pSocket.emit("newRound", {
                  role:            isImpostor ? "impostor" : "crewmate",
                  word:            isImpostor ? "IMPOSTOR" : newWord,
                  round:           updatedGame.currentRound,
                  totalRounds:     updatedGame.totalRounds,
                  currentTurnId:   firstPlayer._id.toString(),
                  currentTurnName: firstPlayer.name,
                });
              }
            }
            startDescriptionTimer(lobbyCode, 60000);
            io.to(lobbyCode).emit("phaseChanged", {
              phase: "describing", round: updatedGame.currentRound,
              totalRounds: updatedGame.totalRounds, timerSeconds: 60,
              currentTurnId:   firstPlayer._id.toString(),
              currentTurnName: firstPlayer.name,
            });
          }, 5000);
        }
      } else {
        await game.save();
      }
    } catch (err) { console.error("castVote error:", err); }
  });

  socket.on("disconnect", async () => {
    console.log(`🔌 Disconnected: ${socket.id}`);
    if (socket.data.playerId)
      await Player.findByIdAndUpdate(socket.data.playerId, { isOnline: false });
  });

  function findSocketByPlayerId(playerId) {
    for (const [, s] of io.sockets.sockets) {
      if (s.data.playerId === playerId) return s;
    }
    return null;
  }
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`))