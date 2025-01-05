// server.js
const express = require('express');
const { Client,MessageMedia  ,LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const axios = require('axios');
const app = express();
const port = 3000;
const path = require('path');
const fs = require('fs');
const { Buffer } = require('buffer');
const { URL } = require('url');
require('dotenv').config();

// Middleware for parsing JSON bodies
app.use(express.json());

// Path to store session data
const SESSION_FILE_PATH = './session.json';

let sessionData;
let qrCode = null;
let isReady = 'false';
// Store messages in memory (replace with database in production)
const messages = [];
const callback_url = process.env.CALLBACK_URL;

if (fs.existsSync(SESSION_FILE_PATH)) {
    sessionData = require(SESSION_FILE_PATH); // Load saved session
}

// Initialize WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: 'client-one', // Optional: Use unique IDs for multiple sessions
    }) ,
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});




client.on('ready', () => {
    console.log('Client is ready!');
    isReady = 'true';
    fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(session));
    
});

// WhatsApp Client Event Handlers
client.on('qr', async (qr) => {
    console.log('QR RECEIVED', qr);
    // Convert QR to data URL for easy display
    qrCode = await qrcode.toDataURL(qr);
});



client.on('message', async msg => {
    // Store message

    var messageData = {
        from: msg.from,
        body: msg.body,
        timestamp: new Date(),
        id: msg.id,
        hasMedia:msg.hasMedia,
        msg:msg
    };

    //console.log(msg.hasMedia);
    if (msg.hasMedia) {
        const media = await msg.downloadMedia();

        if (media && media.mimetype.startsWith('image')) {
            // Save to a file or process the image
            fs.writeFile(`./images/${msg.id.id}.jpg`, media.data, { encoding: 'base64' }, function (err) {
                if (err) {
                    console.error('Failed to save image:', err);
                } else {
                    console.log('Image saved successfully!');
                }
            });

            // If you need the image as a base64 string
           // console.log('Image in base64:', media.data);
            messageData.media_url = `{$APP_URL}/images/${msg.id.id}.jpg`;
        }
       // console.log('Image in base64:', media);
    }

   
    messages.push(messageData);
    console.log(messageData);
    axios.get(callback_url, { params: messageData })
    .then(response => {
        console.log('Message sent successfully:', response.data);
    })
    .catch(error => {
        console.error('Error sending message:', error);
    });

    // Handle commands
    if (msg.body === '!ping') {
        msg.reply('pong');
    }
});

// Initialize WhatsApp client
client.initialize();

// API Endpoints
// Middleware to check if client is ready
const checkClient = (req, res, next) => {
    if (!isReady) {
        return res.status(503).json({
            status: 'error',
            message: 'WhatsApp client not ready. Please scan the QR code first.'
        });
    }
    next();
};


// Serve the images directory as static content
app.use('/images', express.static('images'));

// Get QR Code
app.get('/api/qr', (req, res) => {
    if (qrCode) {
        res.json({ qr: qrCode });
    } else {
        res.status(404).json({ error: 'QR Code not yet generated' });
    }
});

// Get client status
app.get('/api/status', (req, res) => {
    res.json({
        isReady: isReady
    });
});

// Create Group
app.post('/create-group', async (req, res) => {
    const { groupName, participants } = req.body;

    if (!groupName || !participants || !Array.isArray(participants)) {
        return res.status(400).json({ error: 'Invalid input data' });
    }

    try {
        const group = await client.createGroup(groupName, participants);
        res.json({
            message: 'Group created successfully',
            groupId: group.gid._serialized,
        });
    } catch (error) {
        console.error('Failed to create group:', error);
        res.status(500).json({ error: 'Failed to create group' });
    }
});

