import { defineConfig } from 'wxt';

const APP_ORIGIN = process.env.WXT_APP_ORIGIN;

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Atlas',
    description: 'Save a page and see only what is new to you, checked against everything you have read.',
    permissions: ['activeTab', 'scripting', 'sidePanel', 'storage'],
    host_permissions: ['http://*/*', 'https://*/*'],
    // Lets the signed-in connect page hand over a token. With `ids` absent, other extensions cannot message this one.
    externally_connectable: { matches: ['http://localhost:3000/*', ...(APP_ORIGIN ? [`${APP_ORIGIN}/*`] : [])] },
    action: { default_title: 'Open Atlas' },
    commands: {
      'save-page': {
        suggested_key: { default: 'Alt+S' },
        description: 'Save the current tab to Atlas',
      },
    },
  },
});
