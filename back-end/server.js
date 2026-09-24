import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

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

app.get("/api/expenses", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id, 
        title, 
        amount::float AS amount, 
        category, 
        TO_CHAR(date, 'YYYY-MM-DD') AS date 
      FROM expenses 
      ORDER BY date DESC, id DESC;
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching expenses:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/expenses/:id", async (req, res) => {
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
      WHERE id = $1;
    `;
    const result = await pool.query(query, [idValidation.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Expense not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching expense by ID:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/expenses", async (req, res) => {
  const validation = validateExpenseData(req.body, false);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const { title, amount, category, date } = validation.cleanData;

  try {
    const query = `
      INSERT INTO expenses (title, amount, category, date)
      VALUES ($1, $2, $3, $4)
      RETURNING id, title, amount::float AS amount, category, TO_CHAR(date, 'YYYY-MM-DD') AS date;
    `;
    const result = await pool.query(query, [title, amount, category, date]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error adding expense:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/api/expenses/:id", async (req, res) => {
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
      WHERE id = $5
      RETURNING id, title, amount::float AS amount, category, TO_CHAR(date, 'YYYY-MM-DD') AS date;
    `;
    const values = [title, amount, category, date, idValidation.id];
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

app.delete("/api/expenses/:id", async (req, res) => {
  const idValidation = validateExpenseId(req.params.id);
  if (!idValidation.valid) {
    return res.status(404).json({ error: idValidation.error });
  }

  try {
    const query = `
      DELETE FROM expenses 
      WHERE id = $1 
      RETURNING id, title, amount::float AS amount, category, TO_CHAR(date, 'YYYY-MM-DD') AS date;
    `;
    const result = await pool.query(query, [idValidation.id]);

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
