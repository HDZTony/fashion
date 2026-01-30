import { inject, computed } from 'vue'

export function useSidebar() {
  const context = inject<{
    state: ReturnType<typeof computed>
    open: ReturnType<typeof computed>
    openMobile: ReturnType<typeof computed>
    isMobile: ReturnType<typeof computed>
    collapsible?: ReturnType<typeof computed>
    setOpen: (value: boolean) => void
    setOpenMobile: (value: boolean) => void
    toggleSidebar: () => void
  }>('sidebar')

  if (!context) {
    throw new Error('useSidebar must be used within SidebarProvider')
  }

  // Return reactive properties and methods
  return {
    state: context.state,
    open: context.open,
    openMobile: context.openMobile,
    isMobile: context.isMobile,
    collapsible: context.collapsible,
    setOpen: context.setOpen,
    setOpenMobile: context.setOpenMobile,
    toggleSidebar: context.toggleSidebar,
  }
}
