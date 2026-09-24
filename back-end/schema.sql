DROP TABLE IF EXISTS expenses;

CREATE TABLE expenses (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    category VARCHAR(50) NOT NULL CHECK (category IN ('Food', 'Transport', 'Bills', 'Entertainment', 'Other')),
    date DATE NOT NULL
);

INSERT INTO expenses (title, amount, category, date) VALUES
('Lunch', 4.50, 'Food', '2026-01-15'),
('Internet Bill', 25.00, 'Bills', '2026-01-16'),
('Taxi to downtown', 3.00, 'Transport', '2026-01-17'),
('Cinema Movie', 8.00, 'Entertainment', '2026-01-18'),
('Notebook', 2.00, 'Other', '2026-01-19');