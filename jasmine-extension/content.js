// content.js
// Sahibinden sayfalarından veri çeker ve sayfaya Avcı butonu ekler

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function extractListingData() {
  try {
    const url = window.location.href;
    const idMatch = url.match(/(\d{5,})/);
    const listingId = idMatch ? idMatch[1] : '';

    const title = document.querySelector('h1')?.innerText?.trim() || '';
    
    let price = '';
    const priceH3 = document.querySelector('.classifiedInfo h3') || document.querySelector('.classified-price-container');
    if (priceH3 && priceH3.innerText) {
      const text = priceH3.innerText.trim();
      const priceMatch = text.match(/[\d\.,]+\s*TL/i);
      price = priceMatch ? priceMatch[0] : text.split('\n')[0].trim();
    }

    const detailItems = document.querySelectorAll('.classifiedInfoList li, .classifiedInfo li');
    let location = '';
    let roomCount = '';
    let area = '';

    detailItems.forEach(li => {
      const labelText = li.querySelector('strong')?.innerText?.trim() || '';
      const valueText = li.querySelector('span')?.innerText?.trim() || li.innerText.replace(labelText, '').trim();

      if (labelText.includes('İl / İlçe') || labelText.includes('Konum')) {
        location = valueText.replace(/[\n\r]+/g, ' - ');
      }
      if (labelText.includes('Oda Sayısı')) {
        roomCount = valueText;
      }
      if (labelText.includes('Brüt Metrekare') || labelText.includes('Net Metrekare')) {
        area = valueText;
      }
    });

    let ownerName = '';
    // Hata yapmamak için document yerine document.body kullanıyoruz (document.innerText tanımsızdır)
    const rightPanel = document.querySelector('.classifiedDetailRightSide') || document.querySelector('.classifiedUserContent') || document.body;
    
    const nameEl1 = rightPanel.querySelector('.username-info-area h5, .seller-info-container h5, .user-info-box h5, .store-name');
    if (nameEl1 && nameEl1.innerText) {
      ownerName = nameEl1.innerText.trim();
    }
    
    if (ownerName) {
        ownerName = ownerName.replace(/Favori Satıcılarıma ekle/gi, '')
                             .replace(/Uyarı/gi, '')
                             .replace(/Efe Eren Akar/gi, '')
                             .replace(/Tüm ilanları/gi, '')
                             .trim();
    }

    // Eğer üstteki seçici işe yaramazsa, "Hesap açma" tarihinin bir üst satırındaki veya 
    // "Yetki Belge No"nun hemen altındaki veya "Cep"in üstündeki kişiyi bul
    if (!ownerName) {
      const panelText = rightPanel.innerText || '';
      const rightTextLines = panelText.split('\n').map(l => l.trim()).filter(l => l.length > 2);
      
      const dateIndex = rightTextLines.findIndex(l => l.includes('Hesap açma tarihi'));
      if (dateIndex > 0) {
        ownerName = rightTextLines[dateIndex - 1];
      }
      
      // Hala bulamadıysa, belki Emlakçı (Yetki Belgesi No yazan yerin altındaki isim)
      if (!ownerName) {
         const yetkiIndex = rightTextLines.findIndex(l => l.includes('Yetki Belge No'));
         if (yetkiIndex >= 0 && rightTextLines.length > yetkiIndex + 1) {
             ownerName = rightTextLines[yetkiIndex + 1];
         }
      }
      
      if (ownerName) {
          ownerName = ownerName.replace(/Favori Satıcılarıma ekle/gi, '')
                               .replace(/Tüm ilanları/gi, '')
                               .trim();
      }
    }
    
    let ownerPhone = '';
    const allText = (rightPanel.innerText || '') + ' ' + (document.body.innerText || '');
    
    // Güçlendirilmiş Regex: Boşluklar esnek bırakıldı
    const regex1 = /(?:0|90|\+90)?\s*\(?\s*([543]\d{2})\s*\)?\s*(\d{3})\s*[\-\s]*(\d{2})\s*[\-\s]*(\d{2})/g;
    const regex2 = /05\d{9}/g;

    let match = regex1.exec(allText);
    if (match) {
      ownerPhone = `0 (${match[1]}) ${match[2]} ${match[3]} ${match[4]}`;
    } else {
      let match2 = regex2.exec(allText);
      if (match2) {
        const p = match2[0];
        ownerPhone = `0 (${p.substring(1,4)}) ${p.substring(4,7)} ${p.substring(7,9)} ${p.substring(9,11)}`;
      }
    }

    return { url, listingId, title, price, location, roomCount, area, ownerName, ownerPhone };
  } catch (error) {
    console.error('Avcı Eklentisi Hatası:', error);
    return null;
  }
}

