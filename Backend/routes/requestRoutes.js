const express = require("express");
const router = express.Router();
const { createRequest, getRequests, updateRequestStatus } = require("../controllers/requestController");
const auth = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");

// Everyone must be authenticated
router.use(auth);

router.post("/", allowRoles("buyer", "school", "institution"), createRequest);
router.get("/", getRequests);
router.patch("/:id", allowRoles("farmer"), updateRequestStatus);

module.exports = router;