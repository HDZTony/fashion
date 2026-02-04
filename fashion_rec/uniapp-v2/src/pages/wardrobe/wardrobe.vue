<template>
  <view class="min-h-screen bg-gradient-to-b from-pink-50 via-white to-purple-50 font-sans text-gray-900">
    <wd-navbar
      v-if="!embedded"
      :title="t('wardrobe.title')"
      left-arrow
      :left-text="t('common.back')"
      fixed
      placeholder
      safe-area-inset-top
      bordered
      @click-left="goBack"
    />
    <view class="px-4 sm:px-6 lg:px-8 pt-4 pb-8">

      <view class="space-y-6">
        <!-- Upload section -->
        <view class="bg-white p-6 rounded-2xl shadow-sm border border-pink-100">
          <view class="text-lg font-semibold mb-4 flex items-center gap-2 bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
            {{ t('wardrobe.uploadItems') }}
          </view>
          <view
            class="border-2 border-dashed border-pink-200 rounded-xl p-8 text-center bg-pink-50 active:bg-pink-100 transition-colors"
            @click="triggerFileInput"
          >
            <view v-if="isUploading && uploadProgress" class="flex flex-col items-center gap-2">
              <view class="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
              <text class="text-sm text-pink-500">Uploading {{ uploadProgress.current }}/{{ uploadProgress.total }}</text>
              <text class="text-xs text-pink-400 truncate max-w-full">{{ uploadProgress.currentFile }}</text>
            </view>
            <view v-else-if="isUploading" class="flex flex-col items-center gap-2">
              <view class="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
              <text class="text-sm text-pink-500">{{ t('wardrobe.analyzing') }}</text>
            </view>
            <view v-else>
              <text class="font-medium text-gray-700 block">{{ t('wardrobe.upload.clickOrDrag') }}</text>
              <text class="text-xs text-pink-600 mt-2 block">{{ t('wardrobe.upload.multipleHint') }}</text>
            </view>
          </view>
          <!-- URL Upload -->
          <view class="mt-4 pt-4 border-t border-pink-200">
            <text class="text-sm font-medium text-gray-700 mb-2 block">{{ t('wardrobe.uploadFromUrl') }}</text>
            <view class="space-y-2">
              <textarea
                v-model="imageUrlInput"
                :placeholder="t('wardrobe.upload.urlPlaceholder')"
                :disabled="isUploadingUrl || isUploading"
                class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 resize-y text-sm min-h-[80px]"
                style="box-sizing: border-box;"
              />
              <view v-if="isUploadingUrl && urlUploadProgress" class="flex flex-col gap-1">
                <view class="flex items-center gap-2">
                  <view class="w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
                  <text class="text-sm text-pink-500">Uploading {{ urlUploadProgress.current }}/{{ urlUploadProgress.total }}</text>
                </view>
                <text class="text-xs text-pink-400 truncate">{{ urlUploadProgress.currentUrl }}</text>
              </view>
              <button
                type="button"
                :disabled="isUploadingUrl || isUploading || !imageUrlInput.trim()"
                class="px-4 py-2 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
                @click="handleUrlUpload"
              >
                <text>{{ isUploadingUrl ? t('wardrobe.uploadUrlsUploading') : t('wardrobe.uploadUrls') }}</text>
              </button>
            </view>
          </view>

          <!-- Import example items -->
          <view class="mt-4 pt-4 border-t border-pink-200">
            <text class="text-sm font-medium text-gray-700 mb-2 block">{{ t('wardrobe.importExampleItems') }}</text>
            <view class="flex gap-2 flex-nowrap">
              <button
                type="button"
                :disabled="isImporting"
                class="px-3 py-1.5 text-xs whitespace-nowrap bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
                @click="importExampleItems(GENDER_WOMENS)"
              >
                <text>{{ isImporting ? t('wardrobe.upload.uploading') : t('wardrobe.importWomensSample') }}</text>
              </button>
              <button
                type="button"
                :disabled="isImporting"
                class="px-3 py-1.5 text-xs whitespace-nowrap bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
                @click="importExampleItems(GENDER_MENS)"
              >
                <text>{{ isImporting ? t('wardrobe.upload.uploading') : t('wardrobe.importMensSample') }}</text>
              </button>
            </view>
          </view>
        </view>

        <!-- Wardrobe grid section -->
        <view class="bg-white p-6 rounded-2xl shadow-sm border border-pink-100 min-h-[400px]">
          <view class="flex items-center justify-between mb-4 flex-wrap gap-2">
            <view class="flex items-center gap-2 flex-wrap">
              <text class="text-lg font-semibold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">{{ t('wardrobe.title') }}</text>
              <text v-if="uploadedItems.length > 0" class="text-sm text-pink-600">({{ t('wardrobe.itemsCount', { count: uploadedItems.length }) }})</text>
            </view>
            <view class="flex items-center gap-2">
              <button
                type="button"
                :disabled="isLoadingItems"
                class="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-pink-600 disabled:opacity-50"
                @click="loadUserItems"
              >
                <text>{{ t('wardrobe.refresh') }}</text>
              </button>
              <button
                type="button"
                class="px-3 py-1.5 text-sm rounded-lg border transition-colors"
                :class="isSelectionMode ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white border-pink-600' : 'border-pink-200 text-pink-600'"
                @click="toggleSelectionMode"
              >
                <text>{{ isSelectionMode ? t('wardrobe.cancelSelection') : t('wardrobe.bulkSelect') }}</text>
              </button>
              <button
                v-if="isSelectionMode && selectedCount > 0"
                type="button"
                :disabled="isDeleting"
                class="px-3 py-1.5 text-sm rounded-lg bg-red-500 text-white disabled:opacity-50"
                @click="deleteSelectedItems"
              >
                <text>Delete ({{ selectedCount }})</text>
              </button>
            </view>
          </view>
          <view v-if="isSelectionMode" class="mb-4 flex items-center gap-2 flex-wrap">
            <button type="button" class="px-3 py-1 text-xs rounded-lg border border-gray-200 text-pink-600" @click="toggleSelectAll">
              <text>{{ isAllSelected ? t('wardrobe.unselectAll') : t('wardrobe.selectAll') }}</text>
            </button>
            <text class="text-sm text-pink-500">{{ t('wardrobe.selectedCount', { selected: selectedCount, total: filteredItems.length }) }}</text>
          </view>
          <view class="flex flex-wrap gap-2 mb-4">
            <button
              v-for="filter in typeFilters"
              :key="filter"
              type="button"
              class="px-3 py-1 text-sm rounded-full border transition-colors"
              :class="selectedFilter === filter ? 'bg-black text-white border-black' : 'border-gray-200 text-pink-600'"
              @click="selectedFilter = filter"
            >
              <text>{{ filter }}</text>
            </button>
          </view>
          <view class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            <view
              v-for="(item, index) in filteredItems"
              :key="String(item.id)"
              class="relative rounded-xl overflow-hidden border aspect-[3/4]"
              :class="isSelectionMode && selectedItemIdsSet.has(String(item.id)) ? 'border-pink-500 border-2 ring-2 ring-pink-200' : 'border-pink-200'"
              @click="isSelectionMode ? toggleItemSelection(String(item.id)) : openPreview(index)"
            >
              <view v-if="isSelectionMode" class="absolute top-2 left-2 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center" :class="selectedItemIdsSet.has(String(item.id)) ? 'bg-pink-500 border-pink-500' : 'bg-white/90 border-pink-300'" @click.stop="toggleItemSelection(String(item.id))">
                <text v-if="selectedItemIdsSet.has(String(item.id))" class="text-white text-xs">✓</text>
              </view>
              <image
                v-if="item.url || item.features.path"
                :src="getThumbnailUrl((item.url || item.features.path)!)"
                class="absolute inset-0 w-full h-full"
                mode="aspectFill"
              />
              <view v-else class="absolute inset-0 bg-gray-100 flex items-center justify-center">
                <text class="text-xs text-pink-400">{{ formatFeatureValue(item.features.type) }}</text>
              </view>
              <view class="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-2 text-xs">
                {{ formatFeatureValue(item.features.color) }}
              </view>
              <view
                v-if="!isSelectionMode"
                class="absolute top-2 right-2 z-10 w-6 h-6 rounded-full flex items-center justify-center"
                :class="isOutfitSelected(String(item.id)) ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white' : 'bg-white/80 text-pink-400'"
                @click.stop="toggleOutfitSelection(String(item.id))"
              >
                <text v-if="isOutfitSelected(String(item.id))" class="text-white text-xs">✓</text>
                <view v-else class="w-4 h-4 rounded-full border-2 border-current" />
              </view>
              <view
                v-if="!isSelectionMode"
                class="absolute bottom-10 left-2 z-10 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center"
                @click.stop="openItemDetailsSheet(item)"
              >
                <text class="text-gray-600 text-xs font-bold">i</text>
              </view>
            </view>
            <view v-if="filteredItems.length === 0" class="col-span-full flex flex-col items-center justify-center text-pink-600 py-12">
              <text class="text-4xl mb-2">👗</text>
              <text class="text-sm" v-if="uploadedItems.length === 0">No items yet.</text>
              <text class="text-sm" v-else>No items match the "{{ selectedFilter }}" filter.</text>
            </view>
          </view>
        </view>
      </view>

      <!-- Item Details Sheet (bottom panel) -->
      <view v-if="showItemDetailsSheet" class="fixed inset-0 z-50 flex items-end" @click.self="showItemDetailsSheet = false">
        <view class="absolute inset-0 bg-black/50" @click="showItemDetailsSheet = false" />
        <view class="relative bg-white rounded-t-2xl w-full max-h-[85vh] flex flex-col shadow-xl" @click.stop>
          <view class="p-4 border-b border-gray-200 flex items-center justify-between shrink-0">
            <text class="text-lg font-bold">Item Details</text>
            <view class="flex items-center gap-2">
              <button v-if="detailItem && !isEditingItem" type="button" class="p-2 text-gray-600" @click="startEditingItem">
                <text>Edit</text>
              </button>
              <button type="button" class="p-2 text-gray-600" @click="showItemDetailsSheet = false">
                <text>Close</text>
              </button>
            </view>
          </view>
          <scroll-view v-if="detailItem" scroll-y class="flex-1 min-h-0 p-4" style="max-height: 75vh;">
            <view class="flex justify-center mb-4">
              <image
                v-if="detailItem.url || detailItem.features?.path"
                :src="getMediumImageUrl(detailItem.url || detailItem.features?.path)"
                class="w-full max-w-sm rounded-lg"
                mode="widthFix"
              />
              <view v-else class="w-full max-w-sm h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                <text class="text-gray-400">No image</text>
              </view>
            </view>
            <view class="space-y-4">
              <view class="border-b border-gray-200 pb-3">
                <text class="text-xs font-medium text-gray-500 uppercase block mb-1">Type</text>
                <text v-if="!isEditingItem" class="text-base font-semibold text-gray-900">{{ formatFeatureValue(detailItem.features?.type) }}</text>
                <input v-else v-model="editedFeatures.type" class="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-base" placeholder="e.g. T-shirt, Jeans" />
              </view>
              <view class="border-b border-gray-200 pb-3">
                <text class="text-xs font-medium text-gray-500 uppercase block mb-1">Color</text>
                <text v-if="!isEditingItem" class="text-base text-gray-900">{{ formatFeatureValue(detailItem.features?.color) }}</text>
                <input v-else v-model="editedFeatures.color" class="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-base" placeholder="e.g. Blue, Red" />
              </view>
              <view class="border-b border-gray-200 pb-3">
                <text class="text-xs font-medium text-gray-500 uppercase block mb-1">Style</text>
                <text v-if="!isEditingItem" class="text-base text-gray-900">{{ hasValue(detailItem.features?.style) ? formatFeatureValue(detailItem.features?.style) : 'Not specified' }}</text>
                <input v-else v-model="editedFeatures.style" class="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-base" placeholder="e.g. Casual, Formal" />
              </view>
              <view class="border-b border-gray-200 pb-3">
                <text class="text-xs font-medium text-gray-500 uppercase block mb-1">Pattern</text>
                <text v-if="!isEditingItem" class="text-base text-gray-900">{{ hasValue(detailItem.features?.pattern) ? formatFeatureValue(detailItem.features?.pattern) : 'Not specified' }}</text>
                <input v-else v-model="editedFeatures.pattern" class="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-base" placeholder="e.g. Solid, Striped" />
              </view>
              <view class="border-b border-gray-200 pb-3">
                <text class="text-xs font-medium text-gray-500 uppercase block mb-1">Occasion</text>
                <text v-if="!isEditingItem" class="text-base text-gray-900">{{ hasValue(detailItem.features?.occasion) ? formatFeatureValue(detailItem.features?.occasion) : 'Not specified' }}</text>
                <input v-else v-model="editedFeatures.occasion" class="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-base" placeholder="e.g. Daily, Work" />
              </view>
              <view class="border-b border-gray-200 pb-3">
                <text class="text-xs font-medium text-gray-500 uppercase block mb-1">Material</text>
                <text v-if="!isEditingItem" class="text-base text-gray-900">{{ hasValue(detailItem.features?.material) ? formatFeatureValue(detailItem.features?.material) : 'Not specified' }}</text>
                <input v-else v-model="editedFeatures.material" class="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-base" placeholder="e.g. Cotton, Denim" />
              </view>
              <view class="border-b border-gray-200 pb-3">
                <text class="text-xs font-medium text-gray-500 uppercase block mb-1">Gender</text>
                <text v-if="!isEditingItem" class="text-base text-gray-900">{{ detailItem && hasValue(detailItem.features?.gender) ? detailItem.features?.gender : 'Not specified' }}</text>
                <view v-else class="flex gap-2 mt-1 flex-wrap">
                  <button type="button" class="px-3 py-1.5 rounded-lg border text-sm" :class="editedFeatures.gender === genderMens ? 'bg-pink-100 border-pink-500 text-pink-700' : 'border-gray-200'" @click="editedFeatures.gender = genderMens">Man's</button>
                  <button type="button" class="px-3 py-1.5 rounded-lg border text-sm" :class="editedFeatures.gender === genderWomens ? 'bg-pink-100 border-pink-500 text-pink-700' : 'border-gray-200'" @click="editedFeatures.gender = genderWomens">Women's</button>
                  <button type="button" class="px-3 py-1.5 rounded-lg border text-sm" :class="editedFeatures.gender === 'Unisex' ? 'bg-pink-100 border-pink-500 text-pink-700' : 'border-gray-200'" @click="editedFeatures.gender = 'Unisex'">Unisex</button>
                </view>
              </view>
              <view class="border-b border-gray-200 pb-3">
                <text class="text-xs font-medium text-gray-500 uppercase block mb-1">Description</text>
                <text v-if="!isEditingItem" class="text-base text-gray-900 block whitespace-pre-wrap">{{ hasValue(detailItem.features?.description) ? detailItem.features?.description : 'Not specified' }}</text>
                <textarea v-else v-model="editedFeatures.description" class="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-base min-h-[80px]" placeholder="Description..." />
              </view>
            </view>
            <view v-if="isEditingItem" class="flex gap-3 pt-4 mt-4 border-t border-gray-200">
              <button type="button" :disabled="isUpdatingItem" class="flex-1 px-4 py-2 text-gray-700 border rounded-lg" @click="cancelEditingItem">Cancel</button>
              <button type="button" :disabled="isUpdatingItem" class="flex-1 px-4 py-2 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-lg disabled:opacity-50" @click="saveItemUpdates">
                <text>{{ isUpdatingItem ? 'Saving...' : 'Save' }}</text>
              </button>
            </view>
          </scroll-view>
        </view>
      </view>

      <!-- Confirm dialog: multiple items -->
      <view v-if="showConfirmDialog" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="cancelAddItems">
        <view class="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
          <view class="p-6 border-b border-gray-200">
            <text class="text-xl font-bold">Multiple Items Detected</text>
            <text class="text-sm text-pink-500 mt-1 block">Please select one item to add to your wardrobe.</text>
          </view>
          <scroll-view scroll-y class="flex-1 p-6" style="max-height: 50vh;">
            <view v-for="(item, index) in pendingItems" :key="index" class="border border-gray-200 rounded-xl p-4 mb-4" :class="selectedPendingIndex === index ? 'bg-gray-50 border-pink-500' : ''" @click="selectedPendingIndex = index">
              <view class="flex items-start gap-4">
                <view class="flex-1">
                  <view class="flex items-center gap-2 mb-2">
                    <text class="font-semibold">{{ formatFeatureValue(item.features?.type) }}</text>
                    <text class="text-sm text-pink-500">{{ formatFeatureValue(item.features?.color) }}</text>
                  </view>
                  <view class="grid grid-cols-2 gap-2 text-xs text-pink-600">
                    <text>Style: {{ formatFeatureValue(item.features?.style) }}</text>
                    <text>Occasion: {{ formatFeatureValue(item.features?.occasion) }}</text>
                    <text>Pattern: {{ formatFeatureValue(item.features?.pattern) }}</text>
                    <text>Material: {{ formatFeatureValue(item.features?.material) }}</text>
                  </view>
                </view>
                <image v-if="item.url" :src="getThumbnailUrl(item.url)" class="w-16 h-16 rounded-lg" mode="aspectFill" />
              </view>
            </view>
          </scroll-view>
          <view class="p-6 border-t border-gray-200 flex justify-end gap-3">
            <button type="button" class="px-4 py-2 text-gray-700" @click="cancelAddItems">
              <text>Cancel</text>
            </button>
            <button type="button" :disabled="isConfirming || selectedPendingIndex === null" class="px-6 py-2 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-lg disabled:opacity-50" @click="confirmAddItems">
              <text>{{ isConfirming ? 'Adding...' : 'Add Selected Item' }}</text>
            </button>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { apiClient, uploadApiClient, longUploadApiClient } from '@/lib/api-client'
