<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { useRouter } from 'vue-router'
import { computed, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useHead } from '@vueuse/head'
import { useSEO } from '@/composables/useSEO'
import { siteBaseUrl } from '@/config/seo'
import axios from 'axios'
import { supabase } from '@/lib/supabase'
import { API_URL } from '@/config/api'

defineOptions({ name: 'Home' })

const router = useRouter()

const authStore = useAuthStore()
const isAuthenticated = computed(() => authStore.isAuthenticated)
const isSettingVersion = ref(false)

// Set user version when entering studio
const setUserVersion = async (version: 'stable' | 'v2' = 'v2') => {
  try {
    // First, try to get session from Supabase (primary source)
    const { data: { session } } = await supabase.auth.getSession()
    let token = session?.access_token
    
    // Fallback: if Supabase session is not available, try localStorage
    if (!token) {
      const backupToken = localStorage.getItem('auth_token')
      if (backupToken) {
        token = backupToken
        console.log('[Home] Using backup token from localStorage for setUserVersion')
      }
    }
    
    if (!token) {
      console.warn('[Home] No auth token available for setUserVersion')
      return false
    }

    const response = await axios.post(
      `${API_URL}/api/router/set-version`,
      { version },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        withCredentials: true, // Include cookies
      }
    )

    return response.data.success === true
  } catch (error) {
    console.error('Failed to set user version:', error)
    return false
  }
}

const handleGetStarted = async () => {
  if (isAuthenticated.value) {
    // Set user version to v2 when entering studio (lazy routing)
    // This ensures the user is assigned a version and cached in KV
    isSettingVersion.value = true
    try {
      // Set version to v2 (or 'stable' if you prefer)
      // The version will be cached in KV, so subsequent requests won't query database
      await setUserVersion('v2')
    } catch (error) {
      console.warn('Failed to set user version, continuing anyway:', error)
    } finally {
      isSettingVersion.value = false
    }
    router.push('/studio')
  } else {
    router.push('/login')
  }
}

const buttonText = computed(() => {
  return isAuthenticated.value ? 'Enter Studio' : 'Start for Free'
})

// FAQ data
const faqs = [
  {
    question: 'What is the difference between Fashion Rec and the many similar services already available in the market?',
    answer: '1. Fashion Rec is a service designed for individual users. 2. It features a smart wardrobe for convenient personal clothing management. 3. It is affordable, and free users can also enjoy full functionality.'
  },
  {
    question: 'How do I use the AI virtual try-on?',
    answer: 'Upload your photo and the garments you want to try. Our AI will generate the try-on results automatically. You can start in the Studio page.'
  },
  {
    question: "If I don't plan to pay, is this website useless to me?",
    answer: "Absolutely not. We believe people will always pay for quality service. Even if you subscribe to the free plan, you can still enjoy all core features."
  },
  {
    question: 'What is the difference between Free and Premium?',
    answer: 'The Free plan offers 2 try-on per day with core features and history saving. Premium includes more try-ons and advanced features.'
  },
  {
    question: 'Is my data safe?',
    answer: 'We take privacy and security seriously. All uploaded photos and data are stored with encryption and never shared with third parties.'
  },
  {
    question: 'Which image formats are supported?',
    answer: 'JPG, PNG, WEBP and other common formats are supported. Clear portrait photos provide the best results.'
  },
  {
    question: 'How do I manage my wardrobe?',
    answer: 'After signing in, go to “My Wardrobe” to add, edit, or delete items.'
  }
]

useSEO({
  title: 'Fashion Rec | Virtual Try-On & Smart Outfit Recommendations',
  description: 'Build your AI-powered wardrobe, try on outfits virtually, and get personalized recommendations instantly.',
  path: '/',
  image: `${siteBaseUrl}/images/brand/hdz.png`,
})

const faqSchema = computed(() => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
}))

const faqJsonLd = computed(() => JSON.stringify(faqSchema.value))

useHead({
  script: [
    {
      type: 'application/ld+json',
      children: faqJsonLd.value,
    },
  ],
})
</script>

