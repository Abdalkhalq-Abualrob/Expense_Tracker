const token = localStorage.getItem("token");
if (!token) {
  window.location.replace("login.html");
}

const API_BASE_URL = "http://localhost:3000/api";

const loadingElem = document.getElementById("profile-loading");
const contentElem = document.getElementById("profile-content");
const alertElem = document.getElementById("profile-alert");
const editForm = document.getElementById("edit-profile-form");
const nameInput = document.getElementById("edit-name");
const emailInput = document.getElementById("edit-email");
const dateInput = document.getElementById("profile-date");
const currentPasswordInput = document.getElementById("current-password");
const newPasswordInput = document.getElementById("new-password");
const countElem = document.getElementById("profile-count");
const spentElem = document.getElementById("profile-spent");
const saveBtn = document.getElementById("save-profile-btn");
const logoutBtn = document.getElementById("logout-btn");

function showAlert(message, type = "danger") {
  alertElem.className = `alert alert-${type} py-2`;
  alertElem.textContent = message;
  alertElem.classList.remove("d-none");
}

function hideAlert() {
  alertElem.classList.add("d-none");
}

logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.replace("login.html");
});

async function loadProfile() {
  hideAlert();
  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.replace("login.html");
      return;
    }

    const data = await response.json();

    nameInput.value = data.user.full_name;
    emailInput.value = data.user.email;
    dateInput.value = data.user.created_at;
    countElem.textContent = data.stats.total_expenses_count;
    spentElem.textContent = `$${Number(data.stats.total_spent).toFixed(2)}`;

    loadingElem.classList.add("d-none");
    contentElem.classList.remove("d-none");
  } catch (error) {
    showAlert("Failed to load profile data.");
  }
}

editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert();

  const full_name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const current_password = currentPasswordInput.value;
  const new_password = newPasswordInput.value;

  if (!full_name || !email) {
    showAlert("Name and Email are required.");
    return;
  }

  const payload = { full_name, email };
  if (new_password) {
    if (!current_password) {
      showAlert("Current password is required to set a new password.");
      return;
    }
    payload.current_password = current_password;
    payload.new_password = new_password;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";

  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to update profile");
    }

    // update token and user data in local storage
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));

    showAlert("Profile updated successfully!", "success");
    currentPasswordInput.value = "";
    newPasswordInput.value = "";
  } catch (error) {
    showAlert(error.message, "danger");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Changes";
  }
});

document.addEventListener("DOMContentLoaded", loadProfile);
