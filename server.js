import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./Routes/authRoutes.js";
import cookieParser from "cookie-parser";
import universityRoutes from "./Routes/universityRoutes.js";
import societyRoutes from "./Routes/societyRoutes.js";
import eventRoutes from "./Routes/eventRoutes.js";
import contestRoutes from "./Routes/contestRoutes.js";
import imageRoute from "./utils/uploadImage.js";
import setUserContext from "./Middleware/setUserContext.js";
import protectRoute from "./Middleware/authMiddleware.js";
import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import pool from "./Database/db.js";

dotenv.config();
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use(
  cors({
    origin: "http://localhost:5173", // Frontend URL
    credentials: true, // Allow cookies to be sent
  })
);
app.use(express.json());
app.use(cookieParser());

pool.connect((err) => {
  if (err) {
    console.log("Error connecting to database", err);
  } else {
    console.log("Connected to PostgreSQL Database");
  }
});

//create tables
// import createTables from "./tableCreation.js";
// createTables(pool);

// Apply setUserContext middleware globally
app.use(async (req, res, next) => {
  try {
    const token = req.cookies.jwt;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded && decoded.userID) {
          // Make sure we pass a number rather than an empty string
          const userId = parseInt(decoded.userID);
          await pool.query("SET LOCAL app.current_user_id = $1", [userId]);
        } else {
          await pool.query("SET LOCAL app.current_user_id = '-1'");
        }
      } catch (error) {
        await pool.query("SET LOCAL app.current_user_id = '-1'");
      }
    } else {
      await pool.query("SET LOCAL app.current_user_id = '-1'");
    }
    next();
  } catch (error) {
    console.error("Error setting user context:", error);
    // Even if we can't set the context, allow the request to proceed
    next();
  }
});

app.get("/", (req, res) => {
  res.send("Hello world from the backend");
});

//done
app.use("/api/auth", authRoutes);

//one thing needed in updation, deletion, : need to add authentication
app.use("/api/university", universityRoutes);

//done : may add authentication for who is accessing
app.use("/api/society", societyRoutes);

//done : may add authentication for who is accessing
app.use("/api/event", eventRoutes);

//underdevelopment
app.use("/api/contest", contestRoutes);

app.use("/image", imageRoute);

// Socket.io connection handling
const connectedUsers = new Map(); // Map to store user details with their socket IDs

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);
  
  // Handle user login
  socket.on("user_connected", async (userData) => {
    try {
      console.log("User connected:", userData);
      
      if (!userData || !userData.userId) {
        console.error("Invalid user data received:", userData);
        return;
      }
      
      // Parse userId to ensure it's a number
      const userId = parseInt(userData.userId);
      if (isNaN(userId)) {
        console.error("Invalid userId format:", userData.userId);
        return;
      }
      
      // Store user information with socket ID
      connectedUsers.set(socket.id, {
        userId: userId,
        name: userData.name || "Anonymous",
        socketId: socket.id
      });
      
      // Broadcast updated user list to all clients
      const onlineUsers = Array.from(connectedUsers.values());
      io.emit("users_list", onlineUsers);
    } catch (error) {
      console.error("Error in user_connected handler:", error);
    }
  });
  
  // Handle private messages
  socket.on("private_message", async (data) => {
    try {
      console.log("Received private message:", data);
      
      if (!data || !data.content || !data.fromUserId || !data.toUserId) {
        console.error("Invalid message data:", data);
        socket.emit("message_error", { error: "Invalid message data" });
        return;
      }
      
      // Parse IDs to ensure they're numbers
      const fromUserId = parseInt(data.fromUserId);
      const toUserId = parseInt(data.toUserId);
      
      if (isNaN(fromUserId) || isNaN(toUserId)) {
        console.error("Invalid user IDs in message:", { fromUserId, toUserId });
        socket.emit("message_error", { error: "Invalid user IDs" });
        return;
      }
      
      // Find the recipient's socket ID
      let recipientSocketId = null;
      for (const [socketId, user] of connectedUsers.entries()) {
        if (user.userId === toUserId) {
          recipientSocketId = socketId;
          break;
        }
      }
      
      // Store the message in database
      try {
        const result = await pool.query(
          "INSERT INTO messages (from_user_id, to_user_id, content, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *",
          [fromUserId, toUserId, data.content]
        );
        
        const message = result.rows[0];
        
        // Send to recipient if online
        if (recipientSocketId) {
          io.to(recipientSocketId).emit("new_message", {
            messageId: message.id,
            content: message.content,
            fromUserId: message.from_user_id,
            fromUserName: connectedUsers.get(socket.id)?.name || "Unknown",
            timestamp: message.created_at
          });
        }
        
        // Send confirmation to sender
        socket.emit("message_sent", {
          messageId: message.id,
          toUserId: message.to_user_id,
          content: message.content,
          timestamp: message.created_at
        });
      } catch (error) {
        console.error("Error storing message:", error);
        socket.emit("message_error", { error: "Failed to send message" });
      }
    } catch (error) {
      console.error("Error in private_message handler:", error);
      socket.emit("message_error", { error: "Server error processing message" });
    }
  });
  
  // Handle getting message history between users
  socket.on("get_message_history", async (data) => {
    try {
      console.log("Getting message history:", data);
      
      if (!data || !data.userId || !data.otherUserId) {
        console.error("Invalid message history request:", data);
        socket.emit("message_error", { error: "Invalid request for message history" });
        return;
      }
      
      // Parse IDs to ensure they're numbers
      const userId = parseInt(data.userId);
      const otherUserId = parseInt(data.otherUserId);
      
      if (isNaN(userId) || isNaN(otherUserId)) {
        console.error("Invalid user IDs in history request:", { userId, otherUserId });
        socket.emit("message_error", { error: "Invalid user IDs" });
        return;
      }
      
      const result = await pool.query(
        `SELECT * FROM messages 
         WHERE (from_user_id = $1 AND to_user_id = $2) 
         OR (from_user_id = $2 AND to_user_id = $1) 
         ORDER BY created_at ASC`,
        [userId, otherUserId]
      );
      
      socket.emit("message_history", {
        messages: result.rows,
        userId: otherUserId
      });
    } catch (error) {
      console.error("Error fetching message history:", error);
      socket.emit("message_error", { error: "Failed to fetch message history" });
    }
  });
  
  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    
    // Remove user from connected users
    connectedUsers.delete(socket.id);
    
    // Broadcast updated user list
    const onlineUsers = Array.from(connectedUsers.values());
    io.emit("users_list", onlineUsers);
  });
});

const PORT = process.env.PORT || 5000;

// Use httpServer instead of app.listen
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default pool;
