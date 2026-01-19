<template>
  <div class="container mx-auto px-4 py-8 max-w-7xl">
    <div class="mb-8">
      <h1 class="text-4xl font-bold text-gray-900 mb-2">SEO Dashboard</h1>
      <p class="text-gray-600">Manage your site's search engine optimization with Google Search Console</p>
    </div>

    <!-- Connection Status -->
    <div class="bg-white rounded-lg shadow-sm border border-pink-200 p-6 mb-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl font-semibold text-gray-900 mb-2">Google Search Console Connection</h2>
          <p class="text-gray-600 text-sm">
            <span v-if="isConnected" class="text-green-600 font-medium">✓ Connected</span>
            <span v-else class="text-gray-500">Not connected</span>
          </p>
        </div>
        <button
          v-if="!isConnected"
          @click="connectSearchConsole"
          class="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors"
        >
          Connect Search Console
        </button>
        <button
          v-else
          @click="disconnectSearchConsole"
          class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
        >
          Disconnect
        </button>
      </div>
    </div>

    <!-- Site Verification -->
    <div class="bg-white rounded-lg shadow-sm border border-pink-200 p-6 mb-6">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">Site Verification</h2>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Verify your website</label>
          <div class="flex gap-4">
            <input
              v-model="siteUrl"
              type="text"
              placeholder="https://fashion-rec.com"
              class="flex-1 px-4 py-2 border border-pink-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            />
            <button
              @click="verifySite"
              :disabled="isVerifying"
              class="px-6 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50"
            >
              {{ isVerifying ? 'Verifying...' : 'Verify' }}
            </button>
          </div>
        </div>
        <div v-if="verificationStatus" class="p-4 rounded-lg" :class="verificationStatus.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'">
          {{ verificationStatus.message }}
        </div>
      </div>
    </div>

    <!-- Sitemap Submission -->
    <div class="bg-white rounded-lg shadow-sm border border-pink-200 p-6 mb-6">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">Sitemap Submission</h2>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Submit sitemap to Google</label>
          <div class="flex gap-4">
            <input
              v-model="sitemapUrl"
              type="text"
              placeholder="https://fashion-rec.com/sitemap.xml"
              class="flex-1 px-4 py-2 border border-pink-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            />
            <button
              @click="submitSitemap"
              :disabled="isSubmittingSitemap"
              class="px-6 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50"
            >
              {{ isSubmittingSitemap ? 'Submitting...' : 'Submit' }}
            </button>
          </div>
        </div>
        <div v-if="sitemapStatus" class="p-4 rounded-lg" :class="sitemapStatus.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'">
          {{ sitemapStatus.message }}
        </div>
      </div>
    </div>

    <!-- URL Inspection Tool -->
    <div class="bg-white rounded-lg shadow-sm border border-pink-200 p-6 mb-6">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">URL Inspection Tool</h2>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Check URL indexing status</label>
          <div class="flex gap-4">
            <input
              v-model="inspectionUrl"
              type="text"
              placeholder="https://fashion-rec.com/blog/example"
              class="flex-1 px-4 py-2 border border-pink-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            />
            <button
              @click="inspectUrl"
              :disabled="isInspecting"
              class="px-6 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50"
            >
              {{ isInspecting ? 'Checking...' : 'Inspect' }}
            </button>
          </div>
        </div>
        <div v-if="inspectionResult" class="p-4 bg-gray-50 rounded-lg">
          <h3 class="font-semibold text-gray-900 mb-2">Inspection Result</h3>
          <div class="space-y-2 text-sm">
            <div>
              <span class="font-medium">Indexing Status:</span>
              <span :class="inspectionResult.indexingStatus === 'INDEXED' ? 'text-green-600' : 'text-yellow-600'">
                {{ inspectionResult.indexingStatus || 'Unknown' }}
              </span>
            </div>
            <div v-if="inspectionResult.lastCrawlTime">
              <span class="font-medium">Last Crawl:</span>
              <span class="text-gray-600">{{ new Date(inspectionResult.lastCrawlTime).toLocaleString() }}</span>
            </div>
            <div v-if="inspectionResult.errors && inspectionResult.errors.length > 0">
              <span class="font-medium text-red-600">Errors:</span>
              <ul class="list-disc list-inside text-red-600">
                <li v-for="error in inspectionResult.errors" :key="error">{{ error }}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Video Analytics Reports -->
    <div v-if="isConnected" class="bg-white rounded-lg shadow-sm border border-pink-200 p-6 mb-6">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">Video Search Performance</h2>
      <div class="space-y-4">
        <div class="flex gap-4 items-end">
          <div class="flex-1">
            <label class="block text-sm font-medium text-gray-700 mb-2">Date Range (Video Analytics)</label>
            <div class="flex gap-2">
              <input
                v-model="videoDateRange.start"
                type="date"
                class="px-4 py-2 border border-pink-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
              <span class="self-center text-gray-500">to</span>
              <input
                v-model="videoDateRange.end"
                type="date"
                class="px-4 py-2 border border-pink-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>
          </div>
          <button
            @click="loadVideoAnalytics"
            :disabled="isLoadingVideoAnalytics"
            class="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {{ isLoadingVideoAnalytics ? 'Loading...' : 'Load Video Report' }}
          </button>
        </div>

        <div v-if="videoAnalyticsData" class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div class="p-4 bg-purple-50 rounded-lg">
            <div class="text-sm text-gray-600 mb-1">Video Clicks</div>
            <div class="text-2xl font-bold text-purple-600">{{ videoAnalyticsData.video_search?.clicks || 0 }}</div>
          </div>
          <div class="p-4 bg-indigo-50 rounded-lg">
            <div class="text-sm text-gray-600 mb-1">Video Impressions</div>
            <div class="text-2xl font-bold text-indigo-600">{{ videoAnalyticsData.video_search?.impressions || 0 }}</div>
          </div>
          <div class="p-4 bg-pink-50 rounded-lg">
            <div class="text-sm text-gray-600 mb-1">Video CTR</div>
            <div class="text-2xl font-bold text-pink-600">{{ videoAnalyticsData.video_search?.ctr ? (videoAnalyticsData.video_search.ctr * 100).toFixed(2) + '%' : '0%' }}</div>
          </div>
        </div>

        <div v-if="videoAnalyticsData && videoAnalyticsData.video_search?.queries?.length > 0" class="mt-6">
          <h3 class="font-semibold text-gray-900 mb-3">Video Search Queries</h3>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Query</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clicks</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Impressions</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CTR</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="query in videoAnalyticsData.video_search.queries.slice(0, 10)" :key="query.query">
                  <td class="px-4 py-3 text-sm text-gray-900">{{ query.query }}</td>
                  <td class="px-4 py-3 text-sm text-gray-600">{{ query.clicks }}</td>
                  <td class="px-4 py-3 text-sm text-gray-600">{{ query.impressions }}</td>
                  <td class="px-4 py-3 text-sm text-gray-600">{{ (query.ctr * 100).toFixed(2) }}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="videoAnalyticsData && videoAnalyticsData.potential_video_pages?.length > 0" class="mt-6">
          <h3 class="font-semibold text-gray-900 mb-3">Potential Video Pages</h3>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Page</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clicks</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Impressions</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CTR</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="page in videoAnalyticsData.potential_video_pages.slice(0, 10)" :key="page.page">
                  <td class="px-4 py-3 text-sm text-gray-900 max-w-xs truncate" :title="page.page">{{ page.page }}</td>
                  <td class="px-4 py-3 text-sm text-gray-600">{{ page.clicks }}</td>
                  <td class="px-4 py-3 text-sm text-gray-600">{{ page.impressions }}</td>
                  <td class="px-4 py-3 text-sm text-gray-600">{{ (page.ctr * 100).toFixed(2) }}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Analytics Reports -->
    <div class="bg-white rounded-lg shadow-sm border border-pink-200 p-6 mb-6">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">General Search Performance</h2>
      <div class="space-y-4">
        <div class="flex gap-4 items-end">
          <div class="flex-1">
            <label class="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
            <div class="flex gap-2">
              <input
                v-model="dateRange.start"
                type="date"
                class="px-4 py-2 border border-pink-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
              <span class="self-center text-gray-500">to</span>
              <input
                v-model="dateRange.end"
                type="date"
                class="px-4 py-2 border border-pink-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>
          </div>
          <button
            @click="loadAnalytics"
            :disabled="isLoadingAnalytics"
            class="px-6 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50"
          >
            {{ isLoadingAnalytics ? 'Loading...' : 'Load Report' }}
          </button>
        </div>

        <div v-if="analyticsData" class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div class="p-4 bg-pink-50 rounded-lg">
            <div class="text-sm text-gray-600 mb-1">Total Clicks</div>
            <div class="text-2xl font-bold text-pink-600">{{ analyticsData.clicks || 0 }}</div>
          </div>
          <div class="p-4 bg-purple-50 rounded-lg">
            <div class="text-sm text-gray-600 mb-1">Total Impressions</div>
            <div class="text-2xl font-bold text-purple-600">{{ analyticsData.impressions || 0 }}</div>
          </div>
          <div class="p-4 bg-blue-50 rounded-lg">
            <div class="text-sm text-gray-600 mb-1">Average CTR</div>
            <div class="text-2xl font-bold text-blue-600">{{ analyticsData.ctr ? (analyticsData.ctr * 100).toFixed(2) + '%' : '0%' }}</div>
          </div>
        </div>

        <div v-if="analyticsData && analyticsData.topQueries && analyticsData.topQueries.length > 0" class="mt-6">
          <h3 class="font-semibold text-gray-900 mb-3">Top Queries</h3>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Query</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clicks</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Impressions</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CTR</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="query in analyticsData.topQueries" :key="query.query">
                  <td class="px-4 py-3 text-sm text-gray-900">{{ query.query }}</td>
                  <td class="px-4 py-3 text-sm text-gray-600">{{ query.clicks }}</td>
                  <td class="px-4 py-3 text-sm text-gray-600">{{ query.impressions }}</td>
                  <td class="px-4 py-3 text-sm text-gray-600">{{ (query.ctr * 100).toFixed(2) }}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Video SEO Monitoring -->
    <div class="bg-white rounded-lg shadow-sm border border-pink-200 p-6 mb-6">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">Video SEO Performance</h2>
      <div class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="p-4 bg-green-50 rounded-lg">
            <div class="text-sm text-gray-600 mb-1">Video Sitemap Status</div>
            <div class="text-lg font-bold text-green-600">
              <a href="/video-sitemap.xml" target="_blank" class="hover:underline">
                ✅ Available
              </a>
            </div>
            <div class="text-xs text-gray-500 mt-1">
              Auto-generated from blog posts with videos
            </div>
          </div>
          <div class="p-4 bg-blue-50 rounded-lg">
            <div class="text-sm text-gray-600 mb-1">Video Structured Data</div>
            <div class="text-lg font-bold text-blue-600">✅ Implemented</div>
            <div class="text-xs text-gray-500 mt-1">
              VideoObject schema in blog posts
            </div>
          </div>
        </div>

        <div class="mt-6">
          <h3 class="font-semibold text-gray-900 mb-3">Video SEO Checklist</h3>
          <div class="space-y-3">
            <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div class="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                </svg>
              </div>
              <div class="flex-1">
                <div class="font-medium text-gray-900">Video Sitemap</div>
                <div class="text-sm text-gray-600">Dedicated video sitemap submitted to Google</div>
              </div>
            </div>

            <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div class="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                </svg>
              </div>
              <div class="flex-1">
                <div class="font-medium text-gray-900">Structured Data</div>
                <div class="text-sm text-gray-600">VideoObject schema markup implemented</div>
              </div>
            </div>

            <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div class="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                </svg>
              </div>
              <div class="flex-1">
                <div class="font-medium text-gray-900">Video Thumbnails</div>
                <div class="text-sm text-gray-600">High-quality thumbnails provided for videos</div>
              </div>
            </div>

            <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div class="w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center">
                <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                </svg>
              </div>
              <div class="flex-1">
                <div class="font-medium text-gray-900">Video Analytics</div>
                <div class="text-sm text-gray-600">Monitor video performance in Search Console (coming soon)</div>
              </div>
            </div>

            <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div class="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                </svg>
              </div>
              <div class="flex-1">
                <div class="font-medium text-gray-900">Supported Formats</div>
                <div class="text-sm text-gray-600">Videos use supported formats (MP4, WebM, etc.)</div>
              </div>
            </div>

            <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div class="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                </svg>
              </div>
              <div class="flex-1">
                <div class="font-medium text-gray-900">Large Image Preview</div>
                <div class="text-sm text-gray-600">max-image-preview:large meta tag for Google Explore</div>
              </div>
            </div>

            <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div class="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                </svg>
              </div>
              <div class="flex-1">
                <div class="font-medium text-gray-900">Core Web Vitals</div>
                <div class="text-sm text-gray-600">Optimized build config, lazy loading, and font preconnect</div>
              </div>
            </div>

            <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div class="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                </svg>
              </div>
              <div class="flex-1">
                <div class="font-medium text-gray-900">Mobile Friendly</div>
                <div class="text-sm text-gray-600">Responsive viewport, Tailwind responsive classes, touch-friendly UI</div>
              </div>
            </div>

            <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div class="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                </svg>
              </div>
              <div class="flex-1">
                <div class="font-medium text-gray-900">Content Structure</div>
                <div class="text-sm text-gray-600">Semantic HTML, proper heading hierarchy, and structured content</div>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 class="font-semibold text-blue-900 mb-2">SEO Tips</h4>
          <ul class="text-sm text-blue-800 space-y-1">
            <li>• Videos appear in Google Search, Video tab, and Google Discover</li>
            <li>• Structured data helps Google understand your content</li>
            <li>• High-quality thumbnails improve click-through rates</li>
            <li>• Large image previews in Google Explore boost engagement</li>
            <li>• Monitor performance in Search Console regularly</li>
            <li>• Use descriptive titles and descriptions for all content</li>
          </ul>
        </div>

        <div class="mt-6 p-4 bg-yellow-50 rounded-lg">
          <h4 class="font-semibold text-yellow-900 mb-2">🔄 Weekly SEO Monitoring Checklist</h4>
          <ul class="text-sm text-yellow-800 space-y-2">
            <li class="flex items-start gap-2">
              <span class="text-yellow-600 mt-1">📊</span>
              <span><strong>Search Console Coverage:</strong> Check for new crawl errors and indexing issues</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-yellow-600 mt-1">📈</span>
              <span><strong>Performance Report:</strong> Monitor clicks, impressions, and CTR trends</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-yellow-600 mt-1">🔍</span>
              <span><strong>Rich Results:</strong> Verify structured data is working in search results</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-yellow-600 mt-1">📱</span>
              <span><strong>Mobile Usability:</strong> Ensure all pages work well on mobile devices</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-yellow-600 mt-1">⚡</span>
              <span><strong>Core Web Vitals:</strong> Check PageSpeed Insights for performance issues</span>
            </li>
          </ul>
          <div class="mt-3 text-xs text-yellow-700">
            💡 <strong>Pro Tip:</strong> Set up weekly reminders to review these metrics. Small issues caught early prevent big problems.
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { apiClient } from '../lib/api-client'
import { useAuthStore } from '../stores/auth'

