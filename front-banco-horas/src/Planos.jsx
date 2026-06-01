import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from './api'

export default function Planos() {
  const [loading, setLoading] = useState(null)
  const [erro, setErro] = useState('')
  const navigate = useNavigate()

  async function handleCheckout(tipo) {
    setLoading(tipo)
    setErro('')
    try {
      const rota = tipo === 'vitalicio' ? '/checkout-vitalicio' : '/checkout'
      const { data } = await api.post(rota)
      window.location.href = data.url
    } catch (err) {
      const msg = err.response?.data?.erro || 'Erro ao gerar link de pagamento'
      setErro(msg)
      setLoading(null)
    }
  }

  const planos = [
    {
      id: 'mensal',
      nome: 'Mensal',
      preco: 'R$ 49',
      centavos: ',90',
      periodo: '/mês',
      destaque: false,
      beneficios: ['Acesso total ao painel', 'Cálculo automático de horas', 'Adicional noturno incluso', 'Registros ilimitados', 'Suporte prioritário'],
    },
    {
      id: 'vitalicio',
      nome: 'Vitalício',
      preco: 'R$ 150',
      centavos: ',00',
      periodo: 'único',
      destaque: true,
      beneficios: ['Tudo do plano Mensal', 'Sem mensalidades', 'Acesso vitalício', 'Preço promocional'],
    },
  ]

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <button
          onClick={() => navigate('/painel')}
          className="text-zinc-400 hover:text-zinc-100 transition mb-6 inline-block"
        >
          ← Voltar
        </button>

        <h1 className="text-2xl font-bold text-zinc-100 mb-2">Banco de Horas</h1>
        <p className="text-zinc-400 text-sm mb-8">Escolha o plano ideal para você</p>

        {erro && <p className="text-red-400 text-sm mb-4 bg-red-500/10 rounded-xl p-3">{erro}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {planos.map((plano) => (
            <div
              key={plano.id}
              className={`relative bg-white/10 backdrop-blur-md border shadow-xl rounded-2xl p-8 text-center ${
                plano.destaque ? 'border-emerald-400/50 ring-2 ring-emerald-400/20' : 'border-white/20'
              }`}
            >
              {plano.destaque && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-zinc-900 text-xs font-bold px-4 py-1 rounded-full">
                  MAIS VANTAGEM
                </span>
              )}
              <h2 className="text-xl font-bold text-zinc-100 mb-4">{plano.nome}</h2>
              <div className="mb-4">
                <span className="text-5xl font-bold text-zinc-100">{plano.preco}</span>
                <span className="text-zinc-400 text-lg">{plano.centavos}</span>
                <span className="text-zinc-500 text-sm block">{plano.periodo}</span>
              </div>
              <ul className="text-left text-zinc-300 space-y-3 mb-8">
                {plano.beneficios.map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="text-emerald-400 text-lg">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleCheckout(plano.id)}
                disabled={loading !== null}
                className={`w-full py-3 rounded-2xl font-medium transition disabled:opacity-50 ${
                  plano.destaque
                    ? 'bg-emerald-500 text-zinc-900 hover:bg-emerald-400'
                    : 'bg-zinc-100 text-zinc-900 hover:bg-white'
                }`}
              >
                {loading === plano.id ? 'Gerando link...' : 'Assinar Agora'}
              </button>
            </div>
          ))}
        </div>

        <p className="text-zinc-500 text-xs mt-6 text-center">
          Pagamento processado pelo Mercado Pago. Sua assinatura será ativada automaticamente.
        </p>
      </div>
    </div>
  )
}