function clickShowPhoneButton() {
  const btnSelectors = ['#phoneInfoPart a', '.show-phone', 'a[href*="showPhone"]', '#phoneInfoPart'];
  for (const sel of btnSelectors) {
    const btn = document.querySelector(sel);
    if (btn) {
      btn.click();
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------
// YÜZEN AVCI BUTONU (INJECTED UI)
// ---------------------------------------------------------

function injectHunterButton() {
  // Sadece ilan detay sayfasındaysa butonu ekle
  if (!window.location.href.includes('/ilan/')) return;
  
  if (document.getElementById('jasmine-hunter-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'jasmine-hunter-btn';
  btn.innerText = '🎯 Avcıya Ekle';
  btn.style.position = 'fixed';
  btn.style.bottom = '30px';
  btn.style.right = '30px';
  btn.style.zIndex = '999999';
  btn.style.padding = '15px 25px';
  btn.style.backgroundColor = '#f59e0b';
  btn.style.color = '#000';
  btn.style.border = 'none';
  btn.style.borderRadius = '50px';
  btn.style.fontWeight = 'bold';
  btn.style.fontSize = '16px';
  btn.style.boxShadow = '0 10px 25px rgba(245, 158, 11, 0.5)';
  btn.style.cursor = 'pointer';
  btn.style.transition = 'all 0.3s ease';

  btn.addEventListener('mouseenter', () => {
    btn.style.transform = 'scale(1.05)';
    btn.style.backgroundColor = '#fbbf24';
  });
  
  btn.addEventListener('mouseleave', () => {
    btn.style.transform = 'scale(1)';
    btn.style.backgroundColor = '#f59e0b';
  });

  btn.addEventListener('click', async () => {
    btn.innerText = '⏳ Bekleniyor...';
    btn.style.backgroundColor = '#9ca3af';
    
    // Telefon butonuna tıkla ve bekle (numarayı açmak için)
    clickShowPhoneButton();
    await sleep(2000); // Ajax yanıtı için 2 saniye bekle
    
    const data = extractListingData();
    if (!data || !data.title || !data.url) {
      btn.innerText = '❌ Hata Oluştu';
      btn.style.backgroundColor = '#ef4444';
      btn.style.color = 'white';
      setTimeout(() => {
        btn.innerText = '🎯 Tekrar Dene';
        btn.style.backgroundColor = '#f59e0b';
        btn.style.color = 'black';
      }, 3000);
      return;
    }

    // Storage'a kaydet
    chrome.storage.local.get(['savedListings'], function(result) {
      let listings = result.savedListings || [];
      // Mükerrer kaydı önle
      if (!listings.find(l => l.url === data.url)) {
        listings.push(data);
        chrome.storage.local.set({ savedListings: listings }, function() {
          btn.innerText = '✅ Hafızaya Kaydedildi';
          btn.style.backgroundColor = '#10b981'; // green
          btn.style.color = 'white';
        });
      } else {
         btn.innerText = '⚠️ Zaten Kaydedilmiş';
         btn.style.backgroundColor = '#3b82f6'; // blue
         btn.style.color = 'white';
      }
    });
  });

  document.body.appendChild(btn);
}

// Sayfa yüklendiğinde butonu yerleştir
window.addEventListener('load', () => {
  setTimeout(injectHunterButton, 1000);
});