defineOptions({ name: 'SEODashboard' })

const authStore = useAuthStore()

const isConnected = ref(false)
const isVerifying = ref(false)
const isSubmittingSitemap = ref(false)
const isInspecting = ref(false)
const isLoadingAnalytics = ref(false)
const isLoadingVideoAnalytics = ref(false)

const siteUrl = ref('https://fashion-rec.com')
const sitemapUrl = ref('https://fashion-rec.com/sitemap.xml')
const inspectionUrl = ref('')

const verificationStatus = ref<{ success: boolean; message: string } | null>(null)
const sitemapStatus = ref<{ success: boolean; message: string } | null>(null)
const inspectionResult = ref<any>(null)
const analyticsData = ref<any>(null)
const videoAnalyticsData = ref<any>(null)

const dateRange = ref({
  start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  end: new Date().toISOString().split('T')[0],
})
const videoDateRange = ref({
  start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  end: new Date().toISOString().split('T')[0],
})

const connectSearchConsole = async () => {
  try {
    // Redirect to OAuth flow
    const response = await apiClient.get('/seo/search-console/connect')
    if (response.data.authUrl) {
      window.location.href = response.data.authUrl
    }
  } catch (error: any) {
    console.error('Failed to connect:', error)
    alert(error?.response?.data?.error || 'Failed to connect to Google Search Console')
  }
}

