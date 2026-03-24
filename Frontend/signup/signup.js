const role = document.getElementById("role");
const extraField = document.getElementById("extraField");
const form = document.getElementById("signupForm");
const error = document.getElementById("error");

role.addEventListener("change", () => {
    if (role.value === "school" || role.value === "institution") {
        extraField.classList.remove("hidden");
    } else {
        extraField.classList.add("hidden");
    }
});

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    error.textContent = "";

    const payload = {
        name: document.getElementById("name").value.trim(),
        location: document.getElementById("location").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        email: document.getElementById("email").value.trim(),
        role: role.value,
        extraInfo: document.getElementById("extraInfo").value.trim(),
        password: document.getElementById("password").value
    };

    if (!payload.email) {
        error.textContent = "Email is required.";
        return;
    }
    if (!payload.password || payload.password.length < 6) {
        error.textContent = "Password must be at least 6 characters.";
        return;
    }

    try {
        const res = await fetch(`${AUTH_BASE}/signup`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!res.ok) {
            error.textContent = data.message || "Could not create account.";
            return;
        }

        error.textContent = "Account created! Redirecting to login...";
        setTimeout(() => {
            window.location.href = "../login/login.html";
        }, 800);

    } catch (err) {
        error.textContent = "Something went wrong. Please try again.";
    }
});
