import pool from "../server.js";
import jwt from "jsonwebtoken";

const setUserContext = async (req, res, next) => {
  try {
    const token = req.cookies.jwt;

    if (token) {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (decoded && decoded.userID) {
        // Set the current user ID in the database session
        await pool.query("SET LOCAL app.current_user_id = $1", [
          decoded.userID,
        ]);
      } else {
        // Set a default value for system operations
        await pool.query("SET LOCAL app.current_user_id = -1");
      }
    } else {
      // Set a default value if no token
      await pool.query("SET LOCAL app.current_user_id = -1");
    }
    next();
  } catch (error) {
    console.error("Error setting user context:", error);
    // Set default value even on error
    await pool.query("SET LOCAL app.current_user_id = -1").catch(() => {});
    next();
  }
};

export default setUserContext;
