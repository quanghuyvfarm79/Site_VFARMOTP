import { useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'

interface Endpoint {
  action: string
  title: string
  desc: string
  params: { name: string; required: boolean; desc: string }[]
  example: string
  response: string
}

const ENDPOINTS: Endpoint[] = [
  {
    action: 'get_all_services',
    title: '1. Lấy danh sách dịch vụ',
    desc: 'Trả về danh sách tất cả dịch vụ OTP đang hoạt động.',
    params: [
      { name: 'key', required: true, desc: 'API key của bạn' },
      { name: 'action', required: true, desc: 'get_all_services' },
    ],
    example: '/api/?key=API_KEY&action=get_all_services',
    response: JSON.stringify([{ id: 1, name: 'Microsoft', price: 1000, timeout: 300 }], null, 2),
  },
  {
    action: 'get_number',
    title: '2. Lấy số điện thoại',
    desc: 'Tạo yêu cầu thuê SIM cho dịch vụ được chọn. Trừ tiền ngay khi gọi.',
    params: [
      { name: 'key', required: true, desc: 'API key của bạn' },
      { name: 'action', required: true, desc: 'get_number' },
      { name: 'id', required: true, desc: 'ID dịch vụ (lấy từ get_all_services)' },
    ],
    example: '/api/?key=API_KEY&action=get_number&id=1',
    response:
      '// Thành công:\n' +
      JSON.stringify({ success: true, number: '0901234567', request_id: 'REQ123456' }, null, 2) +
      '\n// Thất bại (hết tiền, provider lỗi...):\n' +
      JSON.stringify({ success: false, message: 'Your balance is not enough!' }, null, 2),
  },
  {
    action: 'get_code',
    title: '3. Lấy mã OTP',
    desc: 'Kiểm tra trạng thái OTP. Poll mỗi 5 giây cho đến khi nhận được mã.',
    params: [
      { name: 'key', required: true, desc: 'API key của bạn' },
      { name: 'action', required: true, desc: 'get_code' },
      { name: 'id', required: true, desc: 'request_id từ get_number' },
    ],
    example: '/api/?key=API_KEY&action=get_code&id=REQ123456',
    response:
      '// Đang chờ:\n' +
      JSON.stringify({ success: true, otp_code: 'is_comming' }, null, 2) +
      '\n// Đã có OTP:\n' +
      JSON.stringify({ success: true, otp_code: '123456' }, null, 2) +
      '\n// Hết giờ:\n' +
      JSON.stringify({ success: true, otp_code: 'timeout' }, null, 2),
  },
  {
    action: 'renew',
    title: '4. Đổi số khác (lấy số mới)',
    desc: 'Huỷ số hiện tại, hoàn tiền và lấy số MỚI từ cùng dịch vụ.',
    params: [
      { name: 'key', required: true, desc: 'API key của bạn' },
      { name: 'action', required: true, desc: 'renew' },
      { name: 'id', required: true, desc: 'request_id của yêu cầu cần đổi' },
    ],
    example: '/api/?key=API_KEY&action=renew&id=REQ123456',
    response: JSON.stringify({ success: true, message: 'Successfully!', number: '0912345678', request_id: 'REQ789012' }, null, 2),
  },
  {
    action: 'renew_phone',
    title: '5. Lấy lại OTP số cũ (Renew Phone)',
    desc: 'Lấy lại OTP cho một số điện thoại đã thuê trước đó. Dịch vụ phải bật "Cho phép Renew".',
    params: [
      { name: 'key', required: true, desc: 'API key của bạn' },
      { name: 'action', required: true, desc: 'renew_phone' },
      { name: 'id', required: true, desc: 'ID dịch vụ (provider)' },
      { name: 'phone', required: true, desc: 'Số điện thoại muốn lấy lại OTP' },
    ],
    example: '/api/?key=API_KEY&action=renew_phone&id=1&phone=0901234567',
    response:
      '// Thành công:\n' +
      JSON.stringify({ success: true, message: 'Successfully!', number: '0901234567', request_id: '0901234567' }, null, 2) +
      '\n// Dịch vụ không hỗ trợ renew:\n' +
      JSON.stringify({ success: false, message: 'provider does not allow renew' }, null, 2) +
      '\n// Số bị blacklist:\n' +
      JSON.stringify({ success: false, message: 'phone is blacklisted' }, null, 2),
  },
]

export default function APIDocsPage() {
  const { apiKey, generateAPIKey } = useAuth()
  const [generatingKey, setGeneratingKey] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showKey, setShowKey] = useState(false)

  async function handleGenerateKey() {
    setGeneratingKey(true)
    try { await generateAPIKey() } finally { setGeneratingKey(false) }
  }

  function copyKey() {
    if (!apiKey) return
    navigator.clipboard.writeText(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const baseUrl = window.location.origin

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">🔌 API Tích hợp</h1>
          <p className="text-gray-500 text-sm">Tích hợp API để tự động hóa việc nhận OTP</p>
        </div>

        {/* Base URL */}
        <div className="bg-white rounded-2xl shadow border border-gray-100 p-5">
          <h2 className="font-bold text-gray-700 mb-3">🌐 Base URL</h2>
          <div className="p-3 bg-gray-900 rounded-xl">
            <code className="text-green-400 font-mono text-sm">{baseUrl}/api/</code>
          </div>
          <p className="text-gray-400 text-xs mt-2">Tất cả request đều là GET. Không cần header đặc biệt.</p>
        </div>

        {/* API Key */}
        <div className="bg-white rounded-2xl shadow border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-700">🔑 API Key của bạn</h2>
            <button
              onClick={handleGenerateKey}
              disabled={generatingKey}
              className="px-3 py-1.5 text-sm bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 disabled:opacity-60"
            >
              {generatingKey ? '⏳...' : apiKey ? '🔄 Tạo lại' : '➕ Tạo key'}
            </button>
          </div>

          {apiKey ? (
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
              <code className="flex-1 text-xs font-mono text-gray-700 break-all">
                {showKey ? apiKey : apiKey.slice(0, 8) + '●'.repeat(20) + apiKey.slice(-4)}
              </code>
              <button onClick={() => setShowKey(v => !v)} className="text-gray-400 hover:text-gray-600 text-sm shrink-0">{showKey ? '🙈' : '👁️'}</button>
              <button onClick={copyKey} className="text-gray-400 hover:text-gray-600 text-sm shrink-0">{copied ? '✅' : '📋'}</button>
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">Chưa có API key. Nhấn "Tạo key" để tạo.</p>
          )}
          <p className="text-xs text-amber-600 mt-2">⚠️ Không chia sẻ key cho người khác. Nếu lộ key, tạo lại ngay.</p>
        </div>

        {/* Endpoints */}
        <div className="space-y-4">
          {ENDPOINTS.map(ep => (
            <div key={ep.action} className="bg-white rounded-2xl shadow border border-gray-100 p-5">
              <h2 className="font-bold text-gray-800 mb-1">{ep.title}</h2>
              <p className="text-gray-500 text-sm mb-4">{ep.desc}</p>

              {/* Params */}
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Tham số</p>
                <div className="divide-y divide-gray-50 border border-gray-100 rounded-xl overflow-hidden">
                  {ep.params.map(p => (
                    <div key={p.name} className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 text-sm">
                      <code className="font-mono text-purple-600 w-28 shrink-0">{p.name}</code>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${p.required ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-500'}`}>
                        {p.required ? 'bắt buộc' : 'tùy chọn'}
                      </span>
                      <span className="text-gray-500">{p.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Example */}
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Ví dụ</p>
                <div className="p-3 bg-gray-900 rounded-xl overflow-x-auto">
                  <code className="text-green-400 font-mono text-xs whitespace-nowrap">
                    GET {baseUrl}{ep.example.replace('API_KEY', apiKey ? apiKey.slice(0, 8) + '...' : 'YOUR_API_KEY')}
                  </code>
                </div>
              </div>

              {/* Response */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Phản hồi</p>
                <pre className="p-3 bg-gray-900 rounded-xl overflow-x-auto text-xs text-blue-300 font-mono whitespace-pre-wrap">
                  {ep.response}
                </pre>
              </div>
            </div>
          ))}
        </div>

        {/* Status codes */}
        <div className="bg-white rounded-2xl shadow border border-gray-100 p-5">
          <h2 className="font-bold text-gray-700 mb-3">📊 Trạng thái OTP (otp_code)</h2>
          <div className="divide-y divide-gray-50">
            {[
              { code: 'is_comming', desc: 'Đang chờ OTP, tiếp tục poll sau 5 giây', cls: 'bg-yellow-100 text-yellow-700' },
              { code: '123456', desc: 'Mã OTP đã nhận thành công', cls: 'bg-green-100 text-green-700' },
              { code: 'timeout', desc: 'Hết thời gian chờ, tiền đã được hoàn trả', cls: 'bg-red-100 text-red-700' },
            ].map(s => (
              <div key={s.code} className="flex items-center gap-3 py-3">
                <code className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${s.cls}`}>{s.code}</code>
                <span className="text-gray-500 text-sm">{s.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}
