window.XAutopilot = window.XAutopilot || {}

window.XAutopilot.helpers = {
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  },
  randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min
  },
  getActionDelay(minSec = 30, maxSec = 90) {
    return this.randomBetween(minSec * 1000, maxSec * 1000)
  },
  getTextContent(element) {
    if (!element) return ''
    return element.innerText?.trim() || element.textContent?.trim() || ''
  },
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  },
  log(message, data = null) {
    data ? console.log('[XAutopilot]', message, data) : console.log('[XAutopilot]', message)
  },
  truncate(text, maxLength = 100) {
    if (!text) return ''
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
  },
  waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(selector)
      if (existing) return resolve(existing)
      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector)
        if (el) { observer.disconnect(); resolve(el) }
      })
      observer.observe(document.body, { childList: true, subtree: true })
      setTimeout(() => { observer.disconnect(); reject(new Error(`Timeout: ${selector}`)) }, timeout)
    })
  },
  dispatchInputEvent(element) {
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
  }
}