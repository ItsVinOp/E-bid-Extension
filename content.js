let automationActive = false;
let targetOrderIds = [];
let openaiApiKey = "";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startAutomation") {
    automationActive = true;
    
    let orderIds = message.orderIds;
    if (orderIds.includes(',')) {
      targetOrderIds = orderIds.split(",").map(e => e.trim()).filter(e => e);
    } else {
      targetOrderIds = orderIds.split("\n").map(e => e.trim()).filter(e => e);
    }
    
    openaiApiKey = message.apiKey;
    console.log("🚀 RANK 1 MODE ACTIVATED for:", targetOrderIds);
    waitForTimerAndBid();
    sendResponse({ status: "started" });
  }
  if (message.action === "stopAutomation") {
    automationActive = false;
    console.log("⛔ Automation stopped");
    sendResponse({ status: "stopped" });
  }
  return true;
});

function waitForTimerAndBid() {
  const timerElement = Array.from(document.querySelectorAll("div, span"))
    .find(el => el.textContent.match(/Starts in/i));
  
  if (!timerElement) {
    console.log("⏳ Searching for timer...");
    return setTimeout(waitForTimerAndBid, 500);
  }

  console.log("✅ Timer found:", timerElement.textContent);
  prepareForBidding();

  const obs = new MutationObserver(() => {
    if (!automationActive) { 
      obs.disconnect(); 
      return; 
    }
    
    const timerText = timerElement.textContent;
    console.log("⏱️", timerText);
    
    if (timerText.match(/Starts in\s*0:0:0/i) || timerText.match(/^0:0:0$/)) {
      console.log("🔥🔥🔥 TIMER ZERO - EXECUTING BIDS NOW! 🔥🔥🔥");
      obs.disconnect();
      setTimeout(doBidding, 100);
    }
  });

  obs.observe(timerElement, { 
    childList: true, 
    subtree: true, 
    characterData: true 
  });
}

let cachedData = [];

function prepareForBidding() {
  console.log("⚡ PRE-CACHING: Loading all order data...");
  
  const rows = Array.from(document.querySelectorAll('table tbody tr'));
  cachedData = [];
  
  rows.forEach((row, index) => {
    const cells = row.querySelectorAll("td");
    
    if (cells.length < 14) return;
    
    const freightCell = cells[11];
    const orderIdCell = cells[13];
    const bidInput = row.querySelector('input[aria-label="Bid Amount"]');
    
    if (!freightCell || !bidInput || !orderIdCell) return;
    
    const orderId = orderIdCell.textContent.trim();
    const freight = parseFloat(freightCell.textContent.trim());
    
    if (targetOrderIds.includes(orderId) && !isNaN(freight)) {
      const bidAmount = freight - 1;
      
      cachedData.push({
        row: row,
        bidInput: bidInput,
        orderId: orderId,
        freight: freight,
        bidAmount: bidAmount
      });
      
      console.log(`✅ CACHED: Order ${orderId} | Freight: ${freight} → Bid: ${bidAmount}`);
    }
  });
  
  console.log(`⚡ READY: ${cachedData.length} orders pre-loaded for INSTANT execution`);
}

function doBidding() {
  if (!automationActive || cachedData.length === 0) {
    console.log("⚠️ No data to process");
    return;
  }
  
  console.log("💰 FILLING ALL BIDS AT MAX SPEED...");
  
  cachedData.forEach((data, index) => {
    setTimeout(() => {
      fillBidInstantly(data);
    }, index * 200);
  });
}

function fillBidInstantly(data) {
  const { bidInput, orderId, bidAmount } = data;
  
  console.log(`⚡ FILLING: ${orderId} = ${bidAmount}`);
  
  bidInput.removeAttribute("readonly");
  bidInput.removeAttribute("disabled");
  bidInput.readOnly = false;
  
  bidInput.focus();
  bidInput.value = bidAmount;
  
  bidInput.dispatchEvent(new Event('input', { bubbles: true }));
  bidInput.dispatchEvent(new Event('change', { bubbles: true }));
  bidInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
  bidInput.blur();
  
  setTimeout(() => {
    clickSave(orderId);
  }, 300);
}

