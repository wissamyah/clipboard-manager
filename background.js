chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['clipboardHistory'], result => {
    if (chrome.runtime.lastError) {
      console.error('Error fetching clipboard history:', chrome.runtime.lastError.message);
      return;
    }
    
    const clipboardHistory = result.clipboardHistory || [];
    console.log("Clipboard Manager installed. Initial history:", clipboardHistory);
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  if (message.action === 'exportClipboard') {
    chrome.storage.local.get(['clipboardHistory'], result => {
      if (chrome.runtime.lastError) {
        console.error('Error fetching clipboard history:', chrome.runtime.lastError.message);
        sendResponse([]);
        return;
      }
      
      sendResponse(result.clipboardHistory || []);
    });
    return true;
  }
});
