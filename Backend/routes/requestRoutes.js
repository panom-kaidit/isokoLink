const express = require("express");
const router = express.Router();
const { createRequest, getRequests, updateRequestStatus } = require("../controllers/requestController");
const auth = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");

// All three routes below require the user to be logged in
router.use(auth);

router.post("/", allowRoles("buyer", "school", "institution"), createRequest);
router.get("/", getRequests);
router.patch("/:id", allowRoles("farmer"), updateRequestStatus);

module.exports = router;