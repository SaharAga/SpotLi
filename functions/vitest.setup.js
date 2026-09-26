// Deterministic test key for tokenCipher.js (32 zero bytes, base64). Real
// deployments read GMAIL_TOKEN_KEY from Secret Manager.
process.env.GMAIL_TOKEN_KEY = process.env.GMAIL_TOKEN_KEY || Buffer.alloc(32).toString('base64');
