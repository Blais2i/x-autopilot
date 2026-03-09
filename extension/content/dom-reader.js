// content/dom-reader.js
// Reads posts, mentions, replies from X's DOM
// NOTE: X frequently updates their DOM structure. These selectors may need updating.
// Last verified: 2025

window.XAutopilot = window.XAutopilot || {};

window.XAutopilot.domReader = {

  // ─── SELECTORS ────────────────────────────────────────────────────────────
  // Centralized so they're easy to update when X changes their markup
  SELECTORS: {
    // Feed
    tweet: '[data-testid="tweet"]',
    tweetText: '[data-testid="tweetText"]',
    tweetArticle: 'article[data-testid="tweet"]',

    // Actions
    replyButton: '[data-testid="reply"]',
    likeButton: '[data-testid="like"]',
    unlikeButton: '[data-testid="unlike"]',
    retweetButton: '[data-testid="retweet"]',

    // Reply composer
    replyTextbox: '[data-testid="tweetTextarea_0"]',
    replyTextboxDiv: '[data-testid="tweetTextarea_0"] div[contenteditable="true"]',
    submitReplyButton: '[data-testid="tweetButtonInline"]',

    // User info
    userNameInTweet: '[data-testid="User-Name"]',
    userHandle: '[data-testid="User-Name"] a[href^="/"]',

    // Notifications / Mentions
    notificationItem: '[data-testid="notification"]',

    // New post composer
    tweetComposer: '[data-testid="tweetTextarea_0"] div[contenteditable="true"]',
    postButton: '[data-testid="tweetButton"]',

    // Follow button
    followButton: '[data-testid="follow"]',
    unfollowButton: '[data-testid="unfollow"]',

    // Profile
    profileName: '[data-testid="UserName"]',
    followerCount: '[href$="/followers"] span span',
  },

  // ─── POST READING ──────────────────────────────────────────────────────────

  /**
   * Get all visible tweet articles from the current feed
   */
  getVisiblePosts() {
    const articles = document.querySelectorAll(this.SELECTORS.tweetArticle);
    const posts = [];

    articles.forEach(article => {
      const post = this.parsePostElement(article);
      if (post) posts.push(post);
    });

    return posts;
  },

  /**
   * Parse a single tweet article element into a structured object
   */
  parsePostElement(article) {
    try {
      const textEl = article.querySelector(this.SELECTORS.tweetText);
      const userNameEl = article.querySelector(this.SELECTORS.userNameInTweet);
      const likeBtn = article.querySelector(this.SELECTORS.likeButton);
      const unlikeBtn = article.querySelector(this.SELECTORS.unlikeButton);
      const replyBtn = article.querySelector(this.SELECTORS.replyButton);

      if (!textEl && !userNameEl) return null;

      // Get user handle from link
      const handleLinks = article.querySelectorAll('a[href^="/"]');
      let handle = '';
      for (const link of handleLinks) {
        const href = link.getAttribute('href');
        if (href && href.match(/^\/[^\/]+$/) && !href.includes('status')) {
          handle = href.replace('/', '');
          break;
        }
      }

      // Get tweet URL/ID
      const tweetLink = article.querySelector('a[href*="/status/"]');
      const tweetUrl = tweetLink ? `https://x.com${tweetLink.getAttribute('href')}` : null;
      const tweetId = tweetUrl ? tweetUrl.match(/\/status\/(\d+)/)?.[1] : null;

      return {
        id: tweetId || window.XAutopilot.helpers.generateId(),
        element: article,
        text: window.XAutopilot.helpers.getTextContent(textEl),
        handle: handle,
        displayName: window.XAutopilot.helpers.getTextContent(userNameEl),
        url: tweetUrl,
        isLiked: !!unlikeBtn, // If unlike button exists, it's already liked
        hasReplyButton: !!replyBtn,
        replyButton: replyBtn,
        likeButton: likeBtn || unlikeBtn,
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      window.XAutopilot.helpers.log('Error parsing post element', err);
      return null;
    }
  },

  /**
   * Get posts from notifications/mentions page
   */
  getMentionPosts() {
    // On /notifications page, tweets are still article[data-testid="tweet"]
    return this.getVisiblePosts().filter(post =>
      post.text.includes('@') || window.location.pathname.includes('notifications')
    );
  },

  /**
   * Get the full thread context of the currently open tweet
   * (when you're on a /status/ page)
   */
  getThreadContext() {
    if (!window.location.pathname.includes('/status/')) return null;

    const articles = document.querySelectorAll(this.SELECTORS.tweetArticle);
    const thread = [];

    articles.forEach(article => {
      const post = this.parsePostElement(article);
      if (post) thread.push(post);
    });

    // First post is the original tweet
    return {
      originalPost: thread[0] || null,
      replies: thread.slice(1),
      fullContext: thread.map(p => `@${p.handle}: ${p.text}`).join('\n\n')
    };
  },

  // ─── COMPOSER ─────────────────────────────────────────────────────────────

  /**
   * Get the reply composer element for a specific tweet
   * Call this AFTER clicking the reply button
   */
  async getReplyComposer() {
    try {
      const composer = await window.XAutopilot.helpers.waitForElement(
        this.SELECTORS.replyTextboxDiv,
        5000
      );
      return composer;
    } catch {
      window.XAutopilot.helpers.log('Reply composer not found');
      return null;
    }
  },

  /**
   * Get the main post composer (for new posts)
   */
  getPostComposer() {
    return document.querySelector(this.SELECTORS.tweetComposer);
  },

  /**
   * Get the submit button for replying
   */
  getReplySubmitButton() {
    return document.querySelector(this.SELECTORS.submitReplyButton);
  },

  /**
   * Get the post submit button
   */
  getPostSubmitButton() {
    return document.querySelector(this.SELECTORS.postButton);
  },

  // ─── USER INFO ─────────────────────────────────────────────────────────────

  /**
   * Get the logged-in user's handle from the page
   */
  getCurrentUserHandle() {
    // X stores the user info in several places
    // Try to get from the nav profile link
    const profileLink = document.querySelector('a[data-testid="AppTabBar_Profile_Link"]');
    if (profileLink) {
      const href = profileLink.getAttribute('href');
      return href ? href.replace('/', '') : null;
    }
    return null;
  },

  /**
   * Check if a follow button exists for a user on the current page
   */
  getFollowButton(articleElement = document) {
    return articleElement.querySelector(this.SELECTORS.followButton);
  },

  // ─── PAGE DETECTION ────────────────────────────────────────────────────────

  getCurrentPage() {
    const path = window.location.pathname;
    if (path === '/home') return 'home';
    if (path === '/notifications') return 'notifications';
    if (path.includes('/status/')) return 'tweet';
    if (path.match(/^\/[^\/]+$/)) return 'profile';
    if (path.includes('/messages')) return 'messages';
    return 'other';
  }
};