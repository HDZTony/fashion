<template>
  <scroll-view scroll-y class="min-h-screen bg-gradient-to-b from-pink-50 via-white to-purple-50" @scrolltolower="() => {}">
    <view class="p-6 pb-32">
      <!-- Step indicator -->
      <view class="flex gap-6 mb-6 text-sm">
        <view :class="['text-gray-400', step1Done ? 'text-pink-600 font-bold' : '']">1 {{ t('studio.modelPhoto.title') }}</view>
        <view :class="['text-gray-400', step2Done ? 'text-pink-600 font-bold' : '']">2 {{ t('studio.stepper.step2Title') }}</view>
        <view :class="['text-gray-400', step3Done ? 'text-pink-600 font-bold' : '']">3 {{ t('studio.stepper.step3Title') }}</view>
      </view>

      <!-- Model photo section -->
      <view class="bg-white rounded-2xl p-6 mb-6 border border-pink-100">
        <text class="text-xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent block mb-4">{{ t('studio.modelPhoto.title') }}</text>
        <!-- 有照片时：预览 + 操作按钮 -->
        <view v-if="store.modelImagePreviewUrl || isUploadingModel" class="p-2.5">
          <view class="flex items-center justify-between mb-2.5">
            <view>
              <text class="text-sm font-medium text-gray-700 block mb-1">{{ t('studio.modelPhoto.title') }}</text>
              <text class="text-xs text-pink-500 block">{{ t('studio.modelPhoto.description') }}</text>
            </view>
            <view v-if="store.modelImagePreviewUrl && !isUploadingModel" class="modelDelBtn" @click="removeModelImage">
              <text class="text-white text-xs">✕</text>
            </view>
          </view>
          <view class="w-32 h-32 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 relative">
            <image v-if="store.modelImagePreviewUrl" :src="getMediumImageUrl(store.modelImagePreviewUrl)" class="w-full h-full" mode="aspectFill" />
            <view v-if="isUploadingModel" class="uploadOverlay">
              <text class="uploadPercent">{{ modelUploadProgress }}%</text>
            </view>
          </view>
          <!-- 操作按钮行 -->
          <view class="flex flex-wrap items-center gap-1 mt-2.5 pt-2.5 border-t border-gray-100">
            <view class="actionBtn" @click="chooseModelImage">
              <text class="actionBtnText">↑ {{ t('studio.modelPhoto.replacePhoto') }}</text>
            </view>
            <view v-if="historicalModelImages.length" class="actionBtn" @click="showModelHistory = !showModelHistory">
              <text class="actionBtnText">{{ t('studio.modelPhoto.history') }}</text>
            </view>
            <view class="actionBtn" @click="showExampleModel = !showExampleModel">
              <text class="actionBtnText">{{ t('studio.example') }}</text>
            </view>
          </view>
        </view>
        <!-- 无照片时：空状态 + 上传按钮 -->
        <view v-else class="p-2.5 text-center">
          <text class="text-5xl block mb-2.5">✨</text>
          <view class="flex flex-wrap items-center justify-center gap-1">
            <view class="actionBtn" @click="chooseModelImage">
              <text class="actionBtnText">↑ {{ t('studio.modelPhoto.uploadNewPhoto') }}</text>
            </view>
            <view v-if="historicalModelImages.length" class="actionBtn" @click="showModelHistory = !showModelHistory">
              <text class="actionBtnText">{{ t('studio.modelPhoto.history') }}</text>
            </view>
            <view class="actionBtn" @click="showExampleModel = !showExampleModel">
              <text class="actionBtnText">{{ t('studio.example') }}</text>
            </view>
          </view>
          <text class="text-xs text-pink-600 block mt-2.5">{{ t('studio.modelPhoto.description') }}</text>
        </view>
      </view>

      <!-- Generate outfit section -->
      <view class="bg-white rounded-2xl p-6 mb-6 border border-pink-100">
        <text class="text-xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent block mb-4">{{ t('studio.tellAIAboutDay') }}</text>

        <!-- 背景选项 Tab：使用 wd-tabs 让切换更醒目 -->
        <wd-tabs
          :model-value="store.backgroundTabValue"
          @change="({ name }: { name: string }) => { store.backgroundTabValue = name }"
          animated
          shrink
          class="genTabs"
        >
          <wd-tab :title="t('studio.noBackgroundImage')" name="no-background" />
          <wd-tab :title="t('studio.withBackgroundImage')" name="with-background" />
        </wd-tabs>

        <!-- 带背景图面板 -->
        <view v-if="store.backgroundTabValue === 'with-background'" class="bgPanel">
          <view class="bgInputBox">
            <textarea
              v-model="store.backgroundActionPrompt"
              :placeholder="t('studio.backgroundActionPromptPlaceholder')"
              class="bgTextarea"
              rows="2"
            />
            <!-- 背景图预览 + 操作按钮行 -->
            <view class="flex flex-wrap items-center gap-2 pt-2.5 border-t border-pink-100">
              <view v-if="store.backgroundImagePreviewUrl || isUploadingBg" class="flex items-center gap-2">
                <view class="bgThumbSmall relative">
                  <image v-if="store.backgroundImagePreviewUrl" :src="getSmallImageUrl(store.backgroundImagePreviewUrl)" class="w-full h-full" mode="aspectFill" />
                  <view v-if="isUploadingBg" class="uploadOverlay rounded-lg">
                    <wd-loading color="#fff" size="32rpx" />
                  </view>
                </view>
                <view v-if="store.backgroundImagePreviewUrl && !isUploadingBg" class="modelDelBtn" @click="removeBackgroundImage">
                  <text class="text-white text-xs">✕</text>
                </view>
              </view>
              <view class="actionBtn" @click="chooseBackgroundImage">
                <text class="actionBtnText">↑ {{ t('studio.uploadBackgroundImage') }}</text>
              </view>
              <view class="actionBtn" @click="showBgHistory = !showBgHistory">
                <text class="actionBtnText">{{ t('studio.viewHistory') }}</text>
              </view>
              <view class="actionBtn" @click="showExampleBg = !showExampleBg">
                <text class="actionBtnText">{{ t('studio.example') }}</text>
              </view>
            </view>
          </view>
        </view>

        <!-- 风格提示词输入框 -->
        <view class="promptInputBox mt-4">
          <textarea
            v-model="store.customPrompt"
            :placeholder="t('studio.promptPlaceholder')"
            class="promptTextarea"
            rows="3"
          />
        </view>

        <!-- 生成按钮：使用 wd-button，loading 态自带动画 -->
        <wd-button
          type="primary"
          block
          round
          :loading="isGenerating"
          :disabled="isGenerating"
          custom-class="genBtn"
          @click="getRecommendations"
        >
          {{ isGenerating ? t('studio.aiThinking') : t('studio.generateOutfit') }} ✨
        </wd-button>

        <!-- branding -->
        <view class="flex items-center justify-center gap-2 mt-3">
          <text class="text-xs font-medium text-gray-700">fashion</text>
          <text class="text-xs text-pink-400">|</text>
          <text class="text-xs text-pink-600">Powered by Qwen</text>
          <text class="text-xs text-pink-400">|</text>
          <text class="text-xs text-pink-400">Independent service</text>
        </view>

        <!-- 加载中状态：使用 wd-loading -->
        <view v-if="isGenerating" class="genLoadingBlock">
          <wd-loading color="#ec4899" size="48rpx" />
          <text class="text-pink-600 text-sm mt-3 block">{{ t('studio.consultingKnowledgeBase') }}</text>
        </view>

        <wd-divider v-if="store.agentOutfits.length && !isGenerating" custom-class="my-4" />

        <!-- AI 搭配方案轮播 -->
        <view v-if="store.agentOutfits.length && !isGenerating" class="outfitPlans">
          <text class="planTitle">{{ t('studio.outfitPlans.title') }}</text>
          <scroll-view scroll-x class="outfitScroll" :show-scrollbar="false">
            <view class="outfitScrollInner">
              <view v-for="(outfit, idx) in store.agentOutfits" :key="idx" class="outfitCard">
                <text class="outfitCardTitle">{{ outfit.title }}</text>
                <text class="outfitCardReason">{{ outfit.reason }}</text>
                <wd-divider custom-class="my-2" />
                <view v-for="(it, i) in outfit.items" :key="i" class="outfitCardItem">
                  <wd-tag type="primary" plain size="small" custom-class="outfitRoleTag">{{ translateRole(it.role) }}</wd-tag>
                  <text class="outfitCardDesc">{{ it.description }}</text>
                </view>
                <wd-button
                  v-if="appliedIdx === idx"
                  type="success"
                  size="small"
                  block
                  round
                  custom-class="mt-3"
                  disabled
                >
                  {{ t('studio.outfitPlans.applied') }} ✓
                </wd-button>
                <wd-button
                  v-else
                  type="primary"
                  size="small"
                  block
                  round
                  plain
                  :loading="applyingIdx === idx"
                  :disabled="applyingIdx !== null"
                  custom-class="mt-3"
                  @click="applyOutfit(outfit, idx)"
                >
                  {{ applyingIdx === idx ? t('studio.outfitPlans.applying') : t('studio.outfitPlans.applyOutfit') }}
                </wd-button>
              </view>
            </view>
          </scroll-view>
        </view>
      </view>

      <!-- Applied outfit items -->
      <view class="bg-white rounded-2xl p-6 mb-6 border border-pink-100">
        <text class="text-xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent block mb-4">{{ t('studio.appliedOutfitItems.title') }}</text>
        <text class="text-sm text-gray-500 block mb-4">{{ t('studio.appliedOutfitItems.description') }}</text>
        <view class="appliedCount">{{ t('studio.appliedOutfitItems.title') }}（{{ store.activeWardrobeItems.length }}）</view>
        <view v-if="store.activeWardrobeItems.length === 0" class="emptyApplied">
          <text class="emptyIcon">👕</text>
          <text>{{ t('studio.appliedOutfitItems.noItemsSelected') }}</text>
          <text class="hint">{{ t('studio.appliedOutfitItems.goToWardrobePrompt') }}</text>
          <button size="mini" @click="goToWardrobe">{{ t('studio.appliedOutfitItems.goToWardrobe') }}</button>
        </view>
        <view v-else class="appliedGrid">
          <view v-for="(item, idx) in store.activeWardrobeItems" :key="item.id" class="appliedItem">
            <image :src="getSmallImageUrl(item.url || item.features.path)" class="itemThumb" mode="aspectFill" @click="previewImage(getSmallImageUrl(item.url || item.features.path))" />
            <button class="delBtn" @click.stop="removeActiveItem(String(item.id))">✕</button>
            <text class="itemLabel">{{ formatFeature(item.features.color) }} {{ formatFeature(item.features.type) }}</text>
          </view>
        </view>
      </view>

      <!-- Try-on section：仅在有可试穿的输入或已有试穿结果时显示 -->
      <view v-if="store.tryOnImageUrl" class="bg-white rounded-2xl p-6 mb-6 border border-pink-100">
        <text class="text-xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent block mb-4">{{ t('studio.reviewOutfits') }}</text>
        <view v-if="store.hasTryOnInput" class="tryOnCtrl">
          <text class="hint">{{ t('studio.readyToTryOn') }}</text>
          <button class="btnTryOn" :disabled="isTryingOn" @click="performTryOn">
            {{ isTryingOn ? t('studio.generatingTryOn') : t('studio.tryOnThisOutfit') }} ✨
          </button>
        </view>
        <view v-if="isTryingOn && !store.tryOnImageUrl" class="loadingBlock">
          <text class="loadingText">{{ t('studio.generatingVirtualTryOn') }}</text>
        </view>
        <view v-if="store.tryOnImageUrl" class="tryOnResult">
          <view class="resultHeader">
            <text class="resultTitle">{{ t('studio.virtualTryOn.title') }}</text>
            <button size="mini" :class="store.favoriteSaved ? 'saved' : ''" :disabled="isSavingFavorite" @click="saveFavorite">
              {{ isSavingFavorite ? t('studio.virtualTryOn.saving') : store.favoriteSaved ? t('studio.virtualTryOn.saved') : t('studio.virtualTryOn.favorite') }} ❤
            </button>
          </view>
          <image :src="getLargeImageUrl(store.tryOnImageUrl)" class="resultImg" mode="widthFix" @click="previewImage(store.tryOnImageUrl!)" />
        </view>
      </view>
    </view>

    <!-- Modals：居中弹窗，避开导航栏和 TabBar -->
    <!-- 历史模特图片弹窗 -->
    <view v-if="showModelHistory" class="modalOverlay" :style="modalSafeStyle" @click.self="showModelHistory = false">
      <view class="modalBox">
        <view class="modalBoxHeader">
          <text class="text-lg font-semibold text-gray-900">{{ t('studio.chooseHistoricalModel') }}</text>
          <view class="modalCloseCircle" @click="showModelHistory = false">
            <text class="text-pink-500 text-base">✕</text>
          </view>
        </view>
        <view v-if="historicalModelImages.length === 0" class="py-12 text-center">
          <text class="text-pink-400 block">{{ t('studio.noHistoricalModel') }}</text>
        </view>
        <scroll-view v-else scroll-x class="modalScrollX" :show-scrollbar="false">
          <view class="scrollXInner">
            <view v-for="img in historicalModelImages" :key="img.id" class="scrollCard scrollCardPortrait" @click="selectHistoricalModel(img)">
              <image :src="getThumbnailUrl(img.image_url)" class="scrollCardImg" mode="aspectFill" />
              <view class="scrollCardLabel">
                <text class="text-sm text-gray-700">{{ new Date(img.created_at).toLocaleDateString() }}</text>
              </view>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>
    <!-- 示例模特图片弹窗 -->
    <view v-if="showExampleModel" class="modalOverlay" :style="modalSafeStyle" @click.self="showExampleModel = false">
      <view class="modalBox">
        <view class="modalBoxHeader">
          <text class="text-lg font-semibold text-gray-900">{{ t('studio.chooseExampleModel') }}</text>
          <view class="modalCloseCircle" @click="showExampleModel = false">
            <text class="text-pink-500 text-base">✕</text>
          </view>
        </view>
        <scroll-view scroll-x class="modalScrollX" :show-scrollbar="false">
          <view class="scrollXInner">
            <view v-for="(url, i) in exampleModelImages" :key="i" class="scrollCard scrollCardPortrait" @click="selectExampleModel(url)">
              <image :src="getMediumImageUrl(url)" class="scrollCardImg" mode="aspectFill" />
              <view class="scrollCardLabel">
                <text class="text-sm font-medium text-gray-700">{{ t('studio.clickToUse') }}</text>
              </view>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>
    <!-- 历史背景图片弹窗 -->
    <view v-if="showBgHistory" class="modalOverlay" :style="modalSafeStyle" @click.self="showBgHistory = false">
      <view class="modalBox">
        <view class="modalBoxHeader">
          <text class="text-lg font-semibold text-gray-900">{{ t('studio.chooseHistoricalBackground') }}</text>
          <view class="modalCloseCircle" @click="showBgHistory = false">
            <text class="text-pink-500 text-base">✕</text>
          </view>
        </view>
        <view v-if="historicalBgImages.length === 0" class="py-12 text-center">
          <text class="text-pink-400 block">{{ t('studio.noHistoricalBackground') }}</text>
        </view>
        <scroll-view v-else scroll-x class="modalScrollX" :show-scrollbar="false">
          <view class="scrollXInner">
            <view v-for="img in historicalBgImages" :key="img.id" class="scrollCard scrollCardLandscape" @click="selectHistoricalBg(img)">
              <image :src="getThumbnailUrl(img.image_url)" class="scrollCardImg" mode="aspectFill" />
              <view class="scrollCardLabel">
                <text class="text-sm text-gray-700">{{ new Date(img.created_at).toLocaleDateString() }}</text>
              </view>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>
    <!-- 示例背景图片弹窗 -->
    <view v-if="showExampleBg" class="modalOverlay" :style="modalSafeStyle" @click.self="showExampleBg = false">
      <view class="modalBox">
        <view class="modalBoxHeader">
          <text class="text-lg font-semibold text-gray-900">{{ t('studio.chooseExampleBackground') }}</text>
          <view class="modalCloseCircle" @click="showExampleBg = false">
            <text class="text-pink-500 text-base">✕</text>
          </view>
        </view>
        <scroll-view scroll-x class="modalScrollX" :show-scrollbar="false">
          <view class="scrollXInner">
            <view
              v-for="(ex, i) in exampleBgImages"
              :key="i"
              class="scrollCard scrollCardLandscape"
              @click="selectExampleBg(ex)"
            >
              <image :src="getSmallImageUrl(ex.url)" class="scrollCardImg" mode="aspectFill" />
              <view class="scrollCardLabel">
                <text class="text-sm font-medium text-gray-700">{{ t('studio.clickToUse') }}</text>
              </view>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>
  </scroll-view>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, inject } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { useStudioStore } from '@/store/studio'
