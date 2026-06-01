import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './Login'
import Register from './Register'
import Painel from './Painel'
import RegistroForm from './RegistroForm'

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token')
  return token ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/painel"
          element={
            <ProtectedRoute>
              <Painel />
            </ProtectedRoute>
          }
        />
        <Route
          path="/registros/novo"
          element={
            <ProtectedRoute>
              <RegistroForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/registros/:id"
          element={
            <ProtectedRoute>
              <RegistroForm />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </div>
  )
}
