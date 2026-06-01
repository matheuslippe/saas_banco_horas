import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from './api'

function calcularTempoRestante(dataAlvo) {
  if (!dataAlvo) return null
  const agora = new Date()
  const alvo = new Date(dataAlvo)
  const diff = alvo - agora
  if (diff <= 0) return 'Expirado'

  const dias = Math.floor(diff / (1000 * 60 * 60 * 24))
  const horas = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  if (dias > 0) return `${dias}d ${horas}h`
  const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  return `${horas}h ${minutos}m`
}

function formatarData(dataStr) {
  if (!dataStr) return '-'
  const d = new Date(dataStr)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function StatusBadge({ status, plano }) {
  const config = {
    trial: { cor: 'bg-amber-500/20 text-amber-300', texto: 'Trial' },
    ativa: { cor: 'bg-emerald-500/20 text-emerald-300', texto: plano === 'vitalicio' ? 'Vitalício' : 'Ativa' },
    inativa: { cor: 'bg-red-500/20 text-red-300', texto: 'Inativa' },
  }
  const c = config[status] || config.inativa
  return (
    <span className={`inline-block px-3 py-1 rounded-xl text-xs font-medium ${c.cor}`}>
      {c.texto}
    </span>
  )
}

export default function Perfil() {
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/me')
      .then(({ data }) => setDados(data))
      .catch(() => navigate('/login'))
      .finally(() => setLoading(false))
  }, [navigate])

  async function handleUpgradeVitalicio() {
    setUpgrading(true)
    try {
      const { data } = await api.post('/checkout-vitalicio')
      window.location.href = data.url
    } catch {
      alert('Erro ao gerar link de pagamento')
      setUpgrading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <p className="text-zinc-400">Carregando...</p>
      </div>
    )
  }

  const tempoRestante = dados ? calcularTempoRestante(dados.trial_vence_em) : null

  return (
    <div className="min-h-screen bg-zinc-900 p-6">
      <div className="max-w-lg mx-auto">
        <button
          onClick={() => navigate('/painel')}
          className="text-zinc-400 hover:text-zinc-100 transition mb-6 inline-block"
        >
          ← Voltar
        </button>

        <div className="bg-white/10 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl p-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold text-zinc-100">Meu Perfil</h1>
            <StatusBadge status={dados?.status_assinatura} plano={dados?.plano} />
          </div>

          <div className="space-y-6">
            <div>
              <label className="text-zinc-500 text-xs uppercase tracking-wide">Nome</label>
              <p className="text-zinc-100 text-lg font-medium">{dados?.nome}</p>
            </div>

            <div>
              <label className="text-zinc-500 text-xs uppercase tracking-wide">Email</label>
              <p className="text-zinc-100 text-lg font-medium">{dados?.email}</p>
            </div>

            <div className="border-t border-white/10 pt-6">
              <label className="text-zinc-500 text-xs uppercase tracking-wide">Plano</label>
              <p className="text-zinc-100 text-lg font-medium capitalize">
                {dados?.plano === 'vitalicio' ? 'Vitalício' : 'Mensal'}
              </p>
            </div>

            {dados?.plano === 'vitalicio' ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                <p className="text-emerald-300 font-medium">Acesso vitalício garantido</p>
                <p className="text-emerald-400/60 text-sm mt-1">Sem expiração</p>
              </div>
            ) : dados?.status_assinatura === 'trial' ? (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <p className="text-amber-300 font-medium">
                  Trial {tempoRestante && tempoRestante !== 'Expirado' ? `— ${tempoRestante} restantes` : 'expirado'}
                </p>
                <p className="text-amber-400/60 text-sm mt-1">
                  Vence em {formatarData(dados?.trial_vence_em)}
                </p>
                {tempoRestante === 'Expirado' && (
                  <button
                    onClick={() => navigate('/planos')}
                    className="mt-3 bg-amber-500 text-zinc-900 px-4 py-1.5 rounded-xl text-sm font-medium hover:bg-amber-400 transition"
                  >
                    Assinar agora
                  </button>
                )}
              </div>
            ) : dados?.status_assinatura === 'ativa' ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                <p className="text-emerald-300 font-medium">Assinatura ativa</p>
              </div>
            ) : (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <p className="text-red-300 font-medium">Assinatura inativa</p>
                <button
                  onClick={() => navigate('/planos')}
                  className="mt-3 bg-red-500 text-white px-4 py-1.5 rounded-xl text-sm font-medium hover:bg-red-400 transition"
                >
                  Ver planos
                </button>
              </div>
            )}
          </div>
        </div>

        {dados?.plano !== 'vitalicio' && (
          <div className="mt-6 bg-gradient-to-r from-emerald-900/40 to-emerald-800/20 backdrop-blur-md border border-emerald-500/30 shadow-xl rounded-2xl p-6 text-center">
            <h2 className="text-lg font-bold text-zinc-100 mb-1">Upgrade para Vitalício</h2>
            <p className="text-zinc-400 text-sm mb-4">Troque sua assinatura mensal por acesso vitalício de uma vez</p>
            <div className="text-3xl font-bold text-emerald-400 mb-4">R$ 150</div>
            <button
              onClick={handleUpgradeVitalicio}
              disabled={upgrading}
              className="w-full bg-emerald-500 text-zinc-900 py-3 rounded-2xl font-medium hover:bg-emerald-400 transition disabled:opacity-50"
            >
              {upgrading ? 'Gerando link...' : 'Comprar Vitalício'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}