import { getThumbnailUrl, getMediumImageUrl, getLargeImageUrl } from '@/lib/imageOptimizer'
import { API_URL } from '@/config/api'
import { useStudioStore } from '@/store/studio'
import type { Item, PendingItem, ItemFeatures } from '@fashion-rec/shared'

const props = defineProps<{ embedded?: boolean }>()
const { t } = useI18n()
// 延迟获取 store，避免 App 端 Pinia 未初始化导致白屏（unibest 文档建议）
const store = computed(() => useStudioStore())

const uploadedItems = computed({
  get: () => store.value.uploadedItems,
  set: (v: Item[]) => {
    store.value.uploadedItems = v
    store.value.persist()
  },
})
const hasLoadedItems = ref(false)
const typeFilters = computed(() => [
  t('wardrobe.categories.all'),
  t('wardrobe.categories.tops'),
  t('wardrobe.categories.bottoms'),
  t('wardrobe.categories.outerwear'),
  t('wardrobe.categories.dresses'),
  t('wardrobe.categories.shoes'),
  t('wardrobe.categories.accessories'),
  t('wardrobe.categories.sportswear'),
  t('wardrobe.categories.traditional'),
])
const selectedFilter = ref('')
const isUploading = ref(false)
const uploadProgress = ref<{ current: number; total: number; currentFile: string } | null>(null)
const pendingItems = ref<PendingItem[]>([])
const selectedPendingIndex = ref<number | null>(null)
const showConfirmDialog = ref(false)
const isConfirming = ref(false)
const imageUrlInput = ref('')
const isUploadingUrl = ref(false)
const urlUploadProgress = ref<{ current: number; total: number; currentUrl: string } | null>(null)
const isImporting = ref(false)
const GENDER_WOMENS = "Women's"
const GENDER_MENS = "Man's"
const genderWomens = GENDER_WOMENS
const genderMens = GENDER_MENS

