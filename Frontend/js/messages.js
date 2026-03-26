// Messaging page script
// Loads history, sends messages through the API (persist first), and listens for live updates via Socket.io.

// Make sure only signed-in users can use messaging
const messagesToken = getToken ? getToken() : localStorage.getItem("token");
if (!messagesToken) window.location.href = "../login/login.html";

const messagesUser = window.currentUser || (getUserFromToken ? getUserFromToken() : null);
if (!messagesUser) {
  localStorage.removeItem("token");
  window.location.href = "../login/login.html";
}

const userId   = String(messagesUser?.id || messagesUser?._id || "");
const userRole = messagesUser?.role || "buyer";
const msgAuthHeaders = { Authorization: `Bearer ${messagesToken}` };

// Local in-memory state
let conversations = [];
let activeConvo   = null;

// Helper functions
const safeText = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const formatTime = (value) =>
  new Date(value || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function scrollChatToBottom() {
  const chat = document.getElementById("chat-messages");
  if (chat) chat.scrollTop = chat.scrollHeight;
}

function sortConversationsByRecent() {
  conversations.sort((a, b) => {
    const aTime = a.messages?.length ? a.messages[a.messages.length - 1].at : 0;
    const bTime = b.messages?.length ? b.messages[b.messages.length - 1].at : 0;
    return bTime - aTime;
  });
}

// Socket.io connection for live chat
const socket = io(window.location.hostname === "localhost"
  ? "http://localhost:5000"
  : window.location.origin);

socket.on("connect", () => {
  socket.emit("register", userId);
});

socket.on("message:new", (payload) => ingestMessage(payload, { source: "socket" }));

// Demo messages to show if the API is unavailable
const sampleFallback = [
  {
    id: "demo-farmer-1",
    name: "Grace (Maize)",
    crop: "Maize",
    avatar: "GR",
    partnerId: "demo-farmer-1",
    messages: [{ from: "them", text: "Hello, I have 800 kg of maize ready.", time: "09:10", at: Date.now() }]
  }
];

// Load existing messages right away
loadMessages();

async function loadMessages() {
  try {
    const res = await fetch(`${API_BASE}/messages`, { headers: { ...msgAuthHeaders } });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "API error");
    }
    const payload = await res.json();
    const msgs = Array.isArray(payload) ? payload : (payload.data || []);

    const map = new Map();
    msgs.forEach((m) => {
      const senderId   = String(m.sender?._id   || m.sender   || m.from || "");
      const receiverId = String(m.receiver?._id || m.receiver || m.to   || "");
      const isMine     = senderId && senderId === userId;
      const partnerId  = isMine ? receiverId : senderId;
      if (!partnerId) return;

      const partner     = isMine ? m.receiver : m.sender;
      const partnerName = (typeof partner === "object" ? partner?.name : null) || "Conversation";

      if (!map.has(partnerId)) {
        map.set(partnerId, {
          id:        partnerId,
          name:      partnerName,
          crop:      m.crop || "",
          avatar:    (partnerName || "?").slice(0, 2).toUpperCase(),
          partnerId,
          messages:  []
        });
      }

      map.get(partnerId).messages.push({
        id:    m._id || m.id,
        tempId: m.clientTempId || null,
        from:  isMine ? "me" : "them",
        text:  m.text || m.message || "",
        at:    new Date(m.createdAt || Date.now()).getTime(),
        status: isMine ? (m.deliveredAt ? "delivered" : "sent") : null
      });
    });

    conversations = Array.from(map.values()).map((c) => ({
      ...c,
      messages: c.messages
        .sort((a, b) => a.at - b.at)
        .map((m) => ({
          ...m,
          time: formatTime(m.at)
        }))
    }));
    sortConversationsByRecent();
  } catch (err) {
    console.warn("Using fallback messages:", err.message);
    conversations = sampleFallback;
  }

  // If the user clicked \"Message Farmer\" elsewhere, open that conversation immediately.
  const pending = sessionStorage.getItem("pendingConvo");
  if (pending) {
    sessionStorage.removeItem("pendingConvo");
    try {
      const { partnerId, name, crop } = JSON.parse(pending);
      if (partnerId) {
        let convo = conversations.find((c) => c.partnerId === partnerId);
        if (!convo) {
          convo = {
            id:        partnerId,
            name:      name || "Farmer",
            crop:      crop || "",
            avatar:    (name || "FA").slice(0, 2).toUpperCase(),
            partnerId,
            messages:  []
          };
          conversations.unshift(convo);
        }
        activeConvo = convo;
      }
    } catch (e) {
      console.warn("Could not parse pendingConvo", e);
    }
  }

  if (!activeConvo) activeConvo = conversations[0] || null;

  renderConvoList();
  if (activeConvo) {
    selectConversation(activeConvo.id);
  } else {
    setChatStatus("No conversations yet. Message a farmer from the Marketplace.");
  }
}

