import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

vi.mock('@/api/client', () => ({
  api: { GET: vi.fn<() => Promise<unknown>>(), POST: vi.fn<() => Promise<unknown>>() },
}))

import { api } from '@/api/client'
import type { components } from '@/api/schema'
import RegisterView from '@/views/RegisterView.vue'

type MessageDto = components['schemas']['MessageDto']
type ValidationProblemDto = components['schemas']['ValidationProblemDto']

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
      { path: '/register', name: 'Register', component: RegisterView },
      { path: '/', name: 'Dashboard', component: { template: '<div />' } },
    ],
  })
}

async function mountRegisterView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createTestRouter()
  await router.push('/register')
  await router.isReady()
  return { wrapper: mount(RegisterView, { global: { plugins: [pinia, router] } }), router }
}

describe('RegisterView', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPost.mockReset()
    mockGet.mockResolvedValue({ data: undefined, error: undefined, response: response(204) })
  })

  it('shows field-level validation errors and does not submit when fields are empty', async () => {
    const { wrapper } = await mountRegisterView()

    await wrapper.find('form').trigger('submit')

    expect(wrapper.text()).toContain('Email is required.')
    expect(wrapper.text()).toContain('Password is required.')
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('rejects a password below the minimum length', async () => {
    const { wrapper } = await mountRegisterView()

    await wrapper.find('#register-email').setValue('a@example.com')
    await wrapper.find('#register-password').setValue('short')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.text()).toContain('Password must be at least 8 characters.')
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('shows a duplicate-email message on 409', async () => {
    const message: MessageDto = { message: 'server wording' }
    mockPost.mockResolvedValueOnce({ data: undefined, error: message, response: response(409) })
    const { wrapper } = await mountRegisterView()

    await wrapper.find('#register-email').setValue('dup@example.com')
    await wrapper.find('#register-password').setValue('password123')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('That email is already in use.')
  })

  it('maps 422 validation errors to field-level messages', async () => {
    const problem: ValidationProblemDto = {
      message: 'Validation failed',
      errors: [{ property: 'email', message: 'Email format is invalid.' }],
    }
    mockPost.mockResolvedValueOnce({ data: undefined, error: problem, response: response(422) })
    const { wrapper } = await mountRegisterView()

    await wrapper.find('#register-email').setValue('a@example.com')
    await wrapper.find('#register-password').setValue('password123')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Email format is invalid.')
  })

  it('navigates to /login on a successful registration', async () => {
    mockPost.mockResolvedValueOnce({
      data: { id: 'u1', email: 'a@example.com' },
      error: undefined,
      response: response(201),
    })
    const { wrapper, router } = await mountRegisterView()

    await wrapper.find('#register-email').setValue('a@example.com')
    await wrapper.find('#register-password').setValue('password123')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('Login')
  })
})
