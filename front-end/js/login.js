const API_BASE_URL = "http://localhost:3000/api";

if (localStorage.getItem("token")) {
  window.location.replace("index.html");
}

const loginForm = document.getElementById("login-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const submitBtn = document.getElementById("submit-btn");
const errorAlert = document.getElementById("error-alert");

function showAlert(message) {
  errorAlert.textContent = message;
  errorAlert.classList.remove("d-none");
}

function hideAlert() {
  errorAlert.textContent = "";
  errorAlert.classList.add("d-none");
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  let isValid = true;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    emailInput.classList.add("is-invalid");
    isValid = false;
  } else {
    emailInput.classList.remove("is-invalid");
  }

  if (!password) {
    passwordInput.classList.add("is-invalid");
    isValid = false;
  } else {
    passwordInput.classList.remove("is-invalid");
  }

  if (!isValid) return;

  submitBtn.disabled = true;
  submitBtn.textContent = "Signing in...";

  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to log in");
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));

    window.location.replace("index.html");
  } catch (error) {
    showAlert(error.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Sign In";
  }
});

emailInput.addEventListener("input", () =>
  emailInput.classList.remove("is-invalid"),
);
passwordInput.addEventListener("input", () =>
  passwordInput.classList.remove("is-invalid"),
);
