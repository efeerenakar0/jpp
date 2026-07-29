(() => {
  if (globalThis.__JASMINE_AVCI_V2__) return;
  globalThis.__JASMINE_AVCI_V2__ = true;

  function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function listingIdFromUrl(value) {
    try {
      const url = new URL(value, location.href);
      const match = url.pathname.match(/(?:-|\/)(\d{5,20})(?:\/|$)/);
      return match?.[1] || '';
    } catch {
      return '';
    }
  }

  function collectVisibleRows() {
    if (location.hostname !== 'www.sahibinden.com') {
      throw new Error('Bu işlem yalnızca www.sahibinden.com üzerinde kullanılabilir.');
    }

    const rows = Array.from(
      document.querySelectorAll(
        'tr.searchResultsItem, li.searchResultsItem, [data-id].searchResultsItem'
      )
    ).filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    const seen = new Set();
    const visibleRows = [];
    for (const row of rows.slice(0, 100)) {
      const anchor = row.querySelector('a[href*="/ilan/"]');
      if (!anchor) continue;
      const url = new URL(anchor.getAttribute('href'), location.href).href;
      const listingId =
        cleanText(row.getAttribute('data-id')) || listingIdFromUrl(url);
      if (!listingId || seen.has(listingId)) continue;
      seen.add(listingId);
      const title =
        cleanText(anchor.getAttribute('title')) ||
        cleanText(row.querySelector('.classifiedTitle, .searchResultsTitleValue')?.textContent) ||
        cleanText(anchor.textContent);
      if (!title) continue;
      visibleRows.push({
        listingId,
        url,
        title,
        price: cleanText(
          row.querySelector('.searchResultsPriceValue, .classified-price')?.textContent
        ),
        location: cleanText(
          row.querySelector('.searchResultsLocationValue, .classified-location')?.textContent
        ),
      });
    }
    return {
      searchUrl: location.href,
      visibleRows,
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.action !== 'collect_visible_search') return false;
    try {
      sendResponse({ ok: true, data: collectVisibleRows() });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : 'Sayfa okunamadı.',
      });
    }
    return true;
  });
})();
