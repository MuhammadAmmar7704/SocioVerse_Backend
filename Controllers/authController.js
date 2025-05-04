import pool from "../server.js";
import bcrypt from "bcryptjs";
import generateTokenAndSetCookie from "../utils/generateToken.js";

export const signup = async (req, res) => {
  try {
    const { username, password, email, university_id } = req.body;

    if (!username || !password || !email) {
      return res.status(400).json({ error: "Please fill all the fields" });
    }

    let user_exists = "SELECT * FROM users where username=$1 ";
    let exists_query = await pool.query(user_exists, [username]);

    if (exists_query.rows.length > 0) {
      return res.status(409).json({ error: "Username already exists" });
    }

    user_exists = "SELECT * FROM users where email=$1 ";
    exists_query = await pool.query(user_exists, [email]);

    if (exists_query.rows.length > 0) {
      return res.status(409).json({ error: "Email already exists" });
    }

    // First check if university_id is valid if provided
    if (university_id !== undefined && university_id !== null) {
      // Ensure university_id is a number before querying
      const uniId = parseInt(university_id);

      if (isNaN(uniId)) {
        return res.status(400).json({ error: "Invalid university ID format" });
      }

      const universityQuery =
        "SELECT university_id FROM university WHERE university_id = $1";
      const universityResult = await pool.query(universityQuery, [uniId]);

      if (universityResult.rows.length === 0) {
        return res.status(400).json({ error: "Invalid university selected" });
      }

      // Store the parsed value for later use
      req.body.university_id = uniId;
    }

    // hashing password, to make it secure
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Start a transaction
    await pool.query("BEGIN");

    try {
      const query = `INSERT INTO users 
          (username, password, email) VALUES ($1,$2,$3)
          RETURNING *`;
      const data = [username, hashedPassword, email];

      // adding in database
      const confirm = await pool.query(query, data);

      if (confirm.rows.length === 0) {
        await pool.query("ROLLBACK");
        return res.status(500).json({ error: "Failed to create user" });
      }

      const user = confirm.rows[0];
      const id = user.user_id;
      const role_id = user.role_id || 1; // Default role is user

      // Get role name
      const roleQuery = "SELECT role_name FROM roles WHERE role_id = $1";
      const roleResult = await pool.query(roleQuery, [role_id]);
      const role_name = roleResult.rows[0]?.role_name || "Users";

      // Only add student record if university_id is valid
      if (university_id !== undefined && university_id !== null) {
        try {
          // Use the previously parsed university_id or parse it again to be safe
          const uniId = parseInt(university_id);
          if (!isNaN(uniId)) {
            await pool.query(
              "INSERT INTO student(student_id, university_id) VALUES ($1,$2)",
              [id, uniId]
            );
          }
        } catch (studentError) {
          console.error("Error adding student record:", studentError);
          // Continue with signup even if student record fails
        }
      }

      // Commit the transaction
      await pool.query("COMMIT");

      return res.status(201).json({
        message: "Signup successful",
        id: id,
        username: user.username,
        role_name: role_name,
      });
    } catch (innerError) {
      // Rollback transaction on error
      await pool.query("ROLLBACK");
      throw innerError;
    }
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Please fill all the fields" });
    }

    const query =
      "SELECT * FROM users u join roles r on u.role_id = r.role_id WHERE email = $1";
    const data = [email];

    const confirm = await pool.query(query, data);
    const { rows } = confirm;

    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const [user] = rows;
    const {
      user_id: id,
      email: user_email,
      password: user_password,
      username: user_username,
      role_id,
      role_name,
    } = user;

    const isPasswordCorrect = await bcrypt.compare(password, user_password);

    if (!isPasswordCorrect) {
      return res.status(401).json({ error: "Invalid Password" });
    }

    generateTokenAndSetCookie(id, role_id, role_name, res);

    // Handle University_Head
    if (role_name === "University_Head") {
      const uni_id = await pool.query(
        "SELECT university_id FROM university WHERE admin_id = $1",
        [id]
      );
      const university_id = uni_id.rows[0]?.university_id;
      return res
        .status(200)
        .json({ id, user_username, user_email, role_name, university_id });
    }

    // Handle Society_Head
    if (role_name === "Society_Head") {
      const soc_id = await pool.query(
        "SELECT society_id FROM society WHERE admin_id = $1",
        [id]
      );
      const society_id = soc_id.rows[0]?.society_id;
      return res
        .status(200)
        .json({ id, user_username, user_email, role_name, society_id });
    }

    // Handle Super_Admin and other roles
    return res.status(200).json({ id, user_username, user_email, role_name });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const logout = (req, res) => {
  try {
    res.clearCookie("jwt", {
      httpOnly: true,
      secure: process.env.NODE_ENV !== "local",
      sameSite: "strict",
    });
    res.status(200).json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) {
      return res.status(400).json({ error: "Please fill all the fields" });
    }
    const query = "DELETE FROM users WHERE user_id = $1;";
    const data = [user_id];

    const confirm = await pool.query(query, data);
    res.status(200).json({ message: `${user_id} has been removed` });
  } catch (error) {
    res.status(500).json({ message: "user not deleted" });
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    const { user_id, role_id, role_name } = req.user;

    // Additional data based on role
    let additionalData = {};

    if (role_name === "University_Head") {
      const uni_result = await pool.query(
        "SELECT university_id FROM university WHERE admin_id = $1",
        [user_id]
      );
      if (uni_result.rows.length > 0) {
        additionalData.university_id = uni_result.rows[0].university_id;
      }
    } else if (role_name === "Society_Head") {
      const soc_result = await pool.query(
        "SELECT society_id FROM society WHERE admin_id = $1",
        [user_id]
      );
      if (soc_result.rows.length > 0) {
        additionalData.society_id = soc_result.rows[0].society_id;
      }
    } else if (role_name === "Student") {
      const student_result = await pool.query(
        "SELECT university_id FROM student WHERE student_id = $1",
        [user_id]
      );
      if (student_result.rows.length > 0) {
        additionalData.university_id = student_result.rows[0].university_id;
      }
    }

    res.json({
      user_id,
      username: req.user.username,
      email: req.user.email,
      role_name,
      ...additionalData,
    });
  } catch (error) {
    console.error("Error in getCurrentUser:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const query = `
      SELECT u.user_id, u.username, u.email, r.role_name 
      FROM users u
      JOIN roles r ON r.role_id = u.role_id
      ORDER BY u.user_id ASC
    `;

    const result = await pool.query(query);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No users found" });
    }

    res.json({ users: result.rows });
  } catch (error) {
    console.error("Error in getAllUsers:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
