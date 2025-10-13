const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const orderIdsField = document.getElementById('orderIds');
const statusDiv = document.getElementById('status');
startBtn.onclick = () => {
  const orderIds = orderIdsField.value.trim();
  if (!orderIds) {
    statusDiv.innerText = "Enter SAP Order IDs!";
    return;
  }
  statusDiv.innerText = "Automation started!";
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    chrome.tabs.sendMessage(tabs[0].id, {
      action: "startAutomation",
      orderIds: orderIds
    });
  });
};
stopBtn.onclick = () => {
  statusDiv.innerText = "Automation stopped.";
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    chrome.tabs.sendMessage(tabs[0].id, { action: "stopAutomation" });
  });
};
