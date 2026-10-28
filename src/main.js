import { installErrorBuffer } from 'craft-bugreport-web'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { attachVueErrorHandler, installCrashLog } from './services/crashLog.js' // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)

import './styles/projects.css'

installErrorBuffer()
installCrashLog(document.getElementById('cc_projects')?.dataset) // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)

const app = createApp(App) // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
app.use(createPinia()) // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
attachVueErrorHandler(app) // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
app.mount('#cc_projects') // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
