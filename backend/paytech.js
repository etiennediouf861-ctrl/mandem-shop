async function initPayTechPayment(payload) {
  const endpoint = process.env.PAYTECH_INIT_ENDPOINT;
  const apiKey = process.env.PAYTECH_API_KEY;
  const secret = process.env.PAYTECH_API_SECRET;

  if (!endpoint || !apiKey || !secret) {
    throw new Error('Configuration PayTech manquante');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'API_KEY': apiKey,
      'API_SECRET': secret
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || 'Erreur PayTech');
  }

  const data = await response.json();
  const redirectUrl = data.redirect_url || data.payment_url || data.url;
  if (!redirectUrl) throw new Error('PayTech: URL de redirection absente');

  return {
    redirectUrl,
    token: data.token || data.pay_token || '',
    ref: data.ref_command || data.ref || ''
  };
}

module.exports = { initPayTechPayment };