import { apiClient, uploadApiClient } from '@/lib/api-client'
import { getThumbnailUrl, getSmallImageUrl, getMediumImageUrl, getLargeImageUrl } from '@/lib/imageOptimizer'
import type { Item, AgentOutfit } from '@fashion-rec/shared'

const props = defineProps<{ embedded?: boolean }>()
const { t } = useI18n()
// 延迟获取 store，避免 App 端 Pinia 未初始化导致白屏（unibest 文档建议）
const store = computed(() => useStudioStore())

// 弹窗安全区域：避开导航栏和 TabBar，距离各留 20rpx（≈10px）
const modalSafeStyle = computed(() => {
  const sys = uni.getSystemInfoSync()
  const statusBarH = sys.statusBarHeight ?? 0
  const navbarH = statusBarH + 44
  const safeBottom = (sys as { safeAreaInsets?: { bottom?: number } }).safeAreaInsets?.bottom ?? 0
  const tabBarH = 50 + safeBottom
  const gap = 10
  return {
    top: `${navbarH + gap}px`,
    bottom: `${tabBarH + gap}px`,
  }
})

const exampleModelImages = ['https://r2.fashion-rec.com/example/IMG_9953.JPG', 'https://r2.fashion-rec.com/example/IMG_9954.JPG']
const exampleBgImages = [
  { url: 'https://r2.fashion-rec.com/example/nature-wallpaper-7541423_1920.jpg', prompt: 'studio.exampleBackgroundPrompts.001' },
  { url: 'https://r2.fashion-rec.com/example/pexels-abdul-ahad-2158214293-35229355.jpg', prompt: 'studio.exampleBackgroundPrompts.002' },
  { url: 'https://r2.fashion-rec.com/example/pexels-adamowicz-adamsky-2149308693-30925021.jpg', prompt: 'studio.exampleBackgroundPrompts.003' },
  { url: 'https://r2.fashion-rec.com/example/pexels-adriannacalvo-23384610.jpg', prompt: 'studio.exampleBackgroundPrompts.004' },
  { url: 'https://r2.fashion-rec.com/example/pexels-alecdoua-34864230.jpg', prompt: 'studio.exampleBackgroundPrompts.005' },
  { url: 'https://r2.fashion-rec.com/example/pexels-alexandre-moreira-2527876-34593721.jpg', prompt: 'studio.exampleBackgroundPrompts.006' },
  { url: 'https://r2.fashion-rec.com/example/pexels-alina-zahorulko-48514961-31445409.jpg', prompt: 'studio.exampleBackgroundPrompts.007' },
  { url: 'https://r2.fashion-rec.com/example/pexels-alina-zahorulko-48514961-31445410.jpg', prompt: 'studio.exampleBackgroundPrompts.008' },
  { url: 'https://r2.fashion-rec.com/example/pexels-alinaskazka-34702608.jpg', prompt: 'studio.exampleBackgroundPrompts.009' },
  { url: 'https://r2.fashion-rec.com/example/pexels-aljona-ovtsinnikova-121486965-24740438.jpg', prompt: 'studio.exampleBackgroundPrompts.010' },
  { url: 'https://r2.fashion-rec.com/example/pexels-alyona-nagel-1468385055-35224891.jpg', prompt: 'studio.exampleBackgroundPrompts.011' },
  { url: 'https://r2.fashion-rec.com/example/pexels-buxteh-30221622.jpg', prompt: 'studio.exampleBackgroundPrompts.012' },
  { url: 'https://r2.fashion-rec.com/example/pexels-casnafu-35129031.jpg', prompt: 'studio.exampleBackgroundPrompts.013' },
  { url: 'https://r2.fashion-rec.com/example/pexels-cheng-shi-song-427082720-33792335.jpg', prompt: 'studio.exampleBackgroundPrompts.014' },
  { url: 'https://r2.fashion-rec.com/example/pexels-christina99999-34801832.jpg', prompt: 'studio.exampleBackgroundPrompts.015' },
  { url: 'https://r2.fashion-rec.com/example/pexels-cigdem-bilgin-2154409770-35014795.jpg', prompt: 'studio.exampleBackgroundPrompts.016' },
  { url: 'https://r2.fashion-rec.com/example/pexels-dario-rawert-724203352-26765041.jpg', prompt: 'studio.exampleBackgroundPrompts.017' },
  { url: 'https://r2.fashion-rec.com/example/pexels-davidexpedition-31225636.jpg', prompt: 'studio.exampleBackgroundPrompts.018' },
  { url: 'https://r2.fashion-rec.com/example/pexels-dawidtkocz-34686175.jpg', prompt: 'studio.exampleBackgroundPrompts.019' },
  { url: 'https://r2.fashion-rec.com/example/pexels-diana-gp-358688833-14714743.jpg', prompt: 'studio.exampleBackgroundPrompts.020' },
  { url: 'https://r2.fashion-rec.com/example/pexels-diego-f-parra-33199-25254926.jpg', prompt: 'studio.exampleBackgroundPrompts.021' },
  { url: 'https://r2.fashion-rec.com/example/pexels-edgar-mosqueda-camacho-544076702-27204878.jpg', prompt: 'studio.exampleBackgroundPrompts.022' },
  { url: 'https://r2.fashion-rec.com/example/pexels-esrannuur-129682465-13820222.jpg', prompt: 'studio.exampleBackgroundPrompts.023' },
  { url: 'https://r2.fashion-rec.com/example/pexels-ezgi-kaya-498261122-35188967.jpg', prompt: 'studio.exampleBackgroundPrompts.024' },
  { url: 'https://r2.fashion-rec.com/example/pexels-galina-kolonitskaia-485466282-35002554.jpg', prompt: 'studio.exampleBackgroundPrompts.025' },
  { url: 'https://r2.fashion-rec.com/example/pexels-holodna-34974763.jpg', prompt: 'studio.exampleBackgroundPrompts.026' },
  { url: 'https://r2.fashion-rec.com/example/pexels-jan-korgaard-2426390-34712722.jpg', prompt: 'studio.exampleBackgroundPrompts.027' },
  { url: 'https://r2.fashion-rec.com/example/pexels-jonathan-yakubu-337910510-28041981.jpg', prompt: 'studio.exampleBackgroundPrompts.028' },
  { url: 'https://r2.fashion-rec.com/example/pexels-laura-paredis-1047081-27041249.jpg', prompt: 'studio.exampleBackgroundPrompts.029' },
  { url: 'https://r2.fashion-rec.com/example/pexels-maksim-smirnov-27565989-32315717.jpg', prompt: 'studio.exampleBackgroundPrompts.030' },
  { url: 'https://r2.fashion-rec.com/example/pexels-maurits-bausenhart-1112663191-34865450.jpg', prompt: 'studio.exampleBackgroundPrompts.031' },
  { url: 'https://r2.fashion-rec.com/example/pexels-myfoodie-2551794.jpg', prompt: 'studio.exampleBackgroundPrompts.032' },
  { url: 'https://r2.fashion-rec.com/example/pexels-nilsr-28271725.jpg', prompt: 'studio.exampleBackgroundPrompts.033' },
  { url: 'https://r2.fashion-rec.com/example/pexels-ramon-clemente-1097299-34314485.jpg', prompt: 'studio.exampleBackgroundPrompts.034' },
  { url: 'https://r2.fashion-rec.com/example/pexels-ricky-kwong-113005840-35360579.jpg', prompt: 'studio.exampleBackgroundPrompts.035' },
  { url: 'https://r2.fashion-rec.com/example/pexels-simon73-30560968.jpg', prompt: 'studio.exampleBackgroundPrompts.036' },
  { url: 'https://r2.fashion-rec.com/example/pexels-studio-lichtfang-2152913672-32488229.jpg', prompt: 'studio.exampleBackgroundPrompts.037' },
  { url: 'https://r2.fashion-rec.com/example/pexels-tatilimiz-villada-2156582649-35141528.jpg', prompt: 'studio.exampleBackgroundPrompts.038' },
  { url: 'https://r2.fashion-rec.com/example/pexels-tobias-schwenk-2158345167-35319435.jpg', prompt: 'studio.exampleBackgroundPrompts.039' },
  { url: 'https://r2.fashion-rec.com/example/pexels-took-a-snap-789265640-20751943.jpg', prompt: 'studio.exampleBackgroundPrompts.040' },
  { url: 'https://r2.fashion-rec.com/example/pexels-urtimud-89-76108288-35117015.jpg', prompt: 'studio.exampleBackgroundPrompts.041' },
  { url: 'https://r2.fashion-rec.com/example/pexels-vahestnatukewild-34774915.jpg', prompt: 'studio.exampleBackgroundPrompts.042' },
  { url: 'https://r2.fashion-rec.com/example/pexels-valentin_21-808934417-31148513.jpg', prompt: 'studio.exampleBackgroundPrompts.043' },
  { url: 'https://r2.fashion-rec.com/example/pexels-wael-belkahla-2158256982-35329797.jpg', prompt: 'studio.exampleBackgroundPrompts.044' },
]