const disconnectSearchConsole = async () => {
  try {
    await apiClient.post('/seo/search-console/disconnect')
    isConnected.value = false
    alert('Disconnected from Google Search Console')
  } catch (error: any) {
    console.error('Failed to disconnect:', error)
    alert(error?.response?.data?.error || 'Failed to disconnect')
  }
}

const verifySite = async () => {
  isVerifying.value = true
  verificationStatus.value = null
  try {
    const response = await apiClient.post('/seo/verify-site', { siteUrl: siteUrl.value })
    verificationStatus.value = {
      success: response.data.verified,
      message: response.data.message || (response.data.verified ? 'Site verified successfully' : 'Site verification failed'),
    }
  } catch (error: any) {
    verificationStatus.value = {
      success: false,
      message: error?.response?.data?.error || 'Verification failed',
    }
  } finally {
    isVerifying.value = false
  }
}

const submitSitemap = async () => {
  isSubmittingSitemap.value = true
  sitemapStatus.value = null
  try {
    const response = await apiClient.post('/seo/submit-sitemap', { sitemapUrl: sitemapUrl.value })
    sitemapStatus.value = {
      success: response.data.success,
      message: response.data.message || (response.data.success ? 'Sitemap submitted successfully' : 'Sitemap submission failed'),
    }
  } catch (error: any) {
    sitemapStatus.value = {
      success: false,
      message: error?.response?.data?.error || 'Sitemap submission failed',
    }
  } finally {
    isSubmittingSitemap.value = false
  }
}

