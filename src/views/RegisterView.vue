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
    await authStore.register(form.email, form.password)
    await router.push('/login')
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
    <h1>Register</h1>
    <p v-if="formError" role="alert">{{ formError }}</p>

    <label for="register-email">Email</label>
    <input id="register-email" v-model="form.email" type="email" autocomplete="username" />
    <p v-if="fieldErrors.email">{{ fieldErrors.email }}</p>

    <label for="register-password">Password</label>
    <input
      id="register-password"
      v-model="form.password"
      type="password"
      autocomplete="new-password"
    />
    <p v-if="fieldErrors.password">{{ fieldErrors.password }}</p>

    <button type="submit" :disabled="submitting">Register</button>
    <RouterLink to="/login">Already have an account? Log in</RouterLink>
  </form>
</template>

<style scoped></style>
