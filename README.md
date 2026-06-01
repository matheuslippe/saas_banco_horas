# SaaS Banco de Horas

Sistema de gestão de banco de horas com assinatura mensal ou plano vitalício, desenvolvido com Node.js/Express, PostgreSQL, React + Vite + Tailwind, Docker e Stripe.

## Funcionalidades

### Autenticação e Usuários
- Cadastro com nome, email e senha (validação de entrada com anti-XSS)
- Login com JWT (token com expiração de 7 dias)
- Recuperação de senha via email (token criptográfico com validade de 1h)
- Rate limiting: 5 tentativas de login por 15 minutos

### Planos e Pagamentos (Stripe)
- **Plano Mensal** — R$ 49,90/mês (assinatura recorrente)
- **Plano Vitalício** — R$ 150,00 (pagamento único)
- Trial gratuito de 7 dias ao cadastrar
- Upgrade para vitalício disponível na página de perfil
- Webhook Stripe com verificação de assinatura (raw body)

### Controle de Horas
- Registro de horas extras e compensações
- Cálculo automático: 50% de bônus sobre total + 20% adicional noturno (22h-05h)
- Saldo atualizado em tempo real no painel
- CRUD completo de registros

### Segurança
- Helmet (headers de segurança)
- CORS restrito ao frontend
- Rate limiting global (100 requisições/15min)
- Validação de entrada em todas as rotas
- Sanitização de erros (não vaza detalhes internos)
- Respostas idênticas no "esqueci senha" (previne user enumeration)
- Senhas hasheadas com bcryptjs
- JWT com segredo via variável de ambiente
- Credenciais de banco fortes e únicas

### Infraestrutura
- Backend em Docker (Node.js 18)
- PostgreSQL 15 em Docker com volume persistente
- Backup diário automático com retenção de 7 dias
- Proxy reverso do Vite para API (/api → localhost:8080)
- Ngrok para webhook Stripe em ambiente local

## Pré-requisitos

- Node.js 18+
- Docker e Docker Compose
- Stripe CLI (para testar webhooks localmente)
- Ngrok (para expor webhook)

## Como rodar

```bash
# 1. Clone o repositório
git clone https://github.com/matheuslippe/saas_banco_horas.git

# 2. Configure as variáveis de ambiente
cp .env.example .env
# Edite .env com suas chaves do Stripe e JWT_SECRET

# 3. Suba os containers (banco + api + backup)
docker compose up -d --build

# 4. Instale as dependências do frontend e rode
cd front-banco-horas
npm install
npm run dev
```

Acesse: **http://localhost:5173**

## Estrutura do Projeto

```
saas_banco_horas/
├── backend/                  # API Node.js/Express
│   ├── index.js              # Rotas, middlewares, lógica de negócio
│   └── src/services/
│       └── stripe.js         # Integração Stripe (checkout sessions)
├── front-banco-horas/        # Frontend React + Vite + Tailwind
│   └── src/
│       ├── Login.jsx
│       ├── Register.jsx
│       ├── Painel.jsx        # Painel principal com saldo e registros
│       ├── Perfil.jsx        # Status da licença, trial, upgrade vitalício
│       ├── Planos.jsx        # Grade de planos (Mensal / Vitalício)
│       ├── EsqueciSenha.jsx  # Formulário de recuperação de senha
│       ├── ResetarSenha.jsx  # Redefinição de senha com token
│       ├── RegistroForm.jsx  # Cadastro/edição de registros
│       ├── api.js            # Axios com interceptor JWT
│       └── components/
│           └── PrivateRoute.jsx  # Rota protegida
├── backup/                   # Serviço de backup diário
│   ├── Dockerfile
│   └── backup.sh             # pg_dump + limpeza (retenção 7 dias)
├── back-ups/                 # Dumps gerados (gitignorado)
├── init.sql                  # Schema inicial do banco
├── docker-compose.yml        # Orquestração dos containers
├── test_security.ps1         # Testes automatizados de segurança
└── .env                      # Chaves Stripe, JWT (não versionado)
```

## API Endpoints

| Método | Rota | Autenticação | Descrição |
|--------|------|-------------|----------|
| GET | `/status` | — | Health check |
| POST | `/usuarios` | — | Cadastro (com trial de 7 dias) |
| POST | `/login` | — | Login (rate limit: 5/15min) |
| POST | `/esqueci-senha` | — | Solicitar link de recuperação |
| POST | `/resetar-senha` | — | Redefinir senha com token |
| GET | `/me` | JWT | Dados do usuário logado |
| GET | `/painel` | JWT | Registros e saldo |
| POST | `/registros` | JWT | Criar registro |
| PUT | `/registros/:id` | JWT | Atualizar registro |
| DELETE | `/registros/:id` | JWT | Excluir registro |
| POST | `/checkout` | JWT | Checkout Stripe (mensal) |
| POST | `/checkout-vitalicio` | JWT | Checkout Stripe (vitalício) |
| POST | `/webhook` | Assinatura Stripe | Webhook de confirmação |

## Testes de Segurança

Inclui script PowerShell (`test_security.ps1`) que cobre:
- Rate limiting (login)
- SQL Injection
- Campos obrigatórios ausentes
- XSS em cadastro
- Token inválido/expirado no reset de senha
- Senha fraca
- User enumeration
- JSON malformado
- Método HTTP não permitido

```powershell
.\test_security.ps1
```

## Webhook Stripe (desenvolvimento local)

```bash
# Terminal 1: Ngrok
ngrok http 8080

# Terminal 2: Stripe CLI
stripe listen --forward-to https://SEU_NGROK.ngrok-free.dev/webhook

# Em outro terminal, teste:
stripe trigger checkout.session.completed
```

Copie o `whsec_...` gerado pelo `stripe listen` para o `STRIPE_WEBHOOK_SECRET` no `.env`.

## Licença

MIT
