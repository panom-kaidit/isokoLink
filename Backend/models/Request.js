const mongoose = require("mongoose");

const requestSchema = new mongoose.Schema(
  {
    listingId: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true },
    crop: { type: String, default: "" },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    quantity: { type: Number, required: true },
    message: { type: String, default: "" },
    status: { type: String, enum: ["Pending", "Accepted", "Declined"], default: "Pending" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Request", requestSchema);
