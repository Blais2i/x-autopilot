window.XAutopilot = window.XAutopilot || {}

window.XAutopilot.humanSimulator = {
  async typeText(element, text) {
    const { sleep, randomBetween, dispatchInputEvent } = window.XAutopilot.helpers
    element.focus()
    await sleep(randomBetween(200, 500))
    for (const char of text) {
      element.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }))
      if (element.getAttribute('contenteditable') !== null) {
        document.execCommand('insertText', false, char)
      } else {
        const start = element.selectionStart
        element.value = element.value.substring(0, start) + char + element.value.substring(start)
        element.selectionStart = element.selectionEnd = start + 1
      }
      dispatchInputEvent(element)
      element.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }))
      await sleep(randomBetween(80, 200))
      if (Math.random() < 0.05) await sleep(randomBetween(400, 800))
    }
    await sleep(randomBetween(200, 400))
  },

  async naturalScroll(targetElement = null) {
    const { sleep, randomBetween } = window.XAutopilot.helpers
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      await sleep(randomBetween(500, 1200))
    } else {
      window.scrollBy({ top: randomBetween(100, 400), behavior: 'smooth' })
      await sleep(randomBetween(600, 1500))
    }
  },

  async moveAndClick(element) {
    const { sleep, randomBetween } = window.XAutopilot.helpers
    if (!element) return
    const rect = element.getBoundingClientRect()
    const x = rect.left + rect.width * (0.3 + Math.random() * 0.4)
    const y = rect.top + rect.height * (0.3 + Math.random() * 0.4)
    element.dispatchEvent(new MouseEvent('mouseover', { clientX: x, clientY: y, bubbles: true }))
    await sleep(randomBetween(80, 200))
    element.dispatchEvent(new MouseEvent('mousedown', { clientX: x, clientY: y, bubbles: true }))
    await sleep(randomBetween(50, 120))
    element.dispatchEvent(new MouseEvent('mouseup', { clientX: x, clientY: y, bubbles: true }))
    element.dispatchEvent(new MouseEvent('click', { clientX: x, clientY: y, bubbles: true }))
    await sleep(randomBetween(200, 500))
  },

  async simulateReading(textLength = 100) {
    const { sleep, randomBetween } = window.XAutopilot.helpers
    const readTime = (textLength / 1000) * 60 * 1000
    await sleep(randomBetween(Math.max(800, readTime * 0.7), Math.max(2000, readTime * 1.5)))
  }
}