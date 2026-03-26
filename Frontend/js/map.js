// This file powers the map page using the Leaflet library.
// Buyers see farmer listings as pins. Farmers see both listings and buyer requests.

const mapToken = getToken ? getToken() : localStorage.getItem("token");
if (!mapToken) {
  window.location.href = "../login/login.html";
}
const mapUser = getUserFromToken ? getUserFromToken() : null;
if (!mapUser) {
  localStorage.removeItem("token");
  window.location.href = "../login/login.html";
}

// Use the role that layout.js already figured out. Fall back to the token if needed.
const role = window.currentRole || mapUser?.role || "buyer";
const isFarmerView = role === "farmer";

// Sample data used when the server cannot be reached
const mockListings = [
  { id: 1, name: "Grace N.", crop: "Maize",   quantity: 800, region: "Central", district: "Luwero", lat: 0.8402, lng: 32.4957 },
  { id: 2, name: "Sam K.",   crop: "Beans",   quantity: 500, region: "Western", district: "Mbarara", lat: -0.6072, lng: 30.6545 },
  { id: 3, name: "Hope T.",  crop: "Tomatoes",quantity: 300, region: "Eastern", district: "Mbale",   lat: 1.0827,  lng: 34.1750 }
];

const mockRequests = [
  { id: 11, buyer: "KCCA School", crop: "Maize", quantity: 200, region: "Central",  district: "Kampala", lat: 0.3476, lng: 32.5825 },
  { id: 12, buyer: "Market Hub",  crop: "Beans", quantity: 150, region: "Northern", district: "Gulu",    lat: 2.7724, lng: 32.2881 }
];

const safeText = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

document.addEventListener("DOMContentLoaded", () => {
  initMapPage();
});

// Set up the map, load data from the server, and draw pins
async function initMapPage() {
  const mapTitle     = document.getElementById("map-title");
  const mapSubtitle  = document.getElementById("map-subtitle");
  const mapCount     = document.getElementById("map-count");
  const listContainer = document.getElementById("map-list-items");

  if (!listContainer) return;

  // Show a different subtitle depending on whether the user is a farmer or buyer
  if (isFarmerView) {
    mapTitle.textContent    = "Map View (Farmer)";
    mapSubtitle.textContent = "See fellow farmers listing products and incoming buyer requests near you.";
  } else {
    mapTitle.textContent    = "Map View";
    mapSubtitle.textContent = "See nearby farmers and available produce.";
  }

  const map = L.map("leaflet-map").setView([0.3476, 32.5825], 7);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "© OpenStreetMap"
  }).addTo(map);

  const { farmerPins, buyerPins, usedFallback } = await loadMapData();

  // Farmers see all pins. Buyers only see farmer listing pins.
  const combined = isFarmerView ? [...farmerPins, ...buyerPins] : farmerPins;

  mapCount.textContent = `${combined.length} result${combined.length === 1 ? "" : "s"}`;
  if (usedFallback) mapCount.textContent += " (using demo data)";

  renderList(combined, listContainer, map);

  // Show a colour legend on the map so farmers can tell pin types apart
  if (isFarmerView) {
    renderLegend(map, farmerPins.length, buyerPins.length);
  }

  // Wire up the search and filter inputs
  const searchInput  = document.getElementById("map-search");
  const cropFilter   = document.getElementById("map-crop-filter");
  const regionFilter = document.getElementById("map-region-filter");

  const refresh = () => {
    const filtered = combined.filter((item) => {
      const label = (item.type === "buyer" ? item.buyer : item.name) || "";
      const matchesSearch = searchInput.value
        ? label.toLowerCase().includes(searchInput.value.toLowerCase()) ||
          (item.crop || "").toLowerCase().includes(searchInput.value.toLowerCase())
        : true;
      const matchesCrop   = cropFilter.value   ? item.crop   === cropFilter.value   : true;
      const matchesRegion = regionFilter.value ? item.region === regionFilter.value : true;
      return matchesSearch && matchesCrop && matchesRegion;
    });

    mapCount.textContent = `${filtered.length} result${filtered.length === 1 ? "" : "s"}`;
    if (usedFallback) mapCount.textContent += " (using demo data)";
    renderList(filtered, listContainer, map);
  };

  searchInput?.addEventListener("input",  refresh);
  cropFilter?.addEventListener("change",  refresh);
  regionFilter?.addEventListener("change", refresh);
}