// UI rendering helpers
function renderConvoList() {
  const list = document.getElementById("convo-list-items");
  if (!list) return;
  list.innerHTML = "";

  if (!conversations.length) {
    list.innerHTML = '<div class="card-detail" style="padding:12px">No conversations yet.</div>';
    return;
  }

  conversations.forEach((convo) => {
    const item = document.createElement("div");
    item.className = `convo-item${activeConvo && convo.id === activeConvo.id ? " active" : ""}`;

    const avatar = document.createElement("div");
    avatar.className = "convo-avatar";
    avatar.textContent = safeText(convo.avatar || "?");

    const textWrap = document.createElement("div");

    const nameEl = document.createElement("div");
    nameEl.className = "convo-name";
    nameEl.textContent = safeText(convo.name);

    const metaEl = document.createElement("div");
    metaEl.className = "convo-meta";
    metaEl.textContent = safeText(convo.crop || "");

    textWrap.appendChild(nameEl);
    textWrap.appendChild(metaEl);
    item.appendChild(avatar);
    item.appendChild(textWrap);
    item.onclick = () => selectConversation(convo.id);
    list.appendChild(item);
  });
}

function selectConversation(id) {
  activeConvo = conversations.find((c) => c.id === id);
  if (!activeConvo) return;

  document.getElementById("chat-name").textContent   = safeText(activeConvo.name);
  document.getElementById("chat-crop").textContent   = safeText(activeConvo.crop || "");
  document.getElementById("chat-avatar").textContent = safeText(activeConvo.avatar || "?");

  const chat = document.getElementById("chat-messages");
  chat.innerHTML = "";

  if (!activeConvo.messages.length) {
    const empty = document.createElement("div");
    empty.className = "card-detail";
    empty.style.padding = "16px";
    empty.textContent = "No messages yet. Say hello!";
    chat.appendChild(empty);
  } else {
    activeConvo.messages.forEach((msg) => {
      const row = document.createElement("div");
      row.className = `chat-bubble ${msg.from === "me" ? "me" : "them"}`;
      if (msg.status === "failed") row.classList.add("chat-failed");
      if (msg.status === "sending") row.classList.add("chat-pending");

      const textEl = document.createElement("div");
      textEl.className = "chat-text";
      textEl.textContent = msg.text;

      const timeEl = document.createElement("div");
      timeEl.className = "chat-time";
      const statusLabel = formatStatus(msg.status);
      timeEl.textContent = statusLabel ? `${msg.time} · ${statusLabel}` : msg.time;

      row.appendChild(textEl);
      row.appendChild(timeEl);
      chat.appendChild(row);
    });
  }

  scrollChatToBottom();
  renderConvoList();
}

// Add new messages from sockets or API responses
function ensureConversation(partnerId, displayName = "Conversation", crop = "") {
  let convo = conversations.find((c) => c.partnerId === partnerId);
  if (!convo) {
    const avatar = (displayName || "?").slice(0, 2).toUpperCase();
    convo = { id: partnerId, partnerId, name: displayName, crop, avatar, messages: [] };
    conversations.unshift(convo);
  }
  return convo;
}

