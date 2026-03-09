import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase.ts'

type ActionLog = {
  id: string
  action_type: 'reply' | 'like' | 'follow' | 'post'
  target_handle: string
  post_text: string
  performed_at: string
}

type Totals = {
  action_type: string
  total: number
  last_7_days: number
  today: number
}

export default function App() {
  const [logs, setLogs] = useState<ActionLog[]>([])
  const [totals, setTotals] = useState<Totals[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30_000)
    return () => clearInterval(interval)
  }, [])

  async function fetchData() {
    const [logsRes, totalsRes] = await Promise.all([
      supabase.from('action_logs').select('*').order('performed_at', { ascending: false }).limit(50),
      supabase.from('action_totals').select('*')
    ])
    if (logsRes.data) setLogs(logsRes.data)
    if (totalsRes.data) setTotals(totalsRes.data)
    setLoading(false)
  }

  const iconMap: Record<string, string> = { reply: '💬', like: '❤️', follow: '➕', post: '📝' }
  const totalToday = totals.reduce((sum, t) => sum + Number(t.today), 0)
  const totalWeek = totals.reduce((sum, t) => sum + Number(t.last_7_days), 0)

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
        <div style={{ width: 36, height: 36, background: '#1d9bf0', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>✦</div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>X Autopilot Dashboard</h1>
          <p style={{ color: '#71767b', fontSize: 13 }}>Your automation analytics</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
        {[
          { label: 'Today', value: totalToday, color: '#1d9bf0' },
          { label: 'This Week', value: totalWeek, color: '#00ba7c' },
          { label: 'Replies', value: totals.find(t => t.action_type === 'reply')?.today ?? 0, color: '#a78bfa' },
          { label: 'Likes', value: totals.find(t => t.action_type === 'like')?.today ?? 0, color: '#f4212e' },
        ].map(stat => (
          <div key={stat.label} style={{ background: '#141414', border: '1px solid #222', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ color: '#71767b', fontSize: 12, marginTop: 4 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#141414', border: '1px solid #222', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #222' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600 }}>Recent Actions</h2>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#71767b' }}>Loading...</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#71767b' }}>No actions yet. Start the extension on x.com!</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#111' }}>
                {['Action', 'Account', 'Post Preview', 'Time'].map(h => (
                  <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#71767b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <tr key={log.id} style={{ borderTop: '1px solid #222', background: i % 2 === 0 ? 'transparent' : '#0d0d0d' }}>
                  <td style={{ padding: '12px 20px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 20, fontSize: 12, background: '#222', fontWeight: 500 }}>
                      {iconMap[log.action_type]} {log.action_type}
                    </span>
                  </td>
                  <td style={{ padding: '12px 20px', color: '#1d9bf0', fontSize: 13 }}>@{log.target_handle || '—'}</td>
                  <td style={{ padding: '12px 20px', color: '#71767b', fontSize: 12, maxWidth: 300 }}>
                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.post_text || '—'}</span>
                  </td>
                  <td style={{ padding: '12px 20px', color: '#71767b', fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(log.performed_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}