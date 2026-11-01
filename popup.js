"use strict";

const form = document.querySelector("#search-form");
const input = document.querySelector("#query");
const button = form.querySelector("button");
const error = document.querySelector("#error");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = input.value.trim();
  if (!query) {
    input.setCustomValidity("検索キーワードを入力してください。");
    input.reportValidity();
    return;
  }
  button.disabled = true;
  error.hidden = true;
  try {
    const result = await chrome.runtime.sendMessage({ type: "search", query });
    if (!result) throw new Error("拡張のバックグラウンド処理を更新してください（edge://extensions の ↻）。");
    if (!result.ok) throw new Error(result.error || "検索処理に失敗しました。");
    window.close();
  } catch (cause) {
    error.textContent = "検索エラー: " + (cause.message || String(cause)) + " 拡張の更新（↻）をお試しください。";
    error.hidden = false;
  } finally {
    button.disabled = false;
  }
});
input.addEventListener("input", () => input.setCustomValidity(""));

const list = document.querySelector("#history-list");
const empty = document.querySelector("#history-empty");
const clear = document.querySelector("#clear-history");
function renderHistory(items) {
  list.replaceChildren();
  empty.hidden = items.length > 0;
  clear.disabled = items.length === 0;
  const filtered = items.filter(q => q.toLocaleLowerCase().includes(input.value.trim().toLocaleLowerCase()));
  for (const query of filtered) {
    const row = document.createElement("li");
    const reuse = document.createElement("button");
    reuse.type = "button";
    reuse.className = "history-query";
    reuse.textContent = query;
    reuse.title = query;
    reuse.addEventListener("click", () => {
      input.value = query;
      input.setCustomValidity("");
      form.requestSubmit();
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "history-remove";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `「${query}」を履歴から削除`);
    remove.addEventListener("click", () => updateHistory({ type: "deleteHistory", query }));
    row.append(reuse, remove);
    list.append(row);
  }
}
let items = [];
async function updateHistory(message) {
  try {
    const result = await chrome.runtime.sendMessage(message);
    if (!result?.ok) throw new Error(result?.error || "バックグラウンド処理から応答がありません。");
    items = result.history;
    renderHistory(items);
  } catch (cause) {
    error.textContent = "履歴エラー: " + (cause.message || String(cause)) + " 拡張の更新（↻）をお試しください。";
    error.hidden = false;
  }
}
input.addEventListener("input", () => renderHistory(items));
clear.addEventListener("click", () => updateHistory({ type: "clearHistory" }));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.searchHistory) {
    items = changes.searchHistory.newValue || [];
    renderHistory(items);
  }
});
updateHistory({ type: "history" });
