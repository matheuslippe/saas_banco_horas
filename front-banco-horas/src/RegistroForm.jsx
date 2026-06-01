import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from './api'

export default function RegistroForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editando = Boolean(id)

  const [form, setForm] = useState({
    data_registro: new Date().toISOString().slice(0, 10),
    inicio: '',
    fim: '',
    tipo: 'extra',
    observacao: '',
  })
  const [calculo, setCalculo] = useState(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (editando) carregarRegistro()
  }, [id])

  async function carregarRegistro() {
    try {
      const usuario = JSON.parse(localStorage.getItem('usuario') || '{}')
      const { data } = await api.get('/painel')
      const reg = data.registros.find((r) => r.id === id)
      if (reg) {
        setForm({
          data_registro: reg.data_registro.slice(0, 10),
          inicio: reg.inicio.slice(0, 5),
          fim: reg.fim.slice(0, 5),
          tipo: reg.tipo,
          observacao: reg.observacao || '',
        })
      }
    } catch {
      setErro('Erro ao carregar registro')
    }
  }

  function atualizar(campo, valor) {
    const novo = { ...form, [campo]: valor }
    setForm(novo)
    if (novo.inicio && novo.fim) {
      const [h1, m1] = novo.inicio.split(':').map(Number)
      const [h2, m2] = novo.fim.split(':').map(Number)
      if (!isNaN(h1) && !isNaN(m1) && !isNaN(h2) && !isNaN(m2)) {
        previewCalculo(novo.inicio, novo.fim)
      }
    }
  }

  function previewCalculo(inicio, fim) {
    let i = inicio.split(':').reduce((h, m) => h * 60 + +m, 0)
    let f = fim.split(':').reduce((h, m) => h * 60 + +m, 0)
    if (f <= i) f += 1440
    const totalMin = f - i
    const totalCom50 = totalMin * 1.5
    const noturno = Math.max(0, Math.min(300, f) - Math.max(0, i))
                  + Math.max(0, Math.min(1740, f) - Math.max(1320, i))
    const totalFinal = totalCom50 + noturno * 1.5 * 0.2
    setCalculo({
      minutosTotais: totalMin,
      minutosNoturnos: noturno,
      horasCalculadas: +(totalFinal / 60).toFixed(2),
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    try {
      if (editando) {
        await api.put(`/registros/${id}`, form)
      } else {
        await api.post('/registros', form)
      }
      navigate('/painel')
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao salvar')
    }
  }

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">{editando ? 'Editar' : 'Novo'} Registro</h1>
      {erro && <p className="text-red-500 text-sm mb-4">{erro}</p>}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Data</label>
          <input type="date" className="w-full border rounded px-3 py-2" value={form.data_registro}
            onChange={(e) => atualizar('data_registro', e.target.value)} required />
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Início</label>
            <input type="time" className="w-full border rounded px-3 py-2" value={form.inicio}
              onChange={(e) => atualizar('inicio', e.target.value)} required />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Fim</label>
            <input type="time" className="w-full border rounded px-3 py-2" value={form.fim}
              onChange={(e) => atualizar('fim', e.target.value)} required />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Tipo</label>
          <select className="w-full border rounded px-3 py-2" value={form.tipo}
            onChange={(e) => atualizar('tipo', e.target.value)}>
            <option value="extra">Hora Extra</option>
            <option value="compensacao">Compensação</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Observação</label>
          <textarea className="w-full border rounded px-3 py-2" rows={2} value={form.observacao}
            onChange={(e) => atualizar('observacao', e.target.value)} />
        </div>
        {calculo && (
          <div className="bg-gray-50 p-3 rounded text-sm space-y-1">
            <p>Tempo total: <strong>{calculo.minutosTotais} min</strong> ({+(calculo.minutosTotais / 60).toFixed(2)}h)</p>
            <p>Período noturno: <strong>{calculo.minutosNoturnos} min</strong></p>
            <p className="text-lg font-bold text-blue-700">Horas calculadas: {calculo.horasCalculadas}h</p>
          </div>
        )}
        <div className="flex gap-2">
          <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
            {editando ? 'Atualizar' : 'Salvar'}
          </button>
          <button type="button" onClick={() => navigate('/painel')}
            className="px-4 py-2 border rounded hover:bg-gray-50">Cancelar</button>
        </div>
      </form>
    </div>
  )
}
