// This file powers the marketplace page where buyers browse farm produce.
// It loads listings from the server. If the server is down it shows demo data.

const marketplaceToken = getToken ? getToken() : localStorage.getItem("token");
if (!marketplaceToken) {
  window.location.href = "../login/login.html";
}
const marketplaceUser = window.currentUser || (getUserFromToken ? getUserFromToken() : null);
if (!marketplaceUser) {
  localStorage.removeItem("token");
  window.location.href = "../login/login.html";
}
const role = marketplaceUser?.role || "buyer";
const authHeaders = { Authorization: `Bearer ${marketplaceToken}` };

let activeListingId = null;
let activeListingData = null;
let currentListings = [];

// Sample listings shown when the API server is not reachable
const fallbackListings = [
  {
    id: 1,
    crop: "Maize",
    pricePerUnit: 2200,
    quantity: 800,
    harvestDate: "2026-04-10",
    district: "Luwero",
    region: "Central",
    farmerName: "Grace N.",
    farmer: "farmer-demo-1",
    phone: "+256700000111",
    description: "Clean dry maize ready for delivery"
  },
  {
    id: 2,
    crop: "Beans",
    pricePerUnit: 3500,
    quantity: 500,
    harvestDate: "2026-04-03",
    district: "Mbarara",
    region: "Western",
    farmerName: "Sam K.",
    farmer: "farmer-demo-2",
    phone: "+256700000222",
    description: "Nambale beans, bagged and sorted"
  },
  {
    id: 3,
    crop: "Tomatoes",
    pricePerUnit: 2800,
    quantity: 300,
    harvestDate: "2026-03-30",
    district: "Mbale",
    region: "Eastern",
    farmerName: "Hope T.",
    farmer: "farmer-demo-3",
    phone: "+256700000333",
    description: "Fresh tomatoes harvested today"
  }
];

const safeText = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(initMarketplace, 40);
});

function initMarketplace() {
  if (role === "farmer") {
    document.querySelectorAll(".buyer-only").forEach((el) => (el.style.display = "none"));
  }

  const grid = document.getElementById("cards-grid");
  const resultsInfo = document.getElementById("results-info");
  const searchInput = document.getElementById("search");
  const cropSelect = document.getElementById("filter-crop");
  const regionSelect = document.getElementById("filter-region");
  const priceInput = document.getElementById("filter-price");
  const sortSelect = document.getElementById("filter-sort");
  const resetBtn = document.getElementById("reset-btn");

  if (!grid) return;

  const refresh = () => loadAndRender({ grid, resultsInfo, searchInput, cropSelect, regionSelect, priceInput, sortSelect });
  refresh();

  searchInput?.addEventListener("input", refresh);
  cropSelect?.addEventListener("change", refresh);
  regionSelect?.addEventListener("change", refresh);
  priceInput?.addEventListener("input", refresh);
  sortSelect?.addEventListener("change", refresh);

  resetBtn?.addEventListener("click", () => {
    searchInput.value = "";
    cropSelect.value = "";
    regionSelect.value = "";
    priceInput.value = "";
    sortSelect.value = "";
    refresh();
  });
}