const selectedItemIds = computed({
  get: () => store.value.selectedItemIds,
  set: (v: string[]) => {
    store.value.selectedItemIds = v
    store.value.activeWardrobeIds = v
    store.value.persist()
  },
})
const selectedForOutfitIds = ref<Set<string>>(new Set(store.value.selectedItemIds || []))
const loadOutfitSelection = () => {
  const ids = store.value.selectedItemIds || []
  selectedForOutfitIds.value = new Set(Array.isArray(ids) ? ids : [])
}
watch(selectedItemIds, (ids) => {
  selectedForOutfitIds.value = new Set(Array.isArray(ids) ? ids : [])
}, { deep: true })

function toggleOutfitSelection(itemId: string) {
  if (selectedForOutfitIds.value.has(itemId)) {
    selectedForOutfitIds.value.delete(itemId)
  } else {
    selectedForOutfitIds.value.add(itemId)
  }
  selectedItemIds.value = Array.from(selectedForOutfitIds.value)
  uni.setStorageSync('wardrobe-selected-ids', JSON.stringify(selectedItemIds.value))
}
function isOutfitSelected(itemId: string) {
  return selectedForOutfitIds.value.has(itemId)
}

const categoryKeywords: Record<string, string[]> = {
  Tops: ['t-shirt', 'tee', 'shirt', 'blouse', 'hoodie', 'sweater', 'cardigan', 'tank', 'camisole', 'polo', 'top'],
  Bottoms: ['jeans', 'pants', 'trousers', 'shorts', 'skirt', 'leggings', 'chinos', 'culottes', 'palazzo', 'bottom'],
  Outerwear: ['jacket', 'coat', 'blazer', 'windbreaker', 'bomber', 'parka', 'poncho', 'outerwear'],
  Dresses: ['dress', 'gown', 'sundress', 'slip dress', 'cheongsam', 'qipao'],
  Shoes: ['shoe', 'sneaker', 'boot', 'heel', 'loafer', 'sandal', 'flat', 'mule', 'slipper', 'cleat'],
  Accessories: ['belt', 'hat', 'scarf', 'watch', 'sunglasses', 'bag', 'purse', 'jewelry', 'bracelet', 'necklace', 'glove', 'wallet'],
  Sportswear: ['jersey', 'compression', 'yoga', 'active', 'tracksuit', 'swim', 'athletic', 'sports'],
  Traditional: ['hanfu', 'kimono', 'sari', 'dirndl', 'kebaya', 'tuxedo', 'suit', 'uniform'],
}

