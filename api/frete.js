const {cotarFrete} = require('./_lib/superfrete');

// Tabela fixa usada como fallback quando o SUPERFRETE_TOKEN ainda não
// está configurado, ou se a API do Super Frete falhar.
const FRETE_GRATIS_ACIMA = 399.00;
const FALLBACK_VALOR = 29.90;
const FALLBACK_PRAZO = 7;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({erro: 'Método não permitido.'});
  }

  const body = req.method === 'POST' ? (req.body || {}) : req.query;
  const cep = String(body.cep || '').replace(/\D/g, '');
  const totalItens = Number(body.totalItens) || 1;
  const subtotal = Number(body.subtotal) || 0;

  if (cep.length !== 8) {
    return res.status(400).json({erro: 'CEP inválido.'});
  }

  if (subtotal >= FRETE_GRATIS_ACIMA) {
    return res.status(200).json({opcoes: [{id: 0, nome: 'Frete Grátis', empresa: '', preco: 0, prazo: 0, gratis: true}]});
  }

  if (process.env.SUPERFRETE_TOKEN) {
    try {
      const opcoes = await cotarFrete(cep, totalItens, subtotal);
      if (opcoes.length) return res.status(200).json({opcoes});
    } catch (err) {
      console.error('[frete] Super Frete falhou, usando fallback:', err.message);
    }
  }

  // Fallback: valor fixo (sem SUPERFRETE_TOKEN configurado, ou API indisponível)
  return res.status(200).json({
    opcoes: [{id: 0, nome: 'Correios', empresa: '', preco: FALLBACK_VALOR, prazo: FALLBACK_PRAZO, gratis: false}],
  });
};