interface HistoricalImage { id: string; image_url: string; created_at: string }

const historicalModelImages = ref<HistoricalImage[]>([])
const historicalBgImages = ref<HistoricalImage[]>([])
const showModelHistory = ref(false)
const showExampleModel = ref(false)
const showBgHistory = ref(false)
const showExampleBg = ref(false)
const isGenerating = ref(false)
const isTryingOn = ref(false)
const isUploadingModel = ref(false)
const isUploadingBg = ref(false)
const modelUploadProgress = ref(0)
const applyingIdx = ref<number | null>(null)
const appliedIdx = ref<number | null>(null)
const isSavingFavorite = ref(false)
const modelTempPath = ref('') // temp path when user picks new image (before upload completes)

const step1Done = computed(() => !!store.value.modelImagePreviewUrl)
const step2Done = computed(() => store.value.hasTryOnInput)
const step3Done = computed(() => !!store.value.tryOnImageUrl)

const BASE_URL = (uploadApiClient.defaults.baseURL || '').replace(/\/$/, '')
const token = () => uni.getStorageSync('auth_token')

/** 检查是否已登录，未登录则提示并跳转登录页，返回 true 表示需要登录（调用方应 return） */
function requireLogin(): boolean {
  if (token()) return false
  uni.showToast({ title: t('studio.loginRequired'), icon: 'none' })
  uni.navigateTo({ url: '/pages/login/login?redirect=' + encodeURIComponent('/pages/studio/studio') })
  return true
}

