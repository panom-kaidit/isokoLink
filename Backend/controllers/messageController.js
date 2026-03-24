const Message = require("../models/Message");

// Send a message between users
exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, text } = req.body;
    if (!receiverId || !text) {
      return res.status(400).json({ success: false, message: "receiverId and text are required" });
    }

    const message = await Message.create({ sender: req.user.id, receiver: receiverId, text });
    res.status(201).json({ success: true, message: "Message sent", data: message });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not send message" });
  }
};

// Get all messages for the logged-in user
exports.getMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const messages = await Message.find({
      $or: [{ sender: userId }, { receiver: userId }]
    })
      .populate("sender", "name")
      .populate("receiver", "name")
      .sort({ createdAt: 1 });

    res.json({ success: true, message: "Messages loaded", data: messages, userId });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not load messages" });
  }
};
