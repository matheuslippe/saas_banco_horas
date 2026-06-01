import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import api from '../api'

export default function PrivateRoute({ children, requireSubscription = true }) {
  const [status, setStatus] = useState('carregando')
  const token = localStorage.getItem('token')

  useEffect(() => {
    if (!token) {
      setStatus('sem_token')
      return
    }
    if (!requireSubscription) {
      setStatus('ok')
      return
    }
    api.get('/me')
      .then(({ data }) => {
        localStorage.setItem('usuario', JSON.stringify(data))
        if (data.status_assinatura === 'ativa' || data.status_assinatura === 'trial') {
          setStatus('ok')
        } else {
          setStatus('inativa')
        }
      })
      .catch(() => {
        localStorage.removeItem('token')
        setStatus('sem_token')
      })
  }, [token, requireSubscription])

  if (status === 'carregando') {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <p className="text-zinc-400">Verificando acesso...</p>
      </div>
    )
  }

  if (status === 'sem_token') return <Navigate to="/login" replace />
  if (status === 'inativa') return <Navigate to="/planos" replace />
  return children
}
