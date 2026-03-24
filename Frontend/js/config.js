// This file holds shared settings that every other JS file needs.
// It is loaded first on every page so these functions are always available.

// Check if we are running on our own computer or on a live server
const isLocal =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

// Use the local backend on port 5000 when developing on our computer,
// otherwise use the same server the website is hosted on
const API_BASE = isLocal
  ? "http://localhost:5000/api"
  : "/api";

const AUTH_BASE = `${API_BASE}/auth`;

// Read the login token that gets saved in the browser after the user signs in
function getToken() {
  return localStorage.getItem("token");
}

// Decode the token to get the user's info like their name, id, and role
function getUserFromToken() {
  const token = getToken();
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload; // { id, role, name }
  } catch {
    return null;
  }
}
