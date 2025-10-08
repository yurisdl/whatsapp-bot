const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const { handleMessage } = require('./handlers/messageHandler');
const { sendTextMessage } = require('./services/whatsapp');
const { setWhatsappSocket } = require('./api/checkout');
const express = require('express');
const path = require('path');
const cors = require('cors');
const checkoutRouter = require('./api/checkout');
const config = require('./config/env');

const app = express();
const PORT = config.server.port;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../assets')));
app.use(checkoutRouter);

app.listen(PORT, () => {
    console.log(`✅ Servidor rodando na porta ${PORT}`);
});

const connectToWhatsApp = async () => {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\n📱 Escaneie o QR Code com seu WhatsApp:\n');
            qrcode.generate(qr, { small: true });
            console.log('\n');
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('✅ Conectado ao WhatsApp!');
            setWhatsappSocket(sock);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];

        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid.replace('@s.whatsapp.net', '');
        const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

        try {
            const response = await handleMessage(messageText, sender, sock, msg.key.remoteJid);

            if (response && response.trim() !== '') {
                await sendTextMessage(sock, msg.key.remoteJid, response);
            }
        } catch (error) {
            console.error('Erro ao processar mensagem:', error);
            await sendTextMessage(sock, msg.key.remoteJid, 'Desculpe, ocorreu um erro. Tente novamente.');
        }
    });
};

console.log('🚀 Iniciando bot...');
connectToWhatsApp();