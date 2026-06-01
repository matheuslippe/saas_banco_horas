require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(helmet());

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(cors({ origin: frontendUrl, credentials: true }));

app.use(express.json());

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

app.get('/status', (req, res) => res.json({ status: 'ok' }));

app.post('/usuarios', async (req, res) => {
  try {
    const { nome, email, senha } = req.body;
    const hash = await bcrypt.hash(senha, 10);
    const { rows } = await pool.query(
      'INSERT INTO usuarios (nome, email, senha) VALUES ($1, $2, $3) RETURNING id, nome, email',
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
    const token = jwt.sign({ id: rows[0].id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, usuario: { id: rows[0].id, nome: rows[0].nome, email: rows[0].email } });
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

app.get('/painel/:usuario_id', verificarToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM registros WHERE usuario_id = $1 ORDER BY data_registro, inicio',
      [req.params.usuario_id]
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

async function initDatabase() {
  try {
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE TABLE IF NOT EXISTS usuarios (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        nome VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        senha VARCHAR(255) NOT NULL
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
    console.log('Tabelas criadas/verificadas com sucesso');
  } catch (err) {
    console.error('Erro ao criar tabelas:', err.message);
  }
}

initDatabase().then(() => {
  app.listen(process.env.PORT || 3000, () =>
    console.log(`API rodando na porta ${process.env.PORT || 3000}`)
  );
});
