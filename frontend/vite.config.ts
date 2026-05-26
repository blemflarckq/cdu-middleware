import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';


// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: [
        {
          find: "@/",
          replacement: `${path.resolve(__dirname, './src')}/`,
        },
        {
          find: "xlsx",
          replacement: "xlsx/dist/xlsx.full.min.js",
        },
      ]
    
  },

  define: {
    'process.env': '{}',
    'global': 'window'
  },
  
  server: {
    port: 5173,
    host: true, // Important for Docker HMR
    hmr: {
      // For Docker, you might need to configure HMR
      host: 'localhost',
      port: 5173,
      protocol: 'ws',
      clientPort: 5173
    },
    watch: {
      usePolling: true, // Needed for Docker volume mounting
      interval: 1000
    },
    fs: {
      strict: false
    }
  }
})

