require('dotenv').config();

module.exports = {
    mysql: {
        host: process.env.MYSQL_HOST || 'localhost',
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || 'whatsapp_bot',
        port: process.env.MYSQL_PORT || 3306
    },
    mercadopago: {
        accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
        publicKey: process.env.MERCADOPAGO_PUBLIC_KEY,
    },
    server: {
        port: 3000,
        baseURL: process.env.SERVER_URL || 'http://localhost:3000'
    },
    nlp: {
        modelPath: './models/model.private.nlp',
        language: 'pt'
    }
};
