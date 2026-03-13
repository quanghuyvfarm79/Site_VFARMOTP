import { useEffect, useState } from 'react'
import AdminLayout from '../../components/AdminLayout'
import { adminAPI, type AdminUser, type AdminUserStats } from '../../services/api'

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  // Topup modal
  const [topupUser, setTopupUser] = useState<AdminUser | null>(null)
  const [topupAmount, setTopupAmount] = useState('')
  const [topupNote, setTopupNote] = useState('')
  const [topupLoading, setTopupLoading] = useState(false)
  const [topupMsg, setTopupMsg] = useState('')

  // Edit modal
  const [editUser, setEditUser] = useState<AdminUser | null>(null)
  const [editBalance, setEditBalance] = useState('')
  const [editRole, setEditRole] = useState('user')
  const [editLoading, setEditLoading] = useState(false)
  const [editMsg, setEditMsg] = useState('')

  // Stats modal
  const [statsUser, setStatsUser] = useState<AdminUser | null>(null)
  const [stats, setStats] = useState<AdminUserStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)

  // Delete confirm
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const limit = 20

  function load(p = page) {
    setLoading(true)
    adminAPI.getUsers(p, limit)
      .then(r => { setUsers(r.data.items); setTotal(r.data.total) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [page])

  async function handleTopup(e: React.FormEvent) {
    e.preventDefault()
    if (!topupUser) return
    const amount = parseInt(topupAmount)
    if (!amount || amount <= 0) return
    setTopupLoading(true)
    setTopupMsg('')
    try {
      await adminAPI.topupUser(topupUser.id, amount, topupNote || 'Admin nạp tiền')
      setTopupMsg('✅ Nạp tiền thành công!')
      setTopupAmount('')
      setTopupNote('')
      load()
    } catch {
      setTopupMsg('❌ Lỗi khi nạp tiền')
    } finally {
      setTopupLoading(false)
    }
  }

  async function handleToggle(u: AdminUser) {
    await adminAPI.toggleUser(u.id)
    load()
  }

  function openEdit(u: AdminUser) {
    setEditUser(u)
    setEditBalance(String(u.balance))
    setEditRole(u.role)
    setEditMsg('')
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editUser) return
    const balance = parseInt(editBalance)
    if (isNaN(balance) || balance < 0) { setEditMsg('❌ Số dư không hợp lệ'); return }
    setEditLoading(true)
    setEditMsg('')
    try {
      await adminAPI.editUser(editUser.id, balance, editRole)
      setEditMsg('✅ Cập nhật thành công!')
      load()
    } catch (err: any) {
      setEditMsg('❌ ' + (err?.response?.data?.error || 'Lỗi cập nhật'))
    } finally {
      setEditLoading(false)
    }
  }

  async function openStats(u: AdminUser) {
    setStatsUser(u)
    setStats(null)
    setStatsLoading(true)
    try {
      const r = await adminAPI.getUserStats(u.id)
      setStats(r.data)
    } finally {
      setStatsLoading(false)
    }
  }

  async function handleDelete() {
    if (!deleteUser) return
    setDeleteLoading(true)
    try {
      await adminAPI.deleteUser(deleteUser.id)
      setDeleteUser(null)
      load()
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Lỗi xoá user')
    } finally {
      setDeleteLoading(false)
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">👥 Người dùng</h1>
          <p className="text-gray-500 text-sm">Quản lý tài khoản — tổng {total} user</p>
        </div>

        <div className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  {['ID', 'Email', 'Vai trò', 'Số dư', 'Trạng thái', 'Ngày tạo', 'Thao tác'].map(h => (
                    <th key={h} className="px-4 py-3 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-400">⏳ Đang tải...</td></tr>
                ) : users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400">#{u.id}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {u.role === 'admin' ? '👑 Admin' : '👤 User'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-green-600">{u.balance.toLocaleString('vi-VN')}đ</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${u.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {u.active ? '✅ Hoạt động' : '🔒 Khoá'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{u.created_at}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        <button
                          onClick={() => { setTopupUser(u); setTopupMsg('') }}
                          className="px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs hover:bg-green-200"
                        >💰 Nạp</button>
                        <button
                          onClick={() => openEdit(u)}
                          className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs hover:bg-blue-200"
                        >✏️ Sửa</button>
                        <button
                          onClick={() => openStats(u)}
                          className="px-2 py-1 bg-purple-100 text-purple-700 rounded-lg text-xs hover:bg-purple-200"
                        >📊 Thống kê</button>
                        {u.role !== 'admin' && (
                          <>
                            <button
                              onClick={() => handleToggle(u)}
                              className={`px-2 py-1 rounded-lg text-xs ${u.active ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : 'bg-sky-100 text-sky-700 hover:bg-sky-200'}`}
                            >{u.active ? '🔒 Khoá' : '🔓 Mở'}</button>
                            <button
                              onClick={() => setDeleteUser(u)}
                              className="px-2 py-1 bg-red-100 text-red-700 rounded-lg text-xs hover:bg-red-200"
                            >🗑️ Xoá</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <span className="text-xs text-gray-500">Trang {page}/{totalPages}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1 text-xs border rounded-lg disabled:opacity-40 hover:bg-gray-50">← Trước</button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-3 py-1 text-xs border rounded-lg disabled:opacity-40 hover:bg-gray-50">Tiếp →</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Topup modal */}
      {topupUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="font-bold text-gray-800 mb-1">💰 Nạp tiền</h2>
            <p className="text-sm text-gray-500 mb-4">{topupUser.email}</p>
            <p className="text-sm text-gray-600 mb-4">Số dư hiện tại: <strong className="text-green-600">{topupUser.balance.toLocaleString('vi-VN')}đ</strong></p>
            {topupMsg && (
              <div className={`mb-3 p-2 rounded-lg text-sm text-center ${topupMsg.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {topupMsg}
              </div>
            )}
            <form onSubmit={handleTopup} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Số tiền (đ)</label>
                <input type="number" value={topupAmount} onChange={e => setTopupAmount(e.target.value)}
                  placeholder="10000" min="1" required
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Ghi chú</label>
                <input type="text" value={topupNote} onChange={e => setTopupNote(e.target.value)}
                  placeholder="Admin nạp tiền"
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 text-sm" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setTopupUser(null)}
                  className="flex-1 py-2 border-2 border-gray-200 text-gray-500 rounded-xl text-sm hover:bg-gray-50">Huỷ</button>
                <button type="submit" disabled={topupLoading}
                  className="flex-1 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-xl text-sm hover:from-green-600 hover:to-emerald-600 disabled:opacity-60">
                  {topupLoading ? '⏳...' : '✅ Nạp tiền'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit user modal */}
      {editUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="font-bold text-gray-800 mb-1">✏️ Chỉnh sửa người dùng</h2>
            <p className="text-sm text-gray-500 mb-4">{editUser.email}</p>
            {editMsg && (
              <div className={`mb-3 p-2 rounded-lg text-sm text-center ${editMsg.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {editMsg}
              </div>
            )}
            <form onSubmit={handleEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Số dư (đ)</label>
                <input type="number" value={editBalance} onChange={e => setEditBalance(e.target.value)}
                  min="0" required
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 text-sm" />
                <p className="text-xs text-gray-400 mt-1">Nhập số dư mới (ghi đè trực tiếp)</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Vai trò</label>
                <select value={editRole} onChange={e => setEditRole(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 text-sm bg-white">
                  <option value="user">👤 User</option>
                  <option value="admin">👑 Admin</option>
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setEditUser(null)}
                  className="flex-1 py-2 border-2 border-gray-200 text-gray-500 rounded-xl text-sm hover:bg-gray-50">Huỷ</button>
                <button type="submit" disabled={editLoading}
                  className="flex-1 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold rounded-xl text-sm hover:from-blue-600 hover:to-indigo-600 disabled:opacity-60">
                  {editLoading ? '⏳...' : '💾 Lưu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stats modal */}
      {statsUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-gray-800">📊 Thống kê</h2>
                <p className="text-sm text-gray-500">{statsUser.email}</p>
              </div>
              <button onClick={() => setStatsUser(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            {statsLoading ? (
              <p className="text-center text-gray-400 py-6">⏳ Đang tải...</p>
            ) : stats ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-green-600 font-medium">Tổng nạp</p>
                    <p className="text-lg font-bold text-green-700">{stats.total_topup.toLocaleString('vi-VN')}đ</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-red-600 font-medium">Tổng chi</p>
                    <p className="text-lg font-bold text-red-700">{stats.total_spent.toLocaleString('vi-VN')}đ</p>
                  </div>
                  <div className="bg-purple-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-purple-600 font-medium">OTP đã mua</p>
                    <p className="text-lg font-bold text-purple-700">{stats.total_otp}</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-blue-600 font-medium">Số dư hiện tại</p>
                    <p className="text-lg font-bold text-blue-700">{statsUser.balance.toLocaleString('vi-VN')}đ</p>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 font-medium">Đăng nhập gần nhất</p>
                  <p className="text-sm font-semibold text-gray-700 mt-1">
                    {stats.last_login_at ?? '—'}
                  </p>
                </div>
                {stats.last_login_ua && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500 font-medium mb-1">
                      {/Mobile|Android|iPhone|iPad/i.test(stats.last_login_ua) ? '📱' : '🖥️'} User Agent
                    </p>
                    <p className="text-xs text-gray-600 break-all leading-relaxed">{stats.last_login_ua}</p>
                  </div>
                )}
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 font-medium">Ngày tạo tài khoản</p>
                  <p className="text-sm font-semibold text-gray-700 mt-1">{statsUser.created_at}</p>
                </div>
              </div>
            ) : null}
            <button onClick={() => setStatsUser(null)}
              className="mt-4 w-full py-2 border-2 border-gray-200 text-gray-500 rounded-xl text-sm hover:bg-gray-50">
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="text-5xl mb-3">🗑️</div>
            <h2 className="font-bold text-gray-800 mb-1">Xoá người dùng?</h2>
            <p className="text-sm text-gray-500 mb-1">{deleteUser.email}</p>
            <p className="text-xs text-red-500 mb-5">Hành động này không thể hoàn tác. Tất cả dữ liệu liên quan sẽ bị xoá.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteUser(null)}
                className="flex-1 py-2 border-2 border-gray-200 text-gray-500 rounded-xl text-sm hover:bg-gray-50">Huỷ</button>
              <button onClick={handleDelete} disabled={deleteLoading}
                className="flex-1 py-2 bg-gradient-to-r from-red-500 to-rose-500 text-white font-semibold rounded-xl text-sm hover:from-red-600 hover:to-rose-600 disabled:opacity-60">
                {deleteLoading ? '⏳...' : '🗑️ Xoá'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
