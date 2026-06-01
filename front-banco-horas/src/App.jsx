import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './Login'
import Register from './Register'
import EsqueciSenha from './EsqueciSenha'
import ResetarSenha from './ResetarSenha'
import Painel from './Painel'
import RegistroForm from './RegistroForm'
import Planos from './Planos'
import Perfil from './Perfil'
import PrivateRoute from './components/PrivateRoute'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/esqueci-senha" element={<EsqueciSenha />} />
        <Route path="/resetar-senha/:token" element={<ResetarSenha />} />
        <Route
          path="/planos"
          element={
            <PrivateRoute requireSubscription={false}>
              <Planos />
            </PrivateRoute>
          }
        />
        <Route
          path="/perfil"
          element={
            <PrivateRoute>
              <Perfil />
            </PrivateRoute>
          }
        />
        <Route
          path="/painel"
          element={
            <PrivateRoute>
              <Painel />
            </PrivateRoute>
          }
        />
        <Route
          path="/registros/novo"
          element={
            <PrivateRoute>
              <RegistroForm />
            </PrivateRoute>
          }
        />
        <Route
          path="/registros/:id"
          element={
            <PrivateRoute>
              <RegistroForm />
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </div>
  )
}