function formatFeature(v: string | string[] | undefined) {
  if (!v) return 'Unknown'
  return Array.isArray(v) ? v.join(', ') : v
}
function translateRole(role: string) {
  const m: Record<string, string> = {
    top: t('studio.outfitPlans.roles.top'),
    bottom: t('studio.outfitPlans.roles.bottom'),
    outer: t('studio.outfitPlans.roles.outer'),
    shoes: t('studio.outfitPlans.roles.shoes'),
    accessory: t('studio.outfitPlans.roles.accessory'),
  }
  return m[role.toLowerCase()] || role
}

function saveStore() { store.value.persist() }
watch(() => store.value.customPrompt, saveStore)
watch(() => store.value.backgroundImageUrl, saveStore)
watch(() => store.value.backgroundImagePreviewUrl, saveStore)
watch(() => store.value.backgroundActionPrompt, saveStore)
watch(() => store.value.modelImagePreviewUrl, saveStore)
watch(() => store.value.tryOnImageUrl, saveStore)
watch(() => store.value.agentOutfits, saveStore, { deep: true })
watch(() => store.value.activeWardrobeIds, saveStore, { deep: true })
watch(() => store.value.uploadedItems, saveStore, { deep: true })
watch(() => store.value.activeWardrobeRoleMapEntries, saveStore, { deep: true })
watch(() => store.value.originalAppliedOutfit, saveStore, { deep: true })