<template>
  <div class="min-h-screen bg-white">
    <!-- Main Content -->
    <main class="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <!-- Hero Section -->
      <header class="text-center py-20" aria-label="Hero section">
        <h1 class="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
          Your Style, Reimagined
        </h1>
        <p class="mt-6 text-lg leading-8 text-gray-600 max-w-2xl mx-auto">
          AI-powered virtual try-on and personalized outfit recommendations. Discover your perfect look instantly with Fashion Rec.
        </p>
        <div class="mt-10 flex items-center justify-center gap-x-6">
          <Button
            @click="handleGetStarted"
            variant="default"
            :disabled="isSettingVersion"
            class="text-xl font-extrabold px-8 py-4 h-auto shadow-2xl hover:shadow-3xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Get started with Fashion Rec"
          >
            {{ isSettingVersion ? 'Setting up...' : buttonText }}
          </Button>
        </div>
      </header>

      <!-- Use Cases Section -->
      <section class="py-20 bg-gray-50">
        <div class="max-w-7xl mx-auto">
          <h2 class="text-3xl font-bold text-center mb-12 text-gray-900">Solve Your Fashion Challenges</h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <!-- Use Case 1: Avoid Duplicate Purchases -->
            <div class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              <div class="aspect-[5/8] bg-gray-100 flex items-center justify-center">
                <img
                  src="/images/use-cases/duplicate-clothes.png"
                  alt="Person organizing wardrobe to avoid duplicate purchases"
                  class="w-full h-full object-cover"
                />
              </div>
              <div class="p-6">
                <h3 class="text-xl font-semibold mb-3 text-gray-900">Avoid Duplicate Purchases</h3>
                <p class="text-gray-600">
                  Keep track of your wardrobe in one place. Our smart wardrobe management helps you remember what you own, preventing you from buying the same clothes twice.
                </p>
              </div>
            </div>

            <!-- Use Case 2: Preview Before Buying -->
            <div class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              <div class="aspect-[5/8] bg-gray-100 flex items-center justify-center">
                <img
                  src="/images/use-cases/online-preview.png"
                  alt="Person using phone to preview online clothes"
                  class="w-full h-full object-cover"
                />
              </div>
              <div class="p-6">
                <h3 class="text-xl font-semibold mb-3 text-gray-900">Preview Before Buying</h3>
                <p class="text-gray-600">
                  Unsure how that online purchase will look on you? Try it on virtually first. Our AI virtual try-on lets you see the fit and style before you buy.
                </p>
              </div>
            </div>

            <!-- Use Case 3: Daily Outfit Ideas -->
            <div class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              <div class="aspect-[5/8] bg-gray-100 flex items-center justify-center">
                <img
                  src="/images/use-cases/daily-outfit.png"
                  alt="Person deciding what to wear today"
                  class="w-full h-full object-cover"
                />
              </div>
              <div class="p-6">
                <h3 class="text-xl font-semibold mb-3 text-gray-900">Get Daily Outfit Ideas</h3>
                <p class="text-gray-600">
                  Not sure what to wear today? Get personalized outfit recommendations based on your wardrobe, style preferences, and the occasion.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Features Section (示例内容，可以后续扩展) -->
      <section class="py-20">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div class="text-center">
            <div class="mx-auto h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <svg class="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path>
              </svg>
            </div>
            <h3 class="text-xl font-semibold mb-2">Personalized Wardrobe</h3>
            <p class="text-gray-600">Manage your closet and keep your outfit history.</p>
          </div>
          <div class="text-center">
            <div class="mx-auto h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
              <svg class="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <h3 class="text-xl font-semibold mb-2">AI Virtual Try-On</h3>
            <p class="text-gray-600">Advanced AI lets you preview outfits effortlessly.</p>
          </div>
          <div class="text-center">
            <div class="mx-auto h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center mb-4">
              <svg class="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
              </svg>
            </div>
            <h3 class="text-xl font-semibold mb-2">Smart Recommendations</h3>
            <p class="text-gray-600">Get outfit picks tailored to your style and preferences.</p>
          </div>
        </div>
      </section>

    </main>

    <!-- FAQ Section -->
    <section class="bg-gray-50 py-20">
      <div class="container mx-auto px-4 sm:px-6 lg:px-8">
        <div class="max-w-3xl mx-auto">
          <h2 class="text-3xl font-bold text-center mb-12 text-gray-900">Frequently Asked Questions</h2>
          <Accordion type="single" collapsible class="w-full">
            <AccordionItem
              v-for="(faq, index) in faqs"
              :key="index"
              :value="`item-${index}`"
              class="border-b border-gray-200"
            >
              <AccordionTrigger class="text-left font-semibold text-gray-900 hover:no-underline py-4">
                {{ faq.question }}
              </AccordionTrigger>
              <AccordionContent class="text-gray-600 pb-4 pt-0">
                {{ faq.answer }}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </section>

    <!-- Social Media Section -->
    <footer class="bg-white border-t border-gray-200 py-12">
      <div class="container mx-auto px-4 sm:px-6 lg:px-8">
        <div class="max-w-4xl mx-auto">
          <h3 class="text-2xl font-bold text-center mb-8 text-gray-900">Follow Us</h3>
          <div class="flex justify-center items-center gap-6 flex-wrap">
            <!-- 社交媒体图标 - 使用SVG图标，您也可以替换为图片 -->
            <a
              href="https://x.com/hedongzhouu?s=21"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-900 hover:text-white transition-colors"
              aria-label="X"
            >
              <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            <a
              href="https://www.instagram.com/dongzhouhe?igsh=MXR5cmhpeHlzbHp6dw%3D%3D&utm_source=qr"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 hover:bg-pink-500 hover:text-white transition-colors"
              aria-label="Instagram"
            >
              <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            </a>
            <a
              href="www.youtube.com/@dongzhouhe"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 hover:bg-red-600 hover:text-white transition-colors"
              aria-label="YouTube"
            >
              <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </a>
            <a
              href="https://discord.gg/7cDGjf6S"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 hover:bg-indigo-600 hover:text-white transition-colors"
              aria-label="Discord"
            >
              <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
            </a>
          </div>
          <p class="text-center text-gray-600 mt-8 text-sm">
            © 2025 Fashion Rec. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  </div>
</template>

