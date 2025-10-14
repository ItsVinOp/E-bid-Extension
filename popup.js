const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const orderIdsField = document.getElementById('orderIds');
const apiKeyField = document.getElementById('apiKey');
const saveApiKeyBtn = document.getElementById('saveApiKey');
const statusDiv = document.getElementById('status');

// Load saved API key
chrome.storage.local.get(['openai_api_key'], (result) => {
  if (result.openai_api_key) {
    apiKeyField.value = result.openai_api_key;
  }
});

// Save API key
saveApiKeyBtn.onclick = () => {
  const apiKey = apiKeyField.value.trim();
  if (!apiKey) {
    statusDiv.innerHTML = '<span class="error">❌ Enter API Key!</span>';
    return;
  }
  chrome.storage.local.set({ openai_api_key: apiKey }, () => {
    statusDiv.innerHTML = '<span class="success">✅ API Key Saved!</span>';
  });
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
    statusDiv.innerHTML = '<span class="error">❌ Enter OpenAI API Key!</span>';
    return;
  }
  
  statusDiv.innerHTML = '<span class="success">🚀 Automation STARTED! Waiting for timer...</span>';
  
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    chrome.tabs.sendMessage(tabs[0].id, {
      action: "startAutomation",
      orderIds: orderIds,
      apiKey: apiKey
    }, (response) => {
      if (chrome.runtime.lastError) {
        statusDiv.innerHTML = '<span class="error">❌ Error: Refresh Eye2Serve page</span>';
      }
    });
  });
};

// Stop automation
stopBtn.onclick = () => {
  statusDiv.innerHTML = '<span class="error">⛔ Automation STOPPED</span>';
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    chrome.tabs.sendMessage(tabs[0].id, { action: "stopAutomation" }, () => {});
  });
};
