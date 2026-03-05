Part 1: Azure Portal (for Outlook Invoice Sync)

This process allows your server to read emails from info@marqland.com (and others) using the Microsoft Graph API.

1. App Registration

Go to Azure Portal and sign in.

Search for App Registrations and click New Registration.

Name: BizManager-InvoiceSync

Supported account types: Select "Accounts in this organizational directory only" (Single Tenant).

Click Register.

2. Get Your IDs

Once registered, copy these values immediately to your .env file:

Application (client) ID → OUTLOOK_CLIENT_ID

Directory (tenant) ID → OUTLOOK_TENANT_ID

3. Generate Secret

In the left menu, click Certificates & secrets.

Click New client secret.

Set description to "ServerSecret" and expiry to 2 years.

IMPORTANT: Copy the Value (not the ID). This is your OUTLOOK_CLIENT_SECRET. It disappears forever once you refresh the page.

4. Set Permissions (For marqland.com Domain)

Click API Permissions -> Add a permission.

Select Microsoft Graph -> Application permissions.

Search for and check: Mail.Read

Click Add permissions.

CRITICAL STEP: Click the button "Grant admin consent for Marqland" next to the Add button. (Status should turn green).

Part 2: WhatsApp Cloud API (for Webhook & Notifications)

1. Meta for Developers

Go to Meta for Developers.

Create an App -> Select Other -> Select Business as the app type.

Give it a name (e.g., MarqlandBizManager).

2. Setup WhatsApp

In the App Dashboard, find "WhatsApp" and click Set up.

Go to API Setup in the left menu.

Here you will find:

Temporary Access Token (This expires in 24 hours. You must eventually generate a Permanent Token via Business Settings -> System Users).

Phone Number ID → WHATSAPP_PHONE_NUMBER_ID

WhatsApp Business Account ID.

3. Webhook Configuration (For Receiving Invoices)

In the left menu under WhatsApp, click Configuration.

Callback URL: https://your-public-url.com/api/invoices/webhook

Note: Since your server is local, you need a tool like ngrok to provide a public URL for Meta to reach you.

Verify Token: Create a random string (e.g., my_secret_token_123) and put it in your .env as WHATSAPP_VERIFY_TOKEN.

Click Verify and Save.

Under Webhook Fields, click Manage and subscribe to messages.

Your Final .env Requirements

Update your .env file with these new values:

# MONGODB
MONGODB_URI=mongodb://localhost:27017/bizmanager

# GEMINI
GEMINI_API_KEY=your_gemini_key

# AZURE / OUTLOOK
OUTLOOK_TENANT_ID=xxxx-xxxx-xxxx
OUTLOOK_CLIENT_ID=xxxx-xxxx-xxxx
OUTLOOK_CLIENT_SECRET=xxxx-xxxx-xxxx
OUTLOOK_USER_ID=info@marqland.com

# WHATSAPP
WHATSAPP_TOKEN=your_permanent_meta_token
WHATSAPP_PHONE_NUMBER_ID=xxxxxxxxxxxx
WHATSAPP_VERIFY_TOKEN=my_secret_token_123
WHATSAPP_RECIPIENT_PHONE=919876543210
