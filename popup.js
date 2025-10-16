const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const orderIdsField = document.getElementById('orderIds');
const apiKeyField = document.getElementById('apiKey');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
const statusDiv = document.getElementById('status');

// Check if chrome.storage is available
if (typeof chrome !== 'undefined' && chrome.storage) {
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
} else {
  console.error('Chrome storage API not available');
  statusDiv.innerHTML = '<span class="error">⚠️ Extension error - reload</span>';
}

// Save API key
saveApiKeyBtn.onclick = () => {
  const apiKey = apiKeyField.value.trim();
  if (!apiKey) {
    statusDiv.innerHTML = '<span class="error">❌ Enter API Key!</span>';
    return;
  }
  
  if (chrome.storage) {
    chrome.storage.local.set({ openai_api_key: apiKey }, () => {
      statusDiv.innerHTML = '<span class="success">✅ Saved!</span>';
      setTimeout(() => { statusDiv.innerHTML = 'Ready for Rank 1! 🚀'; }, 2000);
    });
  }
};

// Start automation
startBtn.onclick = () => {
  const orderIds = orderIdsField.value.trim();
  const apiKey = apiKeyField.value.trim();
  
  if (!orderIds) {
    statusDiv.innerHTML = '<span class="error">❌ Enter SAP Order IDs!</span>';
    return;
  }
  
  if (!apiKey) {
    statusDiv.innerHTML = '<span class="error">❌ Enter API Key!</span>';
    return;
  }
  
  // Save current values
  if (chrome.storage) {
    chrome.storage.local.set({ sap_order_ids: orderIds, openai_api_key: apiKey });
  }
  
  statusDiv.innerHTML = '<span class="success">🚀 Starting...</span>';
  
  // Check if chrome.tabs is available
  if (!chrome.tabs) {
    statusDiv.innerHTML = '<span class="error">❌ Extension API error</span>';
    return;
  }
  
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (!tabs || tabs.length === 0) {
      statusDiv.innerHTML = '<span class="error">❌ No active tab</span>';
      return;
    }
    
    const currentTab = tabs[0];
    
    // ✅ FIXED: Check if on Eye2Serve OR test page
    const isValidPage = currentTab.url && (
      currentTab.url.includes('eye2serve.com') || 
      currentTab.url.includes('192.168.0.102:5500') ||
      currentTab.url.includes('localhost') ||
      currentTab.url.includes('127.0.0.1') ||
      currentTab.url.includes('test-bidding-page')
    );
    
    if (!isValidPage) {
      statusDiv.innerHTML = '<span class="error">❌ Not on Eye2Serve or test page!</span>';
      return;
    }
    
    // Send message to content script
    chrome.tabs.sendMessage(currentTab.id, {
      action: "startAutomation",
      orderIds: orderIds,
      apiKey: apiKey
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Message error:', chrome.runtime.lastError);
        statusDiv.innerHTML = '<span class="error">⚠️ Refresh page!</span>';
      } else {
        statusDiv.innerHTML = '<span class="success">✅ Running! Watch console...</span>';
      }
    });
  });
};

// Stop automation
stopBtn.onclick = () => {
  statusDiv.innerHTML = '<span class="error">⛔ Stopping...</span>';
  
  if (!chrome.tabs) {
    statusDiv.innerHTML = '<span class="error">❌ Extension API error</span>';
    return;
  }
  
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs && tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, { action: "stopAutomation" }, () => {
        // Ignore errors on stop
      });
    }
  });
  
  statusDiv.innerHTML = '<span class="error">⛔ Stopped</span>';
  setTimeout(() => { statusDiv.innerHTML = 'Ready for Rank 1! 🚀'; }, 2000);
};
