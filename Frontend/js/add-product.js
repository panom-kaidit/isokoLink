// This file runs on the Add Product page where farmers create new listings.
// It tries to get the farmer's GPS location. If that fails, it converts the
// district name they type into coordinates using the OpenStreetMap search API.

const addProdToken = getToken ? getToken() : localStorage.getItem("token");
if (!addProdToken) {
  window.location.href = "../login/login.html";
}
const addProdUser = window.currentUser || (getUserFromToken ? getUserFromToken() : null);
if (!addProdUser || addProdUser.role !== "farmer") {
  window.location.href = "../pages/marketplace.html";
}

// Look up coordinates for a place name using OpenStreetMap.
// Results are remembered in memory so we do not call the API twice for the same name.
const _geocodeCache = {};

async function getCoordinates(place) {
  const key = place.toLowerCase().trim();
  if (_geocodeCache[key]) return _geocodeCache[key];

  const query = encodeURIComponent(place);
  const url   = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;

  try {
    const res  = await fetch(url, { headers: { "User-Agent": "isokoLink-App" } });
    const data = await res.json();
    if (!data.length) return null;

    const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    _geocodeCache[key] = coords;   // save so we never look up the same place twice
    return coords;
  } catch (err) {
    console.warn("Nominatim geocode failed:", err.message);
    return null;
  }
}

// Store the GPS coordinates once we have them
let capturedLat = null;
let capturedLng = null;

const locationStatus = document.getElementById("location-status");

function setLocationStatus(msg, isError = false) {
  if (!locationStatus) return;
  locationStatus.textContent = msg;
  locationStatus.style.color = isError ? "#c0392b" : "#27ae60";
}

// Ask the browser for the farmer's location as soon as the page loads
function requestGPS() {
  if (!navigator.geolocation) {
    setLocationStatus("GPS not available — district name will be geocoded instead.", true);
    return;
  }
  setLocationStatus("Detecting your location...");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      capturedLat = pos.coords.latitude;
      capturedLng = pos.coords.longitude;
      setLocationStatus(
        "GPS location captured (" + capturedLat.toFixed(4) + ", " + capturedLng.toFixed(4) + ")"
      );
    },
    (err) => {
      console.warn("GPS denied:", err.message);
      setLocationStatus(
        "Location permission denied — your district will be geocoded automatically.",
        true
      );
    },
    { timeout: 8000, maximumAge: 60000 }
  );
}

requestGPS();

// As the farmer types their district name, look it up in the background
// so we can show them straight away whether it was found or not.
let districtPreviewTimeout = null;
const districtInput = document.getElementById("district");

districtInput && districtInput.addEventListener("input", function() {
  clearTimeout(districtPreviewTimeout);
  const val = districtInput.value.trim();
  if (!val || capturedLat) return;   // skip if GPS already captured

  districtPreviewTimeout = setTimeout(async function() {
    setLocationStatus('Looking up "' + val + '"...');
    const coords = await getCoordinates(val);
    if (coords) {
      setLocationStatus(
        '"' + val + '" found — (' + coords.lat.toFixed(4) + ', ' + coords.lng.toFixed(4) + ')'
      );
    } else {
      setLocationStatus(
        'Could not find "' + val + '" — check spelling or try a nearby town.',
        true
      );
    }
  }, 700);  // wait 700ms after the farmer stops typing before calling the API
});

// Handle the form when the farmer clicks Submit
const addForm   = document.getElementById("add-product-form");
const statusBox = document.getElementById("add-product-status");

addForm && addForm.addEventListener("submit", async function(e) {
  e.preventDefault();
  if (statusBox) statusBox.textContent = "";

  const district = document.getElementById("district").value.trim();
  const region   = document.getElementById("region").value.trim();

  // First choice: use the GPS coordinates we captured on page load
  let finalLat = capturedLat;
  let finalLng = capturedLng;

  // Second choice: convert the district name to coordinates if GPS was not available
  if (!finalLat || !finalLng) {
    if (statusBox) statusBox.textContent = "Resolving location...";
    const coords = await getCoordinates(district);
    if (coords) {
      finalLat = coords.lat;
      finalLng = coords.lng;
    } else {
      // No coordinates found, submit anyway and let the server try
      console.warn("Could not geocode district:", district);
    }
  }

  const payload = {
    crop:         document.getElementById("crop").value.trim(),
    pricePerUnit: Number(document.getElementById("price").value),
    quantity:     Number(document.getElementById("quantity").value),
    district,
    region,
    harvestDate:  document.getElementById("harvestDate").value || undefined,
    description:  document.getElementById("description").value.trim(),
    phone:        document.getElementById("phone").value.trim(),
    lat:          finalLat,
    lng:          finalLng
  };

  if (statusBox) statusBox.textContent = "Saving product...";

  try {
    const res = await fetch(API_BASE + "/listings", {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  "Bearer " + addProdToken
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Could not save product");

    if (statusBox) statusBox.textContent = "Product added! Redirecting...";
    setTimeout(function() { window.location.href = "products.html"; }, 800);
  } catch (err) {
    if (statusBox) statusBox.textContent = err.message || "Failed to add product";
  }
});
