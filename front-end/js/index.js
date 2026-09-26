const token = localStorage.getItem("token");
if (!token) {
  window.location.replace("login.html");
}

const API_URL = "http://localhost:3000/api/expenses";

let allExpenses = [];
let expenseChartInstance = null;
let alertTimeout = null;

// Dom elements
const themeToggleBtn = document.getElementById("theme-toggle");
const expenseForm = document.getElementById("expense-form");
const titleInput = document.getElementById("title");
const amountInput = document.getElementById("amount");
const categorySelect = document.getElementById("category");
const dateInput = document.getElementById("date");

// Elements for filter, table, stats, loading, alert
const filterCategory = document.getElementById("filter-category");
const expensesTableBody = document.getElementById("expenses-table-body");
const totalAmountElem = document.getElementById("total-amount");
const totalCountElem = document.getElementById("total-count");
const highestExpenseElem = document.getElementById("highest-expense");
const spinner = document.getElementById("loading-spinner");
const alertBox = document.getElementById("alert-box");

// Modal elements
const editModalElement = document.getElementById("editModal");
const editModal = new bootstrap.Modal(editModalElement);
const editForm = document.getElementById("edit-form");
const editIdInput = document.getElementById("edit-id");
const editTitleInput = document.getElementById("edit-title");
const editAmountInput = document.getElementById("edit-amount");
const editCategorySelect = document.getElementById("edit-category");
const editDateInput = document.getElementById("edit-date");

function getAuthHeaders() {
  const currentToken = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${currentToken}`,
  };
}

function handleUnauthorized() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.replace("login.html");
}

function setupUserSessionUI() {
  const userJson = localStorage.getItem("user");
  if (userJson) {
    try {
      const user = JSON.parse(userJson);
      const userDisplayElem = document.getElementById("user-display-name");
      if (userDisplayElem) {
        userDisplayElem.textContent = user.full_name || user.email;
      }
    } catch (e) {
      console.error("Error parsing user data:", e);
    }
  }

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.replace("login.html");
    });
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem("app_theme") || "light";
  document.documentElement.setAttribute("data-bs-theme", savedTheme);
  updateThemeButton(savedTheme);
}

function updateThemeButton(theme) {
  themeToggleBtn.textContent =
    theme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode";
}

themeToggleBtn.addEventListener("click", () => {
  const currentTheme = document.documentElement.getAttribute("data-bs-theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-bs-theme", newTheme);
  localStorage.setItem("app_theme", newTheme);
  updateThemeButton(newTheme);
});

function showAlert(message, type = "danger") {
  if (alertTimeout) {
    clearTimeout(alertTimeout);
  }

  alertBox.className = `alert alert-${type} alert-dismissible fade show`;
  alertBox.innerHTML = `
    <span>${message}</span>
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  alertBox.classList.remove("d-none");

  alertTimeout = setTimeout(() => {
    alertBox.classList.add("d-none");
    alertBox.innerHTML = "";
  }, 6000);
}

function updateStats(expenses) {
  const count = expenses.length;
  totalCountElem.textContent = count;

  if (count === 0) {
    totalAmountElem.textContent = "$0.00";
    highestExpenseElem.textContent = "$0.00";
    renderChart([]);
    return;
  }

  const total = expenses.reduce((sum, item) => sum + Number(item.amount), 0);
  const highest = Math.max(...expenses.map((item) => Number(item.amount)));

  totalAmountElem.textContent = `$${total.toFixed(2)}`;
  highestExpenseElem.textContent = `$${highest.toFixed(2)}`;

  renderChart(expenses);
}

function renderChart(expenses) {
  const ctx = document.getElementById("expense-chart").getContext("2d");

  const categoryTotals = {};
  expenses.forEach((item) => {
    const cat = item.category;
    categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(item.amount);
  });

  const labels = Object.keys(categoryTotals);
  const data = Object.values(categoryTotals);

  if (expenseChartInstance) {
    expenseChartInstance.destroy();
  }

  if (labels.length === 0) {
    return;
  }

  expenseChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: labels,
      datasets: [
        {
          data: data,
          backgroundColor: [
            "#0d6efd",
            "#198754",
            "#ffc107",
            "#dc3545",
            "#6f42c1",
          ],
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
        },
      },
    },
  });
}

function renderTable(expenses) {
  expensesTableBody.innerHTML = "";

  if (expenses.length === 0) {
    expensesTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted py-4">No expenses found.</td>
      </tr>
    `;
    return;
  }

  expenses.forEach((expense, index) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td class="ps-3">${index + 1}</td>
      <td class="fw-semibold">${expense.title}</td>
      <td>$${Number(expense.amount).toFixed(2)}</td>
      <td><span class="badge bg-secondary">${expense.category}</span></td>
      <td>${expense.date}</td>
      <td class="text-end pe-3">
        <button class="btn btn-sm btn-outline-warning me-1 edit-btn" data-id="${expense.id}">Edit</button>
        <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${expense.id}">Delete</button>
      </td>
    `;

    expensesTableBody.appendChild(row);
  });

  attachTableEvents();
}

