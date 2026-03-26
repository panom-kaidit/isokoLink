const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true },
    // Used by the UI to match a pending bubble with the saved record
    clientTempId: { type: String, default: null },
    // When the recipient was online, this is set at emit-time; stays null if they were offline
    deliveredAt: { type: Date, default: null }
  },
  { timestamps: true }
);

// Faster lookups for "messages to deliver to this user"
messageSchema.index({ receiver: 1, deliveredAt: 1 });

module.exports = mongoose.model("Message", messageSchema);
