require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
app.set('trust proxy', 1);
app.use(helmet());

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(cors({ origin: frontendUrl, credentials: true }));

const { criarSessaoCheckout } = require('./src/services/stripe');
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        user: process.env.DB_USER || 'user',
        host: process.env.DB_HOST || 'db',
        database: process.env.DB_NAME || 'banco_horas',
        password: process.env.DB_PASSWORD || 'password',
        port: Number(process.env.DB_PORT) || 5432,
      }
);

let transporter = null;
if (process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function checarTrial(usuario) {
  if (usuario.plano === 'vitalicio') return usuario;
  if (usuario.status_assinatura === 'trial' && usuario.trial_vence_em) {
    if (new Date() > new Date(usuario.trial_vence_em)) {
      await pool.query('UPDATE usuarios SET status_assinatura = $1 WHERE id = $2', ['inativa', usuario.id]);
      usuario.status_assinatura = 'inativa';
    }
  }
  return usuario;
}

function verificarToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ erro: 'Token ausente' });
  const token = header.split(' ')[1];
  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ erro: 'Token invalido' });
  }
}

function calcularHorasComAdicionais(inicio, fim) {
  const [h1, m1] = inicio.split(':').map(Number);
  const [h2, m2] = fim.split(':').map(Number);
  let inicioMin = h1 * 60 + m1;
  let fimMin = h2 * 60 + m2;

  if (fimMin <= inicioMin) fimMin += 1440;

  const totalMin = fimMin - inicioMin;
  const totalCom50 = totalMin * 1.5;

  const noturnoMin = Math.max(0, Math.min(300, fimMin) - Math.max(0, inicioMin))
                   + Math.max(0, Math.min(1740, fimMin) - Math.max(1320, inicioMin));

  const totalFinal = totalCom50 + noturnoMin * 1.5 * 0.2;

  return {
    minutosTotais: totalMin,
    minutosNoturnos: noturnoMin,
    horasCalculadas: +(totalFinal / 60).toFixed(2),
  };
}

// ── Webhook (ANTES do express.json()) ──
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Erro na assinatura do webhook:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  res.status(200).json({ received: true });

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const usuarioId = session.metadata?.usuario_id;
    const plano = session.metadata?.plano || 'mensal';
    const subscriptionId = session.subscription || session.id;

    if (!usuarioId) {
      console.error('Webhook sem usuario_id no metadata');
      return;
    }

    try {
      if (plano === 'vitalicio') {
        await pool.query(
          `UPDATE usuarios SET status_assinatura = 'ativa', plano = 'vitalicio', vitalicio_em = NOW(), stripe_subscription_id = $1
           WHERE id = $2 AND (plano IS NULL OR plano <> 'vitalicio')`,
          [subscriptionId, usuarioId]
        );
        console.log(`Checkout vitalicio ${session.id} finalizado para usuario ${usuarioId}`);
      } else {
        await pool.query(
          'UPDATE usuarios SET status_assinatura = $1, stripe_subscription_id = $2 WHERE id = $3',
          ['ativa', String(subscriptionId), usuarioId]
        );
        console.log(`Assinatura ${subscriptionId} ativada para usuario ${usuarioId}`);
      }
    } catch (err) {
      console.error('Erro ao processar webhook:', err.message);
    }
  }
});

// ── Middlewares globais ──
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const limiterGeral = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { erro: 'Muitas requisicoes. Tente novamente em 15 minutos.' },
});

const limiterLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { erro: 'Muitas tentativas de login. Aguarde 15 minutos.' },
});

app.use(limiterGeral);
app.use('/login', limiterLogin);

// ── Rotas públicas ──
app.get('/status', (req, res) => res.json({ status: 'ok' }));

app.post('/usuarios', async (req, res) => {
  try {
    const { nome, email, senha } = req.body;

    const erros = [];
    if (!nome || nome.trim().length < 2 || nome.length > 100) erros.push('Nome deve ter entre 2 e 100 caracteres');
    else if (/<[^>]*>/.test(nome)) erros.push('Nome nao pode conter tags HTML');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) erros.push('Email invalido');
    if (!senha || senha.length < 6) erros.push('Senha deve ter no minimo 6 caracteres');
    if (erros.length) return res.status(400).json({ erro: erros.join('. ') });

    const hash = await bcrypt.hash(senha, 10);
    const { rows } = await pool.query(
      `INSERT INTO usuarios (nome, email, senha, trial_vence_em)
       VALUES ($1, $2, $3, NOW() + INTERVAL '7 days')
       RETURNING id, nome, email, status_assinatura, trial_vence_em`,
      [nome, email, hash]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Erro em POST /usuarios:', err.message);
    res.status(400).json({ erro: err.message });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    const { rows } = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    if (!rows.length) return res.status(401).json({ erro: 'Credenciais invalidas' });
    const ok = await bcrypt.compare(senha, rows[0].senha);
    if (!ok) return res.status(401).json({ erro: 'Credenciais invalidas' });
    const usuario = await checarTrial(rows[0]);
    const token = jwt.sign({ id: usuario.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        status_assinatura: usuario.status_assinatura,
      },
    });
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
});

