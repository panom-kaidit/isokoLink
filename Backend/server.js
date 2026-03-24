const express  = require("express");
const dotenv   = require("dotenv");
const cors     = require("cors");
const helmet   = require("helmet");
const rateLimit = require("express-rate-limit");
const path     = require("path");                  // ← NEW: needed for static files
const connectDB = require("./config/db");

dotenv.config({ path: '../.env' });
connectDB();

const app = express();

// ── Security headers ──────────────────────────────────────────────────────────
// In production, helmet's default contentSecurityPolicy blocks inline scripts
// and external CDNs (Font Awesome, Leaflet, Socket.io CDN).
// We relax it here so the frontend loads correctly.
app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

// ── CORS ──────────────────────────────────────────────────────────────────────
// Development: allow the live-server origins you were using.
// Production (Docker): the frontend is served by THIS server on the same origin,
// so browser requests are same-origin and CORS headers are not needed.
// Using `origin: true` tells cors to mirror whatever origin the request came from,
// which handles both cases cleanly.
app.use(
  cors({
    origin: process.env.NODE_ENV === "production"
      ? true                                        // same-origin in Docker — mirror origin
      : [                                           // dev origins
          "http://localhost:3000",
          "http://127.0.0.1:5501",
          "http://localhost:5501"
        ],
    credentials: true
  })
);

app.use(express.json());

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use(
  "/api/auth/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
  })
);

// ── API routes ────────────────────────────────────────────────────────────────
// These MUST come before the static-file middleware so /api/* is never
// accidentally served as a file.
app.use("/api/auth",     require("./routes/authRoutes"));
app.use("/api/listings", require("./routes/listingRoutes"));
app.use("/api/requests", require("./routes/requestRoutes"));
app.use("/api/messages", require("./routes/messageRoutes"));

// ── Serve the Frontend static files ──────────────────────────────────────────
// In Docker the project root is /app, so:
//   __dirname  = /app/Backend
//   ../Frontend = /app/Frontend
// express.static serves everything inside Frontend/ — HTML, CSS, JS, images.
app.use(express.static(path.join(__dirname, "../Frontend")));

// ── Catch-all: send index.html for any non-API route ─────────────────────────
// This lets users navigate directly to /login/login.html, /pages/marketplace.html
// etc. — the browser gets the file and the frontend JS takes over routing.
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../Frontend", "index.html"));
});

// ── HTTP + Socket.io server ───────────────────────────────────────────────────
const http = require("http");
const { Server } = require("socket.io");

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    // Same logic as the express cors config above
    origin: process.env.NODE_ENV === "production"
      ? true
      : ["http://127.0.0.1:5501", "http://localhost:5501"],
    methods: ["GET", "POST"]
  }
});

// ── Socket.io: real-time messaging ───────────────────────────────────────────
const users = {};   // { userId: socketId }

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("register", (userId) => {
    users[userId] = socket.id;
  });

  socket.on("sendMessage", ({ senderId, receiverId, text }) => {
    const receiverSocket = users[receiverId];
    if (receiverSocket) {
      io.to(receiverSocket).emit("receiveMessage", {
        senderId,
        text,
        time: new Date()
      });
    }
  });

  socket.on("disconnect", () => {
    for (const id in users) {
      if (users[id] === socket.id) {
        delete users[id];
      }
    }
    console.log("User disconnected:", socket.id);
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode`);
});
