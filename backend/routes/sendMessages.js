const express = require('express');
const router = express.Router();
const axios = require('axios');

// These should be in your .env file
const VERSION = process.env.WHATSAPP_VERSION || 'v21.0';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

/**
 * POST /api/messaging/broadcast
 * Sends a template message to multiple contacts
 */
router.post('/broadcast', async (req, res) => {
  console.log("inside sendmessage broadcast POST API");
  const { contacts, message, attachments } = req.body;

  if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
    console.log("inside sendmessage broadcast POST API IF");
    return res.status(400).json({ message: "No recipient contacts provided." });
  }

  const results = {
    total: contacts.length,
    success: [],
    failed: []
  };

  // Process each contact
  const sendPromises = contacts.map(async (contact) => {
    try {
      // Clean phone number (remove non-digits)
      const cleanPhone = contact.phone.replace(/\D/g, '');
      console.log("inside sendmessage broadcast POST log 1");
      // --- STEP 1: SEND THE MAIN TEXT TEMPLATE ---
      // This establishes the conversation and provides the context/instructions
      await axios.post(
        `https://graph.facebook.com/${VERSION}/${PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: "whatsapp",
          to: cleanPhone,
          type: "template",
          template: {
            name: "product_broadcast", // Ensure this template exists in your Meta dashboard
            language: { code: "en_US" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: contact.name || 'Vendor' },
                  { type: "text", text: message || "Please check the following product requirements." }
                ]
              }
            ]
          }
        },
        { headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` } }
      );

      // --- STEP 2: SEND ATTACHMENTS SEQUENTIALLY ---
      // If there are multiple images/files, we send them as individual follow-up bubbles
      if (attachments && attachments.length > 0) {
        console.log("inside sendmessage broadcast POST IF 1");
        for (const file of attachments) {
          // Determine the correct WhatsApp media type
          let mediaType = "document"; // Default fallback
          if (file.type?.startsWith("image/")) mediaType = "image";
          else if (file.type?.startsWith("video/")) mediaType = "video";
          else if (file.type?.startsWith("audio/")) mediaType = "audio";

          await axios.post(
            `https://graph.facebook.com/${VERSION}/${PHONE_NUMBER_ID}/messages`,
            {
              messaging_product: "whatsapp",
              to: cleanPhone,
              type: mediaType,
              [mediaType]: {
                link: file.url,
                caption: file.name || "Product Detail"
              }
            },
            { headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` } }
          );
        }
      }

      results.success.push({ phone: cleanPhone, name: contact.name });
    } catch (err) {
      console.error(`Broadcast failed for ${contact.phone}:`, err.response?.data || err.message);
      results.failed.push({
        phone: contact.phone,
        error: err.response?.data?.error?.message || "Failed to deliver sequence"
      });
    }
  });

  // Wait for all broadcast attempts to finish
  await Promise.all(sendPromises);

  res.json({
    message: "Broadcast sequence completed",
    summary: results
  });
});

module.exports = router;