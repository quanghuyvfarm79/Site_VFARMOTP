import { useEffect, useState } from 'react'
import AdminLayout from '../../components/AdminLayout'
import { adminAPI, type ProviderForm, type PhoneItem } from '../../services/api'
import type { Provider } from '../../types'

const emptyForm: ProviderForm = {
  id: 0,
  name: '', url: '', url_otp: '', key_phone: 'data.phone', key_req_id: 'data.request_id',
  key_otp: 'otp', fee: 1000, timeout: 300, time_delay: 5,
  use_phone_list: false, key_error_code: '', error_code_fatal: '', key_otp_done: '', allow_renew: true, auto_reset_used: false, active: true,
}


export default function AdminProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editTarget, setEditTarget] = useState<Provider | null>(null)
  const [form, setForm] = useState<ProviderForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  // Phone list modal
  const [phoneProvider, setPhoneProvider] = useState<Provider | null>(null)
  const [, setPhones] = useState<PhoneItem[]>([])
  const [phoneTotal, setPhoneTotal] = useState(0)
  const [phonePage, setPhonePage] = useState(1)
  const [phoneInput, setPhoneInput] = useState('')
  const [phoneLoading, setPhoneLoading] = useState(false)
  const [phoneAdding, setPhoneAdding] = useState(false)
  const [phoneBulkLoading, setPhoneBulkLoading] = useState(false)
  const [phoneMsg, setPhoneMsg] = useState('')
  const [phoneStats, setPhoneStats] = useState<{ available: number; used: number; bad: number } | null>(null)
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null)
  const [pendingFile, setPendingFile] = useState<{ name: string; lines: string[] } | null>(null)
  const [toast, setToast] = useState('')
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const PHONE_PAGE_SIZE = 100

  async function handleCleanupStuck() {
    if (!confirm('Hoàn tiền tất cả giao dịch bị stuck (quá deadline)?')) return
    setCleanupLoading(true)
    try {
      const r = await adminAPI.cleanupStuck()
      showToast(`✅ Đã hoàn tiền ${r.data.refunded} giao dịch stuck`)
    } catch { showToast('❌ Lỗi dọn stuck') }
    finally { setCleanupLoading(false) }
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 4000)
  }

  function load() {
    setLoading(true)
    adminAPI.getProviders().then(r => setProviders(r.data)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  function openCreate() {
    setForm(emptyForm); setEditTarget(null); setErr(''); setModal('create')
  }
  function openEdit(p: Provider) {
    setForm({
      id: p.id,
      name: p.name, url: p.url, url_otp: p.url_otp, key_phone: p.key_phone,
      key_req_id: p.key_req_id, key_otp: p.key_otp, fee: p.fee,
      timeout: p.timeout, time_delay: p.time_delay, use_phone_list: p.use_phone_list,
      key_error_code: p.key_error_code ?? '', error_code_fatal: p.error_code_fatal ?? '',
      key_otp_done: p.key_otp_done ?? '',
      allow_renew: p.allow_renew ?? true,
      auto_reset_used: p.auto_reset_used ?? false,
      active: p.active,
    })
    setEditTarget(p); setErr(''); setModal('edit')
  }

  async function handleToggleActive(id: number) {
    setProviders(prev => prev.map(p => p.id === id ? { ...p, active: !p.active } : p))
    await adminAPI.toggleProvider(id)
  }

  async function handleDelete(id: number) {
    if (!confirm('Xoá Product này? Toàn bộ danh sách SIM sẽ bị xoá theo.')) return
    try {
      await adminAPI.deleteProvider(id)
      load()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Lỗi xoá Product'
      alert(msg)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setErr('')
    try {
      if (modal === 'edit' && editTarget) await adminAPI.updateProvider(editTarget.id, form)
      else await adminAPI.createProvider(form)
      setModal(null); load()
    } catch (e: unknown) {
      setErr((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Lỗi lưu provider')
    } finally {
      setSaving(false)
    }
  }

  function f(field: keyof ProviderForm, value: string | number | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function loadPhonePage(providerId: number, page: number) {
    setPhoneLoading(true)
    try {
      const r = await adminAPI.listPhones(providerId, page, PHONE_PAGE_SIZE)
      setPhones(r.data.items)
      setPhoneTotal(r.data.total)
      setPhonePage(page)
    } finally {
      setPhoneLoading(false)
    }
  }

  async function openPhones(p: Provider) {
    setPhoneProvider(p); setPhoneMsg(''); setPhoneInput(''); setImportProgress(null); setPendingFile(null)
    setPhoneStats({ available: p.phone_available ?? 0, used: p.phone_used ?? 0, bad: p.phone_bad ?? 0 })
    await loadPhonePage(p.id, 1)
  }

  async function handleResetUsed() {
    if (!phoneProvider) return
    if (!confirm(`Nạp lại tất cả số đã dùng về "sẵn sàng" cho ${phoneProvider.name}?`)) return
    setPhoneBulkLoading(true)
    try {
      const r = await adminAPI.resetUsedPhones(phoneProvider.id)
      showToast(`✅ Đã reset ${r.data.reset.toLocaleString()} số về sẵn sàng`)
      await loadPhonePage(phoneProvider.id, 1)
      load()
      setPhoneStats(s => s ? { ...s, available: s.available + r.data.reset, used: 0 } : s)
    } catch { showToast('❌ Lỗi reset số') }
    finally { setPhoneBulkLoading(false) }
  }

  async function handleDeleteUsed() {
    if (!phoneProvider) return
    if (!confirm(`Xóa vĩnh viễn tất cả số đã dùng của ${phoneProvider.name}?`)) return
    setPhoneBulkLoading(true)
    try {
      const r = await adminAPI.deleteUsedPhones(phoneProvider.id)
      showToast(`🗑️ Đã xóa ${r.data.deleted.toLocaleString()} số đã dùng`)
      await loadPhonePage(phoneProvider.id, 1)
      load()
      setPhoneStats(s => s ? { ...s, used: 0 } : s)
    } catch { showToast('❌ Lỗi xóa số') }
    finally { setPhoneBulkLoading(false) }
  }

  async function handleDeleteBad() {
    if (!phoneProvider) return
    if (!confirm(`Xóa vĩnh viễn tất cả số xấu của ${phoneProvider.name}?`)) return
    setPhoneBulkLoading(true)
    try {
      const r = await adminAPI.deleteBadPhones(phoneProvider.id)
      showToast(`🗑️ Đã xóa ${r.data.deleted.toLocaleString()} số xấu`)
      await loadPhonePage(phoneProvider.id, 1)
      load()
      setPhoneStats(s => s ? { ...s, bad: 0 } : s)
    } catch { showToast('❌ Lỗi xóa số xấu') }
    finally { setPhoneBulkLoading(false) }
  }

  // Step 1: read file into memory, don't import yet
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0]) return
    const file = e.target.files[0]
    e.target.value = ''
    const text = await file.text()
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) return
    setPendingFile({ name: file.name, lines })
  }

  // Step 2: user clicks "Import X số" — batch-send to server
  async function handleStartImport() {
    if (!phoneProvider || !pendingFile) return
    const { lines } = pendingFile
    const BATCH = 10000
    setPhoneAdding(true)
    setImportProgress({ done: 0, total: lines.length })
    setPendingFile(null)
    let totalAdded = 0
    for (let i = 0; i < lines.length; i += BATCH) {
      const chunk = lines.slice(i, i + BATCH).join('\n')
      try {
        const r = await adminAPI.addPhones(phoneProvider.id, chunk)
        totalAdded += r.data.added
      } catch { /* skip duplicate/error batches */ }
      setImportProgress({ done: Math.min(i + BATCH, lines.length), total: lines.length })
    }
    setPhoneAdding(false)
    setImportProgress(null)
    const skipped = lines.length - totalAdded
    showToast(`✅ Import xong: thêm mới ${totalAdded.toLocaleString()} số${skipped > 0 ? ` · bỏ qua ${skipped.toLocaleString()} trùng` : ''}`)
    await loadPhonePage(phoneProvider.id, 1)
    load()
  }

  async function handleAddPhones() {
    if (!phoneProvider || !phoneInput.trim()) return
    setPhoneAdding(true); setPhoneMsg('')
    try {
      const total = phoneInput.split(/\r?\n/).map(l => l.trim()).filter(Boolean).length
      const r = await adminAPI.addPhones(phoneProvider.id, phoneInput)
      const skipped = total - r.data.added
      setPhoneMsg(`✅ Thêm mới ${r.data.added} số${skipped > 0 ? ` · bỏ qua ${skipped} trùng` : ''}`)
      setPhoneInput('')
      await loadPhonePage(phoneProvider.id, 1)
      load()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Lỗi thêm số'
      setPhoneMsg(`❌ ${msg}`)
    } finally {
      setPhoneAdding(false)
    }
  }


  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">🛍️ Quản lý Product</h1>
            <p className="text-gray-500 text-sm">Cấu hình sản phẩm OTP và API</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCleanupStuck} disabled={cleanupLoading}
              className="px-4 py-2 bg-orange-100 text-orange-700 font-semibold rounded-xl text-sm hover:bg-orange-200 disabled:opacity-50">
              {cleanupLoading ? '⏳...' : '🧹 Dọn Stuck'}
            </button>
            <button onClick={openCreate}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl text-sm hover:from-purple-700 hover:to-pink-700">
              ➕ Thêm Product
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  {['ID', 'Tên', 'Phí', 'Timeout', 'Delay', 'SIM Pool', 'Trạng thái', 'Thao tác'].map(h => (
                    <th key={h} className="px-4 py-3 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-8 text-gray-400">⏳ Đang tải...</td></tr>
                ) : providers.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400">#{p.id}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                    <td className="px-4 py-3 font-semibold text-purple-600">{p.fee.toLocaleString('vi-VN')}đ</td>
                    <td className="px-4 py-3 text-gray-500">{p.timeout}s</td>
                    <td className="px-4 py-3 text-gray-500">{p.time_delay}s</td>
                    <td className="px-4 py-3">
                      {p.use_phone_list ? (
                        <div className="flex gap-1 flex-wrap text-xs">
                          <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-semibold">{p.phone_available ?? 0} sẵn</span>
                          <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded font-semibold">{p.phone_used ?? 0} dùng</span>
                          {(p.phone_bad ?? 0) > 0 && <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-semibold">{p.phone_bad} xấu</span>}
                        </div>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {p.active ? '✅ Hoạt động' : '⛔ Tắt'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => handleToggleActive(p.id)}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${p.active ? 'bg-green-500' : 'bg-gray-300'}`}
                          title={p.active ? 'Đang bật — click để tắt' : 'Đang tắt — click để bật'}
                        >
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${p.active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </button>
                        {p.use_phone_list && (
                          <button onClick={() => openPhones(p)} className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs hover:bg-blue-100">📱 SIM</button>
                        )}
                        <button onClick={() => openEdit(p)} className="px-2 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs hover:bg-gray-200">✏️ Sửa</button>
                        <button onClick={() => handleDelete(p.id)} className="px-2 py-1 bg-red-100 text-red-700 rounded-lg text-xs hover:bg-red-200">🗑️ Xoá</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create/Edit modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">{modal === 'create' ? '➕ Thêm Product mới' : '✏️ Sửa Product'}</h2>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
              {err && <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{err}</div>}

              {modal === 'create' ? (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ID (tuỳ chọn — để trống để tự tăng)</label>
                  <input type="number" value={form.id || ''} onChange={e => f('id', parseInt(e.target.value) || 0)}
                    min="1" placeholder="Tự động"
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 text-sm" />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ID (có thể đổi — nếu trùng sẽ báo lỗi)</label>
                  <input type="number" value={form.id || ''} onChange={e => f('id', parseInt(e.target.value) || 0)}
                    min="1"
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 text-sm" />
                </div>
              )}

              {([
                ['Tên dịch vụ', 'name', 'text'],
                ['URL lấy số (GET)', 'url', 'text'],
                ['URL lấy OTP (GET + request_id)', 'url_otp', 'text'],
                ['Key phone trong response', 'key_phone', 'text'],
                ['Key request_id trong response', 'key_req_id', 'text'],
                ['Key otp trong response', 'key_otp', 'text'],
              ] as [string, keyof ProviderForm, string][]).map(([label, field, type]) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                  <input type={type} value={form[field] as string} onChange={e => f(field, e.target.value)}
                    required={field === 'name' || field === 'url_otp' || (field === 'url' && !form.use_phone_list)}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 text-sm" />
                </div>
              ))}

              <div className="grid grid-cols-3 gap-3">
                {([['Phí (đ)', 'fee'], ['Timeout (s)', 'timeout'], ['Time delay (s)', 'time_delay']] as [string, keyof ProviderForm][]).map(([label, field]) => (
                  <div key={field}>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                    <input type="number" value={form[field] as number} onChange={e => f(field, parseInt(e.target.value) || 0)}
                      min="0"
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 text-sm" />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Key lỗi (tuỳ chọn)</label>
                  <input type="text" value={form.key_error_code} onChange={e => f('key_error_code', e.target.value)}
                    placeholder="ErrorCode"
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Giá trị lỗi fatal</label>
                  <input type="text" value={form.error_code_fatal} onChange={e => f('error_code_fatal', e.target.value)}
                    placeholder="6"
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Giá trị "hết hạn" từ upstream <span className="text-gray-400">(key_otp_done)</span>
                </label>
                <input type="text" value={form.key_otp_done} onChange={e => f('key_otp_done', e.target.value)}
                  placeholder="timeout — giá trị otp_code khi upstream báo hết hạn"
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 text-sm" />
                <p className="text-xs text-gray-400 mt-1">Khi field key_otp trả về giá trị này → refund ngay, không chờ timeout</p>
              </div>

              <div className="flex items-center gap-6 pt-1 flex-wrap">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={form.active} onChange={e => f('active', e.target.checked)} className="accent-purple-500" />
                  Hoạt động
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={form.use_phone_list} onChange={e => f('use_phone_list', e.target.checked)} className="accent-purple-500" />
                  Dùng danh sách SIM
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={form.allow_renew} onChange={e => f('allow_renew', e.target.checked)} className="accent-purple-500" />
                  Cho phép Renew
                </label>
                {form.use_phone_list && (
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer" title="Khi hết số sẵn sàng, tự động nạp lại toàn bộ số đã dùng và cấp tiếp">
                    <input type="checkbox" checked={form.auto_reset_used} onChange={e => f('auto_reset_used', e.target.checked)} className="accent-purple-500" />
                    Tự động nạp lại số đã dùng
                  </label>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setModal(null)}
                  className="flex-1 py-2.5 border-2 border-gray-200 text-gray-500 rounded-xl text-sm hover:bg-gray-50">Huỷ</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl text-sm hover:from-purple-700 hover:to-pink-700 disabled:opacity-60">
                  {saving ? '⏳...' : modal === 'create' ? '➕ Tạo' : '💾 Lưu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Phone list modal */}
      {phoneProvider && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div>
                <h2 className="font-bold text-gray-800">📱 Danh sách SIM — {phoneProvider.name}</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Tổng {phoneTotal.toLocaleString()} số •
                  trang {phonePage}/{Math.max(1, Math.ceil(phoneTotal / PHONE_PAGE_SIZE))}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {phoneLoading && <span className="text-xs text-gray-400 animate-pulse">⏳</span>}
                <button onClick={() => setPhoneProvider(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>
            </div>

            {/* Import section */}
            <div className="px-6 py-4 border-b border-gray-100 shrink-0 space-y-2">
              {/* File select — show preview after picking */}
              {!pendingFile && !importProgress && (
                <label className={`flex-1 cursor-pointer ${phoneAdding ? 'pointer-events-none opacity-50' : ''}`}>
                  <div className="flex items-center gap-2 px-3 py-2 border-2 border-dashed border-purple-300 rounded-xl text-sm text-purple-600 hover:border-purple-500 hover:bg-purple-50 transition-colors">
                    <span>📂</span>
                    <span>Chọn file .txt (mỗi dòng 1 số — hỗ trợ 300k+)</span>
                  </div>
                  <input type="file" accept=".txt" className="hidden" onChange={handleFileSelect} />
                </label>
              )}

              {/* Pending file preview */}
              {pendingFile && !importProgress && (
                <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-xl">
                  <span className="text-sm text-purple-700 flex-1 truncate">
                    📄 <span className="font-medium">{pendingFile.name}</span>
                    <span className="ml-2 text-purple-500">{pendingFile.lines.length.toLocaleString()} số</span>
                  </span>
                  <button onClick={() => setPendingFile(null)} className="text-gray-400 hover:text-gray-600 text-xs shrink-0">✕</button>
                  <button
                    onClick={handleStartImport}
                    className="px-3 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg text-xs shrink-0 hover:from-purple-700 hover:to-pink-700"
                  >
                    ➕ Import {pendingFile.lines.length.toLocaleString()} số
                  </button>
                </div>
              )}

              {/* Progress bar */}
              {importProgress && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>⏳ Đang import...</span>
                    <span>{importProgress.done.toLocaleString()} / {importProgress.total.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-purple-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.round(importProgress.done / importProgress.total * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Manual paste (small amounts) */}
              <details className="text-xs">
                <summary className="cursor-pointer text-gray-400 hover:text-gray-600 select-none">➕ Nhập tay (số lượng nhỏ)</summary>
                <div className="mt-2">
                  <textarea
                    value={phoneInput}
                    onChange={e => setPhoneInput(e.target.value)}
                    rows={3}
                    placeholder={"84388401426\n84395258897"}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:border-purple-500 resize-none"
                  />
                  <button
                    onClick={handleAddPhones}
                    disabled={phoneAdding || !phoneInput.trim()}
                    className="mt-1 px-4 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg text-sm disabled:opacity-50"
                  >
                    {phoneAdding ? '⏳...' : '➕ Thêm'}
                  </button>
                </div>
              </details>

              {phoneMsg && (
                <p className={`text-xs ${phoneMsg.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>{phoneMsg}</p>
              )}
            </div>

            {/* Stats + bulk actions */}
            <div className="px-6 py-4 space-y-3">
              {/* Counters */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-green-600">{(phoneStats?.available ?? 0).toLocaleString()}</p>
                  <p className="text-xs text-green-700">🟢 Sẵn sàng</p>
                </div>
                <div className="bg-yellow-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-yellow-600">{(phoneStats?.used ?? 0).toLocaleString()}</p>
                  <p className="text-xs text-yellow-700">🟡 Đã dùng</p>
                </div>
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-red-600">{(phoneStats?.bad ?? 0).toLocaleString()}</p>
                  <p className="text-xs text-red-700">🔴 Số xấu</p>
                </div>
              </div>
              {/* Bulk action buttons */}
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={handleResetUsed}
                  disabled={phoneBulkLoading || (phoneStats?.used ?? 0) === 0}
                  className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded-xl text-xs font-semibold hover:bg-blue-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  🔄 Nạp lại số đã dùng
                </button>
                <button
                  onClick={handleDeleteUsed}
                  disabled={phoneBulkLoading || (phoneStats?.used ?? 0) === 0}
                  className="flex-1 px-3 py-2 bg-orange-100 text-orange-700 rounded-xl text-xs font-semibold hover:bg-orange-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  🗑️ Xóa số đã dùng
                </button>
                {(phoneStats?.bad ?? 0) > 0 && (
                  <button
                    onClick={handleDeleteBad}
                    disabled={phoneBulkLoading}
                    className="flex-1 px-3 py-2 bg-red-100 text-red-700 rounded-xl text-xs font-semibold hover:bg-red-200 disabled:opacity-40"
                  >
                    🗑️ Xóa số xấu
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Toast notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-[100] px-5 py-3 bg-gray-900 text-white text-sm font-medium rounded-2xl shadow-xl animate-fade-in">
          {toast}
        </div>
      )}
    </AdminLayout>
  )
}