app.post('/esqueci-senha', async (req, res) => {
  try {
    const { email } = req.body;
    const { rows } = await pool.query('SELECT id, nome FROM usuarios WHERE email = $1', [email]);
    if (rows.length) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 3600000);
      await pool.query(
        'UPDATE usuarios SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
        [token, expires, rows[0].id]
      );
      const link = `${process.env.BACK_URL || frontendUrl}/resetar-senha/${token}`;
      if (transporter) {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || 'noreply@bancodehoras.com',
          to: email,
          subject: 'Recuperacao de senha',
          text: `Ola ${rows[0].nome},\n\nClique no link para redefinir sua senha:\n${link}\n\nLink valido por 1 hora.`,
        });
      } else {
        console.log(`[DEV] Link de reset para ${email}: ${link}`);
      }
    }
    res.json({ mensagem: 'Se o email existir, voce recebera um link de recuperacao.' });
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
});

app.post('/resetar-senha', async (req, res) => {
  try {
    const { token, senha } = req.body;
    if (!token) return res.status(400).json({ erro: 'Token ausente' });
    if (!senha || senha.length < 6) return res.status(400).json({ erro: 'Senha deve ter no minimo 6 caracteres' });
    const { rows } = await pool.query(
      'SELECT id FROM usuarios WHERE reset_token = $1 AND reset_token_expires > NOW()',
      [token]
    );
    if (!rows.length) return res.status(400).json({ erro: 'Token invalido ou expirado' });
    const hash = await bcrypt.hash(senha, 10);
    await pool.query(
      'UPDATE usuarios SET senha = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [hash, rows[0].id]
    );
    res.json({ mensagem: 'Senha redefinida com sucesso' });
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
});

// ── Rotas protegidas ──
app.get('/me', verificarToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, nome, email, stripe_subscription_id, status_assinatura, trial_vence_em, plano, vitalicio_em FROM usuarios WHERE id = $1',
      [req.usuario.id]
    );
    if (!rows.length) return res.status(404).json({ erro: 'Usuario nao encontrado' });
    const usuario = await checarTrial(rows[0]);
    res.json(usuario);
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
});

