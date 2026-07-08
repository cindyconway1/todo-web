import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

vi.mock('@/api/client', () => ({
  api: { GET: vi.fn<() => Promise<unknown>>(), POST: vi.fn<() => Promise<unknown>>() },
}))

import { api } from '@/api/client'
import LoginView from '@/views/LoginView.vue'

const mockGet = api.GET as unknown as ReturnType<typeof vi.fn>
const mockPost = api.POST as unknown as ReturnType<typeof vi.fn>

function response(status: number): Response {
  return new Response(null, { status })
}

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'Login', component: LoginView },
      { path: '/register', name: 'Register', component: { template: '<div />' } },
      { path: '/', name: 'Dashboard', component: { template: '<div />' } },
    ],
  })
}

async function mountLoginView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createTestRouter()
  await router.push('/login')
  await router.isReady()
  return { wrapper: mount(LoginView, { global: { plugins: [pinia, router] } }), router }
}

describe('LoginView', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPost.mockReset()
    mockGet.mockResolvedValue({ data: undefined, error: undefined, response: response(204) })
  })

  it('shows field-level validation errors and does not submit when fields are empty', async () => {
    const { wrapper } = await mountLoginView()

    await wrapper.find('form').trigger('submit')

    expect(wrapper.text()).toContain('Email is required.')
    expect(wrapper.text()).toContain('Password is required.')
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('shows a generic error on invalid credentials without revealing which field was wrong', async () => {
    mockPost.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'no such user' },
      response: response(401),
    })
    const { wrapper } = await mountLoginView()

    await wrapper.find('#login-email').setValue('a@example.com')
    await wrapper.find('#login-password').setValue('password123')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Invalid email or password.')
    expect(wrapper.text()).not.toContain('no such user')
  })

  it('navigates to the Dashboard on a successful login', async () => {
    mockPost.mockResolvedValueOnce({ data: undefined, error: undefined, response: response(204) })
    const { wrapper, router } = await mountLoginView()

    await wrapper.find('#login-email').setValue('a@example.com')
    await wrapper.find('#login-password').setValue('password123')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('Dashboard')
  })
})