function initStudio() {
  store.value.hydrate()
  syncFromWardrobe()
  // 已登录时才拉取历史图片和恢复试穿记录（需要鉴权的接口）
  if (token()) {
    loadHistoricalImages()
    restoreFromTryonHistory()
  }
}
onShow(() => {
  if (props.embedded) return
  initStudio()
})
onMounted(() => {
  if (props.embedded) initStudio()
})

function restoreFromTryonHistory() {
  const raw = uni.getStorageSync('tryon_history_restore')
  if (!raw) return
  try {
    const data = JSON.parse(raw)
    if (data.prompt) store.value.customPrompt = data.prompt
    if (data.background_image_url) {
      store.value.backgroundImageUrl = data.background_image_url
      store.value.backgroundImagePreviewUrl = data.background_image_url
    }
    if (data.image_url) store.value.tryOnImageUrl = data.image_url
    if (data.model_image_url) store.value.modelImagePreviewUrl = data.model_image_url
    if (data.garment_urls && Array.isArray(data.garment_urls) && data.garment_urls.length > 0 && store.value.uploadedItems.length > 0) {
      const matched: string[] = []
      data.garment_urls.forEach((url: string) => {
        const item = store.value.uploadedItems.find((u) => (u.url || u.features?.path) === url || ((u.url || u.features?.path) && url?.includes(u.url || u.features?.path || '')))
        if (item?.id) matched.push(String(item.id))
      })
      if (matched.length) store.value.activeWardrobeIds = matched
    }
    uni.removeStorageSync('tryon_history_restore')
    saveStore()
  } catch (_) {}
}

onLoad(() => {
  store.value.hydrate()
})

function syncFromWardrobe() {
  const cached = uni.getStorageSync('wardrobe-items')
  if (cached) {
    try {
      const items = JSON.parse(cached) as Item[]
      if (Array.isArray(items)) store.value.uploadedItems = items
    } catch (_) {}
  }
  const selected = uni.getStorageSync('wardrobe-selected-ids')
  if (selected) {
    try {
      const ids = JSON.parse(selected) as string[]
      if (Array.isArray(ids) && ids.length > 0) {
        store.value.activeWardrobeIds = [...new Set([...store.value.activeWardrobeIds, ...ids])]
        store.value.selectedItemIds = ids
      }
    } catch (_) {}
  }
}