function getTypeCandidates(typeValue: string | string[] | undefined) {
  if (!typeValue) return []
  return Array.isArray(typeValue) ? typeValue.map((x) => String(x).toLowerCase()) : [String(typeValue).toLowerCase()]
}
function matchesCategory(typeValue: string | string[] | undefined, category: string) {
  if (category === t('wardrobe.categories.all') || category === 'All') return true
  const candidates = getTypeCandidates(typeValue)
  if (candidates.length === 0) return false
  const categoryMap: Record<string, string> = {
    [t('wardrobe.categories.tops')]: 'Tops',
    [t('wardrobe.categories.bottoms')]: 'Bottoms',
    [t('wardrobe.categories.outerwear')]: 'Outerwear',
    [t('wardrobe.categories.dresses')]: 'Dresses',
    [t('wardrobe.categories.shoes')]: 'Shoes',
    [t('wardrobe.categories.accessories')]: 'Accessories',
    [t('wardrobe.categories.sportswear')]: 'Sportswear',
    [t('wardrobe.categories.traditional')]: 'Traditional',
  }
  const englishCategory = categoryMap[category] || category
  const keywords = categoryKeywords[englishCategory] || []
  return candidates.some((c) => keywords.some((kw) => c.includes(kw)))
}
const filteredItems = computed(() => uploadedItems.value.filter((item) => matchesCategory(item.features?.type, selectedFilter.value)))

