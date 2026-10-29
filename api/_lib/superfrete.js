const https = require('https');

const SF_BASE = process.env.SUPERFRETE_SANDBOX === 'true'
  ? 'sandbox.superfrete.com'
  : 'api.superfrete.com';

// TODO: trocar pelo CEP de origem real da UseMacedo (8 dígitos, sem traço)
const CEP_ORIGEM = '00000000';

// Perfis de pacote por quantidade de peças (roupas dobradas em caixa)
function perfilPacote(totalItens) {
  if (totalItens <= 1) return {weight: 0.4, height: 5,  width: 20, length: 25};
  if (totalItens <= 3) return {weight: 0.8, height: 8,  width: 25, length: 30};
  return               {weight: 1.4, height: 12, width: 30, length: 35};
}

function sfRequest(path, body) {
  return new Promise((resolve, reject) => {
    const token = process.env.SUPERFRETE_TOKEN;
    if (!token) return reject(new Error('SUPERFRETE_TOKEN não configurado.'));
    const data = JSON.stringify(body);
    const options = {
      hostname: SF_BASE,
      path,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'UseMacedo (cthiago630@gmail.com)',
        'Content-Length': Buffer.byteLength(data),
        'Accept': 'application/json',
      },
    };
    const req = https.request(options, res => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(raw);
          if (res.statusCode >= 400) {
            const err = new Error(json.message || `Super Frete erro ${res.statusCode}`);
            err.status = res.statusCode;
            return reject(err);
          }
          resolve(json);
        } catch { reject(new Error('Resposta inválida do Super Frete.')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Super Frete timeout.')); });
    req.write(data);
    req.end();
  });
}

// Serviços: 1=PAC, 2=SEDEX, 3=Jadlog
const SERVICOS = '1,2,3';

async function cotarFrete(cepDestino, totalItens, valorDeclarado) {
  const pkg = perfilPacote(totalItens);
  const body = {
    from: {postal_code: CEP_ORIGEM},
    to:   {postal_code: String(cepDestino).replace(/\D/g, '')},
    services: SERVICOS,
    options: {
      own_hand: false,
      receipt: false,
      insurance_value: valorDeclarado > 0 ? valorDeclarado : 0,
      use_insurance_value: valorDeclarado > 0,
    },
    products: [{
      quantity: 1,
      height:   pkg.height,
      width:    pkg.width,
      length:   pkg.length,
      weight:   pkg.weight,
    }],
  };
  const resultado = await sfRequest('/api/v0/calculator', body);
  if (!Array.isArray(resultado)) throw new Error('Resposta inesperada da cotação.');
  return resultado
    .filter(op => !op.error && op.price)
    .map(op => ({
      id:      op.id,
      nome:    op.name,
      empresa: op.company?.name || '',
      preco:   Number(op.price),
      prazo:   op.delivery_time,
    }))
    .sort((a, b) => a.preco - b.preco);
}

module.exports = {cotarFrete, perfilPacote, CEP_ORIGEM};
