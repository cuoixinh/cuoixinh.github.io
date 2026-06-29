# Sensitive Keys — KHÔNG commit file này

File này được git-ignore. Khi setup môi trường mới, copy các giá trị dưới vào `core/config.js`.

## Supabase

| Key | Value |
|-----|-------|
| `supabase.url` | `https://lcobawmkywtxhpezndsh.supabase.co` |
| `supabase.anonKey` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxjb2Jhd21reXd0eGhwZXpuZHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4OTA5ODMsImV4cCI6MjA5MTQ2Njk4M30.4BNmxnfixXdHOq0ovtaF_4wQZ9sap3IWbJNJK9H4Mg4` |

## Cloudflare

| Key | Value |
|-----|-------|
| `cloudflare.purgeSecret` | `9JMoLdvCWhD2W0CGJpsiq+7n/xESNgq6m91bm70cDkg=` |

## Encryption

| Key | Value |
|-----|-------|
| `security.encryptionKey` | `dqvinh` |

## Supabase Edge Function Secrets (set qua Dashboard → Edge Functions → Secrets)

| Secret name | Value |
|-------------|-------|
| `SUPABASE_URL` | auto-injected |
| `SUPABASE_SERVICE_ROLE_KEY` | set trong Supabase Dashboard |
| `ADMIN_SECRET_TOKEN` | token dùng để xác thực admin calls |