const isSelectionMode = ref(false)
const selectedItemIdsSet = ref<Set<string>>(new Set())
const isDeleting = ref(false)
function toggleSelectionMode() {
  isSelectionMode.value = !isSelectionMode.value
  if (!isSelectionMode.value) selectedItemIdsSet.value.clear()
}
function toggleItemSelection(itemId: string) {
  if (selectedItemIdsSet.value.has(itemId)) {
    selectedItemIdsSet.value.delete(itemId)
  } else {
    selectedItemIdsSet.value.add(itemId)
  }
}
function toggleSelectAll() {
  if (selectedItemIdsSet.value.size === filteredItems.value.length) {
    selectedItemIdsSet.value.clear()
  } else {
    filteredItems.value.forEach((item) => selectedItemIdsSet.value.add(String(item.id)))
  }
}
const selectedCount = computed(() => selectedItemIdsSet.value.size)
const isAllSelected = computed(() => filteredItems.value.length > 0 && selectedItemIdsSet.value.size === filteredItems.value.length)
function deleteSelectedItems() {
  if (selectedItemIdsSet.value.size === 0) {
    uni.showToast({ title: t('wardrobe.selectToDeleteFirst'), icon: 'none' })
    return
  }
  const itemIdsArray = Array.from(selectedItemIdsSet.value)
  const itemsToDelete = uploadedItems.value.filter((item) => itemIdsArray.includes(String(item.id)))
  uploadedItems.value = uploadedItems.value.filter((item) => !itemIdsArray.includes(String(item.id)))
  saveItemsToCache()
  selectedItemIdsSet.value.clear()
  isSelectionMode.value = false
  isDeleting.value = true
  apiClient
    .post<{ deleted_count: number; message: string }>('/items/delete', { item_ids: itemIdsArray })
    .then(() => {})
    .catch((err: unknown) => {
      const e = err as { response?: { data?: { detail?: string } }; message?: string }
      uploadedItems.value = [...uploadedItems.value, ...itemsToDelete]
      saveItemsToCache()
      uni.showToast({ title: (e?.response?.data?.detail || e?.message || t('wardrobe.delete.failed')) + '. ' + t('wardrobe.delete.rollback'), icon: 'none', duration: 4000 })
    })
    .finally(() => {
      isDeleting.value = false
    })
}

