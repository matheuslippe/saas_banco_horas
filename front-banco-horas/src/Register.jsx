import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from './api'

export default function Register() {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    try {
      await api.post('/usuarios', { nome, email, senha })
      navigate('/login')
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao cadastrar')
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6 text-center">Criar Conta</h1>
        {erro && <p className="text-red-500 text-sm mb-4">{erro}</p>}
        <input
          type="text"
          placeholder="Nome"
          className="w-full border rounded px-3 py-2 mb-4"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
        />
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
        <button className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 mb-4">
          Cadastrar
        </button>
        <p className="text-center text-sm">
          Já tem conta? <Link to="/login" className="text-blue-600 hover:underline">Entrar</Link>
        </p>
      </form>
    </div>
  )
}
