// background.js

let isScraping = false;
let scrapedListings = [];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function processLinks(links, senderTabId) {
  if (isScraping) return;
  isScraping = true;
  scrapedListings = [];
  
  let successCount = 0;
  
  const maxLinks = Math.min(links.length, 20);
  
  for (let i = 0; i < maxLinks; i++) {
    if (!isScraping) break; 
    
    const url = links[i];
    
    chrome.runtime.sendMessage({ 
      action: "progress", 
      current: i + 1, 
      total: maxLinks, 
      statusText: `İlan ${i+1}/${maxLinks} açılıyor...` 
    });

    try {
      const tab = await chrome.tabs.create({ url, active: true });
      
      await new Promise(resolve => {
        chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
          if (tabId === tab.id && info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        });
      });

      // Sayfanın yüklenmesini bekle
      await sleep(3000);

      // Telefonu göster butonuna tıkla
      await chrome.tabs.sendMessage(tab.id, { action: "click_phone" }).catch(() => {});
      
      // AJAX sorgusunu bekle
      await sleep(3000);

      // Veriyi çek
      const response = await chrome.tabs.sendMessage(tab.id, { action: "extract_single" }).catch(() => null);
      
      if (response && response.data) {
        scrapedListings.push(response.data);
        successCount++;
      }

      await chrome.tabs.remove(tab.id);

      if (i < maxLinks - 1) {
        // İNSAN SİMÜLASYONU: Bot korumasını aşmak için bekle
        const randomSleep = Math.floor(Math.random() * 4000) + 4000;
        chrome.runtime.sendMessage({ 
          action: "progress", 
          current: i + 1, 
          total: maxLinks, 
          statusText: `Anti-Ban dinlenmesi (${(randomSleep/1000).toFixed(1)} sn)...` 
        });
        await sleep(randomSleep);
      }
      
    } catch (error) {
      console.error(`Error processing ${url}`, error);
    }
  }

  isScraping = false;
  chrome.runtime.sendMessage({ 
    action: "finished", 
    successCount, 
    total: maxLinks 
  });
  
  // JSON dosyasını indir
  if (scrapedListings.length > 0) {
    downloadJSON();
  }
}

function downloadJSON() {
  if (scrapedListings.length === 0) return;
  const jsonString = JSON.stringify(scrapedListings, null, 2);
  // UTF-8 string to Base64
  const encodedString = btoa(unescape(encodeURIComponent(jsonString)));
  const dataUrl = 'data:application/json;base64,' + encodedString;
  
  chrome.downloads.download({
    url: dataUrl,
    filename: 'jasmine_ilanlar.json',
    saveAs: true
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "start_bulk_scrape") {
    processLinks(request.links, sender.tab?.id);
    sendResponse({ started: true });
  } else if (request.action === "download_json") {
    downloadJSON();
    sendResponse({ success: true });
  } else if (request.action === "add_single_and_download") {
    scrapedListings.push(request.data);
    downloadJSON();
    sendResponse({ success: true });
  }
  return true;
});
