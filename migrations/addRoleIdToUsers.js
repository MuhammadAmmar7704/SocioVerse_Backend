import pool from "../server.js";
import addRoleIdToUsers from "./migrations/addRoleIdToUsers.js";

const addRoleIdToUsers = async () => {
  try {
    // Check if role_id column exists
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'role_id';
    `;

    const columnExists = await pool.query(checkColumnQuery);

    if (columnExists.rows.length === 0) {
      // Add role_id column if it doesn't exist
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN role_id INTEGER DEFAULT 1;
      `);

      await pool.query(`
        ALTER TABLE users 
        ADD CONSTRAINT fk_user_role
        FOREIGN KEY (role_id) 
        REFERENCES roles(role_id) 
        ON DELETE SET NULL;
      `);

      console.log("Role ID column added to users table");
    } else {
      console.log("Role ID column already exists");
    }
  } catch (error) {
    console.error("Error adding role_id column:", error);
  }
};

await addRoleIdToUsers();

export default addRoleIdToUsers;
