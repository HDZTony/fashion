/**
 * Unified API Configuration
 * 
 * This file provides a single source of truth for API URLs across the application.
 * 
 * Environment Variables:
 * - VITE_API_URL: Backend API URL
 *   - Development: http://127.0.0.1:8787 (local Cloudflare Router via wrangler dev)
 *   - Production: https://fashion.hdz73.com (production Cloudflare Router)
 * - VITE_SUBSCRIPTION_API_URL: Subscription service API URL (defaults to http://localhost:3001)
 * 
 * Usage:
 *   import { API_URL, SUBSCRIPTION_API_URL } from '@/config/api'
 */

/**
 * Backend API URL
 * - Development: http://127.0.0.1:8787 (local Cloudflare Router via wrangler dev)
 * - Production: https://fashion.hdz73.com (production Cloudflare Router)
 * - All environments use Cloudflare Router for consistency (no direct backend connection)
 * - Default fallback: http://127.0.0.1:8787 (local development)
 * 
 * IMPORTANT: In local development, this MUST point to cloudflare-router (port 8787).
 * The router handles version routing to appropriate backend versions.
 */
// Force use cloudflare-router in development
const envApiUrl = import.meta.env.VITE_API_URL
const isProdMode = import.meta.env.PROD || import.meta.env.MODE === 'production'
const defaultDevUrl = 'http://127.0.0.1:8787'
const defaultProdUrl = 'https://fashion.hdz73.com'

export const API_URL = (() => {
  // In production, use env or production default
  if (isProdMode) {
    return envApiUrl || defaultProdUrl
  }
  
  // In development:
  // - If env is explicitly set to cloudflare-router or production URL, use it
  // - Otherwise use default cloudflare-router URL
  if (envApiUrl && (envApiUrl.includes('8787') || envApiUrl.includes('hdz73.com'))) {
    return envApiUrl
  }
  
  // Force use cloudflare-router for development
  return defaultDevUrl
})()


/**
 * Subscription Service API URL
 * 
 * IMPORTANT: Subscription requests should go through Cloudflare Router for version routing.
 * - Development: Use API_URL (goes through local Cloudflare Router)
 * - Production: Use API_URL (goes through production Cloudflare Router)
 * 
 * The Router will automatically route subscription requests to the correct version:
 * - v2 users → V2_SUBSCRIPTION_SERVICE_URL
 * - stable users → STABLE_SUBSCRIPTION_SERVICE_URL
 * 
 * Direct subscription service URL (only for testing/debugging):
 * - Development: http://localhost:3001
 * - Production: https://fashion-rec-subscription-service.954504788.workers.dev
 */
export const SUBSCRIPTION_API_URL = import.meta.env.VITE_SUBSCRIPTION_API_URL || API_URL

/**
 * Check if running in development mode
 */
export const isDevelopment = import.meta.env.DEV

/**
 * Check if running in production mode
 */
export const isProduction = import.meta.env.PROD

