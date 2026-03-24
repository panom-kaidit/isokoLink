const mongoose = require("mongoose");

const listingSchema = new mongoose.Schema(
  {
    crop: String,
    pricePerUnit: Number,
    quantity: Number,
    district: String,
    region: String,
    farmer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    farmerName: String,
    phone: String,
    description: String,
    harvestDate: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model("Listing", listingSchema);
