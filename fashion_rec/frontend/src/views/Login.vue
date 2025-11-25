<script setup lang="ts">
import { supabase } from '../lib/supabase'
import { ref } from 'vue'

const email = ref('')
const isLoading = ref(false)
const message = ref('')

const handleEmailLogin = async () => {
  if (!email.value) {
    message.value = 'Please enter your email'
    return
  }

  isLoading.value = true
  message.value = ''

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.value,
      options: {
        emailRedirectTo: `${window.location.origin}/callback`
      }
    })

    if (error) throw error

    message.value = 'Check your email for the login link!'
  } catch (error: any) {
    message.value = error.message || 'An error occurred'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 p-4">
    <div class="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
      <h1 class="text-3xl font-bold mb-2 text-center">Welcome</h1>
      <p class="text-gray-500 mb-8 text-center">Sign in to access your AI Wardrobe</p>
      
      <div class="space-y-4">
        <input
          v-model="email"
          type="email"
          placeholder="Enter your email"
          class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black"
          @keyup.enter="handleEmailLogin"
        />
        
        <button 
          @click="handleEmailLogin"
          :disabled="isLoading"
          class="w-full bg-black text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ isLoading ? 'Sending...' : 'Sign in with Email' }}
        </button>

        <p v-if="message" class="text-sm text-center" :class="message.includes('Check') ? 'text-green-600' : 'text-red-600'">
          {{ message }}
        </p>
      </div>
    </div>
  </div>
</template>
