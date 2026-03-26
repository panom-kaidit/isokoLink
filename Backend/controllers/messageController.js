const Message = require("../models/Message");

const messagePopulate = [
  { path: "sender", select: "name" },
  { path: "receiver", select: "name" }
];

const toPayload = (doc, tempId) => ({
  _id:         doc._id,
  senderId:    String(doc.sender?._id || doc.sender),
  senderName:  doc.sender?.name || "",
  receiverId:  String(doc.receiver?._id || doc.receiver),
  receiverName: doc.receiver?.name || "",
  text:        doc.text,
  createdAt:   doc.createdAt,
  deliveredAt: doc.deliveredAt,
  tempId:      tempId || doc.clientTempId || null
});

// Send a message between users (save first, then broadcast via Socket.io)
exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, text, tempId } = req.body;
    const cleanText = String(text || "").trim();
    if (!receiverId || !cleanText) {
      return res.status(400).json({ success: false, message: "receiverId and text are required" });
    }

    const createAndEmit = req.app.get("createAndEmitMessage");
    let payload = null;

    if (typeof createAndEmit === "function") {
      // Preferred path: use shared helper so the same logic runs for HTTP and socket sends
      payload = await createAndEmit({
        senderId: req.user.id,
        receiverId,
        text: cleanText,
        tempId
      });
    }

    // Fallback (should not normally run): save + populate + reply without socket
    if (!payload) {
      const message = await Message.create({
        sender: req.user.id,
        receiver: receiverId,
        text: cleanText,
        clientTempId: tempId || null
      });
      await message.populate(messagePopulate);
      payload = toPayload(message, tempId);
    }

    res.status(201).json({ success: true, message: "Message sent", data: payload });
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
      .populate(messagePopulate)
      .sort({ createdAt: 1 });

    res.json({ success: true, message: "Messages loaded", data: messages, userId });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not load messages" });
  }
};
