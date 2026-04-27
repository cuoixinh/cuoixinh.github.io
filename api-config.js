/**
 * API Config - Trỏ tất cả request qua Cloudflare Worker
 *
 * Sau khi deploy worker, thay WORKER_URL bằng URL thật:
 * https://wedding-cache-proxy.YOUR_SUBDOMAIN.workers.dev
 *
 * Nếu chưa setup worker, để WORKER_URL = null để fallback về Supabase trực tiếp
 */

const WORKER_URL = null; // TODO: thay bằng URL worker sau khi deploy

const SUPABASE_EDGE_URL =
  "https://lcobawmkywtxhpezndsh.supabase.co/functions/v1/wedding-admin";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxjb2Jhd21reXd0eGhwZXpuZHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4OTA5ODMsImV4cCI6MjA5MTQ2Njk4M30.4BNmxnfixXdHOq0ovtaF_4wQZ9sap3IWbJNJK9H4Mg4";

/**
 * URL gốc để gọi API - tự động chọn Worker hoặc Supabase
 */
const API_BASE = WORKER_URL || SUPABASE_EDGE_URL;

/**
 * Headers mặc định cho mọi request
 */
const DEFAULT_HEADERS = {
  Authorization: `Bearer ${ANON_KEY}`,
  "Content-Type": "application/json",
};

/**
 * Wrapper fetch dùng chung - tự động dùng Worker nếu có
 */
async function apiFetch(params = {}, options = {}) {
  const url = new URL(API_BASE);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });

  const res = await fetch(url.toString(), {
    headers: DEFAULT_HEADERS,
    ...options,
  });

  return res;
}
