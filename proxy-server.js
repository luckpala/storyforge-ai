// 简单的CORS代理服务器
// 用于解决浏览器CORS限制问题
// 使用方法: node proxy-server.js

import http from 'http';
import https from 'https';
import { URL } from 'url';

// 尝试多个端口，从3001开始
const START_PORT = 3001;
const MAX_PORT_ATTEMPTS = 10;

function startServer(port) {
  const server = http.createServer((req, res) => {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-goog-api-key, x-stainless-timeout');

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // 从查询参数或路径中获取目标URL
  const url = new URL(req.url, `http://${req.headers.host}`);
  const targetUrl = url.searchParams.get('target') || url.pathname.replace(/^\/proxy\//, '');

  if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid target URL. Use ?target=https://example.com/path' }));
    return;
  }

  try {
    const target = new URL(targetUrl);
    const client = target.protocol === 'https:' ? https : http;

    // 复制请求头
    const options = {
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: target.pathname + target.search,
      method: req.method,
      headers: { ...req.headers }
    };

    // 移除host头，让目标服务器设置
    delete options.headers.host;

    const proxyReq = client.request(options, (proxyRes) => {
      // 设置CORS头（覆盖目标服务器的响应头，确保CORS正常工作）
      const responseHeaders = { ...proxyRes.headers };
      responseHeaders['Access-Control-Allow-Origin'] = '*';
      responseHeaders['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      responseHeaders['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, x-goog-api-key, x-stainless-timeout';
      
      // 复制响应头
      res.writeHead(proxyRes.statusCode, responseHeaders);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('代理请求错误:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Proxy request failed', message: err.message }));
    });

    // 转发请求体
    req.pipe(proxyReq);
  } catch (err) {
    console.error('代理错误:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Proxy error', message: err.message }));
  }
});

  server.listen(port, '0.0.0.0', () => {
    console.log(`CORS代理服务器运行在 http://0.0.0.0:${port}`);
    console.log(`本地访问: http://localhost:${port}`);
    console.log(`网络访问: http://<你的IP地址>:${port}`);
    console.log(`使用方法: 将API请求改为 http://<服务器地址>:${port}/proxy?target=<原始URL>`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      // 端口被占用，尝试下一个端口
      if (port < START_PORT + MAX_PORT_ATTEMPTS - 1) {
        console.log(`端口 ${port} 被占用，尝试端口 ${port + 1}...`);
        startServer(port + 1);
      } else {
        console.error(`错误: 无法找到可用端口（已尝试 ${MAX_PORT_ATTEMPTS} 个端口）`);
        process.exit(1);
      }
    } else {
      console.error('服务器错误:', err);
      process.exit(1);
    }
  });
}

// 启动服务器
startServer(START_PORT);

