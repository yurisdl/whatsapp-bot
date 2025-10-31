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

const clearCorruptedSession = (originalLog) => {
    const path = require('path');
    const authPath = path.join(__dirname, '../auth_info_baileys');

    const log = originalLog || console.log;

    log('🗑️  Verificando pasta:', authPath);

    if (fs.existsSync(authPath)) {
        try {
            log('🗑️  Removendo pasta de autenticação...');

            // Tenta remover arquivos primeiro
            const files = fs.readdirSync(authPath);
            log(`📂 Encontrados ${files.length} arquivos/pastas`);

            for (const file of files) {
                const filePath = path.join(authPath, file);
                try {
                    const stat = fs.statSync(filePath);
                    if (stat.isDirectory()) {
                        fs.rmSync(filePath, { recursive: true, force: true });
                    } else {
                        fs.unlinkSync(filePath);
                    }
                    log(`  ✓ Removido: ${file}`);
                } catch (err) {
                    log(`  ✗ Erro ao remover ${file}:`, err.message);
                }
            }

            // Remove a pasta principal
            fs.rmdirSync(authPath);

            // Verifica se realmente foi removida
            if (!fs.existsSync(authPath)) {
                lastSessionClear = Date.now();
                log('✅ Pasta removida com sucesso!');
            } else {
                log('⚠️  Pasta ainda existe após remoção!');
            }
        } catch (error) {
            log('❌ Erro ao remover pasta:', error.message);
            log('Stack:', error.stack);
        }
    } else {
        log('ℹ️  Pasta de autenticação não existe');
    }
};

let connectionAttempts = 0;
const MAX_ATTEMPTS = 3;
let lastConnectionAttempt = 0;
let isConnecting = false;
let lastSessionClear = 0;
let waitingForQR = false;

