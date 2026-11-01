"use strict";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "google-search-selection",
      title: "「%s」をGoogleで検索",
      contexts: ["selection"]
    });
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== "google-search-selection") return;
  const query = (info.selectionText || "").trim();
  if (query) enqueue(() => search(query)).catch(console.error);
});

// Serialize history changes from all popup windows and the context menu.
let pending = Promise.resolve();
function enqueue(task) {
  const result = pending.then(task);
  pending = result.catch(() => {});
  return result;
}
async function history() {
  const data = await chrome.storage.local.get("searchHistory");
  return Array.isArray(data.searchHistory)
    ? data.searchHistory.filter(q => typeof q === "string").slice(0, 20) : [];
}
async function search(query) {
  const previous = await history();
  await chrome.tabs.create({ url: "https://www.google.com/search?q=" + encodeURIComponent(query) });
  await chrome.storage.local.set({ searchHistory: [query, ...previous.filter(q => q !== query)].slice(0, 20) });
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return;
  if (!["search", "history", "deleteHistory", "clearHistory"].includes(message?.type)) return;
  enqueue(async () => {
    if (message.type === "search") {
      const query = typeof message.query === "string" ? message.query.trim() : "";
      if (!query || query.length > 2000) throw new Error("Invalid query");
      await search(query);
    } else if (message.type === "deleteHistory") {
      await chrome.storage.local.set({ searchHistory: (await history()).filter(q => q !== message.query) });
    } else if (message.type === "clearHistory") {
      await chrome.storage.local.set({ searchHistory: [] });
    }
    return { ok: true, history: await history() };
  }).then(respond, (error) => {
    console.error("Google search extension:", error);
    respond({ ok: false, error: error.message || String(error) });
  });
  return true;
});
