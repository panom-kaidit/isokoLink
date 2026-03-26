// This file handles the requests page for both buyers and farmers.
// Buyers see the requests they sent. Farmers see requests they received.

const requestsToken = getToken ? getToken() : localStorage.getItem("token");
if (!requestsToken) {
  window.location.href = "../login/login.html";
}
const requestsUser = window.currentUser || (getUserFromToken ? getUserFromToken() : null);
if (!requestsUser) {
  localStorage.removeItem("token");
  window.location.href = "../login/login.html";
}
const role = requestsUser?.role || "buyer";
const isFarmer = role === "farmer";
const reqAuthHeaders = { Authorization: `Bearer ${requestsToken}` };

let requestsData = [];
let viewMode = "cards";

// Listen for live request updates so status changes appear without a refresh
const socket = io(window.location.hostname === "localhost"
  ? "http://localhost:5000"
  : window.location.origin);

socket.on("connect", () => {
  const id = String(requestsUser?.id || requestsUser?._id || "");
  if (id) socket.emit("register", id);
});

socket.on("request:update", (payload) => {
  // Refetch to keep the UI consistent (filters, sorting, etc.)
  fetchRequests();
  if (payload?.action === "created" && role === "farmer") {
    showToast("New request received");
  }
  if (payload?.action === "status" && role === "buyer") {
    showToast(`Request updated to ${payload.data?.status || "Updated"}`);
  }
});

// Clean any text before putting it on the page so it cannot break the layout
const safeText = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

document.addEventListener("DOMContentLoaded", () => {
  applyRoleVisibility();
  fetchRequests();
});

function applyRoleVisibility() {
  if (role === "farmer") {
    document.querySelectorAll(".buyer-only").forEach((el) => (el.style.display = "none"));
  } else {
    document.querySelectorAll(".farmer-only").forEach((el) => (el.style.display = "none"));
  }
}

async function fetchRequests() {
  const container = document.getElementById("requests-container");
  if (container) container.innerHTML = '<div class="loading">Loading your requests...</div>';
  const alertBox = document.getElementById("req-alert");
  if (alertBox) {
    alertBox.textContent = "";
    alertBox.classList.add("hidden");
  }

  try {
    const res = await fetch(`${API_BASE}/requests`, { headers: { ...reqAuthHeaders } });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Server error");
    }
    const payload = await res.json();
    requestsData = payload.data || payload || [];
  } catch (err) {
    console.warn("Using empty list because API failed", err);
    requestsData = [];
    showAlert("Could not load requests from the server.");
  }
  renderRequests();
}

function filterRequests() {
  renderRequests();
}

function setView(mode) {
  viewMode = mode;
  const cardsBtn = document.getElementById("view-cards-btn");
  const tableBtn = document.getElementById("view-table-btn");
  if (cardsBtn && tableBtn) {
    cardsBtn.classList.toggle("btn-outline", mode !== "cards");
    tableBtn.classList.toggle("btn-outline", mode !== "table");
  }
  renderRequests();
}

// Apply the current filters and draw the results on screen
function renderRequests() {
  const container = document.getElementById("requests-container");
  if (!container) return;

  const statusFilter = document.getElementById("status-filter").value;
  const sort = document.getElementById("sort-requests").value;

  let filtered = [...requestsData];
  if (statusFilter) filtered = filtered.filter((r) => r.status === statusFilter);
  if (sort === "oldest") filtered = filtered.reverse();

  if (!filtered.length) {
    container.innerHTML = '<div class="card-detail">No requests yet.</div>';
    return;
  }

  container.innerHTML = viewMode === "table" ? renderTable(filtered) : renderCards(filtered);
}

function renderCards(list) {
  return `
    <div class="card--wrapper">
      ${list
        .map(
          (req) => `
            <div class="payment--card">
              <div class="card--header">
                <div>
                  <div class="title">${safeText(req.crop || req.listingId?.crop || req.listingId)}</div>
                  <div class="card-detail">${req.quantity} kg</div>
                </div>
                <span class="badge">${req.status}</span>
              </div>
              <p class="card-detail">Buyer: ${safeText(req.buyer?.name || req.buyer || "")}</p>
              <p class="card-detail">Farmer: ${safeText(req.farmer?.name || req.farmer || "")}</p>
              ${isFarmer ? buildFarmerActions(req._id || req.id) : ""}
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderTable(list) {
  return `
    <div class="table-shell">
      <table class="table">
        <thead><tr><th>Product</th><th>Quantity</th><th>Status</th><th>Buyer</th>${isFarmer ? "<th>Actions</th>" : ""}</tr></thead>
        <tbody>
          ${list
            .map(
              (req) => `
                <tr>
                  <td>${safeText(req.crop || req.listingId?.crop || req.listingId)}</td>
                  <td>${req.quantity} kg</td>
                  <td>${req.status}</td>
                  <td>${safeText(req.buyer?.name || req.buyer || "")}</td>
                  ${isFarmer ? `<td>${buildFarmerActions(req._id || req.id)}</td>` : ""}
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function buildFarmerActions(id) {
  return `
    <div class="flex gap-10 farmer-only">
      <button class="btn btn-primary btn-sm" onclick="updateStatus('${id}', 'Accepted')">Accept</button>
      <button class="btn btn-outline btn-sm" onclick="updateStatus('${id}', 'Declined')">Reject</button>
    </div>
  `;
}

// Send the updated status (Accepted or Declined) to the server
async function updateStatus(id, newStatus) {
  try {
    const res = await fetch(`${API_BASE}/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...reqAuthHeaders },
      body: JSON.stringify({ status: newStatus })
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.message || "Update failed");
    requestsData = requestsData.map((r) => (r._id === id || r.id === id ? payload.data || payload : r));
    showAlert(`Request updated to ${newStatus}`);
    renderRequests();
  } catch (err) {
    showAlert(err.message || "Could not update request");
  }
}

function showAlert(text) {
  const alertBox = document.getElementById("req-alert");
  if (alertBox) {
    alertBox.textContent = text;
    alertBox.classList.remove("hidden");
  } else {
    showToast(text);
  }
}
