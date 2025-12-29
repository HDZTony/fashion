<script setup lang="ts">
defineOptions({ name: 'LVProducts' })
import { ref, onMounted, computed } from 'vue'
import { Search, ExternalLink, Download, Loader2, ShoppingBag } from 'lucide-vue-next'
import { apiClient } from '../lib/api-client'

// 商品接口定义
interface LVProduct {
  product_id: string
  product_name: string
  price: string | null
  original_lv_url: string
  thumbnail_url: string | null
  original_image_url: string
  created_at: string
  updated_at: string
  metadata?: Record<string, any>
}

// 状态管理
const products = ref<LVProduct[]>([])
const isLoading = ref(false)
const searchKeyword = ref('')
const totalProducts = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)

// 抓取相关状态
const showScrapeDialog = ref(false)
const isScraping = ref(false)
const scrapeCategoryUrl = ref('')
const scrapeMaxPages = ref(1)
const scrapeMaxProducts = ref<number | null>(null)
const generateThumbnails = ref(true)
const watermarkText = ref('fashion-rec.dongzhouhe.com')
const scrapeResult = ref<any>(null)

// 加载商品列表
const loadProducts = async (page: number = 1) => {
  isLoading.value = true
  try {
    const offset = (page - 1) * pageSize.value
    const response = await apiClient.get<{
      products: LVProduct[]
      total: number
    }>('/lv-products', {
      params: {
        limit: pageSize.value,
        offset: offset,
        order_by: 'created_at',
        order_direction: 'DESC',
      },
    })
    
    products.value = response.data.products
    totalProducts.value = response.data.total
    currentPage.value = page
  } catch (error: any) {
    console.error('Failed to load products:', error)
    alert(`Failed to load products: ${error.response?.data?.detail || error.message}`)
  } finally {
    isLoading.value = false
  }
}

// 搜索商品
const searchProducts = async () => {
  if (!searchKeyword.value.trim()) {
    loadProducts()
    return
  }
  
  isLoading.value = true
  try {
    const response = await apiClient.get<{
      products: LVProduct[]
      keyword: string
      count: number
    }>('/lv-products/search', {
      params: {
        keyword: searchKeyword.value.trim(),
        limit: pageSize.value,
        offset: 0,
      },
    })
    
    products.value = response.data.products
    totalProducts.value = response.data.count
    currentPage.value = 1
  } catch (error: any) {
    console.error('Failed to search products:', error)
    alert(`Search failed: ${error.response?.data?.detail || error.message}`)
  } finally {
    isLoading.value = false
  }
}

// 抓取商品
const scrapeProducts = async () => {
  if (!scrapeCategoryUrl.value.trim()) {
    alert('Please enter a product category page URL')
    return
  }
  
  isScraping.value = true
  scrapeResult.value = null
  
  try {
    const response = await apiClient.post('/lv-products/scrape', {
      category_url: scrapeCategoryUrl.value.trim(),
      max_pages: scrapeMaxPages.value,
      max_products: scrapeMaxProducts.value,
      generate_thumbnails: generateThumbnails.value,
      watermark_text: watermarkText.value || null,
    })
    
    scrapeResult.value = response.data
    alert(`Successfully scraped ${response.data.total_added} products`)
    
    // 重新加载商品列表
    await loadProducts(1)
    
    // 关闭对话框
    showScrapeDialog.value = false
  } catch (error: any) {
    console.error('Failed to scrape products:', error)
    alert(`Scrape failed: ${error.response?.data?.detail || error.message}`)
  } finally {
    isScraping.value = false
  }
}

// 生成缩略图
const generateThumbnail = async (productId: string) => {
  try {
    await apiClient.post(`/lv-products/${productId}/generate-thumbnail`, {
      watermark_text: watermarkText.value || null,
    })
    
    alert('Thumbnail generated')
    // 重新加载商品列表
    await loadProducts(currentPage.value)
  } catch (error: any) {
    console.error('Failed to generate thumbnail:', error)
    alert(`Thumbnail generation failed: ${error.response?.data?.detail || error.message}`)
  }
}

// 计算总页数
const totalPages = computed(() => {
  return Math.ceil(totalProducts.value / pageSize.value)
})

// 格式化价格
const formatPrice = (price: string | null) => {
  if (!price) return 'Price unavailable'
  return price
}

