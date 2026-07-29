document.addEventListener('DOMContentLoaded', async () => {
  const appUrlInput = document.getElementById('appUrl');
  const authorizationInput = document.getElementById('sourceAuthorizationId');
  const transferButton = document.getElementById('transferButton');
  const exportButton = document.getElementById('exportButton');
  const status = document.getElementById('status');
  const jobLink = document.getElementById('jobLink');

  const stored = await chrome.storage.local.get([
    'jasmineAppUrl',
    'sourceAuthorizationId',
  ]);
  appUrlInput.value =
    stored.jasmineAppUrl || 'https://jpp-ufeb.vercel.app';
  authorizationInput.value = stored.sourceAuthorizationId || '';

  function setStatus(message, kind = 'info') {
    status.textContent = message;
    status.dataset.kind = kind;
  }

  async function collectSnapshot() {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id || !tab.url?.startsWith('https://www.sahibinden.com/')) {
      throw new Error(
        'Önce filtrelenmiş Sahibinden arama sonuçları sekmesini açın.'
      );
    }
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    });
    const snapshot = await chrome.tabs.sendMessage(tab.id, {
      action: 'collect_visible_search',
    });
    if (!snapshot?.ok) {
      throw new Error(snapshot?.error || 'Arama sonuçları okunamadı.');
    }
    return snapshot.data;
  }

  transferButton.addEventListener('click', async () => {
    transferButton.disabled = true;
    exportButton.disabled = true;
    jobLink.hidden = true;
    setStatus('Açık aramadaki görünür satırlar hazırlanıyor…');
    try {
      const snapshot = await collectSnapshot();

      const appUrl = appUrlInput.value.trim().replace(/\/+$/, '');
      const sourceAuthorizationId = authorizationInput.value.trim();
      await chrome.storage.local.set({
        jasmineAppUrl: appUrl,
        sourceAuthorizationId,
      });
      const response = await fetch(
        `${appUrl}/api/fabrika/hunting/extension-sync`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...snapshot,
            ...(sourceAuthorizationId ? { sourceAuthorizationId } : {}),
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Avcı işi oluşturulamadı.');
      }
      setStatus(
        `${data.visibleRowsAccepted} görünür satır kabul edildi. İş kuyruğa alındı.`,
        'success'
      );
      jobLink.href = `${appUrl}${data.jobUrl}`;
      jobLink.hidden = false;
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : 'Aktarım tamamlanamadı.',
        'error'
      );
    } finally {
      transferButton.disabled = false;
      exportButton.disabled = false;
    }
  });

  exportButton.addEventListener('click', async () => {
    transferButton.disabled = true;
    exportButton.disabled = true;
    setStatus('Görünür ilanlar JSON paketi için hazırlanıyor…');
    try {
      const snapshot = await collectSnapshot();
      if (!snapshot.visibleRows.length) {
        throw new Error('Bu sayfada aktarılabilir görünür ilan bulunamadı.');
      }
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        searchUrl: snapshot.searchUrl,
        listings: snapshot.visibleRows,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = `jasmine_ilanlar_${Date.now()}.json`;
      anchor.click();
      URL.revokeObjectURL(downloadUrl);
      setStatus(
        `${snapshot.visibleRows.length} görünür ilan JSON paketine yazıldı.`,
        'success'
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : 'Paket oluşturulamadı.',
        'error'
      );
    } finally {
      transferButton.disabled = false;
      exportButton.disabled = false;
    }
  });
});
