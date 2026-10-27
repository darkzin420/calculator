const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MercadoPagoConfig, Payment } = require('mercadopago');

const app = express();
app.use(cors());
app.use(express.json());

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN || 'SEU_ACCESS_TOKEN_MERCADO_PAGO'
});

const pendingCalculations = new Map();

// Senha exigida apenas para o painel admin
const ADMIN_PASS = "mamacopeludo";
const TOKEN_SECRETO = "token_sessao_admin_autorizado_123";

// Middleware de verificação admin
function verificarAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || authHeader !== `Bearer ${TOKEN_SECRETO}`)
  {
    return res.status(401).json({ error: 'Não autorizado.' });
  }
  next();
}

// Rota de Login do Admin (Validando APENAS a senha)
app.post('/api/admin/login', (req, res) => {
  const { pass } = req.body;
  if (pass === ADMIN_PASS)
  {
    return res.json({ success: true, token: TOKEN_SECRETO });
  }
  res.status(401).json({ success: false, error: 'Senha incorreta.' });
});

// Rota para calcular e gerar o ID de pagamento (Pública)
app.post('/api/calcular', async (req, res) => {
  try
  {
    const { expressao, resultado } = req.body;
    if (!expressao || resultado === undefined)
    {
      return res.status(400).json({ error: 'Expressão inválida.' });
    }

    const paymentId = 'pix_' + Date.now();
    pendingCalculations.set(paymentId, {
      id: paymentId,
      expressao,
      resultado,
      status: 'pending',
      criadoEm: new Date().toLocaleTimeString()
    });

    res.json({
      paymentId,
      qrCode: "00020126580014br.gov.bcb.pix... Chave: 32991261878 (Valor: R$ 5,00)",
      message: 'PIX gerado com sucesso.'
    });
  } catch (error)
  {
    res.status(500).json({ error: 'Erro ao gerar PIX.' });
  }
});

// Rota para verificar o status do pagamento (Pública)
app.get('/api/verificar/:paymentId', async (req, res) => {
  const { paymentId } = req.params;
  const calcData = pendingCalculations.get(paymentId);

  if (!calcData) return res.status(404).json({ error: 'Não encontrado.' });

  res.json({ status: calcData.status, resultado: calcData.resultado });
});

// Rota protegida para listar transações no painel
app.get('/api/admin/transacoes', verificarAdmin, (req, res) => {
  const transacoes = Array.from(pendingCalculations.values());
  res.json(transacoes);
});

// Rota protegida para aprovar o pagamento no painel
app.post('/api/simular-aprovar', verificarAdmin, (req, res) => {
  const { paymentId } = req.body;
  const calcData = pendingCalculations.get(paymentId);

  if (calcData)
  {
    calcData.status = 'approved';
    pendingCalculations.set(paymentId, calcData);
    return res.json({ success: true, resultado: calcData.resultado });
  }

  res.status(404).json({ error: 'Transação não encontrada' });
});

module.exports = app;