function clickSave(orderId) {
  const saveBtn = document.querySelector('button[title="Save"]') ||
                 Array.from(document.querySelectorAll('button'))
                   .find(btn => btn.textContent.trim() === 'Save');
  
  if (saveBtn) {
    console.log(`💾 CLICKING SAVE for ${orderId}...`);
    saveBtn.click();
    
    setTimeout(() => {
      waitForCaptchaModal(orderId);
    }, 500);
  } else {
    console.log(`❌ Save button not found for ${orderId}`);
  }
}

function waitForCaptchaModal(orderId) {
  let attempts = 0;
  const maxAttempts = 30;
  
  const checkInterval = setInterval(() => {
    if (!automationActive || attempts++ > maxAttempts) {
      clearInterval(checkInterval);
      return;
    }
    
    const modal = document.querySelector('[role="dialog"]') ||
                 document.querySelector('.sapMDialog') ||
                 document.querySelector('[id*="dialog"]');
    
    if (modal && modal.offsetParent !== null) {
      clearInterval(checkInterval);
      console.log(`🔐 CAPTCHA MODAL DETECTED for ${orderId}!`);
      solveCaptchaWithAI(modal, orderId);
    }
  }, 100);
}

async function solveCaptchaWithAI(modal, orderId) {
  try {
    const captchaImg = modal.querySelector('img');
    const captchaInput = modal.querySelector('input[type="text"]');
    const yesBtn = Array.from(modal.querySelectorAll('button'))
                     .find(b => b.textContent.match(/yes|ok|submit/i));
    
    if (!captchaImg || !captchaInput || !yesBtn) {
      console.log("❌ CAPTCHA elements not found");
      return;
    }
    
    console.log("🖼️ CAPTCHA image found, sending to OpenAI Vision...");
    
    const imgSrc = captchaImg.src;
    const solution = await solveWithOpenAI(imgSrc);
    
    if (solution) {
      console.log(`✅ CAPTCHA SOLVED: "${solution}"`);
      
      captchaInput.value = solution;
      captchaInput.dispatchEvent(new Event('input', { bubbles: true }));
      
      setTimeout(() => {
        console.log(`✅ Clicking YES for ${orderId}...`);
        yesBtn.click();
        
        setTimeout(() => {
          handleConfirmationMessage();
        }, 500);
      }, 200);
    } else {
      console.log("❌ Failed to solve CAPTCHA");
    }
    
  } catch (error) {
    console.error("❌ CAPTCHA solving error:", error);
  }
}

async function solveWithOpenAI(imageUrl) {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "This is a CAPTCHA image. Extract ONLY the text/characters you see. Return ONLY the characters, nothing else. No explanations."
              },
              {
                type: "image_url",
                image_url: { url: imageUrl }
              }
            ]
          }
        ],
        max_tokens: 50,
        temperature: 0.1
      })
    });
    
    const data = await response.json();
    
    if (data.choices && data.choices[0]) {
      const solution = data.choices[0].message.content.trim();
      return solution;
    }
    
    return null;
  } catch (error) {
    console.error("OpenAI API error:", error);
    return null;
  }
}

function handleConfirmationMessage() {
  setTimeout(() => {
    const okBtn = Array.from(document.querySelectorAll('button'))
                    .find(b => b.textContent.match(/ok/i));
    
    if (okBtn) {
      console.log("✅ Clicking OK on confirmation...");
      okBtn.click();
      
      setTimeout(() => {
        checkBidRank();
      }, 1000);
    }
  }, 500);
}

function checkBidRank() {
  console.log("🏆 Checking Bid Rank...");
  
  const rankCells = Array.from(document.querySelectorAll('td'))
                     .filter(cell => cell.textContent.trim() === '01' || cell.textContent.trim() === '1');
  
  if (rankCells.length > 0) {
    console.log("🎉🎉🎉 RANK 1 ACHIEVED! 🎉🎉🎉");
  } else {
    console.log("⚠️ Check rank manually");
  }
}

console.log("✅ RANK 1 AUTO-BIDDER WITH AI CAPTCHA LOADED!");
