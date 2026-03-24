// This file runs the messages page.
// It loads past conversations from the server and lets users chat in real time using Socket.io.
// All variables are declared at the top so the socket listeners below can use them safely.

// Check the user is logged in before anything else runs
const messagesToken = getToken ? getToken() : localStorage.getItem("token");
if (!messagesToken) {
  window.location.href = "../login/login.html";
}
const messagesUser = window.currentUser || (getUserFromToken ? getUserFromToken() : null);
if (!messagesUser) {
  localStorage.removeItem("token");
  window.location.href = "../login/login.html";
}
const userId      = String(messagesUser?.id || messagesUser?._id || "");
const userRole    = messagesUser?.role || "buyer";
const msgAuthHeaders = { Authorization: `Bearer ${messagesToken}` };

// Keep track of all loaded conversations and which one is open right now
let conversations = [];
let activeConvo   = null;

// Clean text before putting it on the page so special characters display correctly
const safeText = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

function scrollChatToBottom() {
  const chat = document.getElementById("chat-messages");
  if (chat) chat.scrollTop = chat.scrollHeight;
}

// Connect to the live messaging server so new messages arrive without refreshing the page.
// We connect after the variables above are ready so nothing is undefined when messages arrive.
const socket = io(window.location.hostname === "localhost"
  ? "http://localhost:5000"
  : window.location.origin);

// Tell the server which user this browser tab belongs to so it can deliver messages to us
socket.on("connect", () => {
  socket.emit("register", userId);
});

socket.on("receiveMessage", (msg) => {
  const { senderId, text, time } = msg;

  // Look for an existing conversation with this person, or create a new one
  let convo = conversations.find((c) => c.partnerId === senderId);
  if (!convo) {
    convo = {
      id:        senderId,
      name:      "New contact",
      avatar:    "NC",
      partnerId: senderId,
      crop:      "",
      messages:  []
    };
    conversations.push(convo);
  }

  convo.messages.push({
    from: "them",
    text,
    time: new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  });

  if (activeConvo && activeConvo.partnerId === senderId) {
    // The user is already looking at this conversation, so update it live
    selectConversation(convo.id);
    scrollChatToBottom();
  } else {
    // The message is for a different conversation, just refresh the list on the left
    renderConvoList();
  }
});

// A sample conversation shown when the server cannot be reached
const sampleFallback = [
  {
    id: "demo-farmer-1",
    name: "Grace (Maize)",
    crop: "Maize",
    avatar: "GR",
    partnerId: "demo-farmer-1",
    messages: [{ from: "them", text: "Hello, I have 800 kg of maize ready.", time: "09:10" }]
  }
];

// The script is placed at the bottom of the HTML so the page is ready when this runs.
// We can call loadMessages() straight away without waiting for DOMContentLoaded.
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
        from: isMine ? "me" : "them",
        text: m.text || m.message || "",
        at:   new Date(m.createdAt || Date.now()).getTime()
      });
    });

    conversations = Array.from(map.values()).map((c) => ({
      ...c,
      messages: c.messages
        .sort((a, b) => a.at - b.at)
        .map((m) => ({
          ...m,
          time: new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }))
    }));
  } catch (err) {
    console.warn("Using fallback messages:", err.message);
    conversations = sampleFallback;
  }

  // If the user came from the marketplace by clicking "Message Farmer",
  // that page saved the farmer's info in sessionStorage. We pick it up here
  // and open that conversation straight away.
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
          conversations.unshift(convo); // put at top of list
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

// Draw the list of conversations in the left panel
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

// Open a conversation and show its messages in the right panel
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

      const textEl = document.createElement("div");
      textEl.className = "chat-text";
      textEl.textContent = msg.text;

      const timeEl = document.createElement("div");
      timeEl.className = "chat-time";
      timeEl.textContent = msg.time;

      row.appendChild(textEl);
      row.appendChild(timeEl);
      chat.appendChild(row);
    });
  }

  scrollChatToBottom();
  renderConvoList();
}

// Send the message the user typed when they click Send or press Enter
async function sendMessage() {
  const input = document.getElementById("chat-input");
  const text  = input.value.trim();
  if (!text || !activeConvo) return;

  // Show the message on screen right away so it feels instant
  const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  activeConvo.messages.push({ from: "me", text, time: now });
  input.value = "";
  selectConversation(activeConvo.id); // re-render + scroll

  const receiverId = activeConvo.partnerId || activeConvo.id;

  try {
    const res = await fetch(`${API_BASE}/messages`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", ...msgAuthHeaders },
      body:    JSON.stringify({ receiverId, text })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "send failed");
    }

    // Only send via the live socket after we know the server saved the message
    socket.emit("sendMessage", { senderId: userId, receiverId, text });

  } catch (err) {
    console.warn("Message not saved to API:", err.message);
    showToast("Message shown locally but could not be saved to server.");
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
