window.XAutopilot = window.XAutopilot || {}

window.XAutopilot.domReader = {
  SELECTORS: {
    tweetArticle: 'article[data-testid="tweet"]',
    tweetText: '[data-testid="tweetText"]',
    replyButton: '[data-testid="reply"]',
    likeButton: '[data-testid="like"]',
    unlikeButton: '[data-testid="unlike"]',
    submitReplyButton: '[data-testid="tweetButtonInline"]',
    userNameInTweet: '[data-testid="User-Name"]',
    tweetComposer: '[data-testid="tweetTextarea_0"] div[contenteditable="true"]',
    postButton: '[data-testid="tweetButton"]',
    followButton: '[data-testid="follow"]',
  },

  getVisiblePosts() {
    const articles = document.querySelectorAll(this.SELECTORS.tweetArticle)
    const posts = []
    articles.forEach(article => {
      const post = this.parsePostElement(article)
      if (post) posts.push(post)
    })
    return posts
  },

  parsePostElement(article) {
    try {
      const textEl = article.querySelector(this.SELECTORS.tweetText)
      const userNameEl = article.querySelector(this.SELECTORS.userNameInTweet)
      const likeBtn = article.querySelector(this.SELECTORS.likeButton)
      const unlikeBtn = article.querySelector(this.SELECTORS.unlikeButton)
      const replyBtn = article.querySelector(this.SELECTORS.replyButton)

      if (!textEl && !userNameEl) return null

      let handle = ''
      const handleLinks = article.querySelectorAll('a[href^="/"]')
      for (const link of handleLinks) {
        const href = link.getAttribute('href')
        if (href && href.match(/^\/[^\/]+$/) && !href.includes('status')) {
          handle = href.replace('/', '')
          break
        }
      }

      const tweetLink = article.querySelector('a[href*="/status/"]')
      const tweetUrl = tweetLink ? `https://x.com${tweetLink.getAttribute('href')}` : null
      const tweetId = tweetUrl ? tweetUrl.match(/\/status\/(\d+)/)?.[1] : null

      return {
        id: tweetId || window.XAutopilot.helpers.generateId(),
        element: article,
        text: window.XAutopilot.helpers.getTextContent(textEl),
        handle,
        url: tweetUrl,
        isLiked: !!unlikeBtn,
        hasReplyButton: !!replyBtn,
        replyButton: replyBtn,
        likeButton: likeBtn || unlikeBtn,
      }
    } catch (err) {
      window.XAutopilot.helpers.log('Error parsing post', err)
      return null
    }
  },

  getMentionPosts() {
    return this.getVisiblePosts()
  },

  async getReplyComposer() {
    const selectors = [
      '[data-testid="tweetTextarea_0"] div[contenteditable="true"]',
      'div[contenteditable="true"][aria-label="Post your reply"]',
      'div[contenteditable="true"][aria-label="Tweet your reply"]',
      'div[contenteditable="true"][data-testid="tweetTextarea_0"]',
      '.public-DraftEditor-content',
      'div[contenteditable="true"]'
    ]

    for (const selector of selectors) {
      try {
        const el = await window.XAutopilot.helpers.waitForElement(selector, 3000)
        if (el) {
          window.XAutopilot.helpers.log(`Composer found: ${selector}`)
          return el
        }
      } catch {
        continue
      }
    }

    window.XAutopilot.helpers.log('Reply composer not found')
    return null
  },

  getPostComposer() {
    const selectors = [
      '[data-testid="tweetTextarea_0"] div[contenteditable="true"]',
      'div[contenteditable="true"][aria-label="Post text"]',
      'div[contenteditable="true"]'
    ]
    for (const selector of selectors) {
      const el = document.querySelector(selector)
      if (el) return el
    }
    return null
  },

  getReplySubmitButton() {
    return (
      document.querySelector('[data-testid="tweetButtonInline"]') ||
      document.querySelector('[data-testid="tweetButton"]')
    )
  },

  getPostSubmitButton() {
    return document.querySelector('[data-testid="tweetButton"]')
  },

  getFollowButton(articleElement = document) {
    return articleElement.querySelector(this.SELECTORS.followButton)
  },

  getCurrentUserHandle() {
    const profileLink = document.querySelector('a[data-testid="AppTabBar_Profile_Link"]')
    if (profileLink) return profileLink.getAttribute('href')?.replace('/', '') || null
    return null
  },

  getCurrentPage() {
    const path = window.location.pathname
    if (path === '/home') return 'home'
    if (path === '/notifications') return 'notifications'
    if (path.includes('/status/')) return 'tweet'
    if (path.includes('/compose')) return 'compose'
    return 'other'
  }
}