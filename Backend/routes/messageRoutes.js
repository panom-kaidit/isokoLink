const express = require("express");
const router = express.Router();
const { sendMessage, getMessages } = require("../controllers/messageController");
const auth = require("../middleware/authMiddleware");

router.use(auth);

router.get("/", getMessages);
router.post("/", sendMessage);

module.exports = router;