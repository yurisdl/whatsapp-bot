const express = require('express');
const router = express.Router();
const db = require('../database/mysql');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const config = require('../config/env');

const client = new MercadoPagoConfig({
    accessToken: config.mercadopago.accessToken
});

let whatsappSock = null;

const setWhatsappSocket = (sock) => {
    whatsappSock = sock;
};

const checkoutHandlers = {
    getCheckoutInformation: async (userId) => {
        const user = await db.getUserByPhone(userId.replace(/[^\d]/g, ''));

        if (!user) {
            return { success: false, error: 'Usuário não encontrado' };
        }

        const cartResult = await db.getCart(user);

        if (!cartResult.success || cartResult.cartItems.length === 0) {
            return { success: false, error: 'Carrinho vazio' };
        }

        const products = await db.getProducts();
        const cartItems = cartResult.cartItems.map(item => {
            const product = products.find(p => p.id === item.productId);
            return {
                product: product.fields,
                quantity: item.quantity
            };
        });

        return {
            success: true,
            cartItems,
            name: user.fields.Name || '',
            address: user.fields.Address || ''
        };
    },

    createPreference: async (userId, amount) => {
        const preference = new Preference(client);

        const preferenceData = {
            items: [{
                title: 'Pedido - Loja Online',
                unit_price: parseFloat(amount),
                quantity: 1,
            }],
            back_urls: {
                success: `${config.server.baseURL}/payment-success.html`,
                failure: `${config.server.baseURL}/payment-failure.html`,
                pending: `${config.server.baseURL}/payment-pending.html`
            },
            auto_return: 'approved',
            notification_url: `${config.server.baseURL}/webhook/mercadopago`,
            external_reference: userId
        };

        const response = await preference.create({ body: preferenceData });

        return {
            success: true,
            preferenceId: response.id,
            publicKey: config.mercadopago.publicKey
        };
    },

    updateCustomerInfo: async (userId, name, address) => {
        const user = await db.getUserByPhone(userId.replace(/[^\d]/g, ''));

        if (!user) {
            return { success: false, error: 'Usuário não encontrado' };
        }

        const updateFields = {};
        if (name !== undefined) updateFields.Name = name;
        if (address !== undefined) updateFields.Address = address;

        await db.updateUser(user.id, updateFields);

        return { success: true };
    }
};

router.post('/checkout', async (req, res) => {
    try {
        const { action, userId, amount, name, address } = req.body;

        const handler = checkoutHandlers[action];

        if (!handler) {
            return res.json({ success: false, error: 'Ação inválida' });
        }

        // Passa os parâmetros de acordo com cada ação
        let result;
        if (action === 'updateCustomerInfo') {
            result = await handler(userId, name, address);
        } else if (action === 'createPreference') {
            result = await handler(userId, amount);
        } else {
            result = await handler(userId);
        }

        return res.json(result);
    } catch (error) {
        console.error('Erro no checkout:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

const sendWhatsAppConfirmation = async (user, paymentInfo, orderResult) => {
    if (!whatsappSock) return;

    const phoneNumber = user.fields.PhoneNumber;
    const recipientJid = `${phoneNumber}@s.whatsapp.net`;
    const orderID = orderResult.order.id;

    const cartItems = JSON.parse(user.fields.Cart || orderResult.order.fields.Items);
    const products = await db.getProducts();
    let itemsList = '';

    for (const item of cartItems) {
        const product = products.find(p => p.id === item.productId);
        if (product) {
            const itemTotal = parseFloat(product.fields.Price) * item.quantity;
            itemsList += `\n• ${item.quantity}x ${product.fields.Title} - R$ ${itemTotal.toFixed(2)}`;
        }
    }

    const message = `🎉 *Pagamento Aprovado!*\n\nSeu pagamento foi confirmado com sucesso!\n\n📋 *Dados do Pedido:*\n✅ Pedido: #${orderID}\n👤 Nome: ${user.fields.Name || 'Não informado'}\n📍 Endereço: ${user.fields.Address || 'Não informado'}\n\n🛒 *Itens:*${itemsList}\n\n💰 *Total: R$ ${paymentInfo.transaction_amount.toFixed(2)}*\n\nObrigado pela sua compra! Em breve você receberá mais informações sobre a entrega.`;

    await whatsappSock.sendMessage(recipientJid, { text: message });
};

router.post('/webhook/mercadopago', async (req, res) => {
    try {
        const { type, data } = req.body;
        res.status(200).send('OK');

        if (type === 'payment') {
            const paymentClient = new Payment(client);
            const paymentInfo = await paymentClient.get({ id: data.id });

            if (paymentInfo.status === 'approved') {
                const userId = paymentInfo.external_reference;
                const phoneNumber = userId.replace(/[^\d]/g, '');

                const user = await db.getUserByPhone(phoneNumber);
                if (!user) return;

                const orderResult = await db.createOrUpdateOrder(user, paymentInfo);

                if (orderResult.success) {
                    await sendWhatsAppConfirmation(user, paymentInfo, orderResult);
                }
            }
        }
    } catch (error) {
        console.error('Erro no webhook:', error);
    }
});

module.exports = router;
module.exports.setWhatsappSocket = setWhatsappSocket;
