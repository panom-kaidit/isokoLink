import { Router } from "express";
import { readJson } from "../../Isoko-project/Backend/models/dataStore.js";

const router = Router();
const dataPath = "data/listings.json";

router.get("/", async (req, res) => {
  try {
    const listings = await readJson(dataPath);
    const { search = "", crop, region, sort } = req.query;
    const needle = search.toLowerCase();

    let result = listings.filter((l) => {
      const matchesSearch = needle
        ? l.crop.toLowerCase().includes(needle) ||
          l.farmerName.toLowerCase().includes(needle) ||
          l.district.toLowerCase().includes(needle)
        : true;
      const matchesCrop = crop ? l.crop === crop : true;
      const matchesRegion = region ? l.region === region : true;
      return matchesSearch && matchesCrop && matchesRegion;
    });

    if (sort === "price_asc") result.sort((a, b) => a.pricePerUnit - b.pricePerUnit);
    if (sort === "price_desc") result.sort((a, b) => b.pricePerUnit - a.pricePerUnit);
    if (sort === "harvest_soon") result.sort((a, b) => new Date(a.harvestDate) - new Date(b.harvestDate));
    if (sort === "quantity_desc") result.sort((a, b) => b.quantity - a.quantity);

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load listings" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const listings = await readJson(dataPath);
    const id = Number(req.params.id);
    const listing = listings.find((l) => l.id === id);
    if (!listing) return res.status(404).json({ error: "Not found" });
    res.json(listing);
  } catch (err) {
    res.status(500).json({ error: "Failed to load listing" });
  }
});

export default router;
