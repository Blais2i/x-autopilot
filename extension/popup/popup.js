const $ = id => document.getElementById(id)
let settings = {}

async function init() {
  settings = await loadSettings()
  applyToUI(settings)
  await refreshStatus()
  setInterval(refreshStatus, 3000)
  bindEvents()
}

async function refreshStatus() {
  try {
    const res = await sendToContent({ type: 'GET_STATUS', target: 'content' })
    if (res?.error) { $('statusText').textContent = 'Open x.com first'; return }
    $('actionsToday').textContent = res.actionsToday ?? 0
    $('queueLength').textContent = res.queueLength ?? 0
    $('masterToggle').checked = res.isRunning
    $('statusText').textContent = res.isRunning ? `Active · ${res.page}` : 'Paused'
  } catch {
    $('statusText').textContent = 'Open x.com first'
  }
}

function applyToUI(s) {
  $('masterToggle').checked = s.enabled ?? true
  $('autoReply').checked = s.autoReply ?? true
  $('autoReplyMentions').checked = s.autoReplyToMentions ?? true
  $('autoLike').checked = s.autoLike ?? true
  $('autoFollow').checked = s.autoFollow ?? false
  $('postScheduling').checked = s.postScheduling ?? false
  $('minDelay').value = s.minDelaySeconds ?? 45
  $('maxDelay').value = s.maxDelaySeconds ?? 120
  $('minDelayVal').textContent = s.minDelaySeconds ?? 45
  $('maxDelayVal').textContent = s.maxDelaySeconds ?? 120
}

function collectFromUI() {
  return {
    ...settings,
    enabled: $('masterToggle').checked,
    autoReply: $('autoReply').checked,
    autoReplyToMentions: $('autoReplyMentions').checked,
    autoLike: $('autoLike').checked,
    autoFollow: $('autoFollow').checked,
    postScheduling: $('postScheduling').checked,
    minDelaySeconds: parseInt($('minDelay').value),
    maxDelaySeconds: parseInt($('maxDelay').value),
  }
}

function bindEvents() {
  $('minDelay').addEventListener('input', () => $('minDelayVal').textContent = $('minDelay').value)
  $('maxDelay').addEventListener('input', () => $('maxDelayVal').textContent = $('maxDelay').value)

  $('masterToggle').addEventListener('change', async () => {
    const enabled = $('masterToggle').checked
    settings.enabled = enabled
    await saveSettings(settings)
    await sendToContent({ type: 'TOGGLE_RUNNING', enabled, target: 'content' })
  })

  $('saveBtn').addEventListener('click', async () => {
    settings = collectFromUI()
    await saveSettings(settings)
    await sendToContent({ type: 'UPDATE_SETTINGS', settings, target: 'content' })
    $('saveBtn').textContent = '✓ Saved'
    setTimeout(() => $('saveBtn').textContent = 'Save', 1500)
  })

  $('scanBtn').addEventListener('click', async () => {
    $('scanBtn').textContent = 'Scanning...'
    await sendToContent({ type: 'MANUAL_SCAN', target: 'content' })
    setTimeout(() => $('scanBtn').textContent = 'Scan Now', 2000)
  })
}

function loadSettings() {
  return new Promise(resolve => {
    chrome.storage.sync.get('xautopilot_settings', r => {
      resolve(r.xautopilot_settings || {
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
supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4YXRoamt3YXByc3pmdGNuZnp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzQ5ODUsImV4cCI6MjA4ODY1MDk4NX0.EIvkgG_Yhk2-AXV0VeovtmYnJZzVtKequIEWCxuxy-c'
      })
    })
  })
}

function saveSettings(s) {
  return new Promise(resolve => chrome.storage.sync.set({ xautopilot_settings: s }, resolve))
}

function sendToContent(message) {
  return new Promise(resolve => chrome.runtime.sendMessage(message, resolve))
}

document.addEventListener('DOMContentLoaded', init)