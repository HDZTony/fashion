<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { useRouter } from 'vue-router'
import { computed, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useHead } from '@vueuse/head'
import { useSEO } from '@/composables/useSEO'
import { siteBaseUrl, organizationSchema, websiteSchema } from '@/config/seo'
import { apiClient } from '@/lib/api-client'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineOptions({ name: 'Home' })

const router = useRouter()

const authStore = useAuthStore()
const isAuthenticated = computed(() => authStore.isAuthenticated)
const isSettingVersion = ref(false)

// Set user version when entering studio
const setUserVersion = async (version: 'stable' | 'v2' = 'v2') => {
  try {
    // Call API to set version (apiClient handles authentication automatically)
    const response = await apiClient.post(
      '/api/router/set-version',
      { version },
      {
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
    isSettingVersion.value = true
    try {
      await setUserVersion('v2')
    } catch (error) {
      console.warn('Failed to set user version, continuing anyway:', error)
    } finally {
      isSettingVersion.value = false
    }
  }
  // Studio is available without login (guest: 3 try-on/day, 100 outfit/day by IP)
  router.push('/studio/chat')
}

const buttonText = computed(() => {
  return isAuthenticated.value ? t('home.enterStudio') : t('home.startForFree')
})

// FAQ data - using computed to make it reactive to language changes
const faqs = computed(() => [
  {
    question: t('home.faq.q1'),
    answer: t('home.faq.a1')
  },
  {
    question: t('home.faq.q2'),
    answer: t('home.faq.a2')
  },
  {
    question: t('home.faq.q3'),
    answer: t('home.faq.a3')
  },
  {
    question: t('home.faq.q4'),
    answer: t('home.faq.a4')
  },
  {
    question: t('home.faq.q5'),
    answer: t('home.faq.a5')
  },
  {
    question: t('home.faq.q6'),
    answer: t('home.faq.a6')
  },
  {
    question: t('home.faq.q7'),
    answer: t('home.faq.a7')
  }
])

useSEO({
  title: 'Fashion Rec | Virtual Try-On & Smart Outfit Recommendations',
  description: 'Build your AI-powered wardrobe, try on outfits virtually, and get personalized recommendations instantly.',
  path: '/',
  image: `${siteBaseUrl}/images/brand/hdz.png`,
})

const faqSchema = computed(() => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.value.map((item: { question: string; answer: string }) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
}))

const faqJsonLd = computed(() => JSON.stringify(faqSchema.value))
const organizationJsonLd = computed(() => JSON.stringify(organizationSchema))
const websiteJsonLd = computed(() => JSON.stringify(websiteSchema))

useHead({
  script: [
    {
      type: 'application/ld+json',
      children: faqJsonLd.value,
    },
    {
      type: 'application/ld+json',
      children: organizationJsonLd.value,
    },
    {
      type: 'application/ld+json',
      children: websiteJsonLd.value,
    },
  ],
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-pink-50 via-white to-purple-50">
    <!-- Main Content -->
    <main class="container mx-auto px-4 sm:px-6 lg:px-8">
      <!-- Hero Section -->
      <header class="relative overflow-hidden pt-20 pb-32 text-center" aria-label="Hero section">
        <!-- Decorative background elements -->
        <div class="absolute inset-0 -z-10">
          <div class="absolute top-0 left-1/4 w-96 h-96 bg-pink-200/20 rounded-full blur-3xl"></div>
          <div class="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-200/20 rounded-full blur-3xl"></div>
        </div>
        
        <div class="max-w-4xl mx-auto">
          <h1 class="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight bg-gradient-to-r from-pink-600 via-purple-600 to-pink-600 bg-clip-text text-transparent animate-fade-in">
            {{ $t('home.title') }}
          </h1>
          <p class="mt-6 text-xl sm:text-2xl leading-8 text-gray-700 max-w-3xl mx-auto font-light">
            {{ $t('home.subtitle') }}
            <span class="text-pink-600 font-medium">{{ $t('home.tryBeforeBuy') }}</span> {{ $t('home.findSignatureLook') }}
          </p>
          <div class="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              @click="handleGetStarted"
              variant="default"
              :disabled="isSettingVersion"
              class="text-lg font-semibold px-10 py-6 h-auto bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed rounded-full"
              aria-label="Get started with Fashion Rec"
            >
              {{ isSettingVersion ? 'Setting up...' : buttonText }}
            </Button>
            <Button
              @click="router.push('/pricing')"
              variant="outline"
              class="text-lg font-semibold px-10 py-6 h-auto border-2 border-pink-300 text-pink-600 hover:bg-pink-50 transition-all rounded-full"
            >
              View Pricing
            </Button>
          </div>
          
          <!-- Trust indicators -->
          <div class="mt-16 flex flex-wrap items-center justify-center gap-8 text-sm text-gray-600">
            <div class="flex items-center gap-2">
              <svg class="w-5 h-5 text-pink-500" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
              </svg>
              <span>Free to start</span>
            </div>
            <div class="flex items-center gap-2">
              <svg class="w-5 h-5 text-pink-500" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
              </svg>
              <span>No credit card required</span>
            </div>
            <div class="flex items-center gap-2">
              <svg class="w-5 h-5 text-pink-500" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
              </svg>
              <span>Instant results</span>
            </div>
          </div>
        </div>
      </header>

      <!-- How It Works Section -->
      <section class="py-24 bg-white">
        <div class="max-w-7xl mx-auto">
          <div class="text-center mb-16">
            <h2 class="text-4xl sm:text-5xl font-bold mb-4 bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
              How It Works
            </h2>
            <p class="text-xl text-gray-600 max-w-2xl mx-auto">
              Get started in minutes. Your perfect style is just a few clicks away.
            </p>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            <!-- Step 1 -->
            <div class="relative">
              <div class="bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl p-8 text-center hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-pink-100">
                <div class="w-16 h-16 bg-gradient-to-br from-pink-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold shadow-lg">
                  1
                </div>
                <h3 class="text-xl font-semibold mb-3 text-gray-800">Upload Your Photo</h3>
                <p class="text-gray-600 leading-relaxed">
                  Simply upload a clear photo of yourself. Our AI works best with front-facing portraits.
                </p>
              </div>
              <div class="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gradient-to-r from-pink-300 to-purple-300 transform -translate-y-1/2"></div>
            </div>

            <!-- Step 2 -->
            <div class="relative">
              <div class="bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl p-8 text-center hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-pink-100">
                <div class="w-16 h-16 bg-gradient-to-br from-pink-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold shadow-lg">
                  2
                </div>
                <h3 class="text-xl font-semibold mb-3 text-gray-800">Choose Garments</h3>
                <p class="text-gray-600 leading-relaxed">
                  Select from your wardrobe or try on items from online stores. Browse thousands of options.
                </p>
              </div>
              <div class="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gradient-to-r from-pink-300 to-purple-300 transform -translate-y-1/2"></div>
            </div>

            <!-- Step 3 (formerly Step 4) -->
            <div class="relative">
              <div class="bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl p-8 text-center hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-pink-100">
                <div class="w-16 h-16 bg-gradient-to-br from-pink-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold shadow-lg">
                  3
                </div>
                <h3 class="text-xl font-semibold mb-3 text-gray-800">Get Recommendations</h3>
                <p class="text-gray-600 leading-relaxed">
                  Receive personalized outfit suggestions based on your style, occasion, and preferences.
                </p>
              </div>
              <div class="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gradient-to-r from-pink-300 to-purple-300 transform -translate-y-1/2"></div>
            </div>

            <!-- Step 4 (formerly Step 3) -->
            <div>
              <div class="bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl p-8 text-center hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-pink-100">
                <div class="w-16 h-16 bg-gradient-to-br from-pink-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold shadow-lg">
                  4
                </div>
                <h3 class="text-xl font-semibold mb-3 text-gray-800">AI Magic Happens</h3>
                <p class="text-gray-600 leading-relaxed">
                  Our advanced AI creates a realistic virtual try-on in seconds. See how it looks instantly.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Use Cases Section -->
      <section class="py-24 bg-gradient-to-b from-purple-50 to-pink-50">
        <div class="max-w-7xl mx-auto">
          <div class="text-center mb-16">
            <h2 class="text-4xl sm:text-5xl font-bold mb-4 bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
              Solve Your Fashion Challenges
            </h2>
            <p class="text-xl text-gray-600 max-w-2xl mx-auto">
              Everything you need to look and feel your best, every single day.
            </p>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <!-- Use Case 1: Avoid Duplicate Purchases -->
            <div class="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-pink-100 group">
              <div class="aspect-[5/8] bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center overflow-hidden">
                <img
                  src="/images/use-cases/duplicate-clothes.png"
                  alt="Person organizing wardrobe to avoid duplicate purchases"
                  class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
              </div>
              <div class="p-8">
                <div class="w-12 h-12 bg-gradient-to-br from-pink-500 to-purple-500 rounded-xl flex items-center justify-center mb-4">
                  <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <h3 class="text-2xl font-bold mb-3 text-gray-800">Avoid Duplicate Purchases</h3>
                <p class="text-gray-600 leading-relaxed">
                  Keep track of your wardrobe in one place. Our smart wardrobe management helps you remember what you own, preventing you from buying the same clothes twice.
                </p>
              </div>
            </div>

            <!-- Use Case 2: Preview Before Buying -->
            <div class="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-pink-100 group">
              <div class="aspect-[5/8] bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center overflow-hidden">
                <img
                  src="/images/use-cases/online-preview.png"
                  alt="Person using phone to preview online clothes"
                  class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
              </div>
              <div class="p-8">
                <div class="w-12 h-12 bg-gradient-to-br from-pink-500 to-purple-500 rounded-xl flex items-center justify-center mb-4">
                  <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                </div>
                <h3 class="text-2xl font-bold mb-3 text-gray-800">Preview Before Buying</h3>
                <p class="text-gray-600 leading-relaxed">
                  Unsure how that online purchase will look on you? Try it on virtually first. Our AI virtual try-on lets you see the fit and style before you buy.
                </p>
              </div>
            </div>

            <!-- Use Case 3: Daily Outfit Ideas -->
            <div class="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-pink-100 group">
              <div class="aspect-[5/8] bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center overflow-hidden">
                <img
                  src="/images/use-cases/daily-outfit.png"
                  alt="Person deciding what to wear today"
                  class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
              </div>
              <div class="p-8">
                <div class="w-12 h-12 bg-gradient-to-br from-pink-500 to-purple-500 rounded-xl flex items-center justify-center mb-4">
                  <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                  </svg>
                </div>
                <h3 class="text-2xl font-bold mb-3 text-gray-800">Get Daily Outfit Ideas</h3>
                <p class="text-gray-600 leading-relaxed">
                  Not sure what to wear today? Get personalized outfit recommendations based on your wardrobe, style preferences, and the occasion.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Features Section -->
      <section class="py-24 bg-white">
        <div class="max-w-7xl mx-auto">
          <div class="text-center mb-16">
            <h2 class="text-4xl sm:text-5xl font-bold mb-4 bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
              Why Choose Fashion Rec?
            </h2>
            <p class="text-xl text-gray-600 max-w-2xl mx-auto">
              Everything you need to discover and express your unique style.
            </p>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div class="bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl p-8 text-center hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-pink-100">
              <div class="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center mb-6 shadow-lg">
                <svg class="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path>
                </svg>
              </div>
              <h3 class="text-2xl font-bold mb-3 text-gray-800">Personalized Wardrobe</h3>
              <p class="text-gray-600 leading-relaxed">Manage your closet digitally and keep your complete outfit history. Never forget what you own again.</p>
            </div>
            
            <div class="bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl p-8 text-center hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-pink-100">
              <div class="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center mb-6 shadow-lg">
                <svg class="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <h3 class="text-2xl font-bold mb-3 text-gray-800">AI Virtual Try-On</h3>
              <p class="text-gray-600 leading-relaxed">Advanced AI technology lets you preview outfits effortlessly. See how clothes look on you before buying.</p>
            </div>
            
            <div class="bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl p-8 text-center hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-pink-100">
              <div class="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center mb-6 shadow-lg">
                <svg class="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                </svg>
              </div>
              <h3 class="text-2xl font-bold mb-3 text-gray-800">Smart Recommendations</h3>
              <p class="text-gray-600 leading-relaxed">Get outfit picks tailored to your style, preferences, and occasion. Discover new combinations you'll love.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Final CTA Section -->
      <section class="py-24 bg-gradient-to-r from-pink-600 via-purple-600 to-pink-600 relative overflow-hidden">
        <div class="absolute inset-0 bg-black/10"></div>
        <div class="relative max-w-4xl mx-auto text-center px-4">
          <h2 class="text-4xl sm:text-5xl font-bold text-white mb-6">
            Ready to Transform Your Style?
          </h2>
          <p class="text-xl text-white/90 mb-10 max-w-2xl mx-auto">
            Join thousands of women who have discovered their perfect style with Fashion Rec. Start your journey today.
          </p>
          <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              @click="handleGetStarted"
              variant="default"
              :disabled="isSettingVersion"
              class="text-lg font-semibold px-10 py-6 h-auto bg-white text-pink-600 hover:bg-gray-100 shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed rounded-full"
              aria-label="Get started with Fashion Rec"
            >
              {{ isSettingVersion ? 'Setting up...' : buttonText }}
            </Button>
            <Button
              @click="router.push('/pricing')"
              variant="outline"
              class="text-lg font-semibold px-10 py-6 h-auto bg-white text-pink-600 hover:bg-gray-100 shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed rounded-full"
            >
              View Plans
            </Button>
          </div>
        </div>
      </section>

    </main>

    <!-- FAQ Section -->
    <section class="bg-gradient-to-b from-pink-50 to-purple-50 py-24">
      <div class="container mx-auto px-4 sm:px-6 lg:px-8">
        <div class="max-w-3xl mx-auto">
          <h2 class="text-4xl sm:text-5xl font-bold text-center mb-12 bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
            {{ $t('home.faq.title') }}
          </h2>
          <Accordion type="single" collapsible class="w-full">
            <AccordionItem
              v-for="(faq, index) in faqs"
              :key="index"
              :value="`item-${index}`"
              class="border-b border-pink-200 bg-white rounded-lg mb-2 px-4"
            >
              <AccordionTrigger class="text-left font-semibold text-gray-800 hover:no-underline py-4 hover:text-pink-600 transition-colors">
                {{ faq.question }}
              </AccordionTrigger>
              <AccordionContent class="text-gray-600 pb-4 pt-0 leading-relaxed">
                {{ faq.answer }}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </section>

    <!-- Social Media Section -->
    <footer class="bg-white border-t border-pink-200 py-12">
      <div class="container mx-auto px-4 sm:px-6 lg:px-8">
        <div class="max-w-4xl mx-auto">
          <h3 class="text-2xl font-bold text-center mb-8 bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
            Follow Us
          </h3>
          <div class="flex justify-center items-center gap-6 flex-wrap">
            <!-- 社交媒体图标 - 使用SVG图标，您也可以替换为图片 -->
            <a
              href="https://x.com/hedongzhouu?s=21"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-pink-100 to-purple-100 hover:from-pink-500 hover:to-purple-500 hover:text-white transition-all duration-300 transform hover:scale-110"
              aria-label="X"
            >
              <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            <a
              href="https://www.instagram.com/dongzhou_he?igsh=aWJxamZ6aG5nemM3&utm_source=qr"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-pink-100 to-purple-100 hover:from-pink-500 hover:to-purple-500 hover:text-white transition-all duration-300 transform hover:scale-110"
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
              class="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-pink-100 to-purple-100 hover:from-pink-500 hover:to-purple-500 hover:text-white transition-all duration-300 transform hover:scale-110"
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
              class="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-pink-100 to-purple-100 hover:from-pink-500 hover:to-purple-500 hover:text-white transition-all duration-300 transform hover:scale-110"
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

