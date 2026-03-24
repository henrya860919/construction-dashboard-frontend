import './assets/main.css'
import 'vue-sonner/style.css'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { applyTheme } from '@/lib/theme'

applyTheme()
const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
