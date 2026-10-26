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

// Restore the persisted session before installing the router: `app.use(router)`
// kicks off the initial navigation immediately, so installing it earlier would
// run the guard with `isAuthenticated === false` and bounce a refresh to /login,
// losing the current route. Wrapped in an async IIFE rather than top-level
// await so the bundle stays compatible with the es2020 build target.
void (async () => {
  await auth.restore();
  app.use(router);
  app.mount('#app');
})();