const isLoadingItems = ref(false)

async function checkBackendHealth(maxRetries = 5, delay = 1000): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await apiClient.get<{ status: string; model_loaded?: boolean; database_ready?: boolean }>('/health', { timeout: 5000 })
      if (res.data?.status === 'ready') return true
      if (i < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, delay))
      }
    } catch {
      if (i < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, delay))
      }
    }
  }
  return false
}

function saveItemsToCache() {
  store.value.uploadedItems = [...uploadedItems.value]
  store.value.persist()
  uni.setStorageSync('wardrobe-items', JSON.stringify(uploadedItems.value))
}

async function loadUserItems() {
  isLoadingItems.value = true
  try {
    const isReady = await checkBackendHealth()
    if (!isReady) {
      console.warn('[Wardrobe] Backend may still be initializing, attempting to load items anyway...')
    }
    const res = await apiClient.get<{ items: unknown[] }>('/items', { timeout: 30000 })
    if (!res.data || !res.data.items) {
      uploadedItems.value = []
      return
    }
    const raw = res.data.items
    uploadedItems.value = raw.map((item: unknown) => {
      const o = item as Record<string, unknown>
      const genderVal = o.gender !== undefined && o.gender !== null && o.gender !== '' ? o.gender : 'Unisex'
      const descVal = o.description !== undefined && o.description !== null && o.description !== '' ? o.description : null
      return {
        id: o.id,
        url: (o.path || o.url || '') as string,
        features: {
          path: (o.path || o.url || '') as string,
          type: (o.type as string) || 'Unknown',
          color: (o.color as string) || 'Unknown',
          style: (o.style as string) || 'Unknown',
          pattern: o.pattern,
          occasion: o.occasion,
          material: o.material,
          gender: genderVal,
          description: descVal,
        },
      } as Item
    })
    hasLoadedItems.value = true
    saveItemsToCache()
    uni.removeStorageSync('wardrobe_load_attempted')
  } catch (e: unknown) {
    const err = e as { code?: string; response?: { status: number; data?: { detail?: string } }; message?: string }
    let errorMessage = t('wardrobe.errors.loadFailed')
    if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error') || err.message?.includes('Connection')) {
      errorMessage = `Cannot reach backend. Ensure ${API_URL} is running.`
    } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      errorMessage = 'Request timed out; backend may still be initializing. Wait and refresh.'
    } else if (err.response?.status === 401) {
      uni.navigateTo({ url: '/pages/login/login' })
      return
    } else if (err.response?.status === 503) {
      errorMessage = 'Backend is initializing; please wait and refresh.'
    } else if (err.response?.data?.detail) {
      errorMessage = err.response.data.detail
    } else if (err.message) {
      errorMessage = err.message
    }
    uni.showToast({ title: errorMessage, icon: 'none', duration: 4000 })
  } finally {
    isLoadingItems.value = false
  }
}

const uploadedFileSignatures = new Set<string>()
const pendingUploadSignatures = new Set<string>()
function triggerFileInput() {
  if (typeof document === 'undefined') {
    uni.chooseImage({
      count: 9,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const paths = Array.isArray(res.tempFilePaths) ? res.tempFilePaths : res.tempFilePaths ? [res.tempFilePaths] : []
        if (!paths.length) return
        doNativeUpload(paths)
      },
    })
    return
  }
  const el = document.createElement('input')
  el.type = 'file'
  el.accept = 'image/*'
  el.multiple = true
  el.onchange = (ev) => {
    const target = ev.target as HTMLInputElement
    const files = target.files
    if (files && files.length) handleFileUpload(Array.from(files))
  }
  el.click()
}