// 初始化加载
onMounted(() => {
  loadProducts()
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 p-6">
    <div class="max-w-7xl mx-auto">
      <!-- 页面标题 -->
      <div class="mb-6 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <ShoppingBag class="w-8 h-8 text-purple-600" />
          <h1 class="text-3xl font-bold text-green-900">LV Product Index</h1>
        </div>
        <button
          @click="showScrapeDialog = true"
          class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
        >
          <Download class="w-5 h-5" />
          抓取商品
        </button>
      </div>

      <!-- 搜索栏 -->
      <div class="mb-6 flex gap-3">
        <div class="flex-1 relative">
          <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-green-400" />
          <input
            v-model="searchKeyword"
            @keyup.enter="searchProducts"
            type="text"
            placeholder="Search product name..."
            class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <button
          @click="searchProducts"
          class="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          搜索
        </button>
        <button
          v-if="searchKeyword"
          @click="searchKeyword = ''; loadProducts()"
          class="px-6 py-2 bg-gray-200 text-green-700 rounded-lg hover:bg-gray-300 transition-colors"
        >
          清除
        </button>
      </div>

      <!-- 商品统计 -->
      <div class="mb-4 text-sm text-green-600">
        Found {{ totalProducts }} product(s)
      </div>

      <!-- 加载状态 -->
      <div v-if="isLoading" class="flex justify-center items-center py-12">
        <Loader2 class="w-8 h-8 text-purple-600 animate-spin" />
        <span class="ml-3 text-green-600">加载中...</span>
      </div>

      <!-- 商品网格 -->
      <div v-else-if="products.length > 0" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        <div
          v-for="product in products"
          :key="product.product_id"
          class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow group"
        >
          <!-- 商品图片 -->
          <div class="relative aspect-square bg-gray-100 overflow-hidden">
            <img
              :src="product.thumbnail_url || product.original_image_url"
              :alt="product.product_name"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              @error="($event.target as HTMLImageElement).src = '/placeholder.png'"
            />
            <!-- 操作按钮 -->
            <div class="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                v-if="!product.thumbnail_url"
                @click="generateThumbnail(product.product_id)"
                class="p-2 bg-white rounded-full shadow-md hover:bg-gray-50"
                title="生成缩略图"
              >
                <Download class="w-4 h-4 text-purple-600" />
              </button>
            </div>
          </div>
          
          <!-- 商品信息 -->
          <div class="p-4">
            <h3 class="font-semibold text-green-900 mb-2 line-clamp-2 min-h-[3rem]">
              {{ product.product_name }}
            </h3>
            <p class="text-purple-600 font-bold mb-3">
              {{ formatPrice(product.price) }}
            </p>
            
            <!-- 操作按钮 -->
            <div class="flex gap-2">
              <a
                :href="product.original_lv_url"
                target="_blank"
                rel="noopener noreferrer"
                class="flex-1 px-3 py-2 bg-purple-600 text-white text-center rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
              >
                <ExternalLink class="w-4 h-4" />
                查看详情
              </a>
            </div>
            
            <!-- 时间信息 -->
            <div class="mt-2 text-xs text-green-500">
              {{ new Date(product.created_at).toLocaleDateString('zh-CN') }}
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="text-center py-12">
        <ShoppingBag class="w-16 h-16 text-green-400 mx-auto mb-4" />
        <p class="text-green-600">暂无商品</p>
        <button
          @click="showScrapeDialog = true"
          class="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          开始抓取商品
        </button>
      </div>

      <!-- 分页 -->
      <div v-if="totalPages > 1" class="mt-8 flex justify-center gap-2">
        <button
          @click="loadProducts(currentPage - 1)"
          :disabled="currentPage === 1"
          class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          上一页
        </button>
        <span class="px-4 py-2 text-green-700">
          第 {{ currentPage }} / {{ totalPages }} 页
        </span>
        <button
          @click="loadProducts(currentPage + 1)"
          :disabled="currentPage === totalPages"
          class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          下一页
        </button>
      </div>

      <!-- 抓取商品对话框 -->
      <div
        v-if="showScrapeDialog"
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        @click.self="showScrapeDialog = false"
      >
        <div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <h2 class="text-2xl font-bold text-green-900 mb-4">抓取LV商品</h2>
          
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-green-700 mb-1">
                商品分类页面URL *
              </label>
              <input
                v-model="scrapeCategoryUrl"
                type="text"
                placeholder="例如: https://www.louisvuitton.com/zhs-cn/catalog/women/handbags"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p class="mt-1 text-xs text-green-500">
                输入LV官网的商品分类页面URL（需要根据实际网站结构调整）
              </p>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-green-700 mb-1">
                  最大抓取页数
                </label>
                <input
                  v-model.number="scrapeMaxPages"
                  type="number"
                  min="1"
                  max="10"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-green-700 mb-1">
                  最大商品数量（可选）
                </label>
                <input
                  v-model.number="scrapeMaxProducts"
                  type="number"
                  min="1"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="不限制"
                />
              </div>
            </div>
            
            <div>
              <label class="flex items-center gap-2">
                <input
                  v-model="generateThumbnails"
                  type="checkbox"
                  class="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
                <span class="text-sm font-medium text-green-700">自动生成缩略图</span>
              </label>
            </div>
            
            <div v-if="generateThumbnails">
              <label class="block text-sm font-medium text-green-700 mb-1">
                水印文字
              </label>
              <input
                v-model="watermarkText"
                type="text"
                placeholder="fashion-rec.dongzhouhe.com"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            
            <div class="flex gap-3 pt-4">
              <button
                @click="scrapeProducts"
                :disabled="isScraping || !scrapeCategoryUrl.trim()"
                class="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Loader2 v-if="isScraping" class="w-5 h-5 animate-spin" />
                <Download v-else class="w-5 h-5" />
                {{ isScraping ? '抓取中...' : '开始抓取' }}
              </button>
              <button
                @click="showScrapeDialog = false"
                :disabled="isScraping"
                class="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                取消
              </button>
            </div>
            
            <!-- 抓取结果 -->
            <div v-if="scrapeResult" class="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p class="text-sm text-green-800">
                成功抓取 {{ scrapeResult.total_added }} 个商品（共抓取 {{ scrapeResult.total_scraped }} 个）
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

