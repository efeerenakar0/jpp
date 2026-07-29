document.addEventListener('DOMContentLoaded', async () => {
  const appUrlInput = document.getElementById('appUrl');
  const authorizationInput = document.getElementById('sourceAuthorizationId');
  const transferButton = document.getElementById('transferButton');
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

  transferButton.addEventListener('click', async () => {
    transferButton.disabled = true;
    jobLink.hidden = true;
    setStatus('Açık aramadaki görünür satırlar hazırlanıyor…');
    try {
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
            ...snapshot.data,
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
    }
  });
});
