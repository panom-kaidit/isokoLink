const Request = require("../models/Request");
const Listing = require("../models/Listing");

// Create a new purchase request (buyers/schools/institutions)
exports.createRequest = async (req, res) => {
  try {
    const { listingId, quantity, message = "" } = req.body;

    if (!listingId || !quantity) {
      return res.status(400).json({ success: false, message: "listingId and quantity are required" });
    }

    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({ success: false, message: "Listing not found" });
    }

    const request = await Request.create({
      listingId: listing._id,
      crop: listing.crop || "",
      buyer: req.user.id,
      farmer: listing.farmer,
      quantity,
      message,
      status: "Pending"
    });

    res.status(201).json({ success: true, message: "Request created", data: request });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not create request" });
  }
};

// Get requests for the logged-in user
exports.getRequests = async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === "farmer") {
      filter.farmer = req.user.id;
    } else {
      filter.buyer = req.user.id;
    }

    const requests = await Request.find(filter)
      .populate("buyer", "name")
      .populate("farmer", "name")
      .populate("listingId", "crop pricePerUnit quantity district region farmerName phone")
      .sort({ createdAt: -1 });
    res.json({ success: true, message: "Requests loaded", data: requests });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not load requests" });
  }
};

// Update request status (farmer only)
exports.updateRequestStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["Accepted", "Declined", "Pending"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: "Status must be Accepted or Declined" });
    }

    const request = await Request.findOne({ _id: req.params.id, farmer: req.user.id });
    if (!request) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    request.status = status;
    await request.save();
    await request.populate([
      { path: "buyer", select: "name" },
      { path: "farmer", select: "name" },
      { path: "listingId", select: "crop pricePerUnit quantity district region farmerName phone" }
    ]);

    res.json({ success: true, message: "Status updated", data: request });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not update request" });
  }
};