app.post('/registros', verificarToken, async (req, res) => {
  try {
    const { data_registro, inicio, fim, tipo, observacao } = req.body;
    const calc = calcularHorasComAdicionais(inicio, fim);
    const { rows } = await pool.query(
      `INSERT INTO registros (usuario_id, tipo, data_registro, inicio, fim, observacao, horas_calculadas)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.usuario.id, tipo || 'extra', data_registro, inicio, fim, observacao, calc.horasCalculadas]
    );
    res.status(201).json({ registro: rows[0], calculo: calc });
  } catch (err) {
    console.error('Erro em POST /registros:', err.message);
    res.status(400).json({ erro: err.message });
  }
});

app.put('/registros/:id', verificarToken, async (req, res) => {
  try {
    const { data_registro, inicio, fim, tipo, observacao } = req.body;
    const calc = calcularHorasComAdicionais(inicio, fim);
    const { rows } = await pool.query(
      `UPDATE registros
       SET tipo = $1, data_registro = $2, inicio = $3, fim = $4, observacao = $5, horas_calculadas = $6
       WHERE id = $7 AND usuario_id = $8 RETURNING *`,
      [tipo || 'extra', data_registro, inicio, fim, observacao, calc.horasCalculadas, req.params.id, req.usuario.id]
    );
    if (!rows.length) return res.status(404).json({ erro: 'Registro nao encontrado' });
    res.json({ registro: rows[0], calculo: calc });
  } catch (err) {
    console.error('Erro em PUT /registros:', err.message);
    res.status(400).json({ erro: err.message });
  }
});

app.delete('/registros/:id', verificarToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM registros WHERE id = $1 AND usuario_id = $2 RETURNING *',
      [req.params.id, req.usuario.id]
    );
    if (!rows.length) return res.status(404).json({ erro: 'Registro nao encontrado' });
    res.json({ mensagem: 'Registro excluido' });
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
});

app.get('/painel', verificarToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM registros WHERE usuario_id = $1 ORDER BY data_registro, inicio',
      [req.usuario.id]
    );
    let saldo = 0;
    for (const r of rows) {
      const h = Number(r.horas_calculadas);
      if (r.tipo === 'extra') saldo += h;
      else if (r.tipo === 'compensacao') saldo -= h;
    }
    res.json({ registros: rows, saldo: +saldo.toFixed(2) });
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
});

app.post('/checkout', verificarToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, email FROM usuarios WHERE id = $1', [req.usuario.id]);
    if (!rows.length) return res.status(404).json({ erro: 'Usuario nao encontrado' });
    const backUrl = process.env.BACK_URL
      || (req.headers.origin)
      || (req.headers.referer ? new URL(req.headers.referer).origin : null)
      || process.env.FRONTEND_URL
      || 'http://localhost:5173';
    const sessao = await criarSessaoCheckout(rows[0].email, backUrl, rows[0].id, false);
    await pool.query(
      'UPDATE usuarios SET stripe_subscription_id = $1 WHERE id = $2',
      [sessao.id, req.usuario.id]
    );
    res.json({ url: sessao.url, id: sessao.id });
  } catch (err) {
    console.error('Erro em POST /checkout:', err.message);
    res.status(400).json({ erro: 'Erro ao gerar checkout. Tente novamente.' });
  }
});

app.post('/checkout-vitalicio', verificarToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, email FROM usuarios WHERE id = $1', [req.usuario.id]);
    if (!rows.length) return res.status(404).json({ erro: 'Usuario nao encontrado' });
    const backUrl = process.env.BACK_URL
      || (req.headers.origin)
      || (req.headers.referer ? new URL(req.headers.referer).origin : null)
      || process.env.FRONTEND_URL
      || 'http://localhost:5173';
    const sessao = await criarSessaoCheckout(rows[0].email, backUrl, rows[0].id, true);
    await pool.query(
      'UPDATE usuarios SET stripe_subscription_id = $1 WHERE id = $2',
      [sessao.id, req.usuario.id]
    );
    res.json({ url: sessao.url, id: sessao.id });
  } catch (err) {
    console.error('Erro em POST /checkout-vitalicio:', err.message);
    res.status(400).json({ erro: 'Erro ao gerar checkout. Tente novamente.' });
  }
});

// ── Inicialização do banco ──
async function aguardarBanco(tentativas = 10, intervalo = 2000) {
  for (let i = 1; i <= tentativas; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('Banco conectado');
      return;
    } catch (err) {
      console.log(`Aguardando banco (${i}/${tentativas})...`);
      if (i === tentativas) throw err;
      await new Promise((r) => setTimeout(r, intervalo));
    }
  }
}

async function initDatabase() {
  await aguardarBanco();
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE TABLE IF NOT EXISTS usuarios (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      nome VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      senha VARCHAR(255) NOT NULL,
      stripe_subscription_id VARCHAR(255),
      status_assinatura VARCHAR(50) DEFAULT 'trial',
      trial_vence_em TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS registros (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      usuario_id UUID NOT NULL REFERENCES usuarios(id),
      tipo VARCHAR(50) NOT NULL DEFAULT 'extra',
      data_registro DATE NOT NULL,
      inicio TIME NOT NULL,
      fim TIME NOT NULL,
      observacao TEXT,
      horas_calculadas DECIMAL(10,2) NOT NULL
    );
  `);
  await pool.query(`
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS status_assinatura VARCHAR(50) DEFAULT 'trial';
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS trial_vence_em TIMESTAMP;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS plano VARCHAR(50) DEFAULT 'mensal';
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS vitalicio_em TIMESTAMP;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP;
  `);
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usuarios' AND column_name='mp_assinatura_id') THEN
        UPDATE usuarios SET stripe_subscription_id = mp_assinatura_id WHERE mp_assinatura_id IS NOT NULL;
        ALTER TABLE usuarios DROP COLUMN mp_assinatura_id;
      END IF;
    END $$;
  `);
  await pool.query(`
    UPDATE usuarios
    SET status_assinatura = 'trial', trial_vence_em = NOW() + INTERVAL '7 days'
    WHERE status_assinatura = 'inativa' AND stripe_subscription_id IS NULL;
    UPDATE usuarios
    SET trial_vence_em = NOW() + INTERVAL '7 days'
    WHERE trial_vence_em IS NULL AND status_assinatura = 'trial';
    UPDATE usuarios
    SET status_assinatura = 'trial'
    WHERE status_assinatura = 'inativa' AND trial_vence_em IS NOT NULL AND trial_vence_em > NOW();
  `);
  console.log('Tabelas criadas/verificadas com sucesso');
}

initDatabase().then(() => {
  app.listen(process.env.PORT || 3000, () =>
    console.log(`API rodando na porta ${process.env.PORT || 3000}`)
  );
}).catch((err) => {
  console.error('Falha ao inicializar:', err.message);
  process.exit(1);
});