import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from './api'

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    try {
      const { data } = await api.post('/login', { email, senha })
      localStorage.setItem('token', data.token)
      localStorage.setItem('usuario', JSON.stringify(data.usuario))
      navigate('/painel')
    } catch {
      setErro('Email ou senha incorretos')
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6 text-center">Banco de Horas</h1>
        {erro && <p className="text-red-500 text-sm mb-4">{erro}</p>}
        <input
          type="email"
          placeholder="Email"
          className="w-full border rounded px-3 py-2 mb-4"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Senha"
          className="w-full border rounded px-3 py-2 mb-4"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
        />
        <button className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
          Entrar
        </button>
        <p className="text-center text-sm mt-4">
          Não tem conta? <Link to="/register" className="text-blue-600 hover:underline">Cadastre-se</Link>
        </p>
      </form>
    </div>
  )
}