const inspectUrl = async () => {
  isInspecting.value = true
  inspectionResult.value = null
  try {
    const response = await apiClient.post('/seo/inspect-url', { url: inspectionUrl.value })
    inspectionResult.value = response.data
  } catch (error: any) {
    inspectionResult.value = {
      indexingStatus: 'ERROR',
      errors: [error?.response?.data?.error || 'Inspection failed'],
    }
  } finally {
    isInspecting.value = false
  }
}

const loadVideoAnalytics = async () => {
  isLoadingVideoAnalytics.value = true
  videoAnalyticsData.value = null
  try {
    const response = await apiClient.get('/seo/video-analytics', {
      params: {
        startDate: videoDateRange.value.start,
        endDate: videoDateRange.value.end,
      },
    })
    videoAnalyticsData.value = response.data
  } catch (error: any) {
    console.error('Failed to load video analytics:', error)
    alert(error?.response?.data?.error || 'Failed to load video analytics data')
  } finally {
    isLoadingVideoAnalytics.value = false
  }
}

const loadAnalytics = async () => {
  isLoadingAnalytics.value = true
  analyticsData.value = null
  try {
    const response = await apiClient.get('/seo/analytics', {
      params: {
        startDate: dateRange.value.start,
        endDate: dateRange.value.end,
      },
    })
    analyticsData.value = response.data
  } catch (error: any) {
    console.error('Failed to load analytics:', error)
    alert(error?.response?.data?.error || 'Failed to load analytics data')
  } finally {
    isLoadingAnalytics.value = false
  }
}

const checkConnectionStatus = async () => {
  try {
    const response = await apiClient.get('/seo/search-console/status')
    isConnected.value = response.data.connected || false
  } catch (error) {
    console.error('Failed to check connection status:', error)
    isConnected.value = false
  }
}

onMounted(() => {
  checkConnectionStatus()
})
</script>
