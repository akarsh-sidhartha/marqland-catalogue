const axios = require('axios');

const WHATSAPP_CONFIG = {
  token: process.env.WHATSAPP_TOKEN,
  phoneId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  recipient: process.env.WHATSAPP_RECIPIENT_PHONE,
  version: 'v18.0'
};

/**
 * Sends a daily status report (Existing logic)
 */
async function sendDailyStatus(stats) {
  if (!WHATSAPP_CONFIG.token || !WHATSAPP_CONFIG.phoneId) return;
  const url = `https://graph.facebook.com/${WHATSAPP_CONFIG.version}/${WHATSAPP_CONFIG.phoneId}/messages`;
  const messageData = {
    messaging_product: "whatsapp",
    to: WHATSAPP_CONFIG.recipient,
    type: "text",
    text: {
      body: `📅 *Daily Automation Report*\n\n✅ Outlook Sync: ${stats.outlookStatus}\n📄 Invoices Saved: ${stats.invoicesCount}\n🕒 Time: ${new Date().toLocaleTimeString('en-IN')}`
    }
  };
  try { await axios.post(url, messageData, { headers: { 'Authorization': `Bearer ${WHATSAPP_CONFIG.token}` } }); } catch (e) {}
}

/**
 * Downloads an image/PDF from WhatsApp servers and converts to Base64
 * Required for the "Scan and Save" feature
 */
async function downloadWhatsAppMedia(mediaId) {
    try {
        // 1. Get the Media URL
        const getUrl = `https://graph.facebook.com/${WHATSAPP_CONFIG.version}/${mediaId}`;
        const response = await axios.get(getUrl, {
            headers: { 'Authorization': `Bearer ${WHATSAPP_CONFIG.token}` }
        });

        // 2. Download the actual file bytes
        const fileResponse = await axios.get(response.data.url, {
            headers: { 'Authorization': `Bearer ${WHATSAPP_CONFIG.token}` },
            responseType: 'arraybuffer'
        });

        return {
            base64: Buffer.from(fileResponse.data).toString('base64'),
            mimeType: response.data.mime_type
        };
    } catch (error) {
        console.error("Error downloading WhatsApp media:", error.message);
        return null;
    }
}

module.exports = { sendDailyStatus, downloadWhatsAppMedia };