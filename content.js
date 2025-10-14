let automationActive = false;
let targetOrderIds = [];
let openaiApiKey = "";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startAutomation") {
    automationActive = true;
    
    // Parse Order IDs - ANY FORMAT
    let orderIds = message.orderIds;
    targetOrderIds = orderIds
      .split(/[,\n\s]+/)
      .map(e => e.trim())
      .filter(e => e && /^\d+$/.test(e));
    
    openaiApiKey = message.apiKey;
    console.log("RANK 1 MODE for:", targetOrderIds);
    waitForTimerAndBid();
    sendResponse({ status: "started" });
  }
  if (message.action === "stopAutomation") {
    automationActive = false;
    console.log("Stopped");
    sendResponse({ status: "stopped" });
  }
  return true;
});

function waitForTimerAndBid() {
  const timerElement = Array.from(document.querySelectorAll("div, span"))
    .find(el => el.textContent.match(/Starts in/i));
  
  if (!timerElement) {
    console.log("Searching timer...");
    return setTimeout(waitForTimerAndBid, 500);
  }

  console.log("Timer found:", timerElement.textContent);
  prepareForBidding();

  const obs = new MutationObserver(() => {
    if (!automationActive) { 
      obs.disconnect(); 
      return; 
    }
    
    const timerText = timerElement.textContent;
    console.log("⏱️", timerText);
    
    if (timerText.match(/Starts in\s*0:0:0/i) || timerText.match(/^0:0:0$/)) {
      console.log("TIMER ZERO - GO GO GO!");
      obs.disconnect();
      setTimeout(doBidding, 100);
    }
  });

  obs.observe(timerElement, { childList: true, subtree: true, characterData: true });
}

let cachedData = [];

function prepareForBidding() {
  console.log("PRE-CACHING data...");
  
  const rows = Array.from(document.querySelectorAll('table tbody tr'));
  console.log(`Found ${rows.length} rows`);
  
  cachedData = [];
  
  rows.forEach((row, rowIndex) => {
    const cells = row.querySelectorAll("td");
    
    if (cells.length < 10) return;
    
    // Smart column detection
    let sapOrderId = null;
    let freight = null;
    
    cells.forEach(cell => {
      const text = cell.textContent.trim();
      
      // SAP Order ID: 10-digit number
      if (/^\d{10}$/.test(text)) {
        sapOrderId = text;
      }
      
     
      if (/^\d{1,4}$/.test(text)) {
        const num = parseFloat(text);
        if (num > 0 && num <= 9999) {
          freight = num;
        }
      }
    });
    
    const bidInput = row.querySelector('input[aria-label="Bid Amount"]');
    
    if (!sapOrderId || !freight || !bidInput) return;
    
    // Only process if Order ID is in YOUR list
    if (targetOrderIds.includes(sapOrderId)) {
      const bidAmount = freight - 1;
      
      cachedData.push({
        row: row,
        bidInput: bidInput,
        orderId: sapOrderId,
        freight: freight,
        bidAmount: bidAmount
      });
      
      console.log(`CACHED: ${sapOrderId} | Freight: ${freight} → Bid: ${bidAmount}`);
    } else {
      console.log(`SKIPPED: ${sapOrderId} (not in your list)`);
    }
  });
  
  console.log(`READY: ${cachedData.length} orders cached`);
  
  if (cachedData.length === 0) {
    console.log("NO ORDERS MATCHED! Check:");
    console.log("  Your IDs:", targetOrderIds);
  }
}

function doBidding() {
  if (!automationActive || cachedData.length === 0) {
    console.log("No data");
    return;
  }
  
  console.log("FILLING BIDS...");
  
  cachedData.forEach((data, index) => {
    setTimeout(() => {
      fillAndSave(data);
    }, index * 300);
  });
}

