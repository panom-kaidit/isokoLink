// This file runs on every dashboard page (marketplace, map, messages, etc.)
// It checks if the user is logged in and builds the sidebar based on their role.

// If there is no login token, send the user back to the login page
const layoutToken = getToken ? getToken() : localStorage.getItem("token");
if (!layoutToken) {
  window.location.href = "../login/login.html";
}
const layoutUser = getUserFromToken ? getUserFromToken() : null;
if (!layoutUser) {
  localStorage.removeItem("token");
  window.location.href = "../login/login.html";
}
const layoutRole = layoutUser?.role || "buyer";
window.currentUser = layoutUser;
window.currentRole = layoutRole;

// Hide buttons and sections that don't apply to this user's role
(function applyRoleVisibility() {
  if (layoutRole === "farmer") {
    document.querySelectorAll(".buyer-only").forEach((el) => (el.style.display = "none"));
  } else {
    document.querySelectorAll(".farmer-only").forEach((el) => (el.style.display = "none"));
  }
})();

// Put the user's initials inside the avatar circle in the top right corner
(function setAvatar() {
  const avatar = document.getElementById("user-avatar");
  if (avatar && layoutUser?.name) {
    avatar.textContent = layoutUser.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  }
})();

// Build the sidebar navigation links based on whether the user is a farmer or buyer.
// Farmers and buyers need different menu items, so we create them here with JS
// instead of writing the same nav links in every single HTML file.
(function buildRoleNav() {
  const nav = document.querySelector(".sidebar__menu");
  if (!nav) return;

  // Show "Farmer portal" or "Buyer portal" under the logo in the sidebar
  const brandSubtitle = document.querySelector(".sidebar__brand p");
  if (brandSubtitle) {
    brandSubtitle.textContent = layoutRole === "farmer" ? "Farmer portal" : "Buyer portal";
  }

  const farmerLinks = [
    { page: "map",       href: "map.html",         icon: "fa-map",          label: "Map View" },
    { page: "products",  href: "products.html",     icon: "fa-seedling",     label: "My Products" },
    { page: "requests",  href: "requests.html",     icon: "fa-inbox",        label: "Incoming Requests" },
    { page: "messages",  href: "messages.html",     icon: "fa-message",      label: "Messages" },
  ];

  const buyerLinks = [
    { page: "marketplace", href: "marketplace.html", icon: "fa-cart-shopping", label: "Marketplace" },
    { page: "map",         href: "map.html",          icon: "fa-map",           label: "Map View" },
    { page: "requests",    href: "requests.html",     icon: "fa-inbox",         label: "My Requests" },
    { page: "messages",    href: "messages.html",     icon: "fa-message",       label: "Messages" },
  ];

  const links = layoutRole === "farmer" ? farmerLinks : buyerLinks;

  nav.innerHTML = links
    .map(
      (l) => `
        <a class="menu-link" data-page="${l.page}" href="${l.href}">
          <span class="icon"><i class="fa-solid ${l.icon}"></i></span>${l.label}
        </a>`
    )
    .join("");

  // Highlight the link that matches the page the user is currently on
  const currentPage = document.body.dataset.page;
  nav.querySelectorAll(".menu-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.page === currentPage);
  });
})();

// Create the Log Out button and attach it to the bottom of the sidebar
(function buildLogoutBtn() {
  const sidebarEl = document.querySelector(".sidebar");
  if (!sidebarEl) return;

  const btn = document.createElement("button");
  btn.className = "sidebar__logout";
  btn.innerHTML = '<span class="icon"><i class="fa-solid fa-right-from-bracket"></i></span>Log Out';
  btn.setAttribute("title", "Sign out");
  btn.addEventListener("click", () => {
    if (typeof logOut === "function") {
      logOut();
    } else {
      // logout.js did not load, so we clear everything and redirect manually
      localStorage.clear();
      sessionStorage.clear();
      const layoutScript = document.querySelector('script[src*="layout.js"]').src;
      const layoutBase = layoutScript.replace(/\/js\/layout\.js.*$/, '');
      window.location.href = layoutBase + '/index.html';
    }
  });

  sidebarEl.appendChild(btn);
})();

// On small screens, tapping the hamburger button opens or closes the sidebar
(function setupSidebarToggle() {
  const toggleBtn = document.getElementById("sidebarToggle");
  const sidebar = document.querySelector(".sidebar");
  if (!toggleBtn || !sidebar) return;

  // Create an overlay once and reuse it on every page
  let overlay = document.getElementById("sidebarOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "sidebarOverlay";
    overlay.className = "sidebar-overlay";
    document.body.appendChild(overlay);
  }

  const isMobile = () => window.matchMedia("(max-width: 1024px)").matches;

  const closeSidebar = () => {
    document.body.classList.remove("sidebar-open");
    overlay.classList.remove("active");
    toggleBtn.setAttribute("aria-expanded", "false");
  };

  const toggleSidebar = () => {
    if (!isMobile()) return;
    const isOpen = document.body.classList.toggle("sidebar-open");
    overlay.classList.toggle("active", isOpen);
    toggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
  };

  if (!sidebar.id) {
    sidebar.id = "sidebar";
  }
  toggleBtn.setAttribute("aria-controls", "sidebar");
  toggleBtn.setAttribute("aria-expanded", "false");

  toggleBtn.addEventListener("click", toggleSidebar);
  overlay.addEventListener("click", closeSidebar);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSidebar();
  });
  window.addEventListener("resize", () => {
    if (!isMobile()) {
      closeSidebar();
    }
  });

  // Close the drawer after navigating on small screens
  sidebar.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      if (isMobile()) closeSidebar();
    });
  });
})();

// Show a small popup message at the bottom of the screen for a few seconds
window.showToast = function (message) {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = "1";
  setTimeout(() => {
    toast.style.opacity = "0";
  }, 3000);
};
