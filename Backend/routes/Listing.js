const mongoose = require("mongoose");

const listingSchema = new mongoose.Schema(
  {
    crop:         String,
    pricePerUnit: Number,
    quantity:     Number,
    district:     String,
    region:       String,
    farmer: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true
    },
    farmerName:  String,
    phone:       String,
    description: String,
    harvestDate: Date,
    // ── Location coordinates ───────────────────────────────────────────────
    // Captured from the farmer's browser GPS when they add the product,
    // or resolved server-side from the district name as a fallback.
    lat: { type: Number, default: null },
    lng: { type: Number, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Listing", listingSchema);