// Send message
app.post('/api/send', async (req, res) => {
    if (!isReady) {
        return res.status(503).json({ error: 'WhatsApp client not ready' });
    }

    const { number, message } = req.body;

    if (!number || !message) {
        return res.status(400).json({ error: 'Number and message are required' });
    }

    try {
        // Format number to include country code if not present
        const formattedNumber = number.includes('@c.us') ? number : `${number}@c.us`;
        
        // Send message
        const response = await client.sendMessage(formattedNumber, message);
        //console.log(response);
        res.json({
            success: true,
            messageId: response.id
        });

    } catch (error) {
       // console.log(error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get message history
app.get('/api/messages', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    res.json(messages.slice(-limit));
});

// API route to get chat history
app.get('/api/chat-history/:phoneNumber', async (req, res) => {
    const { phoneNumber } = req.params;
    const chatId = `${phoneNumber}@c.us`;

    if (isReady){
    
    try {
        const chat = await client.getChatById(chatId);
        const messages = await chat.fetchMessages({ limit: 50 });

       // console.log(messages);

        // Format messages for JSON response
        const formattedMessages = messages.map(message => ({
            timestamp: message.timestamp,
            from: message.from,
            body: message.body,
            hasMedia:message.hasMedia,
            message:message,
            imageUrl:`{$APP_URL}/images/${message.id.id}.jpg`
        }));

        

        res.json({
            success: true,
            chatId: chatId,
            messages: formattedMessages
        });
    } catch (error) {
        console.error('Error retrieving chat history:', error);
        res.status(500).json({ success: false, message: 'Error retrieving chat history' });
    }
    }
});

// Get chat list
app.get('/api/chats', async (req, res) => {
    if (!isReady) {
        return res.status(503).json({ error: 'WhatsApp client not ready' });
    }

    try {
        const chats = await client.getChats();
        res.json(chats.map(chat => ({
            id: chat.id._serialized,
            name: chat.name,
            unreadCount: chat.unreadCount
        })));
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/contacts', checkClient, async (req, res) => {
    try {
        const contacts = await client.getContacts();
        const filteredContacts = contacts
            .filter(contact => contact.isMyContact)
            .map(contact => ({
                id: contact.id._serialized,
                name: contact.name,
                number: contact.number,
                shortName: contact.shortName
            }));

        res.json({
            status: 'success',
            data: filteredContacts
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Logout
app.get('/api/logout', async (req, res) => {
    try {
        await client.logout();
        res.json({ success: true });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});


app.post('/api/send-url-image', async (req, res) => {
    if (!isReady) {
        return res.status(503).json({ error: 'WhatsApp client not ready' });
    }

    const { number, imageUrl, caption } = req.body;

    if (!number || !imageUrl) {
        return res.status(400).json({ error: 'Number and image URL are required' });
    }
    //console.log('hello');
    try {
        // Validate URL
        const url = new URL(imageUrl);
        //console.log(url);
        // Check if URL points to an image
        const response = await axios.get(imageUrl, { 
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        
        const contentType = response.headers['content-type'];
        if (!contentType.startsWith('image/')) {
            return res.status(400).json({ error: 'URL does not point to a valid image' });
        }

        // Convert image to base64
        const imageBase64 = Buffer.from(response.data).toString('base64');
       
        // Create message media
        const media = new MessageMedia(
            contentType,
            imageBase64,
            'downloaded_image.jpg'
        );
        //console.log(media);
        // Format number
        const formattedNumber = number.includes('@c.us') ? number : `${number}@c.us`;
        //console.log(formattedNumber);
        // Send message with media
        const messageResponse = await client.sendMessage(formattedNumber, media, {
            caption: caption || ''
        });

      //  console.log(messageResponse.id.id);

        fs.writeFile(`./images/${messageResponse.id.id}.jpg`, imageBase64, { encoding: 'base64' }, function (err) {
            if (err) {
                console.error('Failed to save image:', err);
            } else {
                console.log('Image saved successfully!');
            }
        });

        res.json({
            success: true,
            messageId: messageResponse.id._serialized
        });
    } catch (error) {
        let errorMessage = 'Failed to send image';
        
        if (error.code === 'ENOTFOUND') {
            errorMessage = 'Invalid URL or host not found';
        } else if (error instanceof TypeError) {
            errorMessage = 'Invalid URL format';
        }

        res.status(500).json({
            success: false,
            error: errorMessage,
            p:error
        });
    }
});

// Send URL image to group endpoint
app.post('/api/send-group-url-image', async (req, res) => {
    if (!isReady) {
        return res.status(503).json({ error: 'WhatsApp client not ready' });
    }

    const { groupId, imageUrl, caption } = req.body;

    if (!groupId || !imageUrl) {
        return res.status(400).json({ error: 'Group ID and image URL are required' });
    }

    try {
        // Validate URL
        const url = new URL(imageUrl);
        
        // Check if URL points to an image
        const response = await axios.get(imageUrl, { 
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const contentType = response.headers['content-type'];
        if (!contentType.startsWith('image/')) {
            return res.status(400).json({ error: 'URL does not point to a valid image' });
        }

        // Convert image to base64
        const imageBase64 = Buffer.from(response.data).toString('base64');
        
        // Create message media
        const media = new MessageMedia(
            contentType,
            imageBase64,
            'image.' + contentType.split('/')[1]
        );

        // Format group ID
        const formattedGroupId = groupId.includes('@g.us') ? groupId : `${groupId}@g.us`;
        
        // Check if group exists
        const chats = await client.getChats();
        const group = chats.find(chat => chat.id._serialized === formattedGroupId);
        
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        // Send message with media
        const messageResponse = await client.sendMessage(formattedGroupId, media, {
            caption: caption || ''
        });

        res.json({
            success: true,
            messageId: messageResponse.id._serialized,
            groupName: group.name
        });
    } catch (error) {
        let errorMessage = 'Failed to send image';
        
        if (error.code === 'ENOTFOUND') {
            errorMessage = 'Invalid URL or host not found';
        } else if (error instanceof TypeError) {
            errorMessage = 'Invalid URL format';
        }

        res.status(500).json({
            success: false,
            error: errorMessage
        });
    }
});

app.listen(port, () => {
    console.log(`WhatsApp API server running on port ${port}`);
});