function applyFilter() {
  const selectedCategory = filterCategory.value;
  const filtered =
    selectedCategory === "All"
      ? allExpenses
      : allExpenses.filter((item) => item.category === selectedCategory);

  renderTable(filtered);
  updateStats(filtered);
}

function attachTableEvents() {
  document.querySelectorAll(".delete-btn").forEach((button) => {
    button.addEventListener("click", async (e) => {
      const id = e.target.getAttribute("data-id");
      if (confirm("Are you sure you want to delete this expense?")) {
        await deleteExpense(id);
      }
    });
  });

  document.querySelectorAll(".edit-btn").forEach((button) => {
    button.addEventListener("click", (e) => {
      const id = Number(e.target.getAttribute("data-id"));
      const expense = allExpenses.find((item) => item.id === id);
      if (expense) {
        openEditModal(expense);
      }
    });
  });
}

function openEditModal(expense) {
  editIdInput.value = expense.id;
  editTitleInput.value = expense.title;
  editAmountInput.value = expense.amount;
  editCategorySelect.value = expense.category;
  editDateInput.value = expense.date;
  editModal.show();
}

async function fetchExpenses() {
  spinner.classList.remove("d-none");
  alertBox.classList.add("d-none");

  try {
    const response = await fetch(API_URL, {
      headers: getAuthHeaders(),
    });

    if (response.status === 401 || response.status === 403) {
      handleUnauthorized();
      return;
    }

    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }

    allExpenses = await response.json();
    applyFilter();
  } catch (error) {
    console.error("Connection error:", error);
    allExpenses = [];
    renderTable([]);
    updateStats([]);

    if (error.name === "TypeError" || error.message.includes("fetch")) {
      showAlert(
        "<strong>Server Disconnected:</strong> Could not connect to the backend server. Please verify that the server is running on http://localhost:3000.",
        "danger",
      );
    } else {
      showAlert(`<strong>Error:</strong> ${error.message}`, "danger");
    }
  } finally {
    spinner.classList.add("d-none");
  }
}

async function addExpense(expenseData) {
  spinner.classList.remove("d-none");
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(expenseData),
    });

    if (response.status === 401 || response.status === 403) {
      handleUnauthorized();
      return;
    }

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Failed to add expense");
    }

    showAlert("Expense added successfully!", "success");
    expenseForm.reset();
    setDefaultDate();
    await fetchExpenses();
  } catch (error) {
    showAlert(error.message);
  } finally {
    spinner.classList.add("d-none");
  }
}

async function updateExpense(id, updatedData) {
  spinner.classList.remove("d-none");
  try {
    const response = await fetch(`${API_URL}/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(updatedData),
    });

    if (response.status === 401 || response.status === 403) {
      handleUnauthorized();
      return;
    }

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Failed to update expense");
    }

    showAlert("Expense updated successfully!", "success");
    editModal.hide();
    await fetchExpenses();
  } catch (error) {
    showAlert(error.message);
  } finally {
    spinner.classList.add("d-none");
  }
}

async function deleteExpense(id) {
  spinner.classList.remove("d-none");
  try {
    const response = await fetch(`${API_URL}/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    if (response.status === 401 || response.status === 403) {
      handleUnauthorized();
      return;
    }

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Failed to delete expense");
    }

    showAlert("Expense deleted successfully!", "success");
    await fetchExpenses();
  } catch (error) {
    showAlert(error.message);
  } finally {
    spinner.classList.add("d-none");
  }
}

function setDefaultDate() {
  const today = new Date().toISOString().split("T")[0];
  dateInput.value = today;
}

filterCategory.addEventListener("change", applyFilter);

expenseForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const title = titleInput.value.trim();
  const amount = parseFloat(amountInput.value);
  const category = categorySelect.value;
  const date = dateInput.value;

  if (!title || isNaN(amount) || amount <= 0 || !category || !date) {
    showAlert("Please fill in all fields with valid data.");
    return;
  }

  await addExpense({ title, amount, category, date });
});

editForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = editIdInput.value;
  const title = editTitleInput.value.trim();
  const amount = parseFloat(editAmountInput.value);
  const category = editCategorySelect.value;
  const date = editDateInput.value;

  if (!title || isNaN(amount) || amount <= 0 || !category || !date) {
    showAlert("Please fill in all edit fields with valid data.");
    return;
  }

  await updateExpense(id, { title, amount, category, date });
});

document.addEventListener("DOMContentLoaded", () => {
  setupUserSessionUI();
  initTheme();
  setDefaultDate();
  fetchExpenses();
});
