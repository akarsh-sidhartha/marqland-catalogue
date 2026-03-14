const express = require('express');
const router = express.Router();
const axios = require('axios');
const OrderInquiry = require('../models/orderInquiry');

/**
 * HELPER: Get Microsoft Graph Access Token
 */

const getAccessToken = async () => {
  try {
    // 1. Log masked values for debugging (to ensure they aren't undefined)
    console.log("Attempting MS Auth with Tenant:", process.env.MICROSOFT_TENANT_ID);

    const url = `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`;

    // 2. Use a plain object or URLSearchParams
    const params = new URLSearchParams();
    params.append('client_id', process.env.MICROSOFT_CLIENT_ID);
    params.append('scope', 'https://graph.microsoft.com/.default');
    params.append('client_secret', process.env.MICROSOFT_CLIENT_SECRET);
    params.append('grant_type', 'client_credentials');

    // 3. Explicitly set Content-Type header
    const res = await axios.post(url, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    console.log("✅ MS Access Token acquired successfully");
    return res.data.access_token;

  } catch (error) {
    // 4. Enhanced Error Logging
    if (error.response) {
      // The request was made and the server responded with a status code
      // (Microsoft usually sends a JSON body explaining WHY the 401 happened)
      console.error("❌ Microsoft Auth Error:", error.response.status);
      console.error("Detailed Error Body:", JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error("❌ No response received from Microsoft Auth:", error.message);
    } else {
      console.error("❌ Error setting up MS Auth request:", error.message);
    }
    throw new Error("Failed to authenticate with Microsoft Graph API");
  }
};

/**
 * HELPER: Get or Create Folder by Name under a Parent ID
 */

const getOrCreateFolder = async (token, userId, parentId, folderName) => {
  try {
    // Try to find if folder already exists
    const searchRes = await axios.get(
      `https://graph.microsoft.com/v1.0/users/${userId}/drive/items/${parentId}/children?$filter=name eq '${folderName.replace(/'/g, "''")}'`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (searchRes.data.value.length > 0) {
      return searchRes.data.value[0].id;
    }

    // Create if not exists
    const createRes = await axios.post(
      `https://graph.microsoft.com/v1.0/users/${userId}/drive/items/${parentId}/children`,
      {
        name: folderName,
        folder: {},
        "@microsoft.graph.conflictBehavior": "fail"
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return createRes.data.id;
  } catch (err) {
    // Fallback in case of race conditions
    if (err.response?.status === 409) {
      const retryRes = await axios.get(
        `https://graph.microsoft.com/v1.0/users/${userId}/drive/items/${parentId}/children?$filter=name eq '${folderName.replace(/'/g, "''")}'`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return retryRes.data.value[0]?.id;
    }
    throw err;
  }
};

/**
 * Helper to get current Financial Year in YYYY-YYYY format
 */
const getFinancialYear = () => {
  const today = new Date();
  const month = today.getMonth() + 1; // Jan is 0
  const year = today.getFullYear();
  // If month is April (4) or later, FY is currentYear - nextYear
  // Otherwise, FY is lastYear - currentYear
  return month >= 4
    ? `${year}-${year + 1}`
    : `${year - 1}-${year}`;
};

/**
 * CORE LOGIC: Build Hierarchy and Upload
 * Path: Client Name -> Financial Year -> Contact Person -> RefNumber Folder
 */
const processOneDriveUploads = async (orderData, attachments) => {
  try {
    const token = await getAccessToken();
    const userId = process.env.MICROSOFT_USER_ID;

    // 1. Prepare Folder Names
    const rootFolderName = "Orders";
    const clientFolder = (orderData.clientName || "Unknown Client").trim();
    const fyFolder = getFinancialYear(); // Returns "2024-2025" etc.
    const contactFolder = (orderData.orderPlacedBy || "General").trim();
    const refFolder = (orderData.refNumber || "No-Ref").replace(/\//g, '-').trim();

    let currentParentId = 'root';

    // 2. Hierarchy Creation
    currentParentId = await getOrCreateFolder(token, userId, currentParentId, rootFolderName);
    currentParentId = await getOrCreateFolder(token, userId, currentParentId, clientFolder);
    currentParentId = await getOrCreateFolder(token, userId, currentParentId, fyFolder);
    currentParentId = await getOrCreateFolder(token, userId, currentParentId, contactFolder);

    // 3. Create Reference Folder
    const finalFolderRes = await axios.post(
      `https://graph.microsoft.com/v1.0/users/${userId}/drive/items/${currentParentId}/children`,
      {
        name: refFolder,
        folder: {},
        "@microsoft.graph.conflictBehavior": "replace"
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const folderId = finalFolderRes.data.id;
    const folderUrl = finalFolderRes.data.webUrl;

    // 4. Upload Files
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      for (const file of attachments) {
        // Ensure we are looking at the correct property
        const base64String = file.base64 || file.data;

        if (base64String) {
          const pureBase64 = base64String.includes(',')
            ? base64String.split(',')[1]
            : base64String;

          const fileContent = Buffer.from(pureBase64, 'base64');

          await axios.put(
            `https://graph.microsoft.com/v1.0/users/${userId}/drive/items/${folderId}:/${file.name}:/content`,
            fileContent,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': file.type || 'application/octet-stream'
              }
            }
          );
        }
      }
    }

    return folderUrl;
  } catch (err) {
    console.error("OneDrive Upload Failed:", err.response?.data || err.message);
    return null;
  }
};
/**
 * HELPER: Upload Files to OneDrive
 */
const uploadToOneDrive = async (token, userId, folderId, attachments) => {
  for (const file of attachments) {
    if (file.base64) {
      const buffer = Buffer.from(file.base64.split(',')[1], 'base64');
      await axios.put(
        `https://graph.microsoft.com/v1.0/users/${userId}/drive/items/${folderId}:/${file.name}:/content`,
        buffer,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': file.type } }
      );
    }
  }
};

/**
 * HELPER: Convert a OneDrive Web URL to a Folder ID using the Shares API
 */
const getFolderIdFromUrl = async (token, url) => {
  try {
    if (!url) return null;

    // 1. Convert URL to a sharing token (base64 unpadded) as per MS Graph docs
    const base64Value = Buffer.from(url).toString('base64');
    const shareToken = "u!" + base64Value.replace(/=/g, '').replace(/\//g, '_').replace(/\+/g, '-');

    // 2. Call the shares API to get the drive item
    const res = await axios.get(
      `https://graph.microsoft.com/v1.0/shares/${shareToken}/driveItem`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    return res.data.id;
  } catch (e) {
    console.error("Error resolving folder ID from URL:", e.response?.data || e.message);
    return null;
  }
};

// GET all orders with OneDrive attachments
router.get('/', async (req, res) => {
  try {
    const orders = await OrderInquiry.find().sort({ updatedAt: -1 }).lean();
    const token = await getAccessToken();
    const userId = process.env.MICROSOFT_USER_ID;

    const enhancedOrders = await Promise.all(orders.map(async (order) => {
      try {
        // Use the stored oneDriveFolderUrl to get the actual Folder ID
        const folderId = await getFolderIdFromUrl(token, order.oneDriveFolderUrl);

        if (folderId) {
          const driveRes = await axios.get(
            `https://graph.microsoft.com/v1.0/users/${userId}/drive/items/${folderId}/children`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          order.attachments = driveRes.data.value.map(file => ({
            id: file.id,
            name: file.name,
            size: file.size,
            webUrl: file.webUrl,
            // Include direct download link if available
            downloadUrl: file["@microsoft.graph.downloadUrl"],
            isOneDrive: true
          }));
        } else {
          order.attachments = [];
        }
      } catch (e) {
        order.attachments = [];
      }
      return order;
    }));

    res.json(enhancedOrders);
  } catch (err) {
    console.error("Backend Error Order GET API:", err.message);
    res.status(500).json([]);
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { attachments, ...updateData } = req.body;
    const existingOrder = await OrderInquiry.findById(req.params.id);

    if (!existingOrder) return res.status(404).json({ error: "Order not found" });

    const token = await getAccessToken();
    const userId = process.env.MICROSOFT_USER_ID;

    // Resolve the folder ID from the stored URL
    const folderId = await getFolderIdFromUrl(token, existingOrder.oneDriveFolderUrl);

    if (folderId) {
      // --- NEW: HANDLE FOLDER RENAMING ---
      // Check if refNumber is being updated and is different from the existing one
      if (updateData.refNumber && updateData.refNumber !== existingOrder.refNumber) {
        try {
          // Format the new name (consistent with your creation logic: replacing / with -)
          const newFolderName = updateData.refNumber.replace(/\//g, '-').trim();

          console.log(`Renaming OneDrive folder from ${existingOrder.refNumber} to ${newFolderName}`);

          const renameRes = await axios.patch(
            `https://graph.microsoft.com/v1.0/users/${userId}/drive/items/${folderId}`,
            { name: newFolderName },
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );
          // IMPORTANT: Update the URL in our updateData object so it saves to MongoDB
          if (renameRes.data && renameRes.data.webUrl) {
            updateData.oneDriveFolderUrl = renameRes.data.webUrl;
            console.log("✅ New OneDrive URL captured:", updateData.oneDriveFolderUrl);
          }
          console.log("✅ OneDrive folder renamed successfully.");
        } catch (renameErr) {
          console.error("❌ Failed to rename OneDrive folder:", renameErr.response?.data || renameErr.message);
          // We continue anyway so the DB update doesn't fail
        }
      }

      // --- HANDLE ATTACHMENTS (DELETIONS & UPLOADS) ---
      if (attachments) {
        // 1. HANDLE DELETIONS
        const driveRes = await axios.get(
          `https://graph.microsoft.com/v1.0/users/${userId}/drive/items/${folderId}/children`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const currentOneDriveFiles = driveRes.data.value;

        const filesToDelete = currentOneDriveFiles.filter(item =>
          !attachments.some(a => a.name === item.name)
        );

        for (const file of filesToDelete) {
          await axios.delete(
            `https://graph.microsoft.com/v1.0/users/${userId}/drive/items/${file.id}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
        }

        // 2. HANDLE NEW UPLOADS
        const newUploads = attachments.filter(a => a.base64);
        if (newUploads.length > 0) {
          await uploadToOneDrive(token, userId, folderId, newUploads);
        }
      }
    }

    // 3. Update Database Record
    const updated = await OrderInquiry.findByIdAndUpdate(
      req.params.id,
      { ...updateData, updatedAt: Date.now() },
      { new: true }
    );

    res.json(updated);
  } catch (err) {
    console.error("Backend Error Order PATCH API:", err.message);
    res.status(400).json({ error: err.message });
  }
});


// POST new inquiry
router.post('/', async (req, res) => {
  try {
    const { title, clientName, orderPlacedBy, description, refNumber, attachments } = req.body;

    // Basic validation
    if (!clientName || !orderPlacedBy) {
      return res.status(400).json({ error: "Client Name and Contact Person are required." });
    }

    // 2. Clean attachments for MongoDB (remove heavy base64 strings)
    const cleanedAttachments = (attachments || []).map(file => ({
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified
      // base64 is NOT saved to the database here
    }));

    // Process OneDrive with the defined orderData
    const folderLink = await processOneDriveUploads(req.body, attachments);

    const newOrder = new OrderInquiry({
      title,
      clientName,
      orderPlacedBy,
      oneDriveFolderUrl: folderLink,
      description,
      refNumber,
      status: 'inquiry',
      attachments: cleanedAttachments
    });

    await newOrder.save();
    res.status(201).json(newOrder);
  } catch (err) {
    if (err.code === 11000) {
      res.status(400).json({ error: "Reference number already exists." });
    } else {
      console.error("Post Error:", err.message);
      res.status(500).json({ error: err.message });
    }
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const order = await OrderInquiry.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const userId = process.env.MICROSOFT_USER_ID;

    // Use the same logic as creation to find the folder
    if (order.clientName && order.refNumber) {
      try {
        const token = await getAccessToken();

        // 1. Reconstruct the EXACT path used in processOneDriveUploads
        const rootFolderName = "Orders";
        const clientFolder = (order.clientName || "Unknown Client").trim();

        // We need the FY and Contact to match the creation path
        // If your schema doesn't store 'completedAt' yet for inquiries, 
        // we use the 'updatedAt' or creation date.
        const orderDate = order.createdAt || order.updatedAt || new Date();
        const dateObj = new Date(orderDate);
        const month = dateObj.getMonth() + 1;
        const year = dateObj.getFullYear();
        const fyFolder = month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;

        const contactFolder = (order.orderPlacedBy || "General").trim();
        const refFolder = order.refNumber.replace(/\//g, '-').trim();

        // 2. Build the full path
        // Note: We encode each segment individually to handle spaces/special characters
        const fullPath = `${rootFolderName}/${clientFolder}/${fyFolder}/${contactFolder}/${refFolder}`;
        const encodedPath = fullPath.split('/').map(segment => encodeURIComponent(segment)).join('/');

        console.log(`Attempting to delete OneDrive folder at: /${fullPath}`);

        // 3. Execute Delete
        await axios.delete(
          `https://graph.microsoft.com/v1.0/users/${userId}/drive/root:/${encodedPath}`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        console.log("✅ OneDrive folder deleted successfully.");

      } catch (oneDriveErr) {
        // If the folder was already deleted or moved (404), we just log it and move on
        if (oneDriveErr.response?.status === 404) {
          console.warn("⚠️ OneDrive folder not found, skipping drive deletion.");
        } else {
          console.error("❌ OneDrive Deletion Error:", oneDriveErr.response?.data || oneDriveErr.message);
        }
      }
    }

    // 4. Always delete from MongoDB regardless of OneDrive outcome
    await OrderInquiry.findByIdAndDelete(req.params.id);
    res.json({ message: "Order removed from database and OneDrive" });

  } catch (err) {
    console.error("Route Error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;