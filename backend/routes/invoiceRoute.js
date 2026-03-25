const express = require('express');
const router = express.Router();
const axios = require('axios');
const Invoice = require('../models/Invoice');
const whatsappService = require('../services/whatsappService');
const qs = require('qs');

/**
 * Helper: Delay execution for API rate limits
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Utility: Check if an invoice already exists
 */
const checkIfDuplicate = async (vendor_gst, invoice_number) => {
    if (!vendor_gst || !invoice_number) return false;
    const existing = await Invoice.findOne({ vendor_gst, invoice_number });
    return !!existing;
};

const getAvailableGeminiModels = async (apiKey) => {
    try {
        const response = await axios.get(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        );
        return response.data.models
            .map(m => m.name.replace('models/', ''))
            .filter(name => name.includes('flash') || name.includes('pro'))
            .filter(name => !name.includes('gemini-1.0')); // exclude old retired ones
    } catch {
        return GEMINI_MODELS; // fall back to hardcoded list if this call fails
    }
};

/**
 * CORE AI LOGIC: Shared extraction via Gemini
 */
const processWithGemini = async (base64Data, mimeType) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY missing");

    const systemPrompt = `Extract Indian Tax Invoice details. Return ONLY a valid JSON object with: 
    vendor_name, vendor_gst (15-char GSTIN), invoice_number, date (YYYY-MM-DD), 
    total_amount (Number), cgst (Number), sgst (Number), igst (Number), 
    financialYear (e.g. 2023-24), month (Full Name).`;

    const payload = {
        contents: [{
            parts: [
                { text: systemPrompt },
                { inlineData: { mimeType: mimeType || 'image/jpeg', data: base64Data } }
            ]
        }]
    };

    let attempts = 0;
    while (attempts < 5) {
        try {
            //const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
            const models = await getAvailableGeminiModels(apiKey);
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${models}:generateContent?key=${apiKey}`;
            const response = await axios.post(url, payload);
            const text = response.data.candidates[0].content.parts[0].text;
            const cleanJson = text.replace(/```json|```/g, "").trim();
            return JSON.parse(cleanJson);
        } catch (err) {
            attempts++;
            if (attempts === 5) throw err;
            await sleep(Math.pow(2, attempts) * 1000);
        }
    }
};

/**
 * SHARED LOGIC: Process, Extract, and Save
 */
const handleAutomatedInvoice = async (base64Data, mimeType, source, metadata = {}) => {
    try {
        const extraction = await processWithGemini(base64Data, mimeType);
        
        const isDup = await checkIfDuplicate(extraction.vendor_gst, extraction.invoice_number);
        if (isDup) return { success: false, reason: 'Duplicate', data: extraction };

        const newInvoice = new Invoice({
            ...extraction,
            total_amount: Number(extraction.total_amount || 0),
            image: `data:${mimeType};base64,${base64Data}`,
            mimeType: mimeType,
            receivedVia: source,
            notes: metadata.notes || `Automatically processed via ${source}`,
            createdAt: new Date()
        });

        await newInvoice.save();
        return { success: true, data: newInvoice };
    } catch (err) {
        console.error(`Error in handleAutomatedInvoice (${source}):`, err);
        throw err;
    }
};

/**
 * WHATSAPP WEBHOOK (POST): Handle Incoming Messages
 * This is where your new SIM card "lives" now.
 */
router.post('/whatsapp-webhook', async (req, res) => {
    try {
        const entry = req.body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;

        // Metadata about YOUR new SIM
        const receiverPhoneId = value?.metadata?.phone_number_id;
        const receiverDisplayNumber = value?.metadata?.display_phone_number;

        // If no messages (like a status update), just acknowledge and exit
        if (!value?.messages) return res.sendStatus(200);

        const msg = value.messages[0];
        const fromNumber = msg.from; // Vendor's number
        
        // Detect if the vendor sent a Document (PDF) or an Image
        const media = msg.document || (msg.image ? msg.image : null);

        if (media) {
            console.log(`📩 WhatsApp Invoice Received on ${receiverDisplayNumber} from ${fromNumber}`);
            
            // 1. Tell the vendor you are processing (Good UX)
            await whatsappService.sendReply(
                receiverPhoneId, 
                fromNumber, 
                "⏳ Reading your invoice... please wait."
            ).catch(() => {});

            // 2. Download the media from Meta Servers using the Media ID
            const mediaData = await whatsappService.downloadWhatsAppMedia(media.id);
            
            if (mediaData) {
                // 3. Process with Gemini
                const result = await handleAutomatedInvoice(
                    mediaData.base64, 
                    mediaData.mimeType, 
                    'whatsapp',
                    { notes: `WhatsApp Receiver: ${receiverDisplayNumber} | From: ${fromNumber}` }
                );

                // 4. Send the result back to the vendor
                if (result.success) {
                    await whatsappService.sendReply(
                        receiverPhoneId, 
                        fromNumber, 
                        `✅ Invoice Saved!\n\n*Vendor:* ${result.data.vendor_name}\n*Inv No:* ${result.data.invoice_number}\n*Amount:* ₹${result.data.total_amount}`
                    );
                } else if (result.reason === 'Duplicate') {
                    await whatsappService.sendReply(
                        receiverPhoneId,
                        fromNumber,
                        `⚠️ *Duplicate:* Invoice #${result.data.invoice_number} from ${result.data.vendor_name} is already in our vault.`
                    );
                }
            }
        } else {
            // If they sent text instead of an image
            await whatsappService.sendReply(
                receiverPhoneId,
                fromNumber,
                "👋 Hello! Please send an *Image* or *PDF* of the tax invoice for automated processing."
            );
        }

        res.sendStatus(200);
    } catch (err) {
        console.error("WhatsApp Webhook Error:", err);
        // Always send 200 to Meta so they don't keep retrying the same error
        res.sendStatus(200);
    }
});

/**
 * WHATSAPP WEBHOOK (GET): Required for Meta Verification
 */
router.get('/whatsapp-webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    // WHATSAPP_VERIFY_TOKEN is a random string you set in Meta Portal
    if (mode && token === process.env.WHATSAPP_TOKEN) {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

/**
 * MICROSOFT OUTLOOK SYNC LOGIC (Domain-wide Scan)
 */
const getMicrosoftAccessToken = async () => {
    const tokenUrl = `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`;
    const data = qs.stringify({
        client_id: process.env.MICROSOFT_CLIENT_ID,
        scope: 'https://graph.microsoft.com/.default',
        client_secret: process.env.MICROSOFT_CLIENT_SECRET,
        grant_type: 'client_credentials'
    });

    const response = await axios.post(tokenUrl, data, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    return response.data.access_token;
};

const syncOutlookInvoices = async () => {
    try {
        console.log("🔍 Starting Domain-Wide Outlook Sync...");
        const token = await getMicrosoftAccessToken();
        const headers = { Authorization: `Bearer ${token}` };

        // 1. Fetch all users in the organization
        const usersUrl = `https://graph.microsoft.com/v1.0/users?$select=id,userPrincipalName`;
        const usersResponse = await axios.get(usersUrl, { headers });
        const users = usersResponse.data.value;

        let totalProcessedCount = 0;
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // 2. Iterate through each user and check their mailbox
        for (const user of users) {
            try {
                const userEmail = user.userPrincipalName;
                const mailUrl = `https://graph.microsoft.com/v1.0/users/${user.id}/messages?$filter=hasAttachments eq true and receivedDateTime ge ${yesterday}&$select=id,subject,from,receivedDateTime`;

                const mailResponse = await axios.get(mailUrl, { headers });
                const messages = mailResponse.data.value;

                for (const msg of messages) {
                    const attachUrl = `https://graph.microsoft.com/v1.0/users/${user.id}/messages/${msg.id}/attachments`;
                    const attachRes = await axios.get(attachUrl, { headers });
                    
                    for (const attachment of attachRes.data.value) {
                        const isImage = attachment.contentType?.startsWith('image/');
                        const isPdf = attachment.contentType === 'application/pdf';

                        if (isImage || isPdf) {
                            const result = await handleAutomatedInvoice(
                                attachment.contentBytes,
                                attachment.contentType,
                                'outlook',
                                { notes: `User: ${userEmail} | From: ${msg.from.emailAddress.address} | Subject: ${msg.subject}` }
                            );
                            if (result.success) totalProcessedCount++;
                        }
                    }
                }
            } catch (userErr) {
                // If a user doesn't have a mailbox (e.g., service account), skip them
                console.warn(`Could not scan mailbox for ${user.userPrincipalName}:`, userErr.message);
                continue;
            }
        }
        
        console.log(`✅ Sync Complete. Total Invoices Found: ${totalProcessedCount}`);
        return { success: true, processed: totalProcessedCount };
    } catch (err) {
        console.error("Outlook Domain Sync Error:", err.response?.data || err.message);
        return { success: false, error: err.message };
    }
};

router.post('/outlook-sync', async (req, res) => {
    const result = await syncOutlookInvoices();
    res.json(result);
});

/**
 * STANDARD CRUD & UI ROUTES
 */
router.post('/process', async (req, res) => {
    try {
        const { image, mimeType } = req.body;
        const base64 = image.includes(',') ? image.split(',')[1] : image;
        const result = await processWithGemini(base64, mimeType);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/', async (req, res) => {
    try {
        const invoices = await Invoice.find().sort({ createdAt: -1 });
        res.json(invoices);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const isDup = await checkIfDuplicate(req.body.vendor_gst, req.body.invoice_number);
        if (isDup) return res.status(400).json({ error: "Invoice exists in vault." });

        const newInvoice = new Invoice({
            ...req.body,
            total_amount: Number(req.body.total_amount || 0),
            createdAt: new Date()
        });
        await newInvoice.save();
        res.status(201).json(newInvoice);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await Invoice.findByIdAndDelete(req.params.id);
        res.json({ message: "Invoice deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = {
    router,
    syncOutlookInvoices
};