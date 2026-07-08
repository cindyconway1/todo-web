import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

vi.mock('@/api/client', () => ({
  api: { GET: vi.fn<() => Promise<unknown>>(), POST: vi.fn<() => Promise<unknown>>() },
}))

import { api } from '@/api/client'
import DashboardView from '@/views/DashboardView.vue'

const mockGet = api.GET as unknown as ReturnType<typeof vi.fn>
const mockPost = api.POST as unknown as ReturnType<typeof vi.fn>

function response(status: number): Response {
  return new Response(null, { status })
}

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'Login', component: { template: '<div />' } },
      { path: '/', name: 'Dashboard', component: DashboardView },
    ],
  })
}

describe('DashboardView', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPost.mockReset()
    mockGet.mockResolvedValue({ data: undefined, error: undefined, response: response(204) })
  })

  it('logs out and navigates to /login', async () => {
    mockPost.mockResolvedValueOnce({ data: undefined, error: undefined, response: response(204) })
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createTestRouter()
    await router.push('/')
    await router.isReady()
    const wrapper = mount(DashboardView, { global: { plugins: [pinia, router] } })

    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(mockPost).toHaveBeenCalledWith('/api/auth/logout')
    expect(router.currentRoute.value.name).toBe('Login')
  })
})
