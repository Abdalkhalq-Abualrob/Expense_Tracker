import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Pool } from "pg";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "default_jwt_secret_dev_key";

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const ALLOWED_CATEGORIES = [
  "Food",
  "Transport",
  "Bills",
  "Entertainment",
  "Other",
];

/* ==========================================
  (Authentication Middleware)
========================================== */
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token missing or required" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Token is invalid or has expired" });
    }
    req.user = user;
    next();
  });
}

function validateExpenseId(id) {
  const parsedId = Number(id);
  if (isNaN(parsedId) || !Number.isInteger(parsedId) || parsedId <= 0) {
    return { valid: false, error: "Invalid expense ID" };
  }
  return { valid: true, id: parsedId };
}

function validateExpenseData(data, isPartial = false) {
  const { title, amount, category, date } = data;

  if (isPartial) {
    if (!title || amount === undefined || !category || !date) {
      return {
        valid: false,
        error: "All fields are required: title, amount, category, date",
      };
    }
  }

  const cleanData = {};

  if (title !== undefined) {
    if (typeof title !== "string" || title.trim() === "") {
      return { valid: false, error: "Title must be a non-empty string" };
    }
    cleanData.title = title.trim();
  }

  if (amount !== undefined) {
    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return {
        valid: false,
        error: "Amount must be a positive number greater than zero",
      };
    }
    cleanData.amount = numericAmount;
  }

  if (category !== undefined) {
    if (!ALLOWED_CATEGORIES.includes(category)) {
      return {
        valid: false,
        error: `Invalid category. Allowed categories: ${ALLOWED_CATEGORIES.join(", ")}`,
      };
    }
    cleanData.category = category;
  }

  if (date !== undefined) {
    if (isNaN(Date.parse(date))) {
      return { valid: false, error: "Invalid date format must be YYYY-MM-DD." };
    }
    cleanData.date = date;
  }

  return { valid: true, cleanData };
}

