<script setup lang="ts">
defineOptions({ name: 'PrivacyPolicy' })
import { useRouter } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'

const router = useRouter()
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4">
    <div class="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg p-8">
      <!-- Header -->
      <div class="mb-6">
        <button
          @click="router.back()"
          class="flex items-center gap-2 text-gray-600 hover:text-black transition-colors mb-4"
        >
          <ArrowLeft class="w-5 h-5" />
          <span>Back</span>
        </button>
        <h1 class="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p class="text-gray-500 text-sm">Last updated: Jan 1, 2024</p>
      </div>

      <!-- Content -->
      <div class="prose prose-sm max-w-none space-y-6 text-gray-700">
        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">1. Information We Collect</h2>
          <p class="mb-3">We collect information to provide and improve our services:</p>
          <ul class="list-disc pl-6 space-y-2 mb-3">
            <li><strong>Account info:</strong> Email and password (hashed) when you sign up.</li>
            <li><strong>Uploaded images:</strong> Garment and try-on photos to power recommendations and virtual try-on.</li>
            <li><strong>Usage data:</strong> Preferences, favorites, browsing, and interaction history.</li>
            <li><strong>Device info:</strong> Device type, OS, and browser to optimize experience.</li>
          </ul>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">2. How We Use Information</h2>
          <ul class="list-disc pl-6 space-y-2 mb-3">
            <li>Provide, maintain, and improve AI recommendations and virtual try-on.</li>
            <li>Process your requests and transactions.</li>
            <li>Send service notifications and updates.</li>
            <li>Analyze usage to improve user experience.</li>
            <li>Protect security and prevent fraud.</li>
          </ul>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">3. Storage and Security</h2>
          <ul class="list-disc pl-6 space-y-2 mb-3">
            <li>Encrypted transport (HTTPS).</li>
            <li>Passwords stored with secure hashing.</li>
            <li>Regular security reviews and scans.</li>
            <li>Restricted employee access to personal data.</li>
          </ul>
          <p class="mb-3">Data is stored on secure servers. We do not sell your personal information.</p>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">4. Sharing</h2>
          <p class="mb-3">We do not sell or trade your personal data. We may share only when:</p>
          <ul class="list-disc pl-6 space-y-2 mb-3">
            <li>You provide explicit consent.</li>
            <li>Required by law.</li>
            <li>Necessary to protect rights, property, or safety of users or the public.</li>
            <li>With service providers under strict confidentiality.</li>
          </ul>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">5. AI Usage</h2>
          <p class="mb-3">We use AI (including Qwen and related models) to power recommendations and virtual try-on. Image data may be used to:</p>
          <ul class="list-disc pl-6 space-y-2 mb-3">
            <li>Train/optimize models in anonymized, aggregated form.</li>
            <li>Generate personalized outfit suggestions.</li>
            <li>Create virtual try-on results.</li>
          </ul>
          <p class="mb-3">We do not link personal identifiers to AI training data.</p>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">6. Cookies & Tracking</h2>
          <p class="mb-3">We use cookies to remember login state, save preferences, and analyze usage. You can manage cookies in your browser; disabling may affect features.</p>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">7. Your Rights</h2>
          <ul class="list-disc pl-6 space-y-2 mb-3">
            <li>Access your personal data.</li>
            <li>Correct or update your data.</li>
            <li>Request deletion of your account and data.</li>
            <li>Data portability in a structured format.</li>
            <li>Withdraw consent at any time.</li>
          </ul>
          <p class="mb-3">Contact us to exercise these rights.</p>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">8. Data Retention</h2>
          <ul class="list-disc pl-6 space-y-2 mb-3">
            <li>Account data retained while your account is active.</li>
            <li>Uploaded images retained until you delete them or your account.</li>
            <li>Legally required data retained as mandated.</li>
          </ul>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">9. Children</h2>
          <p class="mb-3">Our services are not directed to children under 13. If we learn we collected such data, we will delete it promptly.</p>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">10. Changes</h2>
          <p class="mb-3">We may update this policy. Significant changes will be communicated via email or site notice. Continued use means acceptance of updates.</p>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">11. Contact Us</h2>
          <p class="mb-3">Questions? Contact us:</p>
          <ul class="list-none space-y-2 mb-3">
            <li><strong>Email:</strong> privacy@fashion-rec.com</li>
            <li><strong>Address:</strong> [Your company address]</li>
          </ul>
        </section>
      </div>

      <!-- Footer -->
      <div class="mt-8 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
        <p>© 2024 Fashion Rec. All rights reserved.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.prose h2 {
  margin-top: 1.5em;
  margin-bottom: 0.75em;
}

.prose ul {
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}

.prose p {
  line-height: 1.7;
}
</style>
