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
 */
export const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8787'

/**
 * Subscription Service API URL
 * - Development: http://localhost:3001
 * - Production: https://fashion-rec-subscription-service.954504788.workers.dev
 */
export const SUBSCRIPTION_API_URL = import.meta.env.VITE_SUBSCRIPTION_API_URL || 'http://localhost:3001'

/**
 * Check if running in development mode
 */
export const isDevelopment = import.meta.env.DEV

/**
 * Check if running in production mode
 */
export const isProduction = import.meta.env.PROD

