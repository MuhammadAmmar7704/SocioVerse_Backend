import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();
const { Pool } = pkg;

//set this from your .env environment, yours may differ
const connectionString = process.env.PORTDB;

const pool = new Pool({
  connectionString,
});

export default pool; 