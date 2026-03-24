import { Router } from "express";
import { readJson, writeJson } from "../models/dataStore.js";

const router = Router();
const reqPath = "data/requests.json";
const listingsPath = "data/listings.json";

router.get("/", async (_req, res) => {
  try {
    const requests = await readJson(reqPath);
    requests.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load requests" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { listingId, quantity, message = "" } = req.body || {};
    if (!listingId || !quantity || Number(quantity) < 1) {
      return res.status(400).json({ error: "listingId and quantity are required" });
    }

    const [requests, listings] = await Promise.all([readJson(reqPath), readJson(listingsPath)]);
    const listing = listings.find((l) => l.id === Number(listingId));
    if (!listing) return res.status(404).json({ error: "Listing not found" });

    const newRequest = {
      id: Date.now(),
      listingId: Number(listingId),
      crop: listing.crop,
      farmerName: listing.farmerName,
      district: listing.district,
      pricePerUnit: listing.pricePerUnit,
      quantity: Number(quantity),
      message,
      status: "Pending",
      date: new Date().toISOString(),
    };

    requests.push(newRequest);
    await writeJson(reqPath, requests);
    res.status(201).json(newRequest);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save request" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const { status } = req.body || {};
    const allowed = new Set(["Pending", "Accepted", "Completed", "Declined"]);
    if (!allowed.has(status)) return res.status(400).json({ error: "Invalid status" });

    const requests = await readJson(reqPath);
    const id = Number(req.params.id);
    let updated = null;

    const next = requests.map((r) => {
      if (r.id === id) {
        updated = { ...r, status };
        return updated;
      }
      return r;
    });

    if (!updated) return res.status(404).json({ error: "Request not found" });

    await writeJson(reqPath, next);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update request" });
  }
});

export default router;