async function loadHistoricalImages() {
  try {
    const [bgRes, modelRes] = await Promise.all([
      apiClient.get<{ images: HistoricalImage[] }>('/user-images?image_type=background'),
      apiClient.get<{ images: HistoricalImage[] }>('/user-images?image_type=model'),
    ])
    historicalBgImages.value = bgRes.data?.images || []
    historicalModelImages.value = modelRes.data?.images || []
  } catch (err: any) {
    console.warn('[Studio] Failed to load historical images:', err?.response?.status, err?.message)
    // 401 表示token过期或无效，静默失败（用户刷新页面时会重新登录）
    // 其他错误（如网络问题）也静默处理，不影响主流程
  }
}

function chooseModelImage() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: (res) => {
      const path = res.tempFilePaths?.[0]
      if (!path) return
      isUploadingModel.value = true
      modelUploadProgress.value = 0
      uni.uploadFile({
        url: BASE_URL + '/model-image',
        filePath: path,
        name: 'file',
        header: { Authorization: 'Bearer ' + token() },
        success: (u) => {
          if (u.statusCode === 200) {
            try {
              const d = JSON.parse(u.data)
              if (d.url) {
                store.value.modelImagePreviewUrl = d.url
                modelTempPath.value = ''
                loadHistoricalImages()
              }
            } catch (_) {}
          }
          isUploadingModel.value = false
          modelUploadProgress.value = 100
        },
        fail: () => {
          isUploadingModel.value = false
          uni.showToast({ title: t('studio.errors.uploadFailed'), icon: 'none' })
        },
      })
    },
  })
}

function removeModelImage() {
  store.value.modelImagePreviewUrl = null
  modelTempPath.value = ''
  saveStore()
}

function selectHistoricalModel(img: HistoricalImage) {
  store.value.modelImagePreviewUrl = img.image_url
  showModelHistory.value = false
  saveStore()
}

function selectExampleModel(url: string) {
  if (url.includes('r2.fashion-rec.com')) {
    store.value.modelImagePreviewUrl = url
  } else {
    uni.showToast({ title: 'Use R2 URL', icon: 'none' })
  }
  showExampleModel.value = false
  saveStore()
}

function chooseBackgroundImage() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: (res) => {
      const path = res.tempFilePaths?.[0]
      if (!path) return
      isUploadingBg.value = true
      uni.uploadFile({
        url: BASE_URL + '/background-image',
        filePath: path,
        name: 'file',
        header: { Authorization: 'Bearer ' + token() },
        success: (u) => {
          if (u.statusCode === 200) {
            try {
              const d = JSON.parse(u.data)
              if (d.url) {
                store.value.backgroundImageUrl = d.url
                store.value.backgroundImagePreviewUrl = d.url
                loadHistoricalImages()
              }
            } catch (_) {}
          }
          isUploadingBg.value = false
        },
        fail: () => {
          isUploadingBg.value = false
          uni.showToast({ title: t('studio.errors.uploadFailed'), icon: 'none' })
        },
      })
    },
  })
}

function removeBackgroundImage() {
  store.value.backgroundImageUrl = null
  store.value.backgroundImagePreviewUrl = null
  saveStore()
}

function selectHistoricalBg(img: HistoricalImage) {
  store.value.backgroundImageUrl = img.image_url
  store.value.backgroundImagePreviewUrl = img.image_url
  showBgHistory.value = false
  saveStore()
}

function selectExampleBg(ex: { url: string; prompt: string }) {
  if (ex.url.includes('r2.fashion-rec.com')) {
    store.value.backgroundImageUrl = ex.url
    store.value.backgroundImagePreviewUrl = ex.url
    if (ex.prompt.startsWith('studio.')) store.value.backgroundActionPrompt = t(ex.prompt)
    else store.value.backgroundActionPrompt = ex.prompt
    store.value.backgroundTabValue = 'with-background'
  }
  showExampleBg.value = false
  saveStore()
}

function chooseNoBackgroundAndClose() {
  removeBackgroundImage()
  store.value.backgroundTabValue = 'no-background'
  showExampleBg.value = false
  saveStore()
}

function chooseWithBackgroundAndClose() {
  store.value.backgroundTabValue = 'with-background'
  showExampleBg.value = false
  saveStore()
}

async function getRecommendations() {
  isGenerating.value = true
  store.value.agentOutfits = []
  store.value.tryOnImageUrl = null
  try {
    if (store.value.uploadedItems.length === 0) {
      const res = await apiClient.get<{ items: unknown[] }>('/items')
      const raw = res.data?.items || []
      store.value.uploadedItems = raw.map((item: unknown) => {
        const o = item as Record<string, unknown>
        return { id: o.id, url: (o.path || o.url) as string, features: { path: (o.path || o.url) as string, type: (o.type as string) || 'Unknown', color: (o.color as string) || 'Unknown', style: (o.style as string) || 'Unknown', pattern: o.pattern, occasion: o.occasion, material: o.material, gender: o.gender, description: o.description } } as Item
      })
    }
    const payload = {
      base_item_ids: store.value.activeWardrobeIds.length ? store.value.activeWardrobeIds : undefined,
      prompt: store.value.customPrompt,
      background_image_url: store.value.backgroundImageUrl || undefined,
      background_action_prompt: store.value.backgroundTabValue === 'with-background' && store.value.backgroundActionPrompt ? store.value.backgroundActionPrompt : undefined,
      model_image_url: store.value.modelImagePreviewUrl || undefined,
      selected_items_roles: store.value.activeWardrobeIds.length ? Object.fromEntries(store.value.getActiveWardrobeRoleMap()) : undefined,
    }
    const res = await uploadApiClient.post<{ outfits: AgentOutfit[] }>('/outfit', payload)
    store.value.agentOutfits = res.data?.outfits || []
    saveStore()
  } catch (e: unknown) {
    uni.showToast({ title: (e as { message?: string })?.message || 'Failed', icon: 'none' })
  } finally {
    isGenerating.value = false
  }
}

