DROP TABLE IF EXISTS expenses;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE expenses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    category VARCHAR(50) NOT NULL CHECK (category IN ('Food', 'Transport', 'Bills', 'Entertainment', 'Other')),
    date DATE NOT NULL
);

INSERT INTO users (full_name, email, password_hash) VALUES
('Abood Admin', 'admin@example.com', '$2b$10$wT2mOzQe7tVv2d0UjKkYcewB9q9U5p1vY3O5l5R3.z8N1.C4zH5qS');
INSERT INTO expenses (user_id, title, amount, category, date) VALUES
(1, 'Lunch', 4.50, 'Food', '2026-01-15'),
(1, 'Internet Bill', 25.00, 'Bills', '2026-01-16'),
(1, 'Taxi to downtown', 3.00, 'Transport', '2026-01-17'),
(1, 'Cinema Movie', 8.00, 'Entertainment', '2026-01-18'),
(1, 'Notebook', 2.00, 'Other', '2026-01-19');