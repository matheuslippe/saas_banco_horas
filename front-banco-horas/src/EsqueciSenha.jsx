import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from './api'

export default function EsqueciSenha() {
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    try {
      await api.post('/esqueci-senha', { email })
      setEnviado(true)
    } catch {
      setErro('Erro ao enviar. Tente novamente.')
    }
  }

  if (enviado) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-white p-8 rounded-lg shadow-md w-96 text-center">
          <h1 className="text-2xl font-bold mb-4">Email enviado</h1>
          <p className="text-gray-600 mb-4">
            Se o email existir, voce recebera um link para redefinir sua senha.
          </p>
          <Link to="/login" className="text-blue-600 hover:underline">Voltar ao login</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6 text-center">Recuperar senha</h1>
        {erro && <p className="text-red-500 text-sm mb-4">{erro}</p>}
        <input
          type="email"
          placeholder="Seu email"
          className="w-full border rounded px-3 py-2 mb-4"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 mb-4">
          Enviar link
        </button>
        <p className="text-center text-sm">
          <Link to="/login" className="text-blue-600 hover:underline">Voltar ao login</Link>
        </p>
      </form>
    </div>
  )
}