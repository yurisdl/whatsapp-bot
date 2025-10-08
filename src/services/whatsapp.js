const config = require('../config/env');

const sendProductsWithImages = async (sock, recipientJid, products) => {
    const baseURL = config.server.baseURL;

    for (let i = 0; i < products.length; i++) {
        const product = products[i];
        const imageUrl = product.fields.ImageURL || `${baseURL}/assets/images/default.jpg`;
        const price = parseFloat(product.fields.Price).toFixed(2);
        const title = product.fields.Title;
        const color = product.fields.Color ? ` (${product.fields.Color})` : '';
        const caption = `${i + 1}. ${title}${color} - R$ ${price}`;

        try {
            if (product.fields.ImageURL) {
                await sock.sendMessage(recipientJid, {
                    image: { url: imageUrl },
                    caption: caption
                });
            } else {
                await sock.sendMessage(recipientJid, {
                    text: caption
                });
            }

            if (i < products.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        } catch (error) {
            try {
                await sock.sendMessage(recipientJid, {
                    text: caption
                });
            } catch (textError) {
                console.log(textError);
            }
        }
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    await sock.sendMessage(recipientJid, {
        text: 'Qual você gostaria de comprar? Digite o *número* ou o *nome* do produto.\n\nExemplo: "1" ou "quero o primeiro"'
    });
};

const sendTextMessage = async (sock, recipientJid, text) => {
    if (text && text.trim() !== '') {
        await sock.sendMessage(recipientJid, { text });
    }
};

module.exports = {
    sendProductsWithImages,
    sendTextMessage
};
