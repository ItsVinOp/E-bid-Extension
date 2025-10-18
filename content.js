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
      setTimeout(executeBidding, 50); // ⚡ FAST: 50ms
    } else {
      console.log("⏳ No timer, retrying...");
      if (automationActive) setTimeout(checkTimerAndDecide, 300);
    }
    return;
  }

  const timerText = timerElement.textContent;
  console.log("✅ Timer found:", timerText.substring(0, 80));
  
  if (timerText.match(/expires?\s+in/i)) {
    console.log("🔥🔥🔥 BIDDING ALREADY ACTIVE - EXECUTING IMMEDIATELY!");
    setTimeout(executeBidding, 50); // ⚡ FAST: 50ms
  }
  else if (timerText.match(/starts?\s+in/i)) {
    if (timerText.match(/\b0+:0+:0+\b/)) {
      console.log("🔥 Timer at 0:0:0 - EXECUTING NOW!");
      setTimeout(executeBidding, 50); // ⚡ FAST: 50ms
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
      setTimeout(executeBidding, 50); // ⚡ FAST: 50ms
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
      setTimeout(executeBidding, 10); // ⚡ ULTRA FAST: 10ms!
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

function prepareForBidding() {
  console.log("⚡ PRE-CACHING data...");
  
  const tbody = document.querySelector('#__xmlview0--idUtclVCVendorAssignmentTable-tblBody');
  if (!tbody) {
    console.log("⚠️ No table body found");
    return;
  }
  
  const rows = Array.from(tbody.querySelectorAll('tr'));
  console.log(`📊 Found ${rows.length} rows`);
  
  cachedData = [];
  
  rows.forEach((row, rowIndex) => {
    const freightCell = document.getElementById(`__text48-__xmlview0--idUtclVCVendorAssignmentTable-${rowIndex}`);
    const bidInput = document.getElementById(`__xmlview0--idBidAmount-__xmlview0--idUtclVCVendorAssignmentTable-${rowIndex}-inner`);
    
    if (!freightCell || !bidInput) {
      return;
    }
    
    const valueText = freightCell.innerText;
    const numericValue = parseFloat(valueText.replace(/[^\d.]/g, ''));
    const bidAmount = numericValue - 1;
    
    const cells = row.querySelectorAll("td");
    let sapOrderId = null;
    
    cells.forEach(cell => {
      const text = cell.textContent.trim();
      if (/^\d{10}$/.test(text)) {
        sapOrderId = text;
      }
    });
    
    if (!sapOrderId) return;
    
    if (targetOrderIds.length === 0 || targetOrderIds.includes(sapOrderId)) {
      cachedData.push({
        rowIndex: rowIndex,
        bidInput: bidInput,
        orderId: sapOrderId,
        freight: numericValue,
        bidAmount: bidAmount
      });
      
      console.log(`✅ ${sapOrderId} | ${numericValue} → ${bidAmount}`);
    }
  });
  
  console.log(`⚡ READY: ${cachedData.length} orders cached`);
}

// ⚡ ULTRA FAST: Fill all bids instantly, no delays!
function executeBidding() {
  if (!automationActive || cachedData.length === 0) {
    console.log("⚠️ No data");
    return;
  }
  
  console.log("💰 FILLING ALL BIDS INSTANTLY!");
  
  // ⚡ PARALLEL: Fill ALL at once (no delays between bids!)
  cachedData.forEach((data) => {
    fillBidInputInstant(data);
  });
  
  // ⚡ FAST: Click Save immediately after filling
  setTimeout(() => {
    clickSaveButton();
  }, 100); // Just 100ms to ensure all fills complete
}

// ⚡ INSTANT fill - no polling, no waiting!
function fillBidInputInstant(data) {
  const { bidInput, orderId, bidAmount } = data;
  
  // ⚡ INSTANT: Just fill it!
  bidInput.value = bidAmount.toString();
  bidInput.dispatchEvent(new Event('input', { bubbles: true }));
  bidInput.dispatchEvent(new Event('change', { bubbles: true }));
  
  console.log(`⚡ ${orderId} = ${bidAmount}`);
}

function clickSaveButton() {
  console.log(`💾 Clicking Save...`);
  
  const saveBtn = Array.from(document.querySelectorAll('button')).find(btn => {
    return btn.textContent.trim() === 'Save';
  });
  
  if (saveBtn) {
    saveBtn.click();
    console.log(`✅ Save clicked!`);
    
    // ⚡ FAST: Start looking for CAPTCHA immediately
    setTimeout(() => waitForCaptcha(), 100);
  } else {
    console.log(`❌ Save not found!`);
  }
}

// ⚡ FAST: 50ms polling intervals (vs 100ms)
function waitForCaptcha() {
  console.log(`⏳ Waiting for CAPTCHA...`);
  
  const maxAttempts = 300; // 15 seconds at 50ms intervals
  let attempts = 0;
  
  const checkInterval = setInterval(() => {
    if (!automationActive || attempts++ > maxAttempts) {
      clearInterval(checkInterval);
      if (attempts > maxAttempts) {
        console.log(`⚠️ CAPTCHA timeout`);
      }
      return;
    }
    
    const captchaImage = document.getElementById('CaptchaImage');
    
    if (captchaImage && captchaImage.offsetParent !== null) {
      clearInterval(checkInterval);
      console.log(`🔐 CAPTCHA FOUND!`);
      solveCaptcha(captchaImage);
    }
  }, 50); // ⚡ FAST: 50ms polling
}

async function solveCaptcha(captchaImage) {
  try {
    const src = captchaImage.getAttribute('src');
    
    if (!src || !src.startsWith('data:image')) {
      console.log("❌ Invalid CAPTCHA src");
      return;
    }
    
    console.log("🖼️ Solving CAPTCHA with OpenAI...");
    
    const captchaResult = await callOpenAI(src);
    
    if (captchaResult) {
      console.log(`✅ SOLVED: "${captchaResult}"`);
      
      const captchaInput = document.evaluate(
        "//input[@placeholder='Enter Captcha']",
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      ).singleNodeValue;
      
      if (captchaInput) {
        captchaInput.value = captchaResult;
        captchaInput.dispatchEvent(new Event('input', { bubbles: true }));
        captchaInput.dispatchEvent(new Event('change', { bubbles: true }));
        
        console.log(`✅ CAPTCHA filled`);
        
        // ⚡ FAST: Click Yes immediately
        setTimeout(() => {
          const yesButton = document.evaluate(
            "//bdi[normalize-space(text())='Yes']",
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          ).singleNodeValue;
          
          if (yesButton) {
            yesButton.click();
            console.log(`✅ YES clicked!`);
            
            setTimeout(checkRank, 1000);
          } else {
            console.log(`❌ YES not found`);
          }
        }, 100); // ⚡ FAST: 100ms
      } else {
        console.log(`❌ CAPTCHA input not found`);
      }
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
              text: "Extract ONLY the exact text from this CAPTCHA image. Return just the characters with correct case, no explanations."
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
    
    if (data.error) {
      console.error("❌ OpenAI error:", data.error);
      return null;
    }
    
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error("❌ Fetch error:", error);
    return null;
  }
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

console.log("✅ ULTRA-FAST RANK 1 BIDDER - LOADED! ⚡");
