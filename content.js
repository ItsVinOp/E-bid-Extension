let automationActive = false;
let targetOrderIds = [];
let openaiApiKey = "";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startAutomation") {
    automationActive = true;
    
    let orderIds = message.orderIds;
    targetOrderIds = orderIds
      .split(/[,\n\s]+/)
      .map(e => e.trim())
      .filter(e => e && /^\d+$/.test(e));
    
    openaiApiKey = message.apiKey;
    console.log("🚀 RANK 1 MODE ACTIVATED for:", targetOrderIds);
    
    intelligentStart();
    sendResponse({ status: "started" });
  }
  
  if (message.action === "stopAutomation") {
    automationActive = false;
    console.log("⛔ Stopped");
    sendResponse({ status: "stopped" });
  }
  
  return true;
});

function intelligentStart() {
  console.log("🔍 Analyzing bidding status...");
  prepareForBidding();
  checkTimerAndDecide();
}

function checkTimerAndDecide() {
  console.log("⏳ Looking for timer...");
  
  const timerElement = Array.from(document.querySelectorAll("div, span, *"))
    .find(el => {
      const text = el.textContent;
      return text.match(/starts?\s+in/i) || 
             text.match(/expires?\s+in/i) || 
             text.match(/\d+:\d+:\d+/);
    });
  
  if (!timerElement) {
    const bidFields = Array.from(document.querySelectorAll('input'));
    const isEnabled = bidFields.some(f => !f.readOnly && !f.disabled);
    
    if (isEnabled) {
      console.log("🔥 NO TIMER BUT FIELDS ENABLED - EXECUTING NOW!");
      setTimeout(executeBidding, 100);
    } else {
      console.log("⏳ No timer, retrying...");
      if (automationActive) setTimeout(checkTimerAndDecide, 300);
    }
    return;
  }

  const timerText = timerElement.textContent;
  console.log("✅ Timer found:", timerText.substring(0, 80));
  
  if (timerText.match(/expires?\s+in/i)) {
    console.log("🔥🔥🔥 BIDDING ALREADY ACTIVE (Expires in) - EXECUTING IMMEDIATELY!");
    setTimeout(executeBidding, 100);
  }
  else if (timerText.match(/starts?\s+in/i)) {
    if (timerText.match(/\b0+:0+:0+\b/)) {
      console.log("🔥 Timer at 0:0:0 - EXECUTING NOW!");
      setTimeout(executeBidding, 100);
    } else {
      console.log("⏱️ Bidding not started yet - Watching timer...");
      watchTimerForStart(timerElement);
    }
  }
  else {
    const bidFields = Array.from(document.querySelectorAll('input'));
    const isEnabled = bidFields.some(f => !f.readOnly && !f.disabled);
    
    if (isEnabled) {
      console.log("🔥 FIELDS ENABLED - EXECUTING NOW!");
      setTimeout(executeBidding, 100);
    } else {
      console.log("⏱️ Waiting for timer zero...");
      watchTimerForStart(timerElement);
    }
  }
}

function watchTimerForStart(timerElement) {
  const obs = new MutationObserver(() => {
    if (!automationActive) {
      obs.disconnect();
      return;
    }
    
    const timerText = timerElement.textContent;
    
    if (timerText.match(/\b0+:0+:0+\b/)) {
      console.log("🔥 TIMER ZERO - EXECUTING NOW!");
      obs.disconnect();
      setTimeout(executeBidding, 50);
    }
  });

  obs.observe(timerElement, { 
    childList: true, 
    subtree: true, 
    characterData: true 
  });
  
  console.log("✅ Observer active - waiting for 0:0:0...");
}

let cachedData = [];

// ✅ FIXED: Pick LAST 10-digit number (SAP Order ID)
function prepareForBidding() {
  console.log("⚡ PRE-CACHING data...");
  
  const table = document.querySelector('table');
  if (!table) {
    console.log("⚠️ No table");
    return;
  }
  
  const rows = Array.from(table.querySelectorAll('tbody tr'));
  console.log(`📊 Found ${rows.length} rows`);
  
  cachedData = [];
  
  rows.forEach((row, rowIndex) => {
    const cells = row.querySelectorAll("td");
    if (cells.length < 3) return;
    
    // ✅ Collect ALL 10-digit numbers, then pick the LAST one
    let allTenDigitNumbers = [];
    let freightValues = [];
    
    cells.forEach((cell, idx) => {
      const text = cell.textContent.trim();
      
      // Collect ALL 10-digit numbers
      if (/^\d{10}$/.test(text)) {
        allTenDigitNumbers.push({ value: text, column: idx });
      }
      
      // Collect Freight candidates
      if (/^\d{1,4}$/.test(text)) {
        const num = parseInt(text);
        if (num > 0 && num <= 9999) {
          freightValues.push({ value: num, column: idx });
        }
      }
    });
    
    // ✅ Pick LAST 10-digit number as SAP Order ID
    let sapOrderId = null;
    if (allTenDigitNumbers.length > 0) {
      sapOrderId = allTenDigitNumbers[allTenDigitNumbers.length - 1].value;
      console.log(`✅ Row ${rowIndex}: SAP Order ID = "${sapOrderId}" (picked last of ${allTenDigitNumbers.length})`);
    }
    
    // ✅ Pick LARGEST number as Freight
    let freight = null;
    if (freightValues.length > 0) {
      freightValues.sort((a, b) => b.value - a.value);
      freight = freightValues[0].value;
      console.log(`💰 Row ${rowIndex}: Freight = ${freight}`);
    }
    
    // ✅ Better input detection
    const bidInput = row.querySelector('input[aria-label="Bid Amount"]') ||
                     row.querySelector('input[type="text"]') ||
                     row.querySelector('input[type="number"]') ||
                     Array.from(row.querySelectorAll('input')).find(inp => !inp.readOnly);
    
    if (!sapOrderId) {
      console.log(`⚠️ Row ${rowIndex}: No SAP Order ID`);
      return;
    }
    
    if (!freight) {
      console.log(`⚠️ Row ${rowIndex}: No Freight`);
      return;
    }
    
    if (!bidInput) {
      console.log(`⚠️ Row ${rowIndex}: No Bid input found`);
      return;
    }
    
    console.log(`🎯 Row ${rowIndex}: Checking "${sapOrderId}" in`, targetOrderIds);
    
    // Check if in target list
    if (targetOrderIds.includes(sapOrderId)) {
      const bidAmount = freight - 1;
      
      cachedData.push({
        row: row,
        bidInput: bidInput,
        orderId: sapOrderId,
        freight: freight,
        bidAmount: bidAmount
      });
      
      console.log(`✅ MATCHED! ${sapOrderId} | Freight: ${freight} → Bid: ${bidAmount}`);
    } else {
      console.log(`⏭️ SKIPPED: ${sapOrderId}`);
    }
  });
  
  console.log(`⚡ READY: ${cachedData.length} orders cached`);
  
  if (cachedData.length === 0) {
    console.log("⚠️⚠️ NO MATCHING ORDERS!");
    console.log("  Your IDs:", targetOrderIds);
  }
}