function fillAndSave(data) {
  const { bidInput, orderId, bidAmount } = data;
  
  console.log(`FILLING: ${orderId} = ${bidAmount}`);
  
  bidInput.removeAttribute("readonly");
  bidInput.removeAttribute("disabled");
  bidInput.focus();
  bidInput.value = bidAmount;
  
  bidInput.dispatchEvent(new Event('input', { bubbles: true }));
  bidInput.dispatchEvent(new Event('change', { bubbles: true }));
  bidInput.blur();
  
  setTimeout(() => {
    clickSave(orderId);
  }, 400);
}

function clickSave(orderId) {
  const saveBtn = document.querySelector('button[title="Save"]') ||
                 Array.from(document.querySelectorAll('button'))
                   .find(btn => btn.textContent.trim() === 'Save');
  
  if (saveBtn) {
    console.log(`SAVE: ${orderId}`);
    saveBtn.click();
    setTimeout(() => waitForCaptcha(orderId), 600);
  } else {
    console.log(`No Save button for ${orderId}`);
  }
}

function waitForCaptcha(orderId) {
  let attempts = 0;
  const checkInterval = setInterval(() => {
    if (!automationActive || attempts++ > 30) {
      clearInterval(checkInterval);
      return;
    }
    
    const modal = document.querySelector('[role="dialog"]') ||
                 document.querySelector('.sapMDialog') ||
                 document.querySelector('[id*="dialog"]');
    
    if (modal && modal.offsetParent !== null) {
      clearInterval(checkInterval);
      console.log(`CAPTCHA for ${orderId}`);
      solveCaptcha(modal, orderId);
    }
  }, 100);
}

async function solveCaptcha(modal, orderId) {
  try {
    const img = modal.querySelector('img');
    const input = modal.querySelector('input[type="text"]');
    const yesBtn = Array.from(modal.querySelectorAll('button'))
                     .find(b => b.textContent.match(/yes|ok|submit/i));
    
    if (!img || !input || !yesBtn) {
      console.log("CAPTCHA elements missing");
      return;
    }
    
    console.log("Solving CAPTCHA with OpenAI GPT-4o Vision...");
    console.log("   (Handles uppercase, lowercase, numbers, mixed)");
    
    const solution = await callOpenAI(img.src);
    
    if (solution) {
      console.log(`SOLVED: "${solution}"`);
      
      input.value = solution;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      
      setTimeout(() => {
        console.log(`Clicking YES: ${orderId}`);
        yesBtn.click();
        setTimeout(handleConfirmation, 500);
      }, 300);
    } else {
      console.log("Failed to solve CAPTCHA");
    }
  } catch (error) {
    console.error("CAPTCHA error:", error);
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
              text: "This is a CAPTCHA image. Extract ONLY the text/characters you see (uppercase, lowercase, numbers, or mixed). Return ONLY the exact characters with correct case, nothing else. No explanations, no extra text."
            },
            {
              type: "image_url",
              image_url: { url: imageUrl }
            }
          ]
        }],
        max_tokens: 50,
        temperature: 0.1
      })
    });
    
    const data = await response.json();
    
    if (data.error) {
      console.error("OpenAI API Error:", data.error);
      return null;
    }
    
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error("OpenAI fetch error:", error);
    return null;
  }
}

function handleConfirmation() {
  setTimeout(() => {
    const okBtn = Array.from(document.querySelectorAll('button'))
                    .find(b => b.textContent.match(/ok/i));
    
    if (okBtn) {
      console.log("Clicking OK");
      okBtn.click();
      setTimeout(checkRank, 1000);
    }
  }, 500);
}

function checkRank() {
  console.log("Checking rank...");
  const rank1 = Array.from(document.querySelectorAll('td'))
                  .filter(c => c.textContent.trim() === '01' || c.textContent.trim() === '1');
  
  if (rank1.length > 0) {
    console.log("RANK 1 ACHIEVED!");
  }
}

console.log("RANK 1 AUTO-BIDDER LOADED!");
