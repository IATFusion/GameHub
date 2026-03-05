import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tmpdir } from 'os'
import { join } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Keep the Vite dep-optimisation cache outside OneDrive so Windows/OneDrive
  // file-locking never blocks `rmdir` when Vite re-optimises dependencies.
  cacheDir: join(tmpdir(), 'vite-drag-racer'),
})