const connectToWhatsApp = async () => {
    if (isConnecting) {
        return;
    }

    try {
        isConnecting = true;

        const now = Date.now();
        const timeSinceLastAttempt = now - lastConnectionAttempt;
        if (timeSinceLastAttempt < 10000) {
            const waitTime = 10000 - timeSinceLastAttempt;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        lastConnectionAttempt = Date.now();

        if (connectionAttempts >= MAX_ATTEMPTS) {
            clearCorruptedSession(console.log);
            connectionAttempts = 0;
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        const { version } = await fetchLatestBaileysVersion();

        // Silencia temporariamente console.log para suprimir logs do Baileys
        const originalLog = console.log;
        const originalWarn = console.warn;
        const originalError = console.error;

        console.log = () => {};

        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

        // Wrapper para saveCreds que silencia logs
        const originalSaveCreds = saveCreds;
        const silentSaveCreds = async () => {
            const tempLog = console.log;
            console.log = () => {};
            try {
                await originalSaveCreds();
            } finally {
                console.log = tempLog === originalLog ? originalLog : tempLog;
            }
        };

        // Restaura console.log após inicialização
        console.log = originalLog;
        console.warn = originalWarn;
        console.error = originalError;

        const logger = {
            level: 'silent',
            trace: () => {},
            debug: () => {},
            info: () => {},
            warn: (msg) => {
                // Silencia avisos de erro de stream 515
                if (typeof msg === 'string' && msg.includes('515')) return;
                if (typeof msg === 'object' && JSON.stringify(msg).includes('515')) return;
                originalWarn(msg);
            },
            error: (msg) => {
                // Silencia erros de stream 515
                if (typeof msg === 'string' && msg.includes('515')) return;
                if (typeof msg === 'object' && JSON.stringify(msg).includes('515')) return;
                originalError(msg);
            },
            child: () => logger
        };

        const sock = makeWASocket({
            logger: logger,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger)
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

        sock.ev.on('creds.update', silentSaveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                connectionAttempts = 0;
                waitingForQR = false;
                originalLog('\n📱 Escaneie o QR Code abaixo:\n');
                qrcodeTerminal.generate(qr, { small: true }, (qrcode) => {
                    process.stdout.write(qrcode + '\n');
                });
                originalLog('\n');
            }

            if (connection === 'close') {
                isConnecting = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const errorMessage = lastDisconnect?.error?.message || '';

                // Ignora apenas o LOG do erro 515, mas continua processando
                const is515Error = errorMessage.includes('515') || errorMessage.includes('stream:error');
                const is428Error = statusCode === 428; // Connection Closed - esperado após limpar sessão

                if (!is515Error && !is428Error) {
                    originalLog(`🔌 Conexão fechada. Código: ${statusCode || 'desconhecido'}`);
                }

                // Se é apenas erro 515 sem statusCode real, ignora totalmente
                if (is515Error && !statusCode) {
                    return;
                }

                // Erro 428 após limpar sessão - aguarda QR Code ser gerado
                if (is428Error && lastSessionClear > 0 && (Date.now() - lastSessionClear) < 30000) {
                    originalLog('⏳ Aguardando QR Code após limpeza de sessão...');
                    return;
                }

                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                const isLoggedOut = statusCode === DisconnectReason.loggedOut;
                const timeSinceLastClear = Date.now() - lastSessionClear;

                // Se foi desconectado pelo celular (logged out), limpa sessão
                // MAS: se já limpou recentemente (menos de 30s), não limpa novamente
                if (isLoggedOut) {
                    if (timeSinceLastClear > 0 && timeSinceLastClear < 30000) {
                        // Acabou de limpar, aguarda QR Code
                        if (!waitingForQR) {
                            waitingForQR = true;
                            originalLog('📱 Aguardando geração do QR Code...');
                        }
                        setTimeout(() => connectToWhatsApp(), 5000);
                        return;
                    }

                    originalLog('📱 Dispositivo desconectado pelo celular. Limpando sessão...');
                    clearCorruptedSession(originalLog);
                    originalLog('🔄 Gerando novo QR Code em 5 segundos...');
                    setTimeout(async () => {
                        connectionAttempts = 0;
                        waitingForQR = false;
                        isConnecting = false;
                        await connectToWhatsApp();
                    }, 5000);
                    return;
                }

                // Erros específicos que requerem limpeza de sessão (401/405)
                if (statusCode === 405 || statusCode === 401) {
                    // Se acabou de limpar a sessão (menos de 60s), aguarda QR Code sem incrementar contador
                    if (timeSinceLastClear > 0 && timeSinceLastClear < 60000) {
                        if (!waitingForQR) {
                            waitingForQR = true;
                            originalLog('📱 Aguardando geração do QR Code...');
                        }
                        // Aguarda mais tempo para o QR Code aparecer
                        setTimeout(() => connectToWhatsApp(), 5000);
                        return;
                    }

                    // Reseta o lastSessionClear após 60s para permitir novas tentativas
                    if (timeSinceLastClear >= 60000) {
                        lastSessionClear = 0;
                    }

                    connectionAttempts++;
                    if (connectionAttempts > MAX_ATTEMPTS) {
                        originalLog('⚠️  Máximo de tentativas atingido. Limpando sessão...');
                        clearCorruptedSession(originalLog);
                        originalLog('🔄 Gerando novo QR Code em 5 segundos...');
                        setTimeout(async () => {
                            connectionAttempts = 0;
                            waitingForQR = false;
                            isConnecting = false;
                            await connectToWhatsApp();
                        }, 5000);
                    } else {
                        const waitTime = 3000;
                        originalLog(`🔄 Tentando reconectar em ${waitTime/1000}s (tentativa ${connectionAttempts}/${MAX_ATTEMPTS})...`);
                        setTimeout(() => connectToWhatsApp(), waitTime);
                    }
                } else if (shouldReconnect) {
                    connectionAttempts++;
                    const waitTime = Math.min(connectionAttempts * 10000, 30000);
                    originalLog(`🔄 Tentando reconectar em ${waitTime/1000}s (tentativa ${connectionAttempts}/${MAX_ATTEMPTS})...`);
                    setTimeout(() => connectToWhatsApp(), waitTime);
                }
            } else if (connection === 'open') {
                originalLog('✅ Conectado ao WhatsApp!');
                connectionAttempts = 0;
                isConnecting = false;
                waitingForQR = false;
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
        isConnecting = false;
        console.error('❌ Erro ao conectar:', error.message);
        connectionAttempts++;
        if (connectionAttempts < MAX_ATTEMPTS) {
            console.log(`🔄 Tentando novamente em 5s (tentativa ${connectionAttempts}/${MAX_ATTEMPTS})...`);
            setTimeout(() => connectToWhatsApp(), 5000);
        } else {
            console.log('⚠️  Máximo de tentativas atingido. Limpando sessão...');
            clearCorruptedSession(console.log);
            connectionAttempts = 0;
            setTimeout(() => connectToWhatsApp(), 5000);
        }
    }
};

console.log('🚀 Iniciando bot...');
connectToWhatsApp();