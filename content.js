let automationActive = false;
let targetOrderIds = [];

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "startAutomation") {
    automationActive = true;
    targetOrderIds = message.orderIds.split(",").map(e => e.trim());
    waitForTimerAndBid();
  }
  if (message.action === "stopAutomation") {
    automationActive = false;
  }
});

function waitForTimerAndBid() {
  // Adjust selector for "Starts in" timer
  const timerSelector = 'div:contains("Starts in"), span:contains("Starts in")';
  const timerElement = Array.from(document.querySelectorAll("div,span"))
    .find(el => el.textContent.match(/Starts in/i));
  if (!timerElement) return setTimeout(waitForTimerAndBid, 1000);

  const obs = new MutationObserver(() => {
    if (!automationActive) { obs.disconnect(); return; }
    if (timerElement.textContent.match(/Starts in\s*0:0*:0*/i)) {
      obs.disconnect();
      setTimeout(doBidding, 1500);
    }
  });
  obs.observe(timerElement, { childList: true, subtree: true });
}

function doBidding() {
  if (!automationActive) return;
  // Adjust these selectors based on your table structure:
  const rows = Array.from(document.querySelectorAll('table tbody tr'));
  rows.forEach(row => {
    const cells = row.querySelectorAll("td");
    // These column indexes may need adjustment!
    const freightCell = cells[11]; // Freight column
    const bidInput = row.querySelector('input[aria-label="Bid Amount"]');
    const orderIdCell = cells[13]; // SAP Order ID column
    const saveBtn = row.querySelector('button[title="Save"]') || document.querySelector('#saveButton');

    // const saveBtn = document.querySelector('button[title="Save"], button:contains("Save")');

    if (!freightCell || !bidInput || !orderIdCell) return;
    const orderId = orderIdCell.textContent.trim();
    if (!targetOrderIds.includes(orderId)) return;

    const freight = parseFloat(freightCell.textContent.trim());
    if (isNaN(freight)) return;

    bidInput.removeAttribute("disabled");
    bidInput.value = freight - 1;
    bidInput.dispatchEvent(new Event('input', { bubbles: true }));

    setTimeout(() => {
      saveBtn && saveBtn.click();
      setTimeout(detectCaptcha, 700);
    }, 300); // Give a small delay for DOM update
  });
}

function detectCaptcha() {
  // Guessing modal selectors, update as required!
  const modal = document.querySelector('.modal-captcha,[id*="captcha"],.captcha-dialog');
  if (modal && modal.offsetParent !== null) {
    console.log("CAPTCHA modal detected", modal);
    // Leave placeholder for future logic
  }
}