async function applyOutfit(outfit: AgentOutfit, idx: number) {
  applyingIdx.value = idx
  appliedIdx.value = null
  try {
    if (store.value.uploadedItems.length === 0) {
      const res = await apiClient.get<{ items: unknown[] }>('/items')
      const raw = res.data?.items || []
      store.value.uploadedItems = raw.map((item: unknown) => {
        const o = item as Record<string, unknown>
        return { id: o.id, url: (o.path || o.url) as string, features: { path: (o.path || o.url) as string, type: (o.type as string) || 'Unknown', color: (o.color as string) || 'Unknown', style: (o.style as string) || 'Unknown', pattern: o.pattern, occasion: o.occasion, material: o.material, gender: o.gender, description: o.description } } as Item
      })
    }
    const ids = outfit.items.map((it) => it.wardrobe_id).filter(Boolean).map(String)
    store.value.activeWardrobeIds = ids
    const map = new Map<string, string>()
    outfit.items.forEach((it) => { if (it.wardrobe_id) map.set(String(it.wardrobe_id), it.role) })
    store.value.setActiveWardrobeRoleMap(map)
    store.value.originalAppliedOutfit = outfit
    appliedIdx.value = idx
    saveStore()
  } catch (e: unknown) {
    uni.showToast({ title: (e as { message?: string })?.message || 'Failed', icon: 'none' })
  } finally {
    applyingIdx.value = null
  }
}

function removeActiveItem(id: string) {
  store.value.activeWardrobeIds = store.value.activeWardrobeIds.filter((i) => i !== id)
  const map = store.value.getActiveWardrobeRoleMap()
  map.delete(id)
  store.value.setActiveWardrobeRoleMap(map)
  saveStore()
}

const switchToWardrobe = inject<(() => void) | null>('switchToWardrobe', null)
function goToWardrobe() {
  if (switchToWardrobe) {
    switchToWardrobe()
  } else {
    uni.navigateTo({ url: '/pages/wardrobe/wardrobe' })
  }
}

async function performTryOn() {
  if (!store.value.modelImagePreviewUrl && !modelTempPath.value) {
    uni.showToast({ title: t('studio.modelPhoto.pleaseUploadFirst'), icon: 'none' })
    return
  }
  const garmentUrls = store.value.activeWardrobeItems.map((i) => i.url || i.features.path).filter(Boolean) as string[]
  const unmatched = store.value.unmatchedOutfitDescriptions
  if (garmentUrls.length === 0 && unmatched.length === 0) {
    uni.showToast({ title: t('studio.outfitPlans.pleaseChooseOutfit'), icon: 'none' })
    return
  }
  isTryingOn.value = true
  store.value.tryOnImageUrl = null
  store.value.setFavoriteStatus(false, null)
  try {
    const fd = new FormData()
    if (store.value.modelImagePreviewUrl) {
      fd.append('person_image_url', store.value.modelImagePreviewUrl)
    }
    fd.append('garment_urls', JSON.stringify(garmentUrls))
    if (unmatched.length) fd.append('unmatched_descriptions', JSON.stringify(unmatched))
    if (store.value.backgroundImageUrl) fd.append('background_image_url', store.value.backgroundImageUrl)
    if (store.value.backgroundActionPrompt) fd.append('background_action_prompt', store.value.backgroundActionPrompt)
    if (store.value.customPrompt) fd.append('prompt', store.value.customPrompt)

    const res = await uploadApiClient.post<{ url: string }>('/try-on', fd)
    store.value.tryOnImageUrl = res.data?.url || null
    saveStore()
  } catch (e: unknown) {
    const err = e as { response?: { data?: { detail?: string }; status?: number }; message?: string }
    const msg = err.response?.data?.detail || err.message || t('studio.errors.tryOnFailed')
    uni.showToast({ title: msg, icon: 'none' })
  } finally {
    isTryingOn.value = false
  }
}

async function saveFavorite() {
  if (!store.value.tryOnImageUrl) return
  if (requireLogin()) return
  if (store.value.favoriteSaved && store.value.currentFavoriteId) {
    try {
      await apiClient.delete(`/favorites/${store.value.currentFavoriteId}`)
      if (store.value.setFavoriteStatus) store.value.setFavoriteStatus(false, null)
      saveStore()
    } catch (_) {
      uni.showToast({ title: t('studio.errors.saveFavoriteFailed'), icon: 'none' })
    }
    return
  }
  isSavingFavorite.value = true
  try {
    const garmentUrls = store.value.activeWardrobeItems.map((i) => i.url || i.features.path).filter(Boolean) as string[]
    const res = await apiClient.post<{ id: string }>('/favorites', {
      image_url: store.value.tryOnImageUrl,
      title: store.value.originalAppliedOutfit?.title || 'Try-on result',
      garment_urls: garmentUrls.length ? garmentUrls : undefined,
      background_image_url: store.value.backgroundImageUrl || undefined,
      prompt: store.value.customPrompt || undefined,
      model_image_url: store.value.modelImagePreviewUrl || undefined,
    })
    if (store.value.setFavoriteStatus) store.value.setFavoriteStatus(true, res.data.id)
    saveStore()
  } catch (_) {
    uni.showToast({ title: t('studio.errors.saveFavoriteFailed'), icon: 'none' })
  } finally {
    isSavingFavorite.value = false
  }
}

function previewImage(url: string) {
  uni.previewImage({ urls: [url] })
}
</script>

