// Background service worker for MV3
// Ensures the extension loads even if no background logic is needed yet.

// chrome.runtime.onInstalled.addListener(() => {
// 	// Placeholder: keep for future background tasks
// });

chrome.runtime.onInstalled.addListener(() => {
	console.log("Rank 1 Auto-Bidder installed!");
  });
  