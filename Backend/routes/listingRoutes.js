const express    = require("express");
const router     = express.Router();
const Listing    = require("../models/Listing");
const User       = require("../models/User");
const auth       = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");

// ── Nominatim geocoder (server-side) ─────────────────────────────────────────
// Resolves a place name to lat/lng using the OpenStreetMap Nominatim API.
// No country restriction — works across all of East Africa and beyond.
// Results are cached in memory for the lifetime of the process.
const _coordCache = {};

async function getCoordinates(place) {
  if (!place) return null;
  const key = place.toLowerCase().trim();
  if (_coordCache[key]) return _coordCache[key];

  const query = encodeURIComponent(place);
  const url   = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;

  try {
    // Node 18+ has native fetch. For older Node use node-fetch.
    const res  = await fetch(url, { headers: { "User-Agent": "isokoLink-App" } });
    const data = await res.json();
    if (!data || !data.length) return null;

    const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    _coordCache[key] = coords;
    return coords;
  } catch (err) {
    console.warn("Nominatim geocode failed for:", place, err.message);
    return null;
  }
}

// ── Helper: fill in missing coordinates for a listing ────────────────────────
// Priority: stored coords → geocode district → geocode region → null
async function resolveCoords(listing) {
  if (listing.lat && listing.lng) {
    return { lat: listing.lat, lng: listing.lng };
  }
  // Try the most specific place name first, then fall back to the region
  const coords =
    (await getCoordinates(listing.district)) ||
    (await getCoordinates(listing.region));
  return coords || { lat: null, lng: null };
}

// ── Demo seed ─────────────────────────────────────────────────────────────────
async function ensureDemoListing() {
  const count = await Listing.countDocuments();
  if (count > 0) return;

  const farmer = await User.findOne({ role: "farmer" });
  if (!farmer) return;

  const coords = await getCoordinates("Wakiso") || {};
  await Listing.create({
    crop:         "Maize",
    pricePerUnit: 1200,
    quantity:     500,
    district:     "Wakiso",
    region:       "Central",
    farmer:       farmer._id,
    farmerName:   farmer.name,
    phone:        farmer.phone,
    description:  "Dry maize ready",
    lat:          coords.lat || null,
    lng:          coords.lng || null
  });
}

// ── GET all listings ──────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    await ensureDemoListing();
    const { search = "", crop, region, sort } = req.query;
    const filter = {};

    if (crop)   filter.crop   = crop;
    if (region) filter.region = region;
    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or  = [
        { crop: regex }, { farmerName: regex },
        { district: regex }, { region: regex }
      ];
    }

    let query = Listing.find(filter).populate("farmer", "name phone role");
    if (sort === "price_asc")     query = query.sort({ pricePerUnit: 1 });
    if (sort === "price_desc")    query = query.sort({ pricePerUnit: -1 });
    if (sort === "harvest_soon")  query = query.sort({ harvestDate: 1 });
    if (sort === "quantity_desc") query = query.sort({ quantity: -1 });

    const listings = await query.exec();

    // Resolve coordinates for every listing in parallel
    const normalized = await Promise.all(
      listings.map(async (l) => {
        const coords = await resolveCoords(l);
        return {
          ...l.toObject(),
          farmerName: l.farmerName || l.farmer?.name,
          phone:      l.phone      || l.farmer?.phone,
          lat:        coords.lat,
          lng:        coords.lng
        };
      })
    );

    res.json(normalized);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to load listings" });
  }
});

// ── GET single listing ────────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id).populate("farmer", "name phone");
    if (!listing) return res.status(404).json({ success: false, message: "Listing not found" });

    const coords = await resolveCoords(listing);
    res.json({
      ...listing.toObject(),
      farmerName: listing.farmerName || listing.farmer?.name,
      phone:      listing.phone      || listing.farmer?.phone,
      lat:        coords.lat,
      lng:        coords.lng
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to load listing" });
  }
});

// ── POST create listing (farmer only) ─────────────────────────────────────────
router.post("/", auth, allowRoles("farmer"), async (req, res) => {
  try {
    const {
      crop, pricePerUnit, quantity,
      district, region, phone, description, harvestDate,
      lat, lng
    } = req.body;

    // If the client already resolved coordinates, use them directly.
    // Otherwise geocode the district (or region as fallback) server-side.
    let finalLat = lat  || null;
    let finalLng = lng  || null;

    if (!finalLat || !finalLng) {
      const coords =
        (await getCoordinates(district)) ||
        (await getCoordinates(region));
      if (coords) {
        finalLat = coords.lat;
        finalLng = coords.lng;
      }
    }

    const listing = new Listing({
      crop, pricePerUnit, quantity,
      district, region, phone, description, harvestDate,
      farmer:     req.user.id,
      farmerName: req.user.name,
      lat:        finalLat,
      lng:        finalLng
    });

    await listing.save();
    res.json({ ...listing.toObject(), lat: finalLat, lng: finalLng });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to create listing" });
  }
});

module.exports = router;
