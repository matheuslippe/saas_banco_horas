import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from './api'

export default function ResetarSenha() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    if (senha !== confirmar) {
      setErro('Senhas nao conferem')
      return
    }
    if (senha.length < 6) {
      setErro('Senha deve ter no minimo 6 caracteres')
      return
    }
    try {
      await api.post('/resetar-senha', { token, senha })
      setSucesso(true)
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao redefinir senha')
    }
  }

  if (sucesso) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-white p-8 rounded-lg shadow-md w-96 text-center">
          <h1 className="text-2xl font-bold mb-4">Senha redefinida</h1>
          <p className="text-gray-600 mb-4">Sua senha foi alterada com sucesso.</p>
          <Link to="/login" className="text-blue-600 hover:underline">Fazer login</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6 text-center">Nova senha</h1>
        {erro && <p className="text-red-500 text-sm mb-4">{erro}</p>}
        <input
          type="password"
          placeholder="Nova senha"
          className="w-full border rounded px-3 py-2 mb-4"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
          minLength={6}
        />
        <input
          type="password"
          placeholder="Confirmar senha"
          className="w-full border rounded px-3 py-2 mb-4"
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value)}
          required
          minLength={6}
        />
        <button className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
          Redefinir senha
        </button>
      </form>
    </div>
  )
}