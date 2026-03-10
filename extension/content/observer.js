window.XAutopilot = window.XAutopilot || {}

window.XAutopilot.observer = {
  _feedObserver: null,
  _lastUrl: window.location.href,
  _newPostCallbacks: [],
  _pageChangeCallbacks: [],
  _processedPostIds: new Set(),

  startFeedObserver() {
    if (this._feedObserver) this._feedObserver.disconnect()

    this._feedObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue
          const articles = node.matches?.('article[data-testid="tweet"]')
            ? [node]
            : [...(node.querySelectorAll?.('article[data-testid="tweet"]') || [])]

          for (const article of articles) {
            const post = window.XAutopilot.domReader.parsePostElement(article)
            if (!post || this._processedPostIds.has(post.id)) continue
            this._processedPostIds.add(post.id)
            this._newPostCallbacks.forEach(cb => cb(post))
          }
        }
      }
    })

    const container = document.querySelector('[data-testid="primaryColumn"]') || document.body
    this._feedObserver.observe(container, { childList: true, subtree: true })
    window.XAutopilot.helpers.log('Observer started')
  },

  startNavigationObserver() {
    setInterval(() => {
      const currentUrl = window.location.href
      if (currentUrl !== this._lastUrl) {
        const previousUrl = this._lastUrl
        this._lastUrl = currentUrl
        this._pageChangeCallbacks.forEach(cb => cb({
          from: previousUrl,
          to: currentUrl,
          page: window.XAutopilot.domReader.getCurrentPage()
        }))
      }
    }, 1000)
  },

  onNewPost(callback) { this._newPostCallbacks.push(callback) },
  onPageChange(callback) { this._pageChangeCallbacks.push(callback) },
  markProcessed(postId) { this._processedPostIds.add(postId) }
}