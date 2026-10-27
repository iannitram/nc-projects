import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'

import './styles/projects.css'

createApp(App).use(createPinia()).mount('#cc_projects')
