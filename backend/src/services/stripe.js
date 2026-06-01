const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function criarSessaoCheckout(email, backUrl, usuarioId, isVitalicio = false) {
  if (isVitalicio) {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'brl',
          product_data: { name: 'Plano Vitalício - SaaS Banco de Horas' },
          unit_amount: 15000,
        },
        quantity: 1,
      }],
      customer_email: email,
      metadata: { usuario_id: usuarioId, plano: 'vitalicio' },
      success_url: `${backUrl}/painel`,
      cancel_url: `${backUrl}/planos`,
    });
    return { url: session.url, id: session.id };
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'brl',
        product_data: { name: 'Plano Premium - SaaS Banco de Horas' },
        unit_amount: 4990,
        recurring: { interval: 'month' },
      },
      quantity: 1,
    }],
    customer_email: email,
    metadata: { usuario_id: usuarioId, plano: 'mensal' },
    success_url: `${backUrl}/painel`,
    cancel_url: `${backUrl}/planos`,
  });
  return { url: session.url, id: session.id, subscription_id: session.subscription };
}

module.exports = { criarSessaoCheckout };