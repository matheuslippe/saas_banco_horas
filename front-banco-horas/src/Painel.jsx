import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from './api'

function formatarData(dataStr) {
  if (!dataStr) return '-'
  const [ano, mes, dia] = dataStr.slice(0, 10).split('-')
  return `${dia}/${mes}/${ano}`
}

function formatarDuracao(horasDecimais) {
  const h = Math.floor(horasDecimais)
  const min = Math.round((horasDecimais - h) * 60)
  return `${h}h ${min}m`
}

export default function Painel() {
  const [registros, setRegistros] = useState([])
  const [saldo, setSaldo] = useState(0)
  const navigate = useNavigate()
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}')

  useEffect(() => {
    carregarDados()
  }, [])

  async function carregarDados() {
    try {
      const { data } = await api.get(`/painel/${usuario.id}`)
      setRegistros(data.registros)
      setSaldo(data.saldo)
    } catch {
      alert('Erro ao carregar dados')
    }
  }

  async function handleDelete(id) {
    if (!confirm('Excluir este registro?')) return
    try {
      await api.delete(`/registros/${id}`)
      carregarDados()
    } catch {
      alert('Erro ao excluir')
    }
  }

  function handleLogout() {
    localStorage.removeItem('token')
    localStorage.removeItem('usuario')
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-zinc-900 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-zinc-100">Painel — {usuario.nome}</h1>
          <div className="flex gap-3">
            <button onClick={() => navigate('/registros/novo')}
              className="bg-zinc-100 text-zinc-900 px-5 py-2.5 rounded-2xl font-medium hover:bg-white transition">
              + Novo Registro
            </button>
            <button onClick={handleLogout}
              className="bg-red-500/80 text-white px-5 py-2.5 rounded-2xl font-medium hover:bg-red-500 transition">
              Sair
            </button>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl p-6 mb-8">
          <p className="text-zinc-100 text-lg">
            Saldo de horas:{' '}
            <span className={`font-bold ${saldo >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatarDuracao(saldo)}
            </span>
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left p-4 text-zinc-400 font-medium">Data</th>
                <th className="text-left p-4 text-zinc-400 font-medium">Início</th>
                <th className="text-left p-4 text-zinc-400 font-medium">Fim</th>
                <th className="text-left p-4 text-zinc-400 font-medium">Tipo</th>
                <th className="text-left p-4 text-zinc-400 font-medium">Observação</th>
                <th className="text-right p-4 text-zinc-400 font-medium">Horas Calc.</th>
                <th className="text-center p-4 text-zinc-400 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r.id} className="border-b border-white/5 hover:bg-white/5 transition">
                  <td className="p-4 text-zinc-100">{formatarData(r.data_registro)}</td>
                  <td className="p-4 text-zinc-100">{r.inicio.slice(0, 5)}</td>
                  <td className="p-4 text-zinc-100">{r.fim.slice(0, 5)}</td>
                  <td className="p-4">
                    <span className={`inline-block px-3 py-1 rounded-xl text-xs font-medium ${
                      r.tipo === 'extra'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {r.tipo === 'extra' ? 'Extra' : 'Compensação'}
                    </span>
                  </td>
                  <td className="p-4 text-zinc-400 max-w-xs truncate">{r.observacao || '-'}</td>
                  <td className="p-4 text-right text-zinc-100 font-medium">{formatarDuracao(Number(r.horas_calculadas))}</td>
                  <td className="p-4 text-center">
                    <button onClick={() => navigate(`/registros/${r.id}`)}
                      className="text-zinc-400 hover:text-zinc-100 transition mr-3">Editar</button>
                    <button onClick={() => handleDelete(r.id)}
                      className="text-red-400 hover:text-red-300 transition">Excluir</button>
                  </td>
                </tr>
              ))}
              {registros.length === 0 && (
                <tr>
                  <td colSpan="7" className="p-10 text-center text-zinc-500">
                    Nenhum registro encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
