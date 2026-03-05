import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Points to the shared Gaming/firebase/ folder so any game can import
      // from '~firebase/firebase-config' without knowing the relative depth.
      // NOTE: must NOT use '@firebase' — that conflicts with Firebase's own package scope.
      '~firebase': path.resolve(__dirname, '../firebase'),
    },
    // Force a single copy of firebase regardless of where it is installed.
    // Without this, Gaming/node_modules/firebase and target-clicker/node_modules/firebase
    // end up as separate module instances with separate service registries, causing
    // "Service database is not available" at runtime.
    dedupe: ['firebase', '@firebase/app', '@firebase/database'],
  },
  server: {
    allowedHosts: ['localhost', '4307-41-122-141-30.ngrok-free.app', 'iatfusion.github.io'],
  },
  base: '/GameHub/',
})