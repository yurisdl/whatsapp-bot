const nlpService = require('../services/nlp');
const db = require('../database/mysql');
const { handleIntent } = require('./intents');

const handleMessage = async (message, sender, sock, recipientJid) => {
    try {
        const result = await nlpService.processMessage(message);
        const { intent, entities } = result;

        console.log(`Intent detectado: ${intent}`);

        const user = await db.getUserByPhone(sender);

        const lowerMessage = message.toLowerCase();
        if (user && user.fields.State === 'showProducts' &&
            !['viewCart', 'removeFromCart', 'checkout'].includes(intent)) {
            const products = await db.getProducts();
            const hasProductMention = products.some(product => {
                const title = product.fields.Title.toLowerCase();
                return lowerMessage.includes(title) || title.split(' ').some(word =>
                    word.length > 3 && lowerMessage.includes(word)
                );
            });

            if (hasProductMention) {
                return await handleIntent('addToCart', { user, sender, entities, message });
            }
        }

        const response = await handleIntent(intent, {
            user,
            sender,
            sock,
            recipientJid,
            entities,
            message
        });

        return response;
    } catch (error) {
        console.error('Erro ao processar mensagem:', error);
        return 'Desculpe, ocorreu um erro. Tente novamente.';
    }
};

module.exports = { handleMessage };
