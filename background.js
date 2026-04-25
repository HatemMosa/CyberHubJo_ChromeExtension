chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ realtimeEnabled: false, level: 1 });
});
