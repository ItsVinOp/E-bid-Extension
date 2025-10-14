const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const orderIdsField = document.getElementById('orderIds');
const apiKeyField = document.getElementById('apiKey');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
const statusDiv = document.getElementById('status');

// Load saved data immediately
chrome.storage.local.get(['openai_api_key', 'sap_order_ids'], (result) => {
  if (result.openai_api_key) {
    apiKeyField.value = result.openai_api_key;
  }
  if (result.sap_order_ids) {
    orderIdsField.value = result.sap_order_ids;
  }
});

// Auto-save Order IDs as user types
let saveTimeout;
orderIdsField.addEventListener('input', () => {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    chrome.storage.local.set({ sap_order_ids: orderIdsField.value });
  }, 500);
});

// Save API key
saveApiKeyBtn.onclick = () => {
  const apiKey = apiKeyField.value.trim();
  if (!apiKey) {
    statusDiv.innerHTML = '<span class="error"> Enter API Key!</span>';
    return;
  }
  chrome.storage.local.set({ openai_api_key: apiKey }, () => {
    statusDiv.innerHTML = '<span class="success">Saved!</span>';
    setTimeout(() => { statusDiv.innerHTML = 'Ready for Rank 1!'; }, 2000);
  });
};

// Start automation
startBtn.onclick = () => {
  const orderIds = orderIdsField.value.trim();
  const apiKey = apiKeyField.value.trim();
  
  if (!orderIds) {
    statusDiv.innerHTML = '<span class="error">Enter SAP Order IDs!</span>';
    return;
  }
  
  if (!apiKey) {
    statusDiv.innerHTML = '<span class="error">Enter API Key!</span>';
    return;
  }
  
  chrome.storage.local.set({ sap_order_ids: orderIds, openai_api_key: apiKey });
  statusDiv.innerHTML = '<span class="success">Starting...</span>';
  
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (!tabs[0].url.includes('eye2serve.com')) {
      statusDiv.innerHTML = '<span class="error">Not on Eye2Serve!</span>';
      return;
    }
    
    chrome.tabs.sendMessage(tabs[0].id, {
      action: "startAutomation",
      orderIds: orderIds,
      apiKey: apiKey
    }, (response) => {
      if (chrome.runtime.lastError) {
        statusDiv.innerHTML = '<span class="error">Refresh page!</span>';
      } else {
        statusDiv.innerHTML = '<span class="success">Running!</span>';
      }
    });
  });
};

// Stop automation
stopBtn.onclick = () => {
  statusDiv.innerHTML = '<span class="error">Stopped</span>';
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    chrome.tabs.sendMessage(tabs[0].id, { action: "stopAutomation" }, () => {});
  });
  setTimeout(() => { statusDiv.innerHTML = 'Ready for Rank 1!'; }, 2000);
};