function executeBidding() {
  if (!automationActive || cachedData.length === 0) {
    console.log("⚠️ No data");
    return;
  }
  
  console.log("💰 FILLING ALL BIDS NOW!");
  
  cachedData.forEach((data, index) => {
    setTimeout(() => {
      fillBidAndSave(data);
    }, index * 200);
  });
}

function fillBidAndSave(data) {
  const { bidInput, orderId, bidAmount } = data;
  
  console.log(`⚡ FILLING: ${orderId} = ${bidAmount}`);
  
  bidInput.removeAttribute("readonly");
  bidInput.removeAttribute("disabled");
  bidInput.readOnly = false;
  
  bidInput.focus();
  bidInput.value = bidAmount;
  
  bidInput.dispatchEvent(new Event('input', { bubbles: true }));
  bidInput.dispatchEvent(new Event('change', { bubbles: true }));
  bidInput.blur();
  
  setTimeout(() => {
    clickSaveButton(orderId);
  }, 300);
}

function clickSaveButton(orderId) {
  const saveBtn = document.querySelector('button[title="Save"]') ||
                 document.querySelector('button[aria-label="Save"]') ||
                 Array.from(document.querySelectorAll('button'))
                   .find(btn => btn.textContent.trim().match(/^Save$/i));
  
  if (saveBtn) {
    console.log(`💾 SAVE: ${orderId}`);
    saveBtn.click();
    setTimeout(() => waitForCaptcha(orderId), 500);
  } else {
    console.log(`❌ No Save button`);
  }
}

function waitForCaptcha(orderId) {
  let attempts = 0;
  const maxAttempts = 40;
  
  const checkInterval = setInterval(() => {
    if (!automationActive || attempts++ > maxAttempts) {
      clearInterval(checkInterval);
      return;
    }
    
    const modal = document.querySelector('[role="dialog"]') ||
                 document.querySelector('.sapMDialog') ||
                 document.querySelector('[id*="dialog" i]');
    
    if (modal && modal.offsetParent !== null) {
      clearInterval(checkInterval);
      console.log(`🔐 CAPTCHA for ${orderId}`);
      solveCaptcha(modal, orderId);
    }
  }, 100);
}

async function solveCaptcha(modal, orderId) {
  try {
    const img = modal.querySelector('img');
    const input = modal.querySelector('input[type="text"]') ||
                 modal.querySelector('.sapMInput input');
    const yesBtn = Array.from(modal.querySelectorAll('button'))
                     .find(b => b.textContent.match(/yes|ok|submit/i));
    
    if (!img || !input || !yesBtn) {
      console.log("❌ CAPTCHA elements missing");
      return;
    }
    
    console.log("🖼️ Solving with OpenAI...");
    
    const solution = await callOpenAI(img.src);
    
    if (solution) {
      console.log(`✅ SOLVED: "${solution}"`);
      
      input.value = solution;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      
      setTimeout(() => {
        console.log(`✅ AUTO-CLICKING YES for ${orderId}`);
        yesBtn.click();
        setTimeout(handleConfirmation, 600);
      }, 200);
    } else {
      console.log("❌ OpenAI failed");
    }
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

async function callOpenAI(imageUrl) {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract ONLY the exact text from this CAPTCHA. Return just the characters with correct case."
            },
            {
              type: "image_url",
              image_url: { url: imageUrl }
            }
          ]
        }],
        max_tokens: 20,
        temperature: 0
      })
    });
    
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error("OpenAI error:", error);
    return null;
  }
}

function handleConfirmation() {
  setTimeout(() => {
    const okBtn = Array.from(document.querySelectorAll('button'))
                    .find(b => b.textContent.match(/^ok$/i));
    
    if (okBtn) {
      console.log("✅ AUTO-CLICKING OK");
      okBtn.click();
      setTimeout(checkRank, 1000);
    }
  }, 400);
}

function checkRank() {
  console.log("🏆 Checking rank...");
  const rank1 = Array.from(document.querySelectorAll('td'))
                  .filter(c => c.textContent.trim() === '01' || 
                               c.textContent.trim() === '1');
  
  if (rank1.length > 0) {
    console.log("🎉🎉🎉 RANK 1 ACHIEVED!");
  }
}

console.log("✅ RANK 1 AUTO-BIDDER - PRODUCTION READY!");
