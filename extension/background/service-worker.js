chrome.runtime.onInstalled.addListener(() => {
  console.log('[XAutopilot] Installed')
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target === 'content') {
    chrome.tabs.query({ active: true, url: ['https://x.com/*', 'https://twitter.com/*'] }, (tabs) => {
      if (tabs.length === 0) {
        sendResponse({ error: 'No X tab found' })
        return
      }
      chrome.tabs.sendMessage(tabs[0].id, message, sendResponse)
    })
    return true
  }
})