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
    // GPS coordinates for placing the listing on the map.
    // Comes from the farmer's browser if they allowed location, otherwise we look it up from the district name.
    lat: { type: Number, default: null },
    lng: { type: Number, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Listing", listingSchema);
