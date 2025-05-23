const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const PORT = process.env.PORT || 3000;

const users = new Map();
const connectedUsers = new Map();
const lastMessageTime = new Map();

const MAX_HISTORY = 250;
const messageHistory = []; // store last 250 messages here

app.use(express.static("public"));
app.use(express.json());

app.post("/signup", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Username and password required" });
  if (users.has(username))
    return res.status(409).json({ error: "Username taken" });

  users.set(username, password);
  res.json({ success: true });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!users.has(username))
    return res.status(404).json({ error: "User not found" });
  if (users.get(username) !== password)
    return res.status(401).json({ error: "Wrong password" });

  res.json({ success: true });
});

function getRateLimitDelay() {
  const activeCount = connectedUsers.size;
  return Math.min(5000, 2000 + Math.floor(activeCount / 5) * 1000);
}

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("user login", (username) => {
    connectedUsers.set(socket.id, username);
    console.log(`User logged in: ${username}`);

    // Send message history to this new user
    socket.emit("message history", messageHistory);

    io.emit("user count", connectedUsers.size);
  });

  socket.on("chat message", (msg) => {
    const username = connectedUsers.get(socket.id);
    if (!username) {
      socket.emit("error message", "You must log in first!");
      return;
    }

    const now = Date.now();
    const lastTime = lastMessageTime.get(username) || 0;
    const delay = getRateLimitDelay();

    if (now - lastTime < delay) {
      socket.emit(
        "error message",
        `Slow down! Wait ${Math.ceil((delay - (now - lastTime)) / 1000)} sec.`
      );
      return;
    }

    lastMessageTime.set(username, now);

    const messageObj = { user: username, text: msg };

    // Add message to history, trim if needed
    messageHistory.push(messageObj);
    if (messageHistory.length > MAX_HISTORY) {
      messageHistory.shift(); // remove oldest message
    }

    io.emit("chat message", messageObj);
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    connectedUsers.delete(socket.id);
    io.emit("user count", connectedUsers.size);
  });
});

http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
