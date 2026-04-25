chrome.runtime.onInstalled.addListener(() => {
  // default OFF
  chrome.storage.sync.set({ realtimeEnabled: false });
});