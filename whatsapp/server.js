const express = require('express');
const cors = require('cors');
const wppconnect = require('@wppconnect-team/wppconnect');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '../.env' }); // Load root .env

const app = express();
app.use(cors());
app.use(express.json());

const prisma = new PrismaClient();
const port = 3001;

// Global State
let currentQR = null;
let connectionStatus = 'disconnected'; // disconnected, qr_ready, connected
let wppClient = null;

async function initWppConnect() {
    connectionStatus = 'disconnected';
    currentQR = null;

    wppconnect.create({
        session: 'jasmine-session',
        catchQR: (base64Qr, asciiQR, attempts, urlCode) => {
            console.log('[WPP] QR Code yakalandı, frontend için hazır.');
            currentQR = base64Qr;
            connectionStatus = 'qr_ready';
        },
        statusFind: (statusSession, session) => {
            console.log('[WPP] Status değişti: ', statusSession);
            if (statusSession === 'isLogged' || statusSession === 'inChat') {
                connectionStatus = 'connected';
                currentQR = null;
                console.log('[WPP] WhatsApp başarıyla bağlandı!');
            }
            if (statusSession === 'notLogged' && connectionStatus !== 'qr_ready') {
                connectionStatus = 'disconnected';
            }
        },
        headless: true,
        autoClose: 0,
        puppeteerOptions: {
            userDataDir: require('path').join(require('os').homedir(), '.wpp_auth'),
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        }
    }).then((client) => {
        wppClient = client;
        start(client);
    }).catch((error) => {
        console.error('[WPP] Başlatma Hatası: ', error);
    });
}

function start(client) {
    client.onMessage(async (message) => {
        if (message.isGroupMsg) return;
        
        console.log(`[WPP] Yeni mesaj geldi: ${message.from} - ${message.body}`);
        
        try {
            const senderPhone = typeof message.from === 'string' ? message.from.split('@')[0] : String(message.from);
            let cleanPhone = senderPhone;
            if (cleanPhone.startsWith('90')) cleanPhone = '0' + cleanPhone.substring(2);

            await prisma.whatsAppMessage.create({
                data: {
                    phone: cleanPhone,
                    text: message.body || '',
                    isIncoming: true,
                    status: 'READ'
                }
            });
        } catch (e) {
            console.error('[WPP] Gelen mesajı kaydetme hatası:', e);
        }
    });
}

initWppConnect();

process.on('SIGINT', async () => {
    console.log('\n[SİSTEM] WPPConnect kapatılıyor...');
    if (wppClient) await wppClient.close();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    console.log('\n[SİSTEM] WPPConnect kapatılıyor...');
    if (wppClient) await wppClient.close();
    process.exit(0);
});

// -- ENDPOINTS --

app.get('/status', (req, res) => {
    res.json({ status: connectionStatus, qr: currentQR });
});

app.get('/chats', async (req, res) => {
    if (connectionStatus !== 'connected' || !wppClient) {
        return res.status(400).json({ error: 'WhatsApp bağlı değil' });
    }
    try {
        const chats = await wppClient.getAllChats();
        console.log(`[WPP] Toplam ${chats.length} sohbet bulundu.`);

        const personalChats = [];
        for (const c of chats) {
            if (c.isGroup) continue;
            const idStr = c.id && c.id._serialized ? c.id._serialized : c.id;
            if (!idStr) continue;

            let phoneStr = idStr.split('@')[0];
            if (phoneStr.startsWith('90')) phoneStr = '0' + phoneStr.substring(2);

            let lastMsg = '';
            let t = c.t || 0;
            if (c.msgs && c.msgs.length > 0) {
                const last = c.msgs[c.msgs.length - 1];
                lastMsg = last.body || '';
                t = last.t || t;
            }

            personalChats.push({
                phone: phoneStr,
                name: c.contact?.name || c.contact?.pushname || c.name || phoneStr,
                lastMessage: lastMsg,
                timestamp: t * 1000,
                unreadCount: c.unreadCount || 0
            });
        }

        personalChats.sort((a, b) => b.timestamp - a.timestamp);
        res.json(personalChats);
    } catch (err) {
        console.error('[WPP] Chat çekme hatası:', err.message);
        res.status(500).json({ error: 'Sohbetler alınamadı', details: err.message });
    }
});

app.post('/messages', async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Telefon numarası eksik' });

    let chatId = phone;
    if (chatId.startsWith('0')) {
        chatId = '90' + chatId.substring(1);
    }
    chatId = `${chatId}@c.us`;

    try {
        if (connectionStatus === 'connected' && wppClient) {
            let messages = await wppClient.getAllMessagesInChat(chatId, true, false);
            const formatted = messages.map(m => ({
                id: m.id,
                body: m.body || m.caption || '',
                isIncoming: !m.fromMe,
                timestamp: (m.t || m.timestamp) * 1000,
            }));
            return res.json(formatted);
        } else {
            const localMsgs = await prisma.whatsAppMessage.findMany({
                where: { phone, status: { not: 'DRAFT' } },
                orderBy: { createdAt: 'asc' }
            });
            return res.json(localMsgs.map(m => ({
                id: m.id,
                body: m.text,
                isIncoming: m.isIncoming,
                timestamp: m.createdAt.getTime()
            })));
        }
    } catch (err) {
        console.error('[WPP] Mesajları çekme hatası:', err);
        res.status(500).json({ error: 'Mesajlar alınamadı' });
    }
});

app.post('/send', async (req, res) => {
    const { phone, message, messageId } = req.body;
    if (!phone || !message) return res.status(400).json({ error: 'Eksik parametre' });
    if (connectionStatus !== 'connected' || !wppClient) {
        return res.status(400).json({ error: 'WhatsApp bağlı değil' });
    }

    let targetPhone = phone;
    if (targetPhone.startsWith('0')) {
        targetPhone = '90' + targetPhone.substring(1);
    }
    
    try {
        const response = await wppClient.sendText(`${targetPhone}@c.us`, message);
        console.log(`[WPP] Mesaj gönderildi: ${targetPhone}`);

        if (messageId) {
            await prisma.whatsAppMessage.update({
                where: { id: messageId },
                data: { status: 'SENT' }
            });
        } else {
            await prisma.whatsAppMessage.create({
                data: {
                    phone,
                    text: message,
                    isIncoming: false,
                    status: 'SENT'
                }
            });
        }

        res.json({ success: true, response });
    } catch (err) {
        console.error('[WPP] Gönderim hatası:', err);
        res.status(500).json({ error: 'Gönderilemedi' });
    }
});

app.post('/logout', async (req, res) => {
    try {
        if (wppClient) {
            await wppClient.logout();
        }
        connectionStatus = 'disconnected';
        currentQR = null;
        res.json({ success: true });
        
        setTimeout(() => {
            initWppConnect();
        }, 3000);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(port, () => {
    console.log(`[WPP] WhatsApp Microservice ${port} portunda çalışıyor...`);
});
