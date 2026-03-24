const form = document.getElementById("loginForm");
const error = document.getElementById("error");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  error.textContent = "";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    error.textContent = "Email and password are required.";
    return;
  }

  try {
    const res = await fetch(`${AUTH_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) {
      error.textContent = data.message || "Invalid credentials.";
      return;
    }

    localStorage.setItem("token", data.token);
    window.location.href = "../pages/marketplace.html";
  } catch (err) {
    error.textContent = "Unable to reach the server. Please try again.";
  }
});
