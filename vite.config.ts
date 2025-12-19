import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        strictPort: false, // 如果端口被占用，自动尝试其他端口
        host: '0.0.0.0',
        hmr: {
          // 优化热更新，减少连接中断
          overlay: true,
          clientPort: 3000
        },
        watch: {
          ignored: [
            '**/storyforge_backup.json',
            '**/storyforge_backup_*.json',
            '**/storyforge_*.txt',
            '**/data/**',  // 忽略数据目录，避免数据保存时触发页面刷新
            '**/data/**/*.json'
          ]
        },
        // 代理配置：解决CORS问题
        // 通用代理：所有 /api-proxy/* 的请求都会被代理到目标服务器
        proxy: {
          '/api-proxy': {
            target: 'https://mcxbx.daybreakhk.com', // 默认目标，实际目标由请求URL决定
            changeOrigin: true,
            rewrite: (path) => {
              // 从路径中提取实际的目标URL
              // 格式: /api-proxy/https://example.com/v1/chat/completions
              const match = path.match(/^\/api-proxy\/(https?:\/\/[^\/]+)(.*)$/);
              if (match) {
                const [, targetHost, targetPath] = match;
                // 更新代理目标
                return targetPath;
              }
              return path.replace(/^\/api-proxy/, '');
            },
            configure: (proxy, _options) => {
              proxy.on('error', (err, _req, _res) => {
                console.log('代理错误:', err);
              });
            }
          }
        }
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || '')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        // 确保所有依赖都被打包，不使用外部 CDN
        rollupOptions: {
          output: {
            // 确保不将依赖标记为 external
            manualChunks: undefined
          }
        },
        // 生产构建时的优化
        sourcemap: false,
        minify: 'esbuild',
        // 增加 chunk 大小警告限制
        chunkSizeWarningLimit: 1000,
        // 设置 base 为相对路径，确保在 Electron 中能正确加载资源
        base: './',
        // 确保资源路径是相对路径
        assetsDir: 'assets',
        // 使用相对路径输出
        outDir: 'dist'
      },
      // 设置 base 为相对路径（全局配置）
      base: './'
    };
});
