import { installErrorBuffer } from 'craft-bugreport-web'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'

import './styles/projects.css'

installErrorBuffer()
createApp(App).use(createPinia()).mount('#cc_projects')