// Fetch listings from the server then draw the product cards on screen
async function loadAndRender(ui) {
  const { grid, resultsInfo, searchInput, cropSelect, regionSelect, priceInput, sortSelect } = ui;
  grid.innerHTML = '<div class="loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading listings...</div>';
  resultsInfo.textContent = "";
  resultsInfo.classList.remove("error-text");

  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.append("search", searchInput.value.trim());
  if (cropSelect.value) params.append("crop", cropSelect.value);
  if (regionSelect.value) params.append("region", regionSelect.value);
  if (sortSelect.value) params.append("sort", sortSelect.value);

  let listings = [];
  let usedFallback = false;
  try {
    const res = await fetch(`${API_BASE}/listings?${params.toString()}`, {
      headers: { ...authHeaders }
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Unable to load listings");
    }
    listings = await res.json();
  } catch (err) {
    console.warn("Using fallback listings because the API is not reachable.", err);
    listings = fallbackListings;
    usedFallback = true;
    resultsInfo.textContent = "Using demo data because the API is unavailable.";
    resultsInfo.classList.add("error-text");
  }

  // Clean up the data so it has consistent field names regardless of what the server sends
  listings = (Array.isArray(listings) ? listings : []).map((l) => ({
    ...l,
    id: l.id || l._id,
    farmer: l.farmer?._id || l.farmerId || l.farmer,
    farmerName: l.farmerName || l.farmer?.name || l.farmer?.fullName || l.name,
    pricePerUnit: Number(l.pricePerUnit || l.price || 0)
  }));

  // Remove listings that cost more than the user typed in the price box
  const maxPrice = Number(priceInput.value);
  if (maxPrice > 0) {
    listings = listings.filter((l) => Number(l.pricePerUnit) <= maxPrice);
  }

  // Sort the results on our side so the order is consistent
  if (sortSelect.value === "price_asc") {
    listings.sort((a, b) => a.pricePerUnit - b.pricePerUnit);
  } else if (sortSelect.value === "price_desc") {
    listings.sort((a, b) => b.pricePerUnit - a.pricePerUnit);
  } else if (sortSelect.value === "harvest_soon") {
    listings.sort((a, b) => new Date(a.harvestDate) - new Date(b.harvestDate));
  } else if (sortSelect.value === "quantity_desc") {
    listings.sort((a, b) => b.quantity - a.quantity);
  }

  currentListings = listings;
  resultsInfo.textContent = `${listings.length} listing${listings.length === 1 ? "" : "s"} found${usedFallback ? " (demo data)" : ""}`;

  grid.innerHTML = listings.length
    ? listings.map((l) => buildCard(l)).join("")
    : `<div class="empty-state full-span">
         <div class="empty-icon"><i class="fa-regular fa-face-frown"></i></div>
         <h3>No listings found</h3>
         <p>Try adjusting your filters.</p>
       </div>`;
}

// Turn one listing object into an HTML card string
function buildCard(listing) {
  const price = Number(listing.pricePerUnit).toLocaleString();
  const cropIcon = '<i class="fa-solid fa-seedling"></i>';
  const farmerName = safeText(listing.farmerName);
  const district = safeText(listing.district);
  const region = safeText(listing.region);
  const crop = safeText(listing.crop);
  const description = safeText(listing.description);

  return `
    <div class="payment--card product-card" id="card-${listing.id}">
      <div class="card--header">
        <div class="amount">
          <span class="title">${cropIcon} ${crop}</span>
          <span class="amount--value">UGX ${price}/kg</span>
        </div>
        <span class="badge">${region}</span>
      </div>
      <span class="card-detail">${district} • ${farmerName}</span>
      <p class="card-detail">${description}</p>
      <div class="card-detail"><strong>Available:</strong> ${Number(listing.quantity || 0).toLocaleString()} kg</div>
      <div class="card--header">
        <button class="btn btn-primary btn-sm btn-full" onclick="openDetails('${listing.id}')">View Details</button>
        <button class="btn btn-outline btn-sm buyer-only" onclick="startConversation('${listing.id}')" title="Message this farmer"><i class="fa-solid fa-message"></i> Message</button>
      </div>
    </div>`;
}

// Open the detail popup when the user clicks "View Details" on a card
function openDetails(id) {
  const listing = currentListings.find((l) => l.id == id || l._id == id);
  const fetchListing = listing
    ? Promise.resolve(listing)
    : fetch(`${API_BASE}/listings/${id}`, { headers: { ...authHeaders } })
        .then(async (r) => {
          if (!r.ok) {
            const err = await r.json();
            throw new Error(err.message || "Unable to load listing");
          }
          return r.json();
        })
        .catch(() => null);

  fetchListing.then((data) => {
    if (!data) return;
    activeListingData = {
      id: data.id || data._id,
      crop: data.crop
    };
    activeListingId = activeListingData.id;

    const price = Number(data.pricePerUnit).toLocaleString();
    const total = (Number(data.quantity || 0) * Number(data.pricePerUnit || 0)).toLocaleString();
    const harvest = data.harvestDate
      ? new Date(data.harvestDate).toLocaleDateString("en-UG", { year: "numeric", month: "long", day: "numeric" })
      : "Not set";
    const farmerName = safeText(data.farmerName || data.farmer?.name || "");
    const district = safeText(data.district || "");
    const region = safeText(data.region || "");
    const phone = safeText(data.phone || "");
    const description = safeText(data.description || "No description");
    const cropTitle = safeText(data.crop || "Listing");

    document.getElementById("detail-title").textContent = cropTitle;
    document.getElementById("detail-body").innerHTML = `
      <div class="detail-meta-grid">
        <div class="meta-box"><div class="meta-label">Price per kg</div><div class="meta-value price">UGX ${price}</div></div>
        <div class="meta-box"><div class="meta-label">Available qty</div><div class="meta-value">${Number(data.quantity || 0).toLocaleString()} kg</div></div>
        <div class="meta-box"><div class="meta-label">Total value</div><div class="meta-value">UGX ${total}</div></div>
        <div class="meta-box"><div class="meta-label">Harvest date</div><div class="meta-value">${harvest}</div></div>
      </div>
      <div class="card-info-line"><span class="info-label">Farmer:</span><span class="info-value">${farmerName}</span></div>
      <div class="card-info-line"><span class="info-label">Location:</span><span class="info-value">${district} District, ${region}</span></div>
      <div class="card-info-line"><span class="info-label">Contact:</span><span class="info-value"><a href="tel:${phone}">${phone}</a></span></div>
      <p class="product-desc">${description}</p>
    `;

    const msgBtn = document.getElementById("detail-save-btn");
    if (msgBtn) {
      if (role === "farmer") {
        msgBtn.style.display = "none";
      } else {
        msgBtn.innerHTML = '<i class="fa-solid fa-message"></i> Message Farmer';
        msgBtn.onclick = () => {
          closeDetails();
          startConversation(data.id || data._id);
        };
      }
    }

    const reqBtn = document.getElementById("detail-request-btn");
    if (reqBtn) {
      if (role === "farmer") {
        reqBtn.style.display = "none";
      } else {
        reqBtn.style.display = "block";
        reqBtn.onclick = () => {
          closeDetails();
          openModal(data.id || data._id, data.crop, data.farmerName);
        };
      }
    }

    document.getElementById("details-modal").style.display = "flex";
  });
}

function closeDetails() {
  const modal = document.getElementById("details-modal");
  if (modal) modal.style.display = "none";
}

// When the buyer clicks "Message", save the farmer's info then go to messages page
function startConversation(listingId) {
  const listing = currentListings.find((l) => l.id == listingId || l._id == listingId);
  if (!listing) {
    showToast("Could not find listing details.");
    return;
  }
  const payload = {
    partnerId: listing.farmer || listing.farmerId || String(listing.id),
    name:      listing.farmerName || "Farmer",
    crop:      listing.crop || ""
  };
  sessionStorage.setItem("pendingConvo", JSON.stringify(payload));
  window.location.href = "messages.html";
}

// Open the "Request to Buy" popup for a specific listing
function openModal(listingId, crop, farmerName) {
  activeListingId = listingId;
  activeListingData = { ...(activeListingData || {}), crop };
  const subtitle = document.getElementById("modal-subtitle");
  if (subtitle) subtitle.textContent = `${crop || ""} from ${farmerName || ""}`;
  const errBox = document.getElementById("req-error");
  if (errBox) errBox.textContent = "";
  document.getElementById("request-modal").style.display = "flex";
}

function closeModal() {
  document.getElementById("request-modal").style.display = "none";
  activeListingId = null;
}

// Send the buyer's purchase request to the server
async function submitRequest() {
  const qty = Number(document.getElementById("req-quantity").value);
  const msg = document.getElementById("req-message").value;
  const errBox = document.getElementById("req-error");
  if (errBox) errBox.textContent = "";

  if (!qty || qty < 1) {
    setRequestError("Please enter a quantity greater than 0.");
    return;
  }
  if (!activeListingId) {
    setRequestError("Please select a listing first.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({
        listingId: activeListingId,
        quantity: qty,
        message: msg
      })
    });

    const payload = await res.json();
    if (!res.ok) throw new Error(payload.message || "Could not save request");

    closeModal();
    document.getElementById("req-quantity").value = "";
    document.getElementById("req-message").value = "";
    showToast("Request sent! Check 'My Requests' to track it.");
  } catch (err) {
    setRequestError(err.message || "Failed to send request. Please try again.");
  }
}

function setRequestError(text) {
  const errBox = document.getElementById("req-error");
  if (errBox) {
    errBox.textContent = text;
  } else {
    showToast(text);
  }
}
