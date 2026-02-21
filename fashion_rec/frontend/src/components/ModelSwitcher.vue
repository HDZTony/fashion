<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ChevronsUpDown, Plus, Trash2, User, Image } from 'lucide-vue-next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { useModelImages, type ModelImage } from '@/composables/useModelImages'
import { useAuthStore } from '@/stores/auth'
import { getThumbnailUrl } from '@/lib/imageOptimizer'

const { isMobile } = useSidebar()
const authStore = useAuthStore()
const {
  models,
  allModels,
  isUploading,
  uploadProgress,
  activeModelId,
  activeModelUrl,
  exampleModelImages,
  loadModels,
  uploadModelImage,
  deleteModel,
  selectModel,
} = useModelImages()

const fileInputRef = ref<HTMLInputElement | null>(null)

const activeModel = computed<ModelImage | null>(() => {
  if (!activeModelId.value) return null
  return allModels.value.find(m => m.id === activeModelId.value) ?? null
})

function autoSelectFirst() {
  if (!activeModelId.value && allModels.value.length > 0) {
    selectModel(allModels.value[0].id)
  }
}

onMounted(async () => {
  if (authStore.isAuthenticated) {
    await loadModels()
  }
  autoSelectFirst()
})

watch(() => authStore.isAuthenticated, async (isAuth) => {
  if (isAuth) {
    await loadModels()
    autoSelectFirst()
  }
})

watch(models, () => {
  autoSelectFirst()
})

function displayName(model: ModelImage): string {
  return model.nickname || new Date(model.created_at).toLocaleDateString()
}

function onAddModelClick() {
  fileInputRef.value?.click()
}

async function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  try {
    await uploadModelImage(file)
  } catch (e: any) {
    console.error('Model upload failed:', e)
    alert(`Upload failed: ${e?.response?.data?.detail || e.message || 'Unknown error'}`)
  }
  target.value = ''
}

async function onDeleteModel(model: ModelImage) {
  if (!confirm('Delete this model? This action cannot be undone.')) return
  try {
    await deleteModel(model.id)
  } catch (e: any) {
    console.error('Delete model failed:', e)
    alert(`Delete failed: ${e?.response?.data?.detail || e.message || 'Unknown error'}`)
  }
}

function onSelectModel(model: ModelImage) {
  selectModel(model.id)
}

function onSelectExample(model: ModelImage) {
  selectModel(model.id)
}
</script>

<template>
  <SidebarMenu>
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <SidebarMenuButton
            size="lg"
            class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <!-- Active model thumbnail or placeholder -->
            <div class="flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden bg-pink-50 border border-pink-200">
              <img
                v-if="activeModelUrl"
                :src="getThumbnailUrl(activeModelUrl)"
                alt="Active model"
                class="size-8 object-cover"
              />
              <User v-else class="size-4 text-pink-400" />
            </div>
            <div class="grid flex-1 text-left text-sm leading-tight">
              <span class="truncate font-medium">
                {{ activeModel ? displayName(activeModel) : 'Select Model' }}
              </span>
              <span class="truncate text-xs text-muted-foreground">
                {{ allModels.length }} model{{ allModels.length !== 1 ? 's' : '' }}
              </span>
            </div>
            <!-- Upload progress indicator -->
            <div v-if="isUploading" class="flex items-center gap-1">
              <div class="w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
              <span class="text-xs text-muted-foreground">{{ uploadProgress }}%</span>
            </div>
            <ChevronsUpDown v-else class="ml-auto" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          class="w-[--reka-dropdown-menu-trigger-width] min-w-64 rounded-lg"
          align="start"
          :side="isMobile ? 'bottom' : 'right'"
          :side-offset="4"
        >
          <!-- Model list -->
          <DropdownMenuLabel class="text-xs text-muted-foreground">
            Models
          </DropdownMenuLabel>

          <DropdownMenuItem
            v-for="model in models"
            :key="model.id"
            class="gap-2 p-2 group/item"
            @click="onSelectModel(model)"
          >
            <Avatar class="h-8 w-8 rounded-md" shape="square" size="sm">
              <AvatarImage
                :src="getThumbnailUrl(model.image_url)"
                :alt="`Model ${model.id}`"
                class="object-cover"
              />
              <AvatarFallback class="rounded-md">
                <User class="size-3.5" />
              </AvatarFallback>
            </Avatar>
            <div class="flex-1 min-w-0">
              <div class="text-sm truncate">{{ displayName(model) }}</div>
            </div>
            <!-- Delete button (visible on hover) -->
            <button
              class="opacity-0 group-hover/item:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-all"
              @click.stop="onDeleteModel(model)"
              title="Delete model"
            >
              <Trash2 class="size-3.5" />
            </button>
          </DropdownMenuItem>

          <div
            v-if="models.length === 0 && !isUploading"
            class="px-2 py-3 text-center text-xs text-muted-foreground"
          >
            No models yet
          </div>

          <!-- Example models -->
          <DropdownMenuSeparator v-if="exampleModelImages.length > 0" />
          <DropdownMenuLabel v-if="exampleModelImages.length > 0" class="text-xs text-muted-foreground">
            Examples
          </DropdownMenuLabel>
          <DropdownMenuItem
            v-for="(example, index) in exampleModelImages"
            :key="example.id"
            class="gap-2 p-2"
            @click="onSelectExample(example)"
          >
            <Avatar class="h-8 w-8 rounded-md" shape="square" size="sm">
              <AvatarImage
                :src="getThumbnailUrl(example.image_url)"
                :alt="`Example ${index + 1}`"
                class="object-cover"
              />
              <AvatarFallback class="rounded-md">
                <Image class="size-3.5" />
              </AvatarFallback>
            </Avatar>
            <span class="text-sm">{{ example.nickname || `Example ${index + 1}` }}</span>
          </DropdownMenuItem>

          <!-- Add model -->
          <DropdownMenuSeparator />
          <DropdownMenuItem class="gap-2 p-2" @click="onAddModelClick">
            <div class="flex size-8 items-center justify-center rounded-md border bg-transparent">
              <Plus class="size-4" />
            </div>
            <div class="font-medium text-muted-foreground">
              Add model
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <!-- Hidden file input for uploading -->
      <input
        ref="fileInputRef"
        type="file"
        accept="image/*"
        class="hidden"
        @change="onFileChange"
      />
    </SidebarMenuItem>
  </SidebarMenu>
</template>