function formatStatus(status) {
  if (!status) return "";
  if (status === "sending") return "sending…";
  if (status === "sent") return "sent";
  if (status === "delivered") return "delivered";
  if (status === "failed") return "failed to send";
  return status;
}

function ingestMessage(payload, { source = "socket" } = {}) {
  if (!payload) return;

  const senderId   = String(payload.senderId || payload.sender || "");
  const receiverId = String(payload.receiverId || payload.receiver || "");
  const partnerId  = senderId === userId ? receiverId : senderId;
  if (!partnerId) return;

  const isMine = senderId === userId;
  const nameFromPayload = isMine ? payload.receiverName : payload.senderName;
  const convo = ensureConversation(partnerId, nameFromPayload || "Conversation", payload.crop || "");

  const when = payload.createdAt ? new Date(payload.createdAt) : new Date();
  const baseStatus = isMine
    ? payload.deliveredAt
      ? "delivered"
      : "sent"
    : null;

  const existing = convo.messages.find((m) =>
    (payload._id && m.id === payload._id) ||
    (payload.tempId && m.tempId && m.tempId === payload.tempId)
  );

  if (existing) {
    existing.id     = existing.id || payload._id || payload.id;
    existing.tempId = existing.tempId || payload.tempId || null;
    existing.status = baseStatus || existing.status;
    existing.text   = existing.text || payload.text || "";
    existing.at     = when.getTime();
    existing.time   = formatTime(when);
  } else {
    convo.messages.push({
      id: payload._id || payload.id || payload.tempId || `msg-${Date.now()}`,
      tempId: payload.tempId || null,
      from: isMine ? "me" : "them",
      text: payload.text || "",
      at: when.getTime(),
      time: formatTime(when),
      status: baseStatus
    });
  }

  convo.messages.sort((a, b) => a.at - b.at);
  sortConversationsByRecent();

  if (activeConvo && activeConvo.partnerId === partnerId) {
    selectConversation(convo.id);
    scrollChatToBottom();
  } else {
    renderConvoList();
  }
}

// Flow for sending a message
async function sendMessage() {
  const input = document.getElementById("chat-input");
  const text  = input.value.trim();
  if (!text || !activeConvo) return;

  const receiverId = activeConvo.partnerId || activeConvo.id;
  const tempId = `tmp-${Date.now()}`;
  const now = new Date();

  // Add a pending bubble instantly
  const pendingMsg = {
    id: tempId,
    tempId,
    from: "me",
    text,
    at: now.getTime(),
    time: formatTime(now),
    status: "sending"
  };
  activeConvo.messages.push(pendingMsg);
  sortConversationsByRecent();
  input.value = "";
  selectConversation(activeConvo.id);

  try {
    const res = await fetch(`${API_BASE}/messages`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", ...msgAuthHeaders },
      body:    JSON.stringify({ receiverId, text, tempId })
    });

    const payload = await res.json();
    if (!res.ok) {
      throw new Error(payload.message || "Could not send message");
    }

    // The server emits after saving. We also ingest the API response to clear the pending state quickly.
    ingestMessage(payload.data || payload, { source: "api" });
  } catch (err) {
    const current = activeConvo.messages.find((m) => m.tempId === tempId);
    if (current) current.status = "failed";
    selectConversation(activeConvo.id);
    console.warn("Message not saved to API:", err.message);
    showToast("Message could not be saved. Check your connection and try again.");
  }
}

function handleEnter(event) {
  if (event.key === "Enter") sendMessage();
}

function setChatStatus(message) {
  const chat = document.getElementById("chat-messages");
  if (!chat) return;
  chat.innerHTML = "";
  const info = document.createElement("div");
  info.className = "card-detail";
  info.style.padding = "16px";
  info.textContent = message;
  chat.appendChild(info);
}
