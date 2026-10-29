import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Second Brain',
    description: 'Save a page and see only what is new to you, checked against everything you have read.',
    permissions: ['activeTab', 'scripting', 'sidePanel', 'storage'],
    host_permissions: ['http://localhost:3000/*'],
    action: { default_title: 'Open Second Brain' },
    commands: {
      'save-page': {
        suggested_key: { default: 'Alt+S' },
        description: 'Save the current tab to Second Brain',
      },
    },
  },
});
