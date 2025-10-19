const {
    default: makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
    Browsers,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');
const qrcodeTerminal = require('qrcode-terminal');
const fs = require('fs');
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

const clearCorruptedSession = () => {
    const authPath = './auth_info_baileys';
    if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
        console.log('Sessão limpa. Gerando novo QR Code...');
    }
};

let connectionAttempts = 0;
const MAX_ATTEMPTS = 2;
let lastConnectionAttempt = 0;

const connectToWhatsApp = async () => {
    try {
        const now = Date.now();
        const timeSinceLastAttempt = now - lastConnectionAttempt;
        if (timeSinceLastAttempt < 10000) {
            const waitTime = 10000 - timeSinceLastAttempt;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        lastConnectionAttempt = Date.now();

        if (connectionAttempts >= MAX_ATTEMPTS) {
            clearCorruptedSession();
            connectionAttempts = 0;
            await new Promise(resolve => setTimeout(resolve, 30000));
        }

        const { version } = await fetchLatestBaileysVersion();

        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, console)
            },
            version: version,
            printQRInTerminal: false,
            browser: Browsers.macOS('Safari'),
            markOnlineOnConnect: false,
            syncFullHistory: false,
            fireInitQueries: false,
            generateHighQualityLinkPreview: false,
            emitOwnEvents: false,
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
            maxRetries: 5,
            retryDelayMs: 2000,
            mobile: false,
            getMessage: async (key) => {
                return undefined;
            },
            shouldIgnoreJid: (jid) => jid.endsWith('@broadcast')
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                connectionAttempts = 0;
                console.log('\n📱 Escaneie o QR Code abaixo:\n');
                qrcodeTerminal.generate(qr, { small: false });
                console.log('\n');
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                if (statusCode === 405) {
                    clearCorruptedSession();
                    connectionAttempts = 0;
                    setTimeout(() => connectToWhatsApp(), 15000);
                } else if (shouldReconnect) {
                    connectionAttempts++;
                    const waitTime = connectionAttempts * 10000;
                    setTimeout(() => connectToWhatsApp(), waitTime);
                } else {
                    clearCorruptedSession();
                }
            } else if (connection === 'open') {
                console.log('✅ Conectado ao WhatsApp!');
                connectionAttempts = 0;
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
    } catch (error) {
        console.error('Erro ao conectar:', error.message);
        connectionAttempts++;
        if (connectionAttempts < MAX_ATTEMPTS) {
            setTimeout(() => connectToWhatsApp(), 5000);
        } else {
            clearCorruptedSession();
        }
    }
};

console.log('🚀 Iniciando bot...');
connectToWhatsApp();