import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import APIDocsPage from './pages/APIDocsPage'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import OTPPage from './pages/OTPPage'
import ProfilePage from './pages/ProfilePage'
import RegisterPage from './pages/RegisterPage'
import TransactionsPage from './pages/TransactionsPage'
import BalancePage from './pages/BalancePage'
import AdminDashboardPage from './pages/admin/DashboardPage'
import AdminUsersPage from './pages/admin/UsersPage'
import AdminProvidersPage from './pages/admin/ProvidersPage'
import AdminTransactionsPage from './pages/admin/TransactionsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* User protected */}
        <Route path="/dashboard"    element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/otp"          element={<ProtectedRoute><OTPPage /></ProtectedRoute>} />
        <Route path="/transactions" element={<ProtectedRoute><TransactionsPage /></ProtectedRoute>} />
        <Route path="/balance"      element={<ProtectedRoute><BalancePage /></ProtectedRoute>} />
        <Route path="/api-docs"     element={<ProtectedRoute><APIDocsPage /></ProtectedRoute>} />
        <Route path="/profile"      element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

        {/* Admin protected */}
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin/dashboard"    element={<ProtectedRoute requireAdmin><AdminDashboardPage /></ProtectedRoute>} />
        <Route path="/admin/users"        element={<ProtectedRoute requireAdmin><AdminUsersPage /></ProtectedRoute>} />
        <Route path="/admin/providers"    element={<ProtectedRoute requireAdmin><AdminProvidersPage /></ProtectedRoute>} />
        <Route path="/admin/transactions" element={<ProtectedRoute requireAdmin><AdminTransactionsPage /></ProtectedRoute>} />

        {/* Default */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
