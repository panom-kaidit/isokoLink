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

// Helmet adds security headers to every response.
// We turn off its strict content policy so our CDN links (Font Awesome, Leaflet) still work.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginOpenerPolicy: false,
    originAgentCluster: false
  })
);

// CORS tells the browser which other websites are allowed to call our API.
// In production the frontend and backend run on the same server, so we just mirror the origin.
// In development we allow the local Live Server ports we use on our computer.
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

// Limit how many login attempts someone can make in 15 minutes to slow down brute-force attacks
app.use(
  "/api/auth/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
  })
);

// Register all the API routes. These come before the static file serving
// so a request to /api/... never accidentally gets treated as a file request.
app.use("/api/auth",     require("./routes/authRoutes"));
app.use("/api/listings", require("./routes/listingRoutes"));
app.use("/api/requests", require("./routes/requestRoutes"));
app.use("/api/messages", require("./routes/messageRoutes"));

// Serve all the HTML, CSS, JS, and image files from the Frontend folder.
// When running in Docker, __dirname points to /app/Backend so ../Frontend resolves correctly.
app.use(express.static(path.join(__dirname, "../Frontend")));

// If someone visits a URL that is not an API route, send them index.html.
// This lets direct links like /login/login.html or /pages/marketplace.html work in the browser.
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../Frontend", "index.html"));
});

// Wrap the Express app in a plain HTTP server so Socket.io can share the same port
const http = require("http");
const { Server } = require("socket.io");

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    // Same allowed-origins rule as the one above for the HTTP server
    origin: process.env.NODE_ENV === "production"
      ? true
      : ["http://127.0.0.1:5501", "http://localhost:5501"],
    methods: ["GET", "POST"]
  }
});

// Keep a simple map of which user is connected on which socket so we can deliver messages directly
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

// Start the server and print the port so we know it is running
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode`);
});