// Fetch listings and requests from the server. Use mock data if either call fails.
async function loadMapData() {
  let listings = [];
  let requests  = [];
  let usedFallback = false;

  try {
    const res = await fetch(`${API_BASE}/listings`, {
      headers: { Authorization: `Bearer ${mapToken}` }
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Listings failed");
    }
    const rawListings = await res.json();
    listings = Array.isArray(rawListings) ? rawListings : (rawListings.data || rawListings.listings || []);
  } catch (err) {
    console.warn("Using mock listings for map", err);
    listings = mockListings;
    usedFallback = true;
  }

  // Requests are only needed on the farmer view
  if (isFarmerView) {
    try {
      const res = await fetch(`${API_BASE}/requests`, {
        headers: { Authorization: `Bearer ${mapToken}` }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Requests failed");
      }
      const raw = await res.json();
      // The server sometimes wraps the array inside { data: [...] } or { requests: [...] }
      requests = Array.isArray(raw) ? raw : (raw.data || raw.requests || []);
    } catch (err) {
      console.warn("Using mock requests for map", err);
      requests = mockRequests;
      usedFallback = true;
    }
  }

  // Shape the data into a consistent format and remove items with no coordinates
  const farmerPins = listings
    .map((l) => ({
      id:       l.id || l._id,
      type:     "farmer",
      name:     l.farmerName || l.name || "Farmer",
      crop:     l.crop,
      quantity: l.quantity,
      region:   l.region,
      district: l.district,
      lat:      Number(l.lat || l.latitude  || 0),
      lng:      Number(l.lng || l.longitude || 0),
    }))
    .filter((i) => i.lat !== 0 && i.lng !== 0);

  const buyerPins = requests
    .map((r) => ({
      id:       r.id || r._id,
      type:     "buyer",
      buyer:    r.buyer?.name || r.buyer || r.name || "Buyer",
      crop:     r.crop,
      quantity: r.quantity,
      region:   r.region,
      district: r.district,
      lat:      Number(r.lat || r.latitude  || 0),
      lng:      Number(r.lng || r.longitude || 0),
    }))
    .filter((i) => i.lat !== 0 && i.lng !== 0);

  return { farmerPins, buyerPins, usedFallback };
}

// Draw the list cards on the left side and place a map pin for each item
function renderList(items, container, map) {
  container.innerHTML = "";

  if (!items.length) {
    container.innerHTML = `
      <div style="padding:20px;text-align:center;color:#666;font-size:0.9rem;">
        No results found. Try adjusting the filters.
      </div>`;
    return;
  }

  // Remove the previous set of pins so we do not stack them on every filter change
  if (map._markersLayer) map.removeLayer(map._markersLayer);
  const markerLayer = L.layerGroup().addTo(map);
  map._markersLayer = markerLayer;

  items.forEach((item) => {
    const isBuyer    = item.type === "buyer";
    const title      = safeText(isBuyer ? item.buyer : item.name);
    const crop       = safeText(item.crop || "—");
    const qty        = Number(item.quantity || 0).toLocaleString();
    const district   = safeText(item.district || "");
    const region     = safeText(item.region || "");

    // Green for farmers, orange for buyers so they are easy to tell apart
    const accentColor  = isBuyer ? "#e67e22" : "#2e7d32";
    const badgeColor   = isBuyer ? "#fff3e0" : "#e8f5e9";
    const badgeText    = isBuyer ? "🛒 Buyer Request" : "🌱 Farmer Listing"; // the imojies are named seedling and shoping card when you pres windows + (.)

    // Build the card element for the left panel list
    const card = document.createElement("div");
    card.style.cssText = `
      background: #fff;
      border: 1px solid #e0e0e0;
      border-left: 4px solid ${accentColor};
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 10px;
      cursor: pointer;
      transition: box-shadow 0.15s;
    `;

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px;">
        <span style="
          font-size:0.72rem;font-weight:600;letter-spacing:0.4px;
          background:${badgeColor};color:${accentColor};
          padding:2px 8px;border-radius:20px;white-space:nowrap;">
          ${badgeText}
        </span>
        <span style="font-size:0.78rem;color:#888;white-space:nowrap;">
          <i class="fa-solid fa-location-dot" style="color:${accentColor};"></i>
          ${district}${district && region ? ", " : ""}${region}
        </span>
      </div>

      <div style="font-weight:700;font-size:1rem;color:#1a1a1a;margin-bottom:2px;">
        ${title}
      </div>

      <div style="font-size:0.85rem;color:#555;margin-bottom:10px;">
        <i class="fa-solid fa-seedling" style="color:#2e7d32;margin-right:4px;"></i>
        <strong>${crop}</strong>
        &nbsp;•&nbsp;
        <i class="fa-solid fa-weight-scale" style="color:#888;margin-right:2px;"></i>
        ${qty} kg
      </div>

      <div style="display:flex;gap:8px;">
        <button
          data-action="focus"
          style="
            flex:1;padding:6px 10px;font-size:0.8rem;font-weight:600;
            background:#f5f5f5;color:#333;border:1px solid #ddd;
            border-radius:6px;cursor:pointer;">
          <i class="fa-solid fa-map-pin"></i> Show on Map
        </button>
        ${!isBuyer ? `
        <button
          data-action="message"
          data-partner-id="${safeText(String(item.id || ""))}"
          data-name="${title}"
          data-crop="${crop}"
          style="
            flex:1;padding:6px 10px;font-size:0.8rem;font-weight:600;
            background:#2e7d32;color:#fff;border:none;
            border-radius:6px;cursor:pointer;">
          <i class="fa-solid fa-message"></i> Message
        </button>` : ""}
      </div>
    `;

    // Add a shadow when the user hovers over a card
    card.addEventListener("mouseenter", () => {
      card.style.boxShadow = "0 4px 12px rgba(0,0,0,0.12)";
    });
    card.addEventListener("mouseleave", () => {
      card.style.boxShadow = "none";
    });

    // Handle button clicks inside the card
    card.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;

      if (btn.dataset.action === "focus") {
        map.setView([item.lat, item.lng], 12);
        marker.openPopup();
      }

      if (btn.dataset.action === "message") {
        startMapConversation(
          btn.dataset.partnerId,
          btn.dataset.name,
          btn.dataset.crop
        );
      }
    });

    container.appendChild(card);

    // Place a pin on the map for this item
    const markerOptions = isBuyer ? { icon: buyerIcon() } : {};
    const marker = L.marker([item.lat, item.lng], markerOptions).addTo(markerLayer);
    marker.bindPopup(`
      <div style="min-width:160px;font-family:sans-serif;">
        <div style="font-weight:700;font-size:0.95rem;margin-bottom:4px;">${title}</div>
        <div style="font-size:0.82rem;color:#555;margin-bottom:2px;">${badgeText}</div>
        <div style="font-size:0.82rem;margin-bottom:2px;">
          <strong>${crop}</strong> &bull; ${qty} kg
        </div>
        <div style="font-size:0.78rem;color:#888;margin-bottom:8px;">
          ${district}${district && region ? ", " : ""}${region}
        </div>
        ${!isBuyer ? `
        <button onclick="startMapConversation('${safeText(String(item.id || ""))}','${title}','${crop}')"
          style="width:100%;padding:5px 0;background:#2e7d32;color:#fff;border:none;
                 border-radius:5px;font-size:0.8rem;font-weight:600;cursor:pointer;">
          <i class='fa-solid fa-message'></i> Message Farmer
        </button>` : ""}
      </div>
    `);
  });
}

// Save the farmer's info and go to the messages page, same as the marketplace does
function startMapConversation(partnerId, name, crop) {
  if (!partnerId || partnerId === "undefined") {
    window.location.href = "messages.html";
    return;
  }
  sessionStorage.setItem("pendingConvo", JSON.stringify({ partnerId, name, crop }));
  window.location.href = "messages.html";
}

// Create a custom orange pin shape for buyer request markers
function buyerIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="
      background:#e67e22;
      width:24px;height:24px;
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      border:2px solid #fff;
      box-shadow:0 1px 3px rgba(0,0,0,.4);">
    </div>`,
    iconSize:   [24, 24],
    iconAnchor: [12, 24],
    popupAnchor:[0, -24],
  });
}

// Add a small legend in the corner so farmers know what each pin colour means
function renderLegend(map, farmerCount, buyerCount) {
  const legend = L.control({ position: "bottomright" });
  legend.onAdd = () => {
    const div = L.DomUtil.create("div");
    div.style.cssText =
      "background:#fff;padding:8px 12px;border-radius:6px;font-size:12px;line-height:1.8;box-shadow:0 1px 4px rgba(0,0,0,.25);";
    div.innerHTML = `
      <strong>Map Legend</strong><br/>
      <span style="color:#2a81cb">● Farmer listing</span> (${farmerCount})<br/>
      <span style="color:#e67e22">● Buyer request</span> (${buyerCount})
    `;
    return div;
  };
  legend.addTo(map);
}
