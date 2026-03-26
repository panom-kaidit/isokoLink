const express   = require("express");
const dotenv    = require("dotenv");
const cors      = require("cors");
const helmet    = require("helmet");
const rateLimit = require("express-rate-limit");
const path      = require("path");
const http      = require("http");
const { Server } = require("socket.io");

const connectDB = require("./config/db");
const Message   = require("./models/Message");

dotenv.config({ path: "../.env" });
connectDB();

const app = express();

// ── Security headers ──────────────────────────────────────────────────────────
// helmet CSP is relaxed so CDN assets (Font Awesome, Leaflet, Socket.io CDN) keep working.
app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.NODE_ENV === "production"
      ? true
      : [
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
app.use("/api/auth",     require("./routes/authRoutes"));
app.use("/api/listings", require("./routes/listingRoutes"));
app.use("/api/requests", require("./routes/requestRoutes"));
app.use("/api/messages", require("./routes/messageRoutes"));

// ── Serve the Frontend static files ──────────────────────────────────────────
app.use(express.static(path.join(__dirname, "../Frontend")));

// ── Catch-all: send index.html for any non-API route ─────────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../Frontend", "index.html"));
});

// ── HTTP + Socket.io server ───────────────────────────────────────────────────
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === "production"
      ? true
      : ["http://127.0.0.1:5501", "http://localhost:5501"],
    methods: ["GET", "POST"]
  }
});

// ── Socket.io: real-time messaging helpers ────────────────────────────────────
const connectedUsers = new Map(); // userId -> Set(socketId)
const userRoom = (id) => `user:${id}`;

function addUserSocket(userId, socketId) {
  const key = String(userId);
  if (!connectedUsers.has(key)) connectedUsers.set(key, new Set());
  connectedUsers.get(key).add(socketId);
}

function removeUserSocket(userId, socketId) {
  const set = connectedUsers.get(String(userId));
  if (!set) return;
  set.delete(socketId);
  if (!set.size) connectedUsers.delete(String(userId));
}

const messagePopulate = [
  { path: "sender", select: "name" },
  { path: "receiver", select: "name" }
];

const formatPayload = (doc, tempId) => ({
  _id:         doc._id,
  senderId:    String(doc.sender?._id || doc.sender),
  senderName:  doc.sender?.name || "",
  receiverId:  String(doc.receiver?._id || doc.receiver),
  receiverName: doc.receiver?.name || "",
  text:        doc.text,
  createdAt:   doc.createdAt,
  deliveredAt: doc.deliveredAt,
  tempId:      tempId || doc.clientTempId || null
});

async function emitMessage(doc, { tempId, notifySender = true, notifyReceiver = true } = {}) {
  const payload = formatPayload(doc, tempId);
  const senderRoom = userRoom(payload.senderId);
  const receiverRoom = userRoom(payload.receiverId);

  if (notifySender) {
    io.to(senderRoom).emit("message:new", { ...payload, direction: "out" });
  }

  const receiverOnline = connectedUsers.get(payload.receiverId)?.size > 0;
  if (notifyReceiver && receiverOnline) {
    if (!doc.deliveredAt) {
      doc.deliveredAt = new Date();
      await doc.save();
      payload.deliveredAt = doc.deliveredAt;
    }
    io.to(receiverRoom).emit("message:new", payload);
  }

  return payload;
}

async function createAndEmitMessage({ senderId, receiverId, text, tempId }) {
  const cleanText = String(text || "").trim();
  if (!senderId || !receiverId || !cleanText) return null;

  const message = await Message.create({
    sender: senderId,
    receiver: receiverId,
    text: cleanText,
    clientTempId: tempId || null
  });

  await message.populate(messagePopulate);
  const payload = await emitMessage(message, { tempId });
  return payload;
}

async function deliverPendingMessages(userId) {
  const pending = await Message.find({ receiver: userId, deliveredAt: null })
    .sort({ createdAt: 1 })
    .populate(messagePopulate);

  for (const msg of pending) {
    await emitMessage(msg, { notifySender: false, tempId: msg.clientTempId });
  }
}

// Expose helpers to controllers via req.app.get(...)
app.set("io", io);
app.set("connectedUsers", connectedUsers);
app.set("userRoom", userRoom);
app.set("emitMessage", emitMessage);
app.set("createAndEmitMessage", createAndEmitMessage);
app.set("notifyUser", (userId, event, payload) => {
  if (!userId || !event) return;
  io.to(userRoom(String(userId))).emit(event, payload);
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("register", async (userId) => {
    const id = String(userId || "");
    if (!id) return;

    socket.data.userId = id;
    addUserSocket(id, socket.id);
    socket.join(userRoom(id));

    try {
      await deliverPendingMessages(id);
    } catch (err) {
      console.error("deliverPendingMessages failed", err.message);
    }
  });

  // Optional: support direct socket sends; still persist first, then broadcast
  socket.on("sendMessage", async ({ receiverId, text, tempId }) => {
    const senderId = String(socket.data.userId || "");
    if (!senderId) return;
    try {
      await createAndEmitMessage({ senderId, receiverId, text, tempId });
    } catch (err) {
      console.error("socket sendMessage failed", err.message);
    }
  });

  socket.on("disconnect", () => {
    const id = socket.data.userId;
    if (id) removeUserSocket(id, socket.id);
    console.log("User disconnected:", socket.id);
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode`);
});
