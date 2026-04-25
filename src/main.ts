import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import vuetify from './plugins/vuetify';
import { configureAuthHooks } from './http/axios';
import { useAuthStore } from './stores/auth';

import '@mdi/font/css/materialdesignicons.css';
import 'vuetify/styles';
import './styles.css';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
app.use(vuetify);

// Pinia must be installed before useAuthStore() is called.
const auth = useAuthStore();

// Bridge axios ↔ auth store. Done late (here, not in axios.ts) to avoid the
// circular import that would otherwise exist between the two modules.
configureAuthHooks({
  getToken: () => auth.token,
  onUnauthorized: () => {
    void auth.logout().then(() => {
      const current = router.currentRoute.value;
      if (current.name !== 'login') {
        void router.replace({
          name: 'login',
          query: { redirect: current.fullPath },
        });
      }
    });
  },
});

// Restore the persisted session before mounting so the router guard sees
// the right `isAuthenticated` state on first navigation.
await auth.restore();

app.mount('#app');
