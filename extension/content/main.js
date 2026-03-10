window.XAutopilot = window.XAutopilot || {}

window.XAutopilot.main = {
  settings: null,
  isRunning: false,
  actionQueue: [],
  isProcessingQueue: false,
  actionCountToday: 0,

  async init() {
    const { log } = window.XAutopilot.helpers
    log('Initializing...')

    this.settings = await this.loadSettings()

    if (!this.settings?.enabled) {
      log('Disabled. Standby.')
      return
    }

    this.isRunning = true

    window.XAutopilot.observer.startFeedObserver()
    window.XAutopilot.observer.startNavigationObserver()

    window.XAutopilot.observer.onNewPost((post) => this.handleNewPost(post))

    window.XAutopilot.observer.onPageChange(({ page }) => {
      log(`Page: ${page}`)
      if (page === 'notifications') {
        setTimeout(() => this.scanPage(), 2000)
      }
    })

    setInterval(() => this.checkScheduler(), 60 * 1000)

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sendResponse)
      return true
    })

    log('✓ Active')
  },

  async handleNewPost(post) {
    if (!this.isRunning || !post.text) return
    if (!this.canPerformAction()) return

    const myHandle = window.XAutopilot.domReader.getCurrentUserHandle()
    if (myHandle && post.handle === myHandle) return
    if (this.actionQueue.find(a => a.post?.id === post.id)) return

    if (this.settings.autoLike) this.queueAction({ type: 'like', post })
    if (this.settings.autoReply) this.queueAction({ type: 'reply', post })
    if (this.settings.autoFollow) this.queueAction({ type: 'follow', post })

    if (!this.isProcessingQueue) this.processQueue()
  },

  queueAction(action) {
    this.actionQueue.push(action)
    window.XAutopilot.helpers.log(`Queued: ${action.type} for @${action.post?.handle}`)
  },

  async processQueue() {
    if (this.isProcessingQueue || this.actionQueue.length === 0) return
    this.isProcessingQueue = true

    while (this.actionQueue.length > 0 && this.isRunning) {
      if (!this.canPerformAction()) break

      const action = this.actionQueue.shift()
      try {
        await this.executeAction(action)
        this.actionCountToday++
        await this.logAction(action)

        const delay = window.XAutopilot.helpers.getActionDelay(
          this.settings.minDelaySeconds || 45,
          this.settings.maxDelaySeconds || 120
        )
        window.XAutopilot.helpers.log(`Waiting ${Math.round(delay / 1000)}s...`)
        await window.XAutopilot.helpers.sleep(delay)
      } catch (err) {
        window.XAutopilot.helpers.log('Action failed', err)
      }
    }

    this.isProcessingQueue = false
  },

  async executeAction(action) {
    const executor = window.XAutopilot.actionExecutor
    switch (action.type) {
      case 'like': return await executor.likePost(action.post)
      case 'follow': return await executor.followUser(action.post)
      case 'reply': {
        const replyText = await this.generateReply(action.post)
        if (!replyText) return { success: false }
        return await executor.replyToPost(action.post, replyText)
      }
      case 'post': return await executor.publishPost(action.text)
    }
  },

  async generateReply(post) {
    const { log } = window.XAutopilot.helpers
    if (!this.settings.supabaseUrl || !this.settings.supabaseAnonKey) {
      log('Supabase not configured')
      return null
    }
    try {
      const response = await fetch(`${this.settings.supabaseUrl}/functions/v1/generate-reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.settings.supabaseAnonKey}`
        },
        body: JSON.stringify({
          postText: post.text,
          postHandle: post.handle,
          replyTone: this.settings.replyTone || 'friendly',
          language: this.settings.language || 'en'
        })
      })
      const data = await response.json()
      return data.reply || null
    } catch (err) {
      log('generateReply failed', err)
      return null
    }
  },

  async scanPage() {
    const { log, sleep } = window.XAutopilot.helpers
    log('Scanning page...')
    await sleep(2000)
    const posts = window.XAutopilot.domReader.getMentionPosts()
    posts.slice(0, 5).forEach(post => {
      if (this.settings.autoReplyToMentions) this.queueAction({ type: 'reply', post })
    })
    if (!this.isProcessingQueue) this.processQueue()
  },

  async checkScheduler() {
    if (!this.settings?.postScheduling || !this.settings.supabaseUrl) return
    try {
      const response = await fetch(`${this.settings.supabaseUrl}/functions/v1/get-due-posts`, {
        headers: { 'Authorization': `Bearer ${this.settings.supabaseAnonKey}` }
      })
      const { posts } = await response.json()
      if (!posts?.length) return
      posts.forEach(p => this.queueAction({ type: 'post', text: p.content }))
      if (!this.isProcessingQueue) this.processQueue()
    } catch (err) {
      window.XAutopilot.helpers.log('Scheduler check failed', err)
    }
  },

  canPerformAction() {
    return this.actionCountToday < (this.settings?.maxActionsPerDay || 80)
  },

  async logAction(action) {
    if (!this.settings?.supabaseUrl) return
    try {
      await fetch(`${this.settings.supabaseUrl}/functions/v1/log-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.settings.supabaseAnonKey}`
        },
        body: JSON.stringify({
          type: action.type,
          handle: action.post?.handle,
          postText: window.XAutopilot.helpers.truncate(action.post?.text, 100),
          timestamp: new Date().toISOString()
        })
      })
    } catch { }
  },

  async loadSettings() {
    return new Promise(resolve => {
      chrome.storage.sync.get('xautopilot_settings', (result) => {
        resolve(result.xautopilot_settings || {
          enabled: true,
          autoReply: true,
          autoReplyToMentions: true,
          autoLike: true,
          autoFollow: false,
          postScheduling: false,
          minDelaySeconds: 45,
          maxDelaySeconds: 120,
          maxActionsPerDay: 80,
          replyTone: 'friendly',
          language: 'en',
          supabaseUrl: 'https://qxathjkwaprszftcnfzt.supabase.co',
          supabaseAnonKey: 'your-real-anon-key-here'
        })
      })
    })
  },

  handleMessage(message, sendResponse) {
    switch (message.type) {
      case 'GET_STATUS':
        sendResponse({
          isRunning: this.isRunning,
          queueLength: this.actionQueue.length,
          actionsToday: this.actionCountToday,
          page: window.XAutopilot.domReader.getCurrentPage()
        })
        break
      case 'UPDATE_SETTINGS':
        this.settings = { ...this.settings, ...message.settings }
        chrome.storage.sync.set({ xautopilot_settings: this.settings })
        sendResponse({ success: true })
        break
      case 'TOGGLE_RUNNING':
        this.isRunning = message.enabled
        if (this.isRunning && !this.isProcessingQueue) this.processQueue()
        sendResponse({ success: true, isRunning: this.isRunning })
        break
      case 'MANUAL_SCAN':
        this.scanPage()
        sendResponse({ success: true })
        break
    }
  }
}

// Boot
setTimeout(() => window.XAutopilot.main.init(), 1500)