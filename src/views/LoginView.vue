<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { AuthError, useAuthStore } from '@/stores/auth'
import { validateEmail, validatePassword } from '@/utils/authValidation'

const router = useRouter()
const authStore = useAuthStore()

const form = reactive({ email: '', password: '' })
const fieldErrors = reactive<{ email?: string; password?: string }>({})
const formError = ref('')
const submitting = ref(false)

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
  <form novalidate @submit.prevent="onSubmit">
    <h1>Log in</h1>
    <p v-if="formError" role="alert">{{ formError }}</p>

    <label for="login-email">Email</label>
    <input id="login-email" v-model="form.email" type="email" autocomplete="username" />
    <p v-if="fieldErrors.email">{{ fieldErrors.email }}</p>

    <label for="login-password">Password</label>
    <input
      id="login-password"
      v-model="form.password"
      type="password"
      autocomplete="current-password"
    />
    <p v-if="fieldErrors.password">{{ fieldErrors.password }}</p>

    <button type="submit" :disabled="submitting">Log in</button>
    <RouterLink to="/register">Need an account? Register</RouterLink>
  </form>
</template>

<style scoped></style>
