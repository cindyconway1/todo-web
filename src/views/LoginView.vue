<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Eye, EyeOff, LogIn } from '@lucide/vue'

import { AuthError, useAuthStore } from '@/stores/auth'
import { validateEmail, validatePassword } from '@/utils/authValidation'

const router = useRouter()
const authStore = useAuthStore()

const form = reactive({ email: '', password: '' })
const fieldErrors = reactive<{ email?: string; password?: string }>({})
const formError = ref('')
const submitting = ref(false)
const showPassword = ref(false)

function validate(): boolean {
  fieldErrors.email = validateEmail(form.email) ?? undefined
  fieldErrors.password = validatePassword(form.password) ?? undefined
  return !fieldErrors.email && !fieldErrors.password
}

async function onSubmit(): Promise<void> {
  formError.value = ''
  if (!validate()) {
    return
  }

  submitting.value = true
  try {
    await authStore.login(form.email, form.password)
    await router.push('/')
  } catch (err) {
    if (err instanceof AuthError && err.kind === 'validation' && err.fieldErrors) {
      Object.assign(fieldErrors, err.fieldErrors)
    } else if (err instanceof AuthError) {
      formError.value = err.message
    } else {
      formError.value = 'Something went wrong. Please try again.'
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
    <form
      novalidate
      class="w-full max-w-sm space-y-6 rounded-md border border-subtle bg-card p-8"
      @submit.prevent="onSubmit"
    >
      <h1 class="text-2xl font-semibold text-default">Log in</h1>

      <p
        v-if="formError"
        role="alert"
        class="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
      >
        {{ formError }}
      </p>

      <div class="space-y-1.5">
        <label for="login-email" class="block text-sm font-medium text-default">Email</label>
        <input
          id="login-email"
          v-model="form.email"
          type="email"
          autocomplete="username"
          class="w-full rounded-md border bg-canvas px-3 py-2 text-default placeholder:text-muted transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent"
          :class="fieldErrors.email ? 'border-danger' : 'border-subtle'"
        />
        <p v-if="fieldErrors.email" class="text-sm text-danger">{{ fieldErrors.email }}</p>
      </div>

      <div class="space-y-1.5">
        <label for="login-password" class="block text-sm font-medium text-default">Password</label>
        <div class="relative">
          <input
            id="login-password"
            v-model="form.password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            class="w-full rounded-md border bg-canvas py-2 pl-3 pr-10 text-default placeholder:text-muted transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent"
            :class="fieldErrors.password ? 'border-danger' : 'border-subtle'"
          />
          <button
            type="button"
            :aria-label="showPassword ? 'Hide password' : 'Show password'"
            :aria-pressed="showPassword"
            class="absolute inset-y-0 right-0 flex items-center pr-3 text-muted transition-colors duration-150 hover:text-accent focus:outline-none focus:text-accent"
            @click="showPassword = !showPassword"
          >
            <EyeOff v-if="showPassword" class="size-4" aria-hidden="true" />
            <Eye v-else class="size-4" aria-hidden="true" />
          </button>
        </div>
        <p v-if="fieldErrors.password" class="text-sm text-danger">{{ fieldErrors.password }}</p>
      </div>

      <button
        type="submit"
        :disabled="submitting"
        class="flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 font-medium text-white transition-colors duration-150 hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-card disabled:cursor-not-allowed disabled:opacity-60"
      >
        <LogIn class="size-4" aria-hidden="true" />
        {{ submitting ? 'Logging in…' : 'Log in' }}
      </button>

      <RouterLink
        to="/register"
        class="block text-center text-sm text-muted transition-colors duration-150 hover:text-accent"
      >
        Need an account? Register
      </RouterLink>
    </form>
  </div>
</template>

<style scoped></style>
