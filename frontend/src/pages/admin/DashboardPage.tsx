import { useEffect, useState } from 'react'
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import AdminLayout from '../../components/AdminLayout'
import { adminAPI, type AdminStats, type ChartPoint, type HourlyPoint, type TopUser, type RecentTx } from '../../services/api'

type Range = '7d' | '30d' | '365d'

const fmt = (n: number) => n?.toLocaleString('vi-VN') ?? '0'
const fmtMoney = (n: number) => (n ?? 0).toLocaleString('vi-VN') + 'đ'

const STATUS_COLOR: Record<string, string> = {
  success: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  timeout: 'bg-orange-100 text-orange-700',
  pending: 'bg-yellow-100 text-yellow-700',
  waiting_otp: 'bg-blue-100 text-blue-700',
  waiting_phone: 'bg-purple-100 text-purple-700',
}

const STATUS_LABEL: Record<string, string> = {
  success: 'Thành công',
  failed: 'Thất bại',
  timeout: 'Timeout',
  pending: 'Đang chờ',
  waiting_otp: 'Chờ OTP',
  waiting_phone: 'Chờ SĐT',
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [chart, setChart] = useState<ChartPoint[]>([])
  const [topUsers, setTopUsers] = useState<TopUser[]>([])
  const [recent, setRecent] = useState<RecentTx[]>([])
  const [hourly, setHourly] = useState<HourlyPoint[]>([])
  const [range, setRange] = useState<Range>('30d')
  const [loading, setLoading] = useState(true)
  const [chartLoading, setChartLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      adminAPI.getStats(),
      adminAPI.getTopUsers(),
      adminAPI.getRecentTransactions(),
      adminAPI.getOTPHourly(),
    ]).then(([s, t, r, h]) => {
      setStats(s.data)
      setTopUsers(t.data ?? [])
      setRecent(r.data ?? [])
      setHourly(h.data ?? [])
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setChartLoading(true)
    adminAPI.getChartStats(range)
      .then(r => setChart(r.data ?? []))
      .finally(() => setChartLoading(false))
  }, [range])

  const kpiCards = stats ? [
    {
      label: 'Tổng người dùng', value: fmt(stats.total_users),
      sub: `+${fmt(stats.today_new_users)} hôm nay`,
      icon: '👥', color: 'from-blue-500 to-blue-600',
    },
    {
      label: 'Doanh thu', value: fmtMoney(stats.total_revenue),
      sub: `Hôm nay: ${fmtMoney(stats.today_revenue)}`,
      icon: '💵', color: 'from-green-500 to-green-600',
    },
    {
      label: 'Tổng nạp vào hệ thống', value: fmtMoney(stats.total_topup),
      sub: `Số dư còn lại: ${fmtMoney(stats.total_balance)}`,
      icon: '💰', color: 'from-emerald-500 to-teal-600',
    },
    {
      label: 'Tổng giao dịch', value: fmt(stats.total_transactions),
      sub: `Hôm nay: ${fmt(stats.today_transactions)}`,
      icon: '📋', color: 'from-purple-500 to-purple-600',
    },
    {
      label: 'Phiên đang chờ OTP', value: fmt(stats.active_sessions),
      sub: 'Đang xử lý',
      icon: '⏳', color: 'from-pink-500 to-red-500',
    },
    {
      label: 'Tỷ lệ thành công', value: (stats.success_rate ?? 0).toFixed(1) + '%',
      sub: (stats.success_rate ?? 0) >= 80 ? '✅ Tốt' : (stats.success_rate ?? 0) >= 50 ? '⚠️ Trung bình' : '❌ Cần kiểm tra',
      icon: '📈', color: 'from-teal-500 to-cyan-600',
    },
  ] : []

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📊 Thống kê hệ thống</h1>
          <p className="text-gray-500 text-sm">Tổng quan hoạt động theo thời gian thực</p>
        </div>

        {/* ── KPI Cards ── */}
        {loading ? (
          <div className="text-gray-400 text-sm">⏳ Đang tải...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
            {kpiCards.map(c => (
              <div key={c.label} className="bg-white rounded-2xl shadow border border-gray-100 p-4 flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center text-xl shrink-0`}>
                  {c.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-gray-400 text-xs truncate">{c.label}</p>
                  <p className="text-gray-800 font-bold text-base leading-tight">{c.value}</p>
                  <p className="text-gray-400 text-xs">{c.sub}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Charts ── */}
        <div className="bg-white rounded-2xl shadow border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-700">📈 Doanh thu & Nạp tiền theo ngày</h2>
            <div className="flex gap-1">
              {(['7d', '30d', '365d'] as Range[]).map(r => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${range === r ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                  {r === '7d' ? '7 ngày' : r === '30d' ? '30 ngày' : '1 năm'}
                </button>
              ))}
            </div>
          </div>
          {chartLoading ? (
            <div className="h-56 flex items-center justify-center text-gray-400 text-sm">⏳ Đang tải...</div>
          ) : chart.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-gray-300 text-sm">Chưa có dữ liệu</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chart} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => (v / 1000).toFixed(0) + 'k'} />
                <Tooltip formatter={(v) => fmtMoney(Number(v))} labelFormatter={l => 'Ngày ' + l} />
                <Legend />
                <Line type="monotone" dataKey="revenue" name="Doanh thu" stroke="#7c3aed" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="topup" name="Nạp vào" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── OTP Charts (2 columns) ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Left: Grouped Bar by day */}
          <div className="bg-white rounded-2xl shadow border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-700">📊 OTP theo trạng thái</h2>
              <div className="flex gap-1">
                {(['7d', '30d', '365d'] as Range[]).map(r => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${range === r ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    {r === '7d' ? '7 ngày' : r === '30d' ? '30 ngày' : '1 năm'}
                  </button>
                ))}
              </div>
            </div>
            {chartLoading ? (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">⏳ Đang tải...</div>
            ) : chart.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-gray-300 text-sm">Chưa có dữ liệu</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chart} barSize={8} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip labelFormatter={l => 'Ngày ' + l} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="otp_success" name="Thành công" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="otp_timeout" name="Timeout" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="otp_bad_phone" name="Số xấu" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="otp_failed" name="Thất bại" fill="#ef4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Right: Line chart by hour (today) */}
          <div className="bg-white rounded-2xl shadow border border-gray-100 p-5">
            <h2 className="font-bold text-gray-700 mb-4">🕐 OTP trong ngày theo giờ</h2>
            {loading ? (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">⏳ Đang tải...</div>
            ) : hourly.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-gray-300 text-sm">Chưa có dữ liệu hôm nay</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={hourly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={v => `${v}h`} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip labelFormatter={l => `${l}:00`} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="otp_success" name="Thành công" stroke="#10b981" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="otp_timeout" name="Timeout" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="otp_bad_phone" name="Số xấu" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="otp_failed" name="Thất bại" stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── Bottom 2 columns ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Top 10 Users */}
          <div className="bg-white rounded-2xl shadow border border-gray-100 p-5">
            <h2 className="font-bold text-gray-700 mb-3">🏆 Top 10 người dùng mua nhiều nhất</h2>
            {loading ? (
              <div className="text-gray-400 text-sm">⏳ Đang tải...</div>
            ) : topUsers.length === 0 ? (
              <p className="text-gray-300 text-sm">Chưa có dữ liệu</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 text-xs border-b border-gray-100">
                      <th className="text-left py-2">#</th>
                      <th className="text-left py-2">Email</th>
                      <th className="text-right py-2">OTP</th>
                      <th className="text-right py-2">Đã tiêu</th>
                      <th className="text-right py-2">Số dư</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {topUsers.map((u, i) => (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="py-2 pr-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-gray-200 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'text-gray-400'}`}>
                            {i + 1}
                          </span>
                        </td>
                        <td className="py-2 text-gray-700 max-w-[140px] truncate">{u.email}</td>
                        <td className="py-2 text-right font-semibold text-purple-600">{fmt(u.otp_count)}</td>
                        <td className="py-2 text-right text-gray-600">{fmtMoney(u.total_spent)}</td>
                        <td className="py-2 text-right text-green-600">{fmtMoney(u.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-2xl shadow border border-gray-100 p-5">
            <h2 className="font-bold text-gray-700 mb-3">🕐 Giao dịch gần nhất</h2>
            {loading ? (
              <div className="text-gray-400 text-sm">⏳ Đang tải...</div>
            ) : recent.length === 0 ? (
              <p className="text-gray-300 text-sm">Chưa có giao dịch</p>
            ) : (
              <div className="space-y-2">
                {recent.map(tx => (
                  <div key={tx.id} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 font-medium truncate">{tx.user_email}</p>
                      <p className="text-xs text-gray-400">{tx.provider_name} · {tx.phone || '—'} · {tx.created_at}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[tx.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {STATUS_LABEL[tx.status] ?? tx.status}
                      </span>
                      <p className="text-xs text-gray-400 mt-0.5">{fmtMoney(tx.amount)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