function doNativeUpload(tempFilePaths: string[]) {
  const token = uni.getStorageSync('auth_token')
  const baseURL = (uploadApiClient.defaults.baseURL || '').replace(/\/$/, '')
  isUploading.value = true
  uploadProgress.value = { current: 0, total: tempFilePaths.length, currentFile: tempFilePaths[0] || '' }
  const allPending: PendingItem[] = []
  let done = 0
  tempFilePaths.forEach((filePath, i) => {
    uploadProgress.value = { current: i + 1, total: tempFilePaths.length, currentFile: filePath }
    uni.uploadFile({
      url: baseURL + '/upload',
      filePath,
      name: 'file',
      header: { Authorization: 'Bearer ' + token },
      success: (res) => {
        try {
          const data = JSON.parse(res.data || '{}') as { auto_added?: boolean; items?: Item[] }
          if (data.auto_added && data.items?.length) {
            loadUserItems()
          } else if (data.items?.length) {
            data.items.forEach((it) => allPending.push({ ...it } as PendingItem))
          }
        } catch (_) {}
        done++
        if (done === tempFilePaths.length) {
          isUploading.value = false
          uploadProgress.value = null
          if (allPending.length) {
            pendingItems.value.push(...allPending)
            selectedPendingIndex.value = 0
            showConfirmDialog.value = true
          } else {
            loadUserItems()
          }
        }
      },
      fail: () => {
        done++
        if (done === tempFilePaths.length) {
          isUploading.value = false
          uploadProgress.value = null
          uni.showToast({ title: t('wardrobe.upload.uploadFailed'), icon: 'none' })
        }
      },
    })
  })
}

function handleFileUpload(files: File[]) {
  const maxSize = 10 * 1024 * 1024
  const invalid: string[] = []
  const fileSignatures = new Map<File, string>()
  files.forEach((file) => {
    const sig = `${file.name}-${file.size}-${file.lastModified}`
    fileSignatures.set(file, sig)
    if (!file.type.startsWith('image/') && !file.name.toLowerCase().endsWith('.avif')) invalid.push(`${file.name} (not an image)`)
    else if (file.size > maxSize) invalid.push(`${file.name} (exceeds 10MB)`)
  })
  if (invalid.length) {
    uni.showToast({ title: invalid.join(', '), icon: 'none' })
    return
  }
  isUploading.value = true
  uploadProgress.value = { current: 0, total: files.length, currentFile: files[0]?.name || '' }
  const allPending: PendingItem[] = []
  let processed = 0
  files.forEach((file, i) => {
    uploadProgress.value = { current: i + 1, total: files.length, currentFile: file.name }
    const formData = new FormData()
    formData.append('file', file)
    uploadApiClient
      .post<{ auto_added: boolean; items: Item[] }>('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((response) => {
        if (response.data.auto_added) {
          loadUserItems()
        } else if (response.data.items?.length) {
          response.data.items.forEach((it) => allPending.push({ ...it } as PendingItem))
        }
        processed++
        if (processed === files.length) {
          isUploading.value = false
          uploadProgress.value = null
          if (allPending.length) {
            pendingItems.value.push(...allPending)
            selectedPendingIndex.value = 0
            showConfirmDialog.value = true
          }
        }
      })
      .catch(() => {
        processed++
        if (processed === files.length) {
          isUploading.value = false
          uploadProgress.value = null
        }
      })
  })
}

async function handleUrlUpload() {
  const text = imageUrlInput.value.trim()
  if (!text) {
    uni.showToast({ title: 'Please enter at least one image URL', icon: 'none' })
    return
  }
  const urlLines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const validUrls: string[] = []
  const invalidUrls: string[] = []
  urlLines.forEach((url) => {
    try {
      new URL(url)
      if (url.startsWith('http://') || url.startsWith('https://')) validUrls.push(url)
      else invalidUrls.push(`${url} (must start with http/https)`)
    } catch {
      invalidUrls.push(`${url} (invalid URL)`)
    }
  })
  if (invalidUrls.length) {
    uni.showToast({ title: invalidUrls.slice(0, 3).join('; '), icon: 'none' })
    return
  }
  if (!validUrls.length) return
  const newUrls = validUrls.filter((u) => !uploadedFileSignatures.has(u) && !pendingUploadSignatures.has(u))
  isUploadingUrl.value = true
  urlUploadProgress.value = { current: 0, total: newUrls.length, currentUrl: newUrls[0] || '' }
  const allPending: PendingItem[] = []
  for (let i = 0; i < newUrls.length; i++) {
    const url = newUrls[i]
    urlUploadProgress.value = { current: i + 1, total: newUrls.length, currentUrl: url }
    try {
      const formData = new FormData()
      formData.append('image_url', url)
      const res = await longUploadApiClient.post<{ auto_added: boolean; items: Item[] }>('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      if (res.data.auto_added) {
        await loadUserItems()
      } else if (res.data.items?.length) {
        res.data.items.forEach((it) => allPending.push({ ...it } as PendingItem))
      }
    } catch (_) {}
  }
  isUploadingUrl.value = false
  urlUploadProgress.value = null
  imageUrlInput.value = ''
  if (allPending.length) {
    pendingItems.value.push(...allPending)
    selectedPendingIndex.value = 0
    showConfirmDialog.value = true
  }
}

