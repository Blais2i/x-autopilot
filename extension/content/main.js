// content/main.js
// Main orchestrator - connects observer, AI, and action executor

window.XAutopilot = window.XAutopilot || {};

window.XAutopilot.main = {
  settings: null,
  isRunning: false,
  actionQueue: [],
  isProcessingQueue: false,
  actionCountToday: 0,
  sessionStartTime: null,

  /**
   * Initialize the extension
   */
  async init() {
    const { log } = window.XAutopilot.helpers;
    log('Initializing X Autopilot...');

    // Load settings from Chrome storage
    this.settings = await this.loadSettings();

    if (!this.settings?.enabled) {
      log('Extension is disabled. Standby.');
      return;
    }

    this.sessionStartTime = new Date();
    this.isRunning = true;

    // Start observers
    window.XAutopilot.observer.startFeedObserver();
    window.XAutopilot.observer.startNavigationObserver();

    // Listen for new posts
    window.XAutopilot.observer.onNewPost((post) => {
      this.handleNewPost(post);
    });

    // Listen for page changes
    window.XAutopilot.observer.onPageChange(({ page }) => {
      log(`Now on page: ${page}`);
      if (page === 'notifications' && this.settings.autoReplyToMentions) {
        setTimeout(() => this.scanNotificationsPage(), 2000);
      }
    });

    // Check scheduler every 60 seconds
    setInterval(() => this.checkScheduler(), 60 * 1000);

    // Listen for messages from popup/background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sendResponse);
      return true; // Keep channel open for async response
    });

    log(`✓ X Autopilot active. Settings:`, this.settings);
  },

  /**
   * Handle a new post detected by the observer
   */
  async handleNewPost(post) {
    const { log } = window.XAutopilot.helpers;

    if (!this.isRunning || !post.text) return;
    if (!this.canPerformAction()) return;

    // Skip posts from ourselves
    const myHandle = window.XAutopilot.domReader.getCurrentUserHandle();
    if (myHandle && post.handle === myHandle) return;

    // Skip if already in queue
    if (this.actionQueue.find(a => a.post?.id === post.id)) return;

    log(`New post detected from @${post.handle}`);

    // Auto-like
    if (this.settings.autoLike && this.shouldLike(post)) {
      this.queueAction({ type: 'like', post });
    }

    // Auto-reply
    if (this.settings.autoReply && this.shouldReply(post)) {
      this.queueAction({ type: 'reply', post });
    }

    // Auto-follow
    if (this.settings.autoFollow && this.shouldFollow(post)) {
      this.queueAction({ type: 'follow', post });
    }

    // Start processing queue if not already running
    if (!this.isProcessingQueue) {
      this.processQueue();
    }
  },

  /**
   * Add an action to the queue
   */
  queueAction(action) {
    this.actionQueue.push(action);
    window.XAutopilot.helpers.log(`Queued action: ${action.type} for @${action.post?.handle}`);
  },

  /**
   * Process queued actions with human-like delays between them
   */
  async processQueue() {
    if (this.isProcessingQueue || this.actionQueue.length === 0) return;

    this.isProcessingQueue = true;
    const { log, sleep, getActionDelay } = window.XAutopilot.helpers;

    while (this.actionQueue.length > 0 && this.isRunning) {
      if (!this.canPerformAction()) {
        log('Daily action limit reached. Pausing.');
        break;
      }

      const action = this.actionQueue.shift();

      try {
        await this.executeAction(action);
        this.actionCountToday++;

        // Log to Supabase
        await this.logAction(action);

        // Human delay between actions
        const delay = getActionDelay(
          this.settings.minDelaySeconds || 30,
          this.settings.maxDelaySeconds || 90
        );
        log(`Waiting ${Math.round(delay / 1000)}s before next action...`);
        await sleep(delay);

      } catch (err) {
        log('Action failed', err);
      }
    }

    this.isProcessingQueue = false;
  },

  /**
   * Execute a single action
   */
  async executeAction(action) {
    const executor = window.XAutopilot.actionExecutor;

    switch (action.type) {
      case 'like':
        return await executor.likePost(action.post);

      case 'reply': {
        // Get AI-generated reply from Supabase Edge Function
        const replyText = await this.generateReply(action.post);
        if (!replyText) return { success: false, error: 'No reply generated' };
        return await executor.replyToPost(action.post, replyText);
      }

      case 'follow':
        return await executor.followUser(action.post);

      case 'post':
        return await executor.publishPost(action.text);

      default:
        window.XAutopilot.helpers.log(`Unknown action type: ${action.type}`);
    }
  },

  /**
   * Call Supabase Edge Function to generate AI reply via DeepSeek
   */
  async generateReply(post) {
    const { log } = window.XAutopilot.helpers;

    if (!this.settings.supabaseUrl || !this.settings.supabaseAnonKey) {
      log('Supabase not configured');
      return null;
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
          myHandle: window.XAutopilot.domReader.getCurrentUserHandle(),
          replyTone: this.settings.replyTone || 'friendly',
          language: this.settings.language || 'en',
          productContext: this.settings.productContext || null
        })
      });

      const data = await response.json();

      if (!response.ok) {
        log('Error from generate-reply function', data);
        return null;
      }

      return data.reply;
    } catch (err) {
      log('Failed to call generate-reply', err);
      return null;
    }
  },

  /**
   * Scan notifications page for mentions to reply to
   */
  async scanNotificationsPage() {
    const { log, sleep } = window.XAutopilot.helpers;
    log('Scanning notifications for mentions...');

    await sleep(2000); // Wait for page to load
    const posts = window.XAutopilot.domReader.getMentionPosts();
    log(`Found ${posts.length} posts on notifications page`);

    posts.slice(0, 5).forEach(post => { // Process up to 5 at a time
      if (!this.actionQueue.find(a => a.post?.id === post.id)) {
        if (this.settings.autoReplyToMentions) {
          this.queueAction({ type: 'reply', post });
        }
      }
    });

    if (!this.isProcessingQueue) this.processQueue();
  },

  /**
   * Check scheduled posts and publish if due
   */
  async checkScheduler() {
    if (!this.settings?.postScheduling) return;
    if (!this.settings.supabaseUrl) return;

    try {
      const response = await fetch(`${this.settings.supabaseUrl}/functions/v1/get-due-posts`, {
        headers: { 'Authorization': `Bearer ${this.settings.supabaseAnonKey}` }
      });

      const { posts } = await response.json();
      if (!posts?.length) return;

      window.XAutopilot.helpers.log(`${posts.length} scheduled post(s) due`);
      posts.forEach(p => this.queueAction({ type: 'post', text: p.content, id: p.id }));
      if (!this.isProcessingQueue) this.processQueue();
    } catch (err) {
      window.XAutopilot.helpers.log('Scheduler check failed', err);
    }
  },

  // ─── FILTERS ───────────────────────────────────────────────────────────────

  shouldReply(post) {
    if (!post.hasReplyButton || !post.text) return false;
    // Add your custom filters here (keywords, specific accounts, etc.)
    return true;
  },

  shouldLike(post) {
    if (post.isLiked) return false;
    return true;
  },

  shouldFollow(post) {
    // Only follow if we have a follow button available on the post
    return !!window.XAutopilot.domReader.getFollowButton(post.element);
  },

  canPerformAction() {
    const maxDaily = this.settings?.maxActionsPerDay || 100;
    return this.actionCountToday < maxDaily;
  },

  // ─── SETTINGS & STORAGE ───────────────────────────────────────────────────

  async loadSettings() {
    return new Promise(resolve => {
      chrome.storage.sync.get('xautopilot_settings', (result) => {
        resolve(result.xautopilot_settings || {
          enabled: false,
          autoReply: false,
          autoReplyToMentions: true,
          autoLike: false,
          autoFollow: false,
          postScheduling: false,
          minDelaySeconds: 45,
          maxDelaySeconds: 120,
          maxActionsPerDay: 80,
          replyTone: 'friendly',
          language: 'en',
          supabaseUrl: '',
          supabaseAnonKey: '',
          productContext: ''
        });
      });
    });
  },

  async logAction(action) {
    if (!this.settings?.supabaseUrl) return;

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
      });
    } catch { /* fail silently */ }
  },

  // ─── MESSAGE HANDLING ─────────────────────────────────────────────────────

  handleMessage(message, sendResponse) {
    const { log } = window.XAutopilot.helpers;

    switch (message.type) {
      case 'GET_STATUS':
        sendResponse({
          isRunning: this.isRunning,
          queueLength: this.actionQueue.length,
          actionsToday: this.actionCountToday,
          page: window.XAutopilot.domReader.getCurrentPage()
        });
        break;

      case 'UPDATE_SETTINGS':
        this.settings = { ...this.settings, ...message.settings };
        chrome.storage.sync.set({ xautopilot_settings: this.settings });
        log('Settings updated', this.settings);
        sendResponse({ success: true });
        break;

      case 'TOGGLE_RUNNING':
        this.isRunning = message.enabled;
        log(`Extension ${this.isRunning ? 'resumed' : 'paused'}`);
        if (this.isRunning && !this.isProcessingQueue && this.actionQueue.length > 0) {
          this.processQueue();
        }
        sendResponse({ success: true, isRunning: this.isRunning });
        break;

      case 'MANUAL_SCAN':
        this.scanNotificationsPage();
        sendResponse({ success: true });
        break;
    }
  }
};

// ─── BOOT ──────────────────────────────────────────────────────────────────
// Wait for X to finish loading before initializing
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.XAutopilot.main.init());
} else {
  setTimeout(() => window.XAutopilot.main.init(), 1500);
}