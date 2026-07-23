// popup.js
document.addEventListener('DOMContentLoaded', () => {
  const listingCountEl = document.getElementById('listingCount');
  const downloadBtn = document.getElementById('downloadBtn');
  const clearBtn = document.getElementById('clearBtn');
  const statusEl = document.getElementById('status');

  let currentListings = [];

  function updateUI() {
    chrome.storage.local.get(['savedListings'], function(result) {
      currentListings = result.savedListings || [];
      listingCountEl.textContent = currentListings.length;
      
      if (currentListings.length > 0) {
        downloadBtn.disabled = false;
        clearBtn.disabled = false;
      } else {
        downloadBtn.disabled = true;
        clearBtn.disabled = true;
      }
    });
  }

  updateUI();

  downloadBtn.addEventListener('click', () => {
    if (currentListings.length === 0) return;
    
    const jsonString = JSON.stringify(currentListings, null, 2);
    // UTF-8 string to Base64
    const encodedString = btoa(unescape(encodeURIComponent(jsonString)));
    const dataUrl = 'data:application/json;base64,' + encodedString;
    
    chrome.downloads.download({
      url: dataUrl,
      filename: 'jasmine_ilanlar.json',
      saveAs: true
    }, () => {
      statusEl.textContent = "✅ Dosya başarıyla indirildi!";
      setTimeout(() => statusEl.textContent = "", 3000);
    });
  });

  clearBtn.addEventListener('click', () => {
    if (confirm("Hafızadaki tüm ilanlar silinecek. Emin misiniz?")) {
      chrome.storage.local.set({ savedListings: [] }, function() {
        updateUI();
        statusEl.textContent = "🗑️ Hafıza temizlendi!";
        setTimeout(() => statusEl.textContent = "", 3000);
      });
    }
  });
});
