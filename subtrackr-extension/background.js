// background.js (service worker)

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "OPEN_SUBTRACKR_DASHBOARD") {
    // Open your SUBTRACKR dashboard directly.
    // Update this URL if your Live Server URL changes.
    const DASHBOARD_URL = "http://127.0.0.1:5500/ProjectBeta-ICS4U/HTMLtest.html";
    chrome.tabs.create({ url: DASHBOARD_URL });
    sendResponse({ ok: true });
    return true; // keep message channel alive for async
  }
  return false;
});

