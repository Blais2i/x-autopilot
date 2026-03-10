window.XAutopilot = window.XAutopilot || {}

window.XAutopilot.actionExecutor = {
  async replyToPost(post, replyText) {
    const { log, sleep, randomBetween } = window.XAutopilot.helpers
    const { moveAndClick, naturalScroll, typeText, simulateReading } = window.XAutopilot.humanSimulator

    try {
      log(`Starting reply to @${post.handle}: "${replyText}"`)

      // 1. Scroll to post
      await naturalScroll(post.element)
      await simulateReading(post.text.length)

      if (!post.replyButton) {
        log('No reply button found')
        return { success: false, error: 'No reply button' }
      }

      // 2. Click reply button
      log('Clicking reply button...')
      await moveAndClick(post.replyButton)
      await sleep(randomBetween(1500, 2500))

      // 3. Find composer - try multiple approaches
      log('Looking for composer...')
      let composer = null

      // Try waiting for the modal composer first
      const composerSelectors = [
        '[data-testid="tweetTextarea_0"] div[contenteditable="true"]',
        'div[contenteditable="true"][aria-label="Post your reply"]',
        'div[contenteditable="true"][aria-label="Tweet your reply"]',
        '.public-DraftEditor-content[contenteditable="true"]',
      ]

      for (const selector of composerSelectors) {
        try {
          composer = await window.XAutopilot.helpers.waitForElement(selector, 3000)
          if (composer) {
            log(`✓ Composer found with selector: ${selector}`)
            break
          }
        } catch { continue }
      }

      // Last resort - find any visible contenteditable
      if (!composer) {
        const allEditables = document.querySelectorAll('div[contenteditable="true"]')
        log(`Found ${allEditables.length} contenteditable elements`)
        for (const el of allEditables) {
          const rect = el.getBoundingClientRect()
          if (rect.width > 100 && rect.height > 20) {
            composer = el
            log('Using fallback contenteditable element')
            break
          }
        }
      }

      if (!composer) {
        log('ERROR: No composer found at all')
        return { success: false, error: 'Composer not found' }
      }

      // 4. Click composer to focus it
      await moveAndClick(composer)
      await sleep(randomBetween(500, 800))

      // 5. Clear any existing text first
      composer.focus()
      document.execCommand('selectAll', false, null)
      await sleep(200)

      // 6. Type the reply
      log(`Typing reply: "${replyText}"`)
      await typeText(composer, replyText)
      await sleep(randomBetween(800, 1500))

      // 7. Verify text was typed
      const typedText = composer.innerText?.trim()
      log(`Text in composer after typing: "${typedText}"`)

      if (!typedText || typedText.length < 2) {
        log('ERROR: Text did not get typed into composer')
        return { success: false, error: 'Typing failed' }
      }

      // 8. Find and click submit
      const submitBtn =
        document.querySelector('[data-testid="tweetButtonInline"]') ||
        document.querySelector('[data-testid="tweetButton"]')

      if (!submitBtn) {
        log('ERROR: Submit button not found')
        return { success: false, error: 'Submit button not found' }
      }

      log('Clicking submit...')
      await moveAndClick(submitBtn)
      await sleep(randomBetween(1500, 2500))

      log(`✓ Reply submitted to @${post.handle}`)
      return { success: true, action: 'reply', handle: post.handle }

    } catch (err) {
      log('Reply error:', err.message)
      return { success: false, error: err.message }
    }
  },

  async likePost(post) {
    const { log, sleep, randomBetween } = window.XAutopilot.helpers
    const { moveAndClick, naturalScroll } = window.XAutopilot.humanSimulator

    try {
      if (post.isLiked) {
        log(`Already liked @${post.handle}`)
        return { success: true, skipped: true }
      }
      if (!post.likeButton) return { success: false, error: 'No like button' }

      await naturalScroll(post.element)
      await sleep(randomBetween(300, 700))
      await moveAndClick(post.likeButton)
      await sleep(randomBetween(500, 1000))

      log(`✓ Liked post by @${post.handle}`)
      return { success: true, action: 'like', handle: post.handle }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  async followUser(post) {
    const { log, sleep, randomBetween } = window.XAutopilot.helpers
    const { moveAndClick } = window.XAutopilot.humanSimulator

    try {
      const followBtn = window.XAutopilot.domReader.getFollowButton(post.element)
      if (!followBtn) return { success: true, skipped: true }

      await sleep(randomBetween(300, 700))
      await moveAndClick(followBtn)
      await sleep(randomBetween(500, 1000))

      log(`✓ Followed @${post.handle}`)
      return { success: true, action: 'follow', handle: post.handle }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },

  async publishPost(text) {
    const { log, sleep, randomBetween } = window.XAutopilot.helpers
    const { moveAndClick, typeText } = window.XAutopilot.humanSimulator

    try {
      if (window.location.pathname !== '/home') {
        window.location.href = 'https://x.com/home'
        await sleep(3000)
      }

      const composer = window.XAutopilot.domReader.getPostComposer()
      if (!composer) return { success: false, error: 'Composer not found' }

      await moveAndClick(composer)
      await sleep(randomBetween(400, 800))
      await typeText(composer, text)
      await sleep(randomBetween(800, 1500))

      const postBtn = window.XAutopilot.domReader.getPostSubmitButton()
      if (!postBtn) return { success: false, error: 'Post button not found' }

      await moveAndClick(postBtn)
      await sleep(randomBetween(1500, 2500))

      log('✓ Post published')
      return { success: true, action: 'post' }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }
}
``
