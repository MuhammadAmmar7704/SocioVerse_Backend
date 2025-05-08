import pool from "../server.js";
import jwt from "jsonwebtoken";

const setUserContext = async (req, res, next) => {
  try {
    const token = req.cookies.jwt;

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (decoded && decoded.userID) {
        await pool.query("SET LOCAL app.current_user_id = $1", [
          decoded.userID,
        ]);
      } else {
        await pool.query("SET LOCAL app.current_user_id = -1");
      }
    } else {
      await pool.query("SET LOCAL app.current_user_id = -1");
    }
    next();
  } catch (error) {
    console.error("Error setting user context:", error);
    await pool.query("SET LOCAL app.current_user_id = -1").catch(() => {});
    next();
  }
};

export default setUserContext;
