const db = require('../database/mysql');
const { sendProductsWithImages } = require('../services/whatsapp');
const config = require('../config/env');

const intentHandlers = {
    greeting: async ({ user, sender }) => {
        if (!user) {
            user = await db.createUser(sender, 'greeting');
        } else {
            await db.updateUser(user.id, { State: 'greeting' });
        }
        return '👋 Olá! Eu sou o *Assistente Virtual da Loja*!\n\nSeja bem-vindo(a)! Gostaria de ver os produtos disponíveis em nossa loja?';
    },

    farewell: async ({ user }) => {
        if (user) await db.updateUser(user.id, { State: 'farewell' });
        return 'Até logo! Volte sempre! 👋';
    },

    agreeing: async ({ user, sender, sock, recipientJid }) => {
        if (!user) {
            return 'Por favor, envie "oi" primeiro para começarmos!';
        }

        if (user.fields.State === 'greeting') {
            const products = await db.getProducts();

            const productTitles = products.map(p => p.fields.Title);
            await db.updateUser(user.id, {
                State: 'showProducts',
                LastShownProducts: JSON.stringify(productTitles)
            });

            await sendProductsWithImages(sock, recipientJid, products);
            return '';
        } else if (user.fields.State === 'addToCart') {
            await db.updateUser(user.id, { State: 'checkout' });
            const checkoutUrl = `${config.server.baseURL}/index.html?userId=${user.fields.PhoneNumber}`;
            return `🛒 *Finalize sua compra clicando no link:*\n\n${checkoutUrl}`;
        }
        return '';
    },

    refusing: async ({ user }) => {
        if (!user) return '';

        if (user.fields.State === 'greeting') {
            return "Tudo bem! Quando quiser ver os produtos, envie a mensagem 'ver produtos' 😊";
        } else if (user.fields.State === 'addToCart') {
            return "Tudo bem! Quando quiser finalizar a compra, envie a palavra 'checkout' 🛒";
        }
        return '';
    },

    showProducts: async ({ user, sender, sock, recipientJid }) => {
        if (!user) {
            user = await db.createUser(sender, 'showProducts');
        } else {
            await db.updateUser(user.id, { State: 'showProducts' });
        }
        const products = await db.getProducts();

        const productTitles = products.map(p => p.fields.Title);
        await db.updateUser(user.id, { LastShownProducts: JSON.stringify(productTitles) });

        await sendProductsWithImages(sock, recipientJid, products);
        return '';
    },

    addToCart: async ({ user, sender, entities, message }) => {
        if (!user) {
            return 'Por favor, envie "oi" primeiro para começarmos!';
        }

        const products = await db.getProducts();
        const lowerMessage = message.toLowerCase().trim();

        let foundProduct = null;
        let bestMatch = 0;

        for (const product of products) {
            const title = product.fields.Title.toLowerCase();

            if (lowerMessage.includes(title)) {
                foundProduct = product;
                break;
            }

            const titleWords = title.split(' ').filter(word => word.length > 2);
            const matchedWords = titleWords.filter(word => lowerMessage.includes(word));
            const matchScore = matchedWords.length;

            if (matchScore === titleWords.length && matchScore > bestMatch) {
                foundProduct = product;
                bestMatch = matchScore;
            }
        }

        if (foundProduct) {
            const result = await db.addToCart(user, foundProduct.fields.Title);
            if (result.success) {
                await db.updateUser(user.id, { State: 'addToCart' });

                let cartMessage = '✅ Item adicionado ao carrinho!\n\n🛒 *Seu carrinho:*\n';
                let total = 0;

                result.cartItems.forEach(item => {
                    const price = parseFloat(item.price);
                    const itemTotal = price * item.quantity;
                    total += itemTotal;
                    cartMessage += `\n• ${item.title}\n  Quantidade: ${item.quantity}x\n  Preço: R$ ${price.toFixed(2)}\n  Subtotal: R$ ${itemTotal.toFixed(2)}\n`;
                });

                cartMessage += `\n*Total: R$ ${total.toFixed(2)}*\n\nGostaria de finalizar a compra?`;
                return cartMessage;
            } else {
                return '❌ Não encontrei esse produto. Tente novamente.';
            }
        }

        return 'Qual produto você gostaria de adicionar? Digite o nome ou o número do produto.';
    },

    viewCart: async ({ user }) => {
        if (!user) {
            return 'Por favor, envie "oi" primeiro para começarmos!';
        }

        const updatedUser = await db.getUserByPhone(user.fields.PhoneNumber);
        if (!updatedUser) {
            return 'Erro ao buscar seus dados. Tente novamente.';
        }

        const result = await db.getCart(updatedUser);

        if (!result.success || result.cartItems.length === 0) {
            return '🛒 Seu carrinho está vazio.\n\nEnvie "ver produtos" para começar a comprar!';
        }

        let cartMessage = '🛒 *Seu carrinho:*\n';
        let total = 0;

        result.cartItems.forEach(item => {
            const price = parseFloat(item.price);
            const itemTotal = price * item.quantity;
            total += itemTotal;
            cartMessage += `\n• ${item.title}\n  Quantidade: ${item.quantity}x\n  Preço: R$ ${price.toFixed(2)}\n  Subtotal: R$ ${itemTotal.toFixed(2)}\n`;
        });

        cartMessage += `\n*Total: R$ ${total.toFixed(2)}*\n\nPara remover um item, envie "remover [nome do produto]"`;
        return cartMessage;
    },

    removeFromCart: async ({ user, entities, message }) => {
        if (!user) {
            return 'Por favor, envie "oi" primeiro para começarmos!';
        }

        const updatedUser = await db.getUserByPhone(user.fields.PhoneNumber);
        if (!updatedUser) {
            return 'Erro ao buscar seus dados. Tente novamente.';
        }

        const products = await db.getProducts();
        const lowerMessage = message.toLowerCase();
        let foundProduct = null;
        let bestMatch = 0;

        for (const product of products) {
            const title = product.fields.Title.toLowerCase();

            if (lowerMessage.includes(title)) {
                foundProduct = product;
                break;
            }

            const titleWords = title.split(' ').filter(word => word.length > 2);
            const matchedWords = titleWords.filter(word => lowerMessage.includes(word));
            const matchScore = matchedWords.length;

            if (matchScore === titleWords.length && matchScore > bestMatch) {
                foundProduct = product;
                bestMatch = matchScore;
            }
        }

        if (foundProduct) {
            const result = await db.removeFromCart(updatedUser, foundProduct.id);

            if (!result.success) {
                return `❌ ${result.message}`;
            }

            if (result.cartItems.length === 0) {
                return '🗑️ Item removido! Seu carrinho está vazio agora.';
            }

            let cartMessage = '🗑️ Item removido!\n\n🛒 *Seu carrinho:*\n';
            let total = 0;

            result.cartItems.forEach(item => {
                const price = parseFloat(item.price);
                const itemTotal = price * item.quantity;
                total += itemTotal;
                cartMessage += `\n• ${item.title}\n  Quantidade: ${item.quantity}x\n  Preço: R$ ${price.toFixed(2)}\n  Subtotal: R$ ${itemTotal.toFixed(2)}\n`;
            });

            cartMessage += `\n*Total: R$ ${total.toFixed(2)}*`;
            return cartMessage;
        }

        return 'Qual produto você gostaria de remover? Envie "ver carrinho" para ver os itens.';
    },

    selectByNumber: async ({ user, sender, message }) => {
        if (!user) {
            return 'Por favor, envie "oi" primeiro para começarmos!';
        }

        const numberMap = {
            'primeiro': 0, '1': 0, 'um': 0,
            'segundo': 1, '2': 1, 'dois': 1,
            'terceiro': 2, '3': 2, 'três': 2, 'tres': 2,
            'quarto': 3, '4': 3, 'quatro': 3,
            'quinto': 4, '5': 4, 'cinco': 4,
            'sexto': 5, '6': 5, 'seis': 5,
            'sétimo': 6, 'setimo': 6, '7': 6, 'sete': 6,
            'oitavo': 7, '8': 7, 'oito': 7,
            'nono': 8, '9': 8, 'nove': 8,
            'décimo': 9, 'decimo': 9, '10': 9, 'dez': 9
        };

        const lowerMessage = message.toLowerCase().trim();
        let productIndex = -1;

        for (const [key, index] of Object.entries(numberMap)) {
            if (lowerMessage === key || lowerMessage.includes(` ${key} `) ||
                lowerMessage.includes(` ${key}`) || lowerMessage.startsWith(`${key} `)) {
                productIndex = index;
                break;
            }
        }

        if (productIndex === -1) {
            const match = lowerMessage.match(/\d+/);
            if (match) {
                productIndex = parseInt(match[0]) - 1;
            }
        }

        if (productIndex !== -1) {
            if (user.fields.LastShownProducts) {
                const lastShownProducts = JSON.parse(user.fields.LastShownProducts);
                if (productIndex < lastShownProducts.length) {
                    const productTitle = lastShownProducts[productIndex];
                    const result = await db.addToCart(user, productTitle);

                    if (result.success) {
                        await db.updateUser(user.id, { State: 'addToCart' });

                        let cartMessage = '✅ Item adicionado ao carrinho!\n\n🛒 *Seu carrinho:*\n';
                        let total = 0;

                        result.cartItems.forEach(item => {
                            const price = parseFloat(item.price);
                            const itemTotal = price * item.quantity;
                            total += itemTotal;
                            cartMessage += `\n• ${item.title}\n  Quantidade: ${item.quantity}x\n  Preço: R$ ${price.toFixed(2)}\n  Subtotal: R$ ${itemTotal.toFixed(2)}\n`;
                        });

                        cartMessage += `\n*Total: R$ ${total.toFixed(2)}*\n\nGostaria de finalizar a compra?`;
                        return cartMessage;
                    }
                } else {
                    return `Ops! Só temos ${lastShownProducts.length} produtos disponíveis. Por favor, escolha um número entre 1 e ${lastShownProducts.length}.`;
                }
            } else {
                return 'Por favor, primeiro veja os produtos disponíveis enviando "ver produtos".';
            }
        }

        return 'Não consegui identificar o número. Por favor, envie o número do produto (ex: "1", "2") ou "ver produtos" para ver a lista.';
    },

    checkout: async ({ user, sender }) => {
        if (!user) {
            return 'Por favor, envie "oi" primeiro para começarmos!';
        }
        await db.updateUser(user.id, { State: 'checkout' });
        const checkoutUrl = `${config.server.baseURL}/index.html?userId=${user.fields.PhoneNumber}`;
        return `🛒 *Finalize sua compra clicando no link:*\n\n${checkoutUrl}`;
    },

    default: () => {
        return "Desculpe, não entendi. Pode reformular sua mensagem? 🤔";
    }
};

const handleIntent = async (intent, params) => {
    const handler = intentHandlers[intent] || intentHandlers.default;
    return await handler(params);
};

module.exports = {
    handleIntent
};
