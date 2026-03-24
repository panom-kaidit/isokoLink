// This function runs when the user clicks "Log Out"
// It clears all saved login data and sends the user back to the home page

function logOut() {
  // Remove everything saved in the browser so no login info is left behind
  localStorage.clear();
  sessionStorage.clear();

  // Find the home page by looking at where this script was loaded from.
  // Going up one folder from /js/logout.js always leads us to Frontend/index.html.
  // This works no matter what server, IP, or port you are running on.
  const scriptURL = document.querySelector('script[src*="logout.js"]').src;
  const frontendBase = scriptURL.replace(/\/js\/logout\.js.*$/, '');
  window.location.href = frontendBase + '/index.html';
}
