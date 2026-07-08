import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from '@/App.vue'
import router, { primeAuth } from '@/router'
import { setUnauthorizedHandler } from '@/api/client'
import { useAntiforgery } from '@/composables/useAntiforgery'

const app = createApp(App)

app.use(createPinia())
app.use(router)

setUnauthorizedHandler(() => {
  void router.push('/login')
})

void primeAuth()
void useAntiforgery().ensureToken()

app.mount('#app')
