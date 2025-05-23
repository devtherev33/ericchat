// server.js
const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

const MAX_MESSAGES = 250;
let messages = [];

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Send chat history to the new user
  socket.emit("chat history", messages);

  socket.on("chat message", (msg) => {
    messages.push(msg);
    if (messages.length > MAX_MESSAGES) {
      messages.shift(); // remove oldest to keep max size
    }
    io.emit("chat message", msg);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

http.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