async function importExampleItems(gender: string) {
  isImporting.value = true
  try {
    const formData = new FormData()
    formData.append('gender', gender)
    await apiClient.post('/items/import-examples', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    await loadUserItems()
  } catch (e: unknown) {
    const err = e as { response?: { data?: { detail?: string } }; message?: string }
    uni.showToast({ title: err?.response?.data?.detail || err?.message || 'Import failed', icon: 'none' })
  } finally {
    isImporting.value = false
  }
}

function formatFeatureValue(v: string | string[] | undefined | null): string {
  if (v === null || v === undefined) return 'Unknown'
  if (Array.isArray(v)) return v.join(', ')
  return String(v)
}

async function confirmAddItems() {
  if (selectedPendingIndex.value === null || selectedPendingIndex.value < 0 || selectedPendingIndex.value >= pendingItems.value.length) {
    uni.showToast({ title: 'Please select an item to add', icon: 'none' })
    return
  }
  const selected = pendingItems.value[selectedPendingIndex.value]
  isConfirming.value = true
  try {
    await uploadApiClient.post<{ items: Item[] }>('/items/batch', [selected])
    await loadUserItems()
    pendingItems.value = []
    selectedPendingIndex.value = null
    showConfirmDialog.value = false
  } catch (e: unknown) {
    const err = e as { response?: { data?: { detail?: string } }; message?: string }
    uni.showToast({ title: err?.response?.data?.detail || err?.message || 'Failed to add', icon: 'none' })
  } finally {
    isConfirming.value = false
  }
}
function cancelAddItems() {
  pendingItems.value = []
  selectedPendingIndex.value = null
  showConfirmDialog.value = false
}

function openPreview(index: number) {
  const urls = filteredItems.value.map((item) => item.url || item.features?.path).filter(Boolean) as string[]
  if (urls.length === 0) return
  const resolvedUrls = urls.map((u) => getLargeImageUrl(u) || u)
  const current = resolvedUrls[index] ?? resolvedUrls[0]
  uni.previewImage({ current, urls: resolvedUrls })
}

// Item detail sheet
const showItemDetailsSheet = ref(false)
const detailItem = ref<Item | null>(null)
const isEditingItem = ref(false)
const editedFeatures = ref<Partial<ItemFeatures>>({})
const isUpdatingItem = ref(false)

function hasValue(v: unknown): boolean {
  return v !== null && v !== undefined && v !== ''
}

function openItemDetailsSheet(item: Item) {
  detailItem.value = item
  showItemDetailsSheet.value = true
  isEditingItem.value = false
  editedFeatures.value = {
    type: item.features?.type,
    color: item.features?.color,
    style: item.features?.style,
    pattern: item.features?.pattern,
    occasion: item.features?.occasion,
    material: item.features?.material,
    gender: item.features?.gender,
    description: item.features?.description,
  }
}

function startEditingItem() {
  isEditingItem.value = true
}

function cancelEditingItem() {
  if (detailItem.value?.features) {
    editedFeatures.value = {
      type: detailItem.value.features.type,
      color: detailItem.value.features.color,
      style: detailItem.value.features.style,
      pattern: detailItem.value.features.pattern,
      occasion: detailItem.value.features.occasion,
      material: detailItem.value.features.material,
      gender: detailItem.value.features.gender,
      description: detailItem.value.features.description,
    }
  }
  isEditingItem.value = false
}

async function saveItemUpdates() {
  if (!detailItem.value?.id) return
  isUpdatingItem.value = true
  try {
    await apiClient.put<{ message: string; item_id: string }>(`/items/${detailItem.value.id}`, { features: editedFeatures.value })
    if (detailItem.value.features) {
      Object.assign(detailItem.value.features, editedFeatures.value)
    }
    const idx = uploadedItems.value.findIndex((i) => String(i.id) === String(detailItem.value?.id))
    if (idx !== -1 && uploadedItems.value[idx].features) {
      Object.assign(uploadedItems.value[idx].features, editedFeatures.value)
      saveItemsToCache()
    }
    isEditingItem.value = false
  } catch (e: unknown) {
    const err = e as { response?: { data?: { detail?: string } }; message?: string }
    uni.showToast({ title: err?.response?.data?.detail || err?.message || 'Update failed', icon: 'none' })
    cancelEditingItem()
  } finally {
    isUpdatingItem.value = false
  }
}

function goBack() {
  uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/index/index' }) })
}

function restoreItemsFromCache(): boolean {
  if (Array.isArray(uploadedItems.value) && uploadedItems.value.length > 0) {
    hasLoadedItems.value = true
    return true
  }
  return false
}

onMounted(() => {
  store.value.hydrate()
  selectedFilter.value = t('wardrobe.categories.all')
  loadOutfitSelection()
  if (props.embedded) {
    const restored = restoreItemsFromCache()
    if (!restored) loadUserItems()
  }
})
onShow(() => {
  if (props.embedded) return
  const token = uni.getStorageSync('auth_token')
  if (!token) {
    uni.navigateTo({ url: '/pages/login/login?redirect=' + encodeURIComponent('/pages/wardrobe/wardrobe') })
    return
  }
  store.value.hydrate()
  loadOutfitSelection()
  if (uploadedItems.value.length === 0) {
    const restored = restoreItemsFromCache()
    if (!restored) {
      const hasTried = uni.getStorageSync('wardrobe_load_attempted') === 'true'
      if (!hasTried && !hasLoadedItems.value) {
        uni.setStorageSync('wardrobe_load_attempted', 'true')
        loadUserItems()
      }
    }
  }
})
</script>
