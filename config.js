/**
 * Centralized Configuration
 * All API keys, URLs, and secrets in one place
 */

const CONFIG = {
  // Supabase
  supabase: {
    url: "https://lcobawmkywtxhpezndsh.supabase.co",
    anonKey:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxjb2Jhd21reXd0eGhwZXpuZHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4OTA5ODMsImV4cCI6MjA5MTQ2Njk4M30.4BNmxnfixXdHOq0ovtaF_4wQZ9sap3IWbJNJK9H4Mg4",
    edgeUrl:
      "https://lcobawmkywtxhpezndsh.supabase.co/functions/v1/wedding-admin",
    paymentUrl:
      "https://lcobawmkywtxhpezndsh.supabase.co/functions/v1/payment-handler",
    storageUrl:
      "https://lcobawmkywtxhpezndsh.supabase.co/storage/v1/object/public/wedding-images",
  },

  // Cloudflare Workers
  cloudflare: {
    imageProxy: "https://wedding-image-proxy.cuoixinh-api.workers.dev",
    templatesCache: "https://templates-cache.cuoixinh-api.workers.dev",
    cacheProxy: "https://wedding-cache-proxy.cuoixinh-api.workers.dev",
    purgeSecret: "9JMoLdvCWhD2W0CGJpsiq+7n/xESNgq6m91bm70cDkg=",
  },

  // Encryption & Security
  security: {
    encryptionKey: "dqvinh",
  },

  // Polling & Timeouts
  polling: {
    interval: 30000, // 30 seconds
    timeout: 300000, // 5 minutes
  },
};