app.post("/api/auth/register", async (req, res) => {
  const { full_name, email, password } = req.body;

  if (!full_name || typeof full_name !== "string" || full_name.trim() === "") {
    return res.status(400).json({ error: "Full name is required" });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "A valid email address is required" });
  }

  if (!password || typeof password !== "string" || password.length < 6) {
    return res
      .status(400)
      .json({ error: "Password must be at least 6 characters long" });
  }

  try {
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email.toLowerCase().trim()],
    );
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "Email is already registered" });
    }

    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, full_name, email, TO_CHAR(created_at, 'YYYY-MM-DD') AS created_at;`,
      [full_name.trim(), email.toLowerCase().trim(), password_hash],
    );

    const user = result.rows[0];

    const token = jwt.sign(
      { id: user.id, email: user.email, full_name: user.full_name },
      JWT_SECRET,
      { expiresIn: "24h" },
    );

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error("Error in register:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const result = await pool.query(
      `SELECT 
         id, 
         full_name, 
         email, 
         password_hash, 
         TO_CHAR(created_at, 'YYYY-MM-DD') AS created_at 
       FROM users 
       WHERE email = $1`,
      [email.toLowerCase().trim()],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = result.rows[0];

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const token = jwt.sign(
      { id: user.id, email: user.email, full_name: user.full_name },
      JWT_SECRET,
      { expiresIn: "24h" },
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error("Error in login:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/auth/me", authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query(
      `SELECT 
         id, 
         full_name, 
         email, 
         TO_CHAR(created_at, 'YYYY-MM-DD') AS created_at 
       FROM users 
       WHERE id = $1;`,
      [req.user.id],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const statsResult = await pool.query(
      `SELECT 
         COUNT(*)::int AS total_expenses_count,
         COALESCE(SUM(amount)::float, 0) AS total_spent
       FROM expenses 
       WHERE user_id = $1;`,
      [req.user.id],
    );

    res.json({
      user: userResult.rows[0],
      stats: statsResult.rows[0],
    });
  } catch (error) {
    console.error("Error in profile /me:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/api/auth/me", authenticateToken, async (req, res) => {
  const { full_name, email, current_password, new_password } = req.body;

  try {
    const userQuery = await pool.query("SELECT * FROM users WHERE id = $1", [
      req.user.id,
    ]);

    if (userQuery.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const currentUser = userQuery.rows[0];

    let updatedName = currentUser.full_name;
    let updatedEmail = currentUser.email;

    if (full_name !== undefined) {
      if (typeof full_name !== "string" || full_name.trim() === "") {
        return res.status(400).json({ error: "Full name cannot be empty" });
      }
      updatedName = full_name.trim();
    }

    if (email !== undefined) {
      const cleanEmail = email.toLowerCase().trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({ error: "Invalid email address format" });
      }
      if (cleanEmail !== currentUser.email) {
        const emailCheck = await pool.query(
          "SELECT id FROM users WHERE email = $1 AND id != $2",
          [cleanEmail, req.user.id],
        );
        if (emailCheck.rows.length > 0) {
          return res.status(400).json({ error: "Email is already taken" });
        }
        updatedEmail = cleanEmail;
      }
    }

    let updatedPasswordHash = currentUser.password_hash;
    if (new_password) {
      if (!current_password) {
        return res.status(400).json({
          error: "Current password is required to set a new password",
        });
      }

      const isCurrentValid = await bcrypt.compare(
        current_password,
        currentUser.password_hash,
      );
      if (!isCurrentValid) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }

      if (typeof new_password !== "string" || new_password.length < 6) {
        return res.status(400).json({
          error: "New password must be at least 6 characters long",
        });
      }

      updatedPasswordHash = await bcrypt.hash(new_password, 10);
    }

    const updateResult = await pool.query(
      `UPDATE users 
       SET full_name = $1, email = $2, password_hash = $3 
       WHERE id = $4 
       RETURNING id, full_name, email, TO_CHAR(created_at, 'YYYY-MM-DD') AS created_at;`,
      [updatedName, updatedEmail, updatedPasswordHash, req.user.id],
    );

    const updatedUser = updateResult.rows[0];

    const newToken = jwt.sign(
      {
        id: updatedUser.id,
        email: updatedUser.email,
        full_name: updatedUser.full_name,
      },
      JWT_SECRET,
      { expiresIn: "24h" },
    );

    res.json({
      message: "Profile updated successfully",
      token: newToken,
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/expenses", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT 
        id, 
        title, 
        amount::float AS amount, 
        category, 
        TO_CHAR(date, 'YYYY-MM-DD') AS date 
      FROM expenses 
      WHERE user_id = $1
      ORDER BY date DESC, id DESC;
    `,
      [req.user.id],
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching expenses:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/expenses/:id", authenticateToken, async (req, res) => {
  const idValidation = validateExpenseId(req.params.id);
  if (!idValidation.valid) {
    return res.status(404).json({ error: idValidation.error });
  }

  try {
    const query = `
      SELECT 
        id, 
        title, 
        amount::float AS amount, 
        category, 
        TO_CHAR(date, 'YYYY-MM-DD') AS date 
      FROM expenses 
      WHERE id = $1 AND user_id = $2;
    `;
    const result = await pool.query(query, [idValidation.id, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Expense not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching expense by ID:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/expenses", authenticateToken, async (req, res) => {
  const validation = validateExpenseData(req.body, false);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const { title, amount, category, date } = validation.cleanData;

  try {
    const query = `
      INSERT INTO expenses (user_id, title, amount, category, date)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, title, amount::float AS amount, category, TO_CHAR(date, 'YYYY-MM-DD') AS date;
    `;
    const result = await pool.query(query, [
      req.user.id,
      title,
      amount,
      category,
      date,
    ]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error adding expense:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/api/expenses/:id", authenticateToken, async (req, res) => {
  const idValidation = validateExpenseId(req.params.id);
  if (!idValidation.valid) {
    return res.status(404).json({ error: idValidation.error });
  }

  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: "No fields provided to update" });
  }

  const dataValidation = validateExpenseData(req.body, true);
  if (!dataValidation.valid) {
    return res.status(400).json({ error: dataValidation.error });
  }

  const {
    title = null,
    amount = null,
    category = null,
    date = null,
  } = dataValidation.cleanData;

  try {
    const query = `
      UPDATE expenses
      SET 
        title = COALESCE($1, title),
        amount = COALESCE($2, amount),
        category = COALESCE($3, category),
        date = COALESCE($4, date)
      WHERE id = $5 AND user_id = $6
      RETURNING id, title, amount::float AS amount, category, TO_CHAR(date, 'YYYY-MM-DD') AS date;
    `;
    const values = [
      title,
      amount,
      category,
      date,
      idValidation.id,
      req.user.id,
    ];
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Expense not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating expense:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/api/expenses/:id", authenticateToken, async (req, res) => {
  const idValidation = validateExpenseId(req.params.id);
  if (!idValidation.valid) {
    return res.status(404).json({ error: idValidation.error });
  }

  try {
    const query = `
      DELETE FROM expenses 
      WHERE id = $1 AND user_id = $2
      RETURNING id, title, amount::float AS amount, category, TO_CHAR(date, 'YYYY-MM-DD') AS date;
    `;
    const result = await pool.query(query, [idValidation.id, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Expense not found" });
    }

    res.json({
      message: "Expense deleted successfully",
      deleted: result.rows[0],
    });
  } catch (error) {
    console.error("Error deleting expense:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on: http://localhost:${PORT}`);
});
