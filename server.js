import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pkg from "pg";
import authRoutes from "./Routes/authRoutes.js";
import cookieParser from "cookie-parser";
import universityRoutes from "./Routes/universityRoutes.js";
import societyRoutes from "./Routes/societyRoutes.js";
import eventRoutes from "./Routes/eventRoutes.js";
import contestRoutes from "./Routes/contestRoutes.js";
import imageRoute from "./utils/uploadImage.js";
import setUserContext from "./Middleware/setUserContext.js";
import protectRoute from "./Middleware/authMiddleware.js";

dotenv.config();
const { Pool } = pkg;
const app = express();

app.use(
  cors({
    origin: "http://localhost:5173", // Frontend URL
    credentials: true, // Allow cookies to be sent
  })
);
app.use(express.json());
app.use(cookieParser());

//set this from your .env environment, yours may differ
const connectionString = process.env.PORTDB;

const pool = new Pool({
  connectionString,
});

pool.connect((err) => {
  if (err) {
    console.log("Error connecting to database", err);
  } else {
    console.log("Connected to PostgreSQL Database");
  }
});

//create tables
import createTables from "./tableCreation.js";
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

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default pool;
