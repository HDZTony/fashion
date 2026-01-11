<script setup lang="ts">
defineOptions({ name: 'TermsOfService' })
import { useRouter } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'

const router = useRouter()
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-pink-50 via-white to-purple-50 py-8 px-4">
    <div class="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-8 border border-pink-100">
      <!-- Header -->
      <div class="mb-6">
        <button
          @click="router.back()"
          class="flex items-center gap-2 text-pink-600 hover:text-pink-700 font-medium transition-colors mb-4"
        >
          <ArrowLeft class="w-5 h-5" />
          <span>Back</span>
        </button>
        <h1 class="text-4xl sm:text-5xl font-bold mb-2 bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
          Terms of Service
        </h1>
        <p class="text-gray-600 text-sm font-medium">Last updated: Dec 16, 2025</p>
      </div>

      <!-- Content -->
      <div class="prose prose-sm max-w-none space-y-6 text-gray-700">
        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">1. Acceptance</h2>
          <p class="mb-3">By using Fashion Rec, you agree to these Terms. If you disagree, please do not use the service.</p>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">2. Service Description</h2>
          <p class="mb-3">Fashion Rec provides AI-powered outfit recommendations, virtual try-on, wardrobe management, and favorites/history features. We may modify, suspend, or discontinue services at any time.</p>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">3. Accounts</h2>
          <ul class="list-disc pl-6 space-y-2 mb-3">
            <li>Provide accurate and current registration info.</li>
            <li>Maintain and update your account details.</li>
            <li>Be responsible for all activity under your account.</li>
            <li>Notify us of unauthorized use.</li>
            <li>Keep your password confidential.</li>
          </ul>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">4. User Content</h2>
          <p class="mb-3">You own content you upload. You grant us rights to use, store, process, and display it to provide the service, and to improve AI models in anonymized/aggregated form.</p>
          <ul class="list-disc pl-6 space-y-2 mb-3">
            <li>You have the necessary rights to the content.</li>
            <li>Your content does not infringe others’ rights.</li>
            <li>Your content is not illegal, harmful, or abusive.</li>
          </ul>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">5. Prohibited Use</h2>
          <p class="mb-3">You will not use the service to:</p>
          <ul class="list-disc pl-6 space-y-2 mb-3">
            <li>Violate laws or regulations.</li>
            <li>Upload malware or harmful code.</li>
            <li>Attempt unauthorized access to systems.</li>
            <li>Disrupt or interfere with the service.</li>
            <li>Harvest information about users.</li>
            <li>Impersonate others.</li>
            <li>Engage in actions that may harm the service.</li>
          </ul>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">6. AI-Generated Content</h2>
          <ul class="list-disc pl-6 space-y-2 mb-3">
            <li>AI outputs may not be fully accurate or meet expectations.</li>
            <li>Virtual try-on is for reference and may differ from real-world results.</li>
            <li>No guarantees on accuracy, completeness, or suitability of AI outputs.</li>
            <li>Use your own judgment when relying on AI suggestions.</li>
          </ul>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">7. Intellectual Property</h2>
          <p class="mb-3">All service content (text, graphics, logos, images, software, etc.) belongs to us or licensors and is protected by IP laws. Do not copy, modify, distribute, sell, or rent without written permission.</p>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">8. Disclaimer</h2>
          <p class="mb-3">The service is provided “as is” and “as available.” We disclaim warranties to the fullest extent permitted by law, including accuracy, reliability, availability, or fitness for a particular purpose.</p>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">9. Limitation of Liability</h2>
          <p class="mb-3">To the maximum extent allowed, we are not liable for indirect, incidental, special, consequential, or punitive damages (including lost profits, data loss, business interruption), even if advised of the possibility.</p>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">10. Indemnity</h2>
          <p class="mb-3">You agree to indemnify and hold us harmless from claims arising from your use, violation of these Terms, infringement of third-party rights, or content you upload.</p>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">11. Termination</h2>
          <p class="mb-3">We may suspend or terminate accounts and access at any time (e.g., Terms violations, inactivity, legal requirements). Upon termination, access stops and we may delete your account/data.</p>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">12. Changes</h2>
          <p class="mb-3">We may update these Terms. Significant changes will be communicated via email or site notice. Continued use means acceptance of updated Terms.</p>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">13. Governing Law</h2>
          <p class="mb-3">These Terms are governed by applicable law. Disputes will be resolved through good-faith negotiation; if unresolved, they may be brought to a court of competent jurisdiction.</p>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-3 text-black">14. Contact</h2>
          <p class="mb-3">Questions? Contact us:</p>
          <ul class="list-none space-y-2 mb-3">
            <li><strong>Email:</strong> support@fashion-rec.com (or support@hdz73.com)</li>
          </ul>
        </section>
      </div>

      <!-- Footer -->
      <div class="mt-8 pt-6 border-t border-gray-200 text-center text-sm text-green-500">
        <p>© 2025 Fashion Rec. All rights reserved.</p>
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
