# 💰 Expense Tracker Application (Multi-User SaaS)

A secure, multi-user full-stack web application designed to track, manage, and analyze personal expenses with strict data isolation. Built with Node.js/Express, PostgreSQL, Bootstrap 5, and native CSS Grid.

---

## 🚀 Key Features

- **Multi-Tenant User Authentication:** Secure user registration, login, and session persistence using JWT (JSON Web Tokens) and salted password hashing via bcrypt.
- **Strict Data Isolation (Anti-IDOR):** Complete isolation of user data; all CRUD operations strictly enforce ownership through the authenticated user token, preventing Insecure Direct Object References (IDOR).
- **User Profile Management:** Dedicated profile portal allowing users to inspect their account overview, live aggregate statistics, and safely update their name, email, or password.
- **Full CRUD API:** Create, Read, Update, and Delete expense records with persistent PostgreSQL storage.
- **Responsive Dashboard:** Summary cards for Total Expenses, Total Count, and Highest Expense built using native CSS Grid.
- **Live Category Filtering:** Instant table filtering and stats recalculation across allowed categories (Food, Transport, Bills, Entertainment, Other).
- **Interactive Breakdown Chart:** Dynamic doughnut chart visualizing expense distributions using Chart.js.
- **Dark Mode Support:** Seamless theme switching (Light/Dark) with user preference persistence via localStorage.
- **Client-Side Auth Guards:** Protected routing preventing unauthorized dashboard access and handling graceful token expirations.

---

## 🛠️ Tech Stack

- **Back-End:** Node.js, Express.js, PostgreSQL (pg), bcrypt, jsonwebtoken (JWT), dotenv, cors.
- **Front-End:** Vanilla JavaScript (ES6+), HTML5, CSS3, Bootstrap 5.3, Chart.js.
- **Database:** PostgreSQL with relational foreign keys and cascaded deletions.

---

## ⚙️ Getting Started from Scratch

### 1. Database Setup

1. Launch PostgreSQL using psql or pgAdmin.
2. Create a new database named expense_tracker:
   CREATE DATABASE expense_tracker;
3. Connect to the database and execute schema.sql to generate the relational schema (users and expenses tables) with initial seed records:
   \c expense_tracker
   \i schema.sql

---

### 2. Back-End Setup & Execution

1. Navigate into the backend directory:
   cd back-end
2. Install all required dependencies:
   npm install
3. Create a .env file in the root of back-end (refer to .env.example) and fill in your configuration:
   PORT=3000
   DB_USER=postgres
   DB_HOST=localhost
   DB_NAME=expense_tracker
   DB_PASSWORD=your_password
   DB_PORT=5432
   JWT_SECRET=your_super_secret_jwt_key
4. Start the server:
   node server.js
   The server is now listening at http://localhost:3000.

---

### 3. Front-End Setup

1. Navigate to the frontend directory:
   cd ../front-end
2. Run the frontend using a local development server (such as the Live Server extension in VS Code or npx serve .) to ensure proper web origins and storage access:
   - Navigate to http://127.0.0.1:5500/login.html (or your local port).
   - Sign up a new account or log in to access the protected dashboard.

---

## 🔌 API Endpoints Reference

### Authentication & Profile Endpoints

| Method | Endpoint           | Description                                | Protected | Status Codes  |
| :----- | :----------------- | :----------------------------------------- | :-------- | :------------ |
| POST   | /api/auth/register | Register a new user and receive a JWT      | No        | 201, 400      |
| POST   | /api/auth/login    | Authenticate credentials and receive a JWT | No        | 200, 400, 401 |
| GET    | /api/auth/me       | Fetch authenticated profile and analytics  | Yes (JWT) | 200, 401, 404 |
| PUT    | /api/auth/me       | Update profile details or change password  | Yes (JWT) | 200, 400, 401 |

### Expenses Endpoints (Isolated per User)

| Method | Endpoint          | Description                                     | Protected | Status Codes       |
| :----- | :---------------- | :---------------------------------------------- | :-------- | :----------------- |
| GET    | /api/expenses     | Retrieve all expenses belonging to current user | Yes (JWT) | 200, 401, 500      |
| GET    | /api/expenses/:id | Retrieve a specific expense by ID               | Yes (JWT) | 200, 401, 404      |
| POST   | /api/expenses     | Create an expense tied to current user          | Yes (JWT) | 201, 400, 401      |
| PUT    | /api/expenses/:id | Update an existing expense (ownership verified) | Yes (JWT) | 200, 400, 401, 404 |
| DELETE | /api/expenses/:id | Remove an expense (ownership verified)          | Yes (JWT) | 200, 401, 404      |

---

## 🧠 Toughest Challenges & Solutions

### 1. Stateless Authentication & Anti-IDOR Data Isolation (JWT & Multi-Tenancy)

- **The Problem:** Transforming a single-user app into a multi-tenant platform introduced critical security vulnerabilities. Relying on client-supplied identifiers (req.body.user_id) exposes the application to Insecure Direct Object Reference (IDOR) attacks, where a malicious user could read, modify, or delete another person's records simply by guessing their ID. Furthermore, session state needed to scale without storing server-side session memory.
- **The Solution:** We implemented stateless authentication using JSON Web Tokens (JWT) signed with a 24-hour expiration window. A centralized Express middleware (authenticateToken) validates the incoming Bearer token header, unpacks the cryptographically signed req.user.id, and injects it directly into the request lifecycle. Every database mutation and query is forced to include ownership constraints:
  SELECT \* FROM expenses WHERE id = $1 AND user_id = $2;
  UPDATE expenses SET ... WHERE id = $1 AND user_id = $2;
  If an unauthorized user attempts to access an expense ID they do not own, the query naturally returns zero affected rows, resulting in a safe 404 Not Found without disclosing record existence.

### 2. Cross-Origin Session Management & Origin Isolation

- **The Problem:** During frontend testing, accessing files directly via the filesystem protocol (file:///...) broke session continuity[cite: 10, 12]. Browsers treat local file: paths as opaque unique security origins, blocking shared localStorage state across different pages (login.html and index.html) and causing recurring 401 Unauthorized errors[cite: 10, 12].
- **The Solution:** We eliminated ad-hoc filesystem execution by standardizing on a local HTTP server workflow (via VS Code Live Server / http-server). Additionally, an Auth Guard architecture was integrated across all frontend controllers:
  const token = localStorage.getItem("token");
  if (!token) {
  window.location.replace("login.html");
  }
  All outgoing asynchronous fetch requests were refactored through a centralized getAuthHeaders() utility injecting the Bearer token. Any upstream 401 or 403 status automatically evicts expired tokens and seamlessly reroutes the client back to the authentication screen.

---

## 📸 Application Screenshots

![Main Page](./Image/image.png)

![Table](./Image/image2.png)
