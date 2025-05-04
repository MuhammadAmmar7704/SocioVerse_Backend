import express from "express";
const router = express.Router();

import {
  deleteUser,
  login,
  signup,
  logout,
  getCurrentUser,
  getAllUsers,
} from "../Controllers/authController.js";
import protectRoute from "../Middleware/authMiddleware.js";
import roleMiddleware from "../Middleware/roleMiddleware.js";
import pool from "../Database/db.js";

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", protectRoute, logout);
router.post("/removeuser", protectRoute,roleMiddleware("remove_user"), deleteUser);
router.get("/me", protectRoute, getCurrentUser);
router.get("/all", protectRoute, roleMiddleware('view_users'),  getAllUsers);

// Add a route to get all users for chat
router.get('/users', protectRoute, async (req, res) => {
  try {
    console.log('User requesting chat list:', req.user);
    const result = await pool.query(
      `SELECT user_id, username, email FROM users WHERE user_id != $1`,
      [req.user.user_id]
    );
    console.log('Users fetched for chat:', result.rows.length);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

export default router;
