// This page is only for farmers. It shows the products they have listed.

const productsToken = getToken ? getToken() : localStorage.getItem("token");
if (!productsToken) {
  window.location.href = "../login/login.html";
}
const productsUser = window.currentUser || (getUserFromToken ? getUserFromToken() : null);
if (!productsUser) {
  localStorage.removeItem("token");
  window.location.href = "../login/login.html";
}
const productsRole = productsUser?.role || "buyer";

let products = [];

document.addEventListener("DOMContentLoaded", () => {
  if (productsRole !== "farmer") {
    const tbody = document.getElementById("products-body");
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="5">This page is for farmers only.</td></tr>';
    }
    return;
  }
  loadProducts();
});

async function loadProducts() {
  const tbody = document.getElementById("products-body");
  if (tbody) tbody.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';

  try {
    const res = await fetch(`${API_BASE}/listings`, {
      headers: { Authorization: `Bearer ${productsToken}` }
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Failed to load listings");
    }
    const data = await res.json();
    const myId = String(productsUser?.id || productsUser?._id || "");
    // Only keep listings that belong to this farmer
    products = (data || []).filter((l) => String(l.farmer?._id || l.farmer) === myId);
  } catch (err) {
    console.error(err);
    products = [];
  }

  renderProducts();
}

// Draw the products table on screen
function renderProducts() {
  const tbody = document.getElementById("products-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!products.length) {
    tbody.innerHTML = '<tr><td colspan="5">No products yet.</td></tr>';
    return;
  }

  products.forEach((prod) => {
    const row = document.createElement("tr");
    const location = [prod.district, prod.region].filter(Boolean).join(" (") + (prod.region ? ")" : "");
    const cells = [
      prod.crop,
      `UGX ${Number(prod.pricePerUnit || prod.price || 0).toLocaleString()}/kg`,
      location,
      prod.status || "Active"
    ];

    cells.forEach((val) => {
      const td = document.createElement("td");
      td.textContent = val;
      row.appendChild(td);
    });

    const actionTd = document.createElement("td");
    const btn = document.createElement("button");
    btn.className = "btn btn-outline btn-sm";
    btn.textContent = "Delete";
    btn.onclick = () => deleteProduct(prod.id || prod._id);
    actionTd.appendChild(btn);
    row.appendChild(actionTd);
    tbody.appendChild(row);
  });
}

// Remove a product from the table when the farmer clicks Delete
function deleteProduct(id) {
  products = products.filter((p) => String(p.id || p._id) !== String(id));
  renderProducts();
}