<style scoped>
/* ===== 生成穿搭 - Tab 栏 ===== */
:deep(.genTabs .wd-tabs__nav) {
  background: transparent !important;
}
:deep(.genTabs .wd-tabs__line) {
  background: linear-gradient(90deg, #ec4899, #a855f7) !important;
}

/* ===== 生成穿搭 - 背景面板 ===== */
.bgPanel { margin-top: 20rpx; }
.bgInputBox {
  border: 2rpx solid #fce7f3;
  border-radius: 24rpx;
  padding: 20rpx;
  background: #fff;
  transition: border-color 0.2s;
}
.bgTextarea {
  width: 100%;
  font-size: 28rpx;
  border: none;
  outline: none;
  background: transparent;
  resize: none;
  box-sizing: border-box;
  color: #374151;
}
.bgThumbSmall {
  width: 80rpx;
  height: 80rpx;
  border-radius: 12rpx;
  overflow: hidden;
  border: 2rpx solid #e5e7eb;
  background: #f9fafb;
  flex-shrink: 0;
}

/* ===== 生成穿搭 - 风格提示输入 ===== */
.promptInputBox {
  border: 2rpx solid #fce7f3;
  border-radius: 24rpx;
  padding: 4rpx;
  background: #fff;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.promptTextarea {
  width: 100%;
  padding: 20rpx;
  font-size: 28rpx;
  border: none;
  outline: none;
  background: transparent;
  resize: none;
  box-sizing: border-box;
  color: #374151;
}

/* ===== 生成按钮 ===== */
:deep(.genBtn) {
  margin-top: 24rpx !important;
  height: 96rpx !important;
  font-size: 32rpx !important;
  background: linear-gradient(90deg, #ec4899, #a855f7) !important;
  border: none !important;
}

/* ===== 加载状态 ===== */
.genLoadingBlock {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48rpx 0;
  border: 2rpx solid #fce7f3;
  border-radius: 24rpx;
  background: linear-gradient(180deg, #fdf2f8, #fff);
  margin-top: 24rpx;
}

/* ===== 上传覆盖层 ===== */
.uploadOverlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 16rpx; }
.uploadPercent { color: #fff; font-size: 32rpx; }

/* ===== 删除按钮（圆形红色） ===== */
.modelDelBtn { width: 48rpx; height: 48rpx; background: #ef4444; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

/* ===== 操作按钮（对齐前端 inline-flex 样式） ===== */
.actionBtn { display: inline-flex; align-items: center; gap: 8rpx; padding: 12rpx 20rpx; border-radius: 16rpx; background: transparent; }
.actionBtnText { font-size: 24rpx; color: #ec4899; }

/* ===== 背景图区域 ===== */
.bgSection { margin-top: 16rpx; }
.bgPreview { position: relative; display: block; width: 100%; margin-top: 16rpx; }
.bgThumb { width: 100%; height: 240rpx; border-radius: 16rpx; display: block; }

/* ===== 提示文本 ===== */
.hint { font-size: 24rpx; color: #ec4899; }

/* ===== 已应用衣物网格 ===== */
.appliedCount { font-size: 26rpx; margin-bottom: 16rpx; }
.emptyApplied { text-align: center; padding: 48rpx; }
.emptyApplied text { display: block; margin-bottom: 8rpx; }
.appliedGrid { display: flex; flex-wrap: wrap; gap: 24rpx; }
.appliedItem { position: relative; width: 160rpx; text-align: center; }
.itemThumb { width: 160rpx; height: 160rpx; border-radius: 16rpx; background: #fce7f3; }
.delBtn { position: absolute; top: -8rpx; right: -8rpx; width: 48rpx; height: 48rpx; padding: 0; line-height: 48rpx; background: #ef4444; color: #fff; border-radius: 50%; font-size: 24rpx; }
.itemLabel { font-size: 22rpx; display: block; margin-top: 8rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ===== AI 搭配方案轮播 ===== */
.outfitPlans { margin-top: 8rpx; }
.planTitle { font-size: 30rpx; font-weight: 600; display: block; margin-bottom: 16rpx; }
.outfitScroll { white-space: nowrap; padding-bottom: 16rpx; }
.outfitScrollInner { display: inline-flex; gap: 24rpx; padding: 0 4rpx; }
.outfitCard {
  display: inline-block;
  width: 560rpx;
  padding: 28rpx;
  background: linear-gradient(135deg, #fdf2f8, #faf5ff);
  border-radius: 24rpx;
  border: 2rpx solid #fce7f3;
  vertical-align: top;
  white-space: normal;
  box-shadow: 0 4rpx 16rpx rgba(236, 72, 153, 0.08);
}
.outfitCardTitle { font-weight: 700; font-size: 30rpx; display: block; margin-bottom: 8rpx; color: #1f2937; }
.outfitCardReason { font-size: 24rpx; color: #ec4899; display: block; margin-bottom: 8rpx; line-height: 1.5; }
.outfitCardItem { display: flex; align-items: flex-start; gap: 12rpx; margin-bottom: 12rpx; }
:deep(.outfitRoleTag) { flex-shrink: 0; }
.outfitCardDesc { font-size: 24rpx; color: #4b5563; line-height: 1.5; }

/* ===== 试穿区域 ===== */
.tryOnCtrl { padding: 24rpx; background: #f9fafb; border-radius: 16rpx; }
.btnTryOn { padding: 20rpx 32rpx; border: 2rpx solid #ec4899; color: #ec4899; border-radius: 16rpx; font-size: 28rpx; }
.tryOnResult { margin-top: 24rpx; padding-top: 24rpx; border-top: 1rpx solid #fce7f3; }
.resultHeader { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.resultTitle { font-size: 30rpx; font-weight: 600; }
.resultImg { width: 100%; border-radius: 16rpx; }

/* ===== 弹窗：居中显示，top/bottom 由 JS 动态设置避开导航栏和 TabBar ===== */
.modalOverlay {
  position: fixed;
  left: 0;
  right: 0;
  /* top / bottom 由 :style="modalSafeStyle" 动态注入 */
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  padding: 20rpx;
}
.modalBox {
  background: #fff;
  border-radius: 32rpx;
  box-shadow: 0 10rpx 60rpx rgba(0, 0, 0, 0.2);
  width: 100%;
  max-height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.modalBoxHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx 40rpx;
  border-bottom: 1rpx solid #e5e7eb;
  flex-shrink: 0;
}
.modalCloseCircle {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ===== 弹窗内横向滚动区域 ===== */
.modalScrollX {
  flex: 1;
  white-space: nowrap;
  padding: 32rpx 0 48rpx;
}
.scrollXInner {
  display: inline-flex;
  gap: 24rpx;
  padding: 0 32rpx;
}

/* 单张滚动卡片：尽量大，占 75vw 宽度 */
.scrollCard {
  position: relative;
  display: inline-block;
  width: 75vw;
  flex-shrink: 0;
  border-radius: 24rpx;
  overflow: hidden;
  border: 4rpx solid #e5e7eb;
  background: #f9fafb;
  box-sizing: border-box;
  vertical-align: top;
  white-space: normal;
}
/* 竖图（模特）：高度更高 */
.scrollCardPortrait {
  height: 80vw;
}
/* 横图（背景）：4:3 比例 */
.scrollCardLandscape {
  height: 56vw;
}
.scrollCardImg {
  width: 100%;
  height: 100%;
  display: block;
}
.scrollCardLabel {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20rpx;
  display: flex;
  justify-content: center;
  background: linear-gradient(transparent, rgba(0,0,0,0.15));
}
.scrollCardLabel text {
  background: rgba(255, 255, 255, 0.92);
  padding: 10rpx 28rpx;
  border-radius: 12rpx;
}
</style>
