/**
 * StoryForge 本地数据服务器
 * 提供本地文件系统访问，实现跨浏览器数据共享
 */

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const PORT = 8765;
// 监听地址：'0.0.0.0' 允许从网络访问（手机等设备），'127.0.0.1' 仅本地访问
const HOST = process.env.DATA_SERVER_HOST || '0.0.0.0';

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 数据文件路径
const FILES = {
    sessions: path.join(DATA_DIR, 'sessions.json'),
    settings: path.join(DATA_DIR, 'settings.json'),
    quickPrompts: path.join(DATA_DIR, 'quickPrompts.json'),
    writingSamples: path.join(DATA_DIR, 'writingSamples.json'),
    writingSamplesEnabled: path.join(DATA_DIR, 'writingSamplesEnabled.json')
};

// 读取文件（如果不存在返回默认值）
function readFile(filePath, defaultValue = null) {
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            return content ? JSON.parse(content) : defaultValue;
        }
    } catch (e) {
        console.error(`Error reading ${filePath}:`, e);
    }
    return defaultValue;
}

// 写入文件
function writeFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error(`Error writing ${filePath}:`, e);
        return false;
    }
}

// CORS 头
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-goog-api-key, x-stainless-timeout',
    'Content-Type': 'application/json'
};

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const method = req.method;

    // 处理 CORS 预检请求
    if (method === 'OPTIONS') {
        res.writeHead(200, corsHeaders);
        res.end();
        return;
    }

    // 设置 CORS 头
    Object.keys(corsHeaders).forEach(key => {
        res.setHeader(key, corsHeaders[key]);
    });

    // 路由处理
    if (url.pathname === '/api/sessions' && method === 'GET') {
        // 读取会话数据
        const data = readFile(FILES.sessions, []);
        res.writeHead(200);
        res.end(JSON.stringify(data));
    } else if (url.pathname === '/api/sessions' && method === 'POST') {
        // 保存会话数据
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                if (writeFile(FILES.sessions, data)) {
                    res.writeHead(200);
                    res.end(JSON.stringify({ success: true }));
                } else {
                    res.writeHead(500);
                    res.end(JSON.stringify({ error: 'Failed to write file' }));
                }
            } catch (e) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
    } else if (url.pathname === '/api/settings' && method === 'GET') {
        // 读取设置
        const data = readFile(FILES.settings, {});
        res.writeHead(200);
        res.end(JSON.stringify(data));
    } else if (url.pathname === '/api/settings' && method === 'POST') {
        // 保存设置
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                if (writeFile(FILES.settings, data)) {
                    res.writeHead(200);
                    res.end(JSON.stringify({ success: true }));
                } else {
                    res.writeHead(500);
                    res.end(JSON.stringify({ error: 'Failed to write file' }));
                }
            } catch (e) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
    } else if (url.pathname === '/api/quickPrompts' && method === 'GET') {
        // 读取快捷提示词
        const data = readFile(FILES.quickPrompts, null);
        res.writeHead(200);
        res.end(JSON.stringify(data));
    } else if (url.pathname === '/api/quickPrompts' && method === 'POST') {
        // 保存快捷提示词
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                if (writeFile(FILES.quickPrompts, data)) {
                    res.writeHead(200);
                    res.end(JSON.stringify({ success: true }));
                } else {
                    res.writeHead(500);
                    res.end(JSON.stringify({ error: 'Failed to write file' }));
                }
            } catch (e) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
    } else if (url.pathname === '/api/writingSamples' && method === 'GET') {
        // 读取范文数据
        const data = readFile(FILES.writingSamples, []);
        res.writeHead(200);
        res.end(JSON.stringify(data));
    } else if (url.pathname === '/api/writingSamples' && method === 'POST') {
        // 保存范文数据
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                if (writeFile(FILES.writingSamples, data)) {
                    res.writeHead(200);
                    res.end(JSON.stringify({ success: true }));
                } else {
                    res.writeHead(500);
                    res.end(JSON.stringify({ error: 'Failed to write file' }));
                }
            } catch (e) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
    } else if (url.pathname === '/api/writingSamplesEnabled' && method === 'GET') {
        // 读取范文启用状态
        const data = readFile(FILES.writingSamplesEnabled, true);
        res.writeHead(200);
        res.end(JSON.stringify(data));
    } else if (url.pathname === '/api/writingSamplesEnabled' && method === 'POST') {
        // 保存范文启用状态
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                if (writeFile(FILES.writingSamplesEnabled, data)) {
                    res.writeHead(200);
                    res.end(JSON.stringify({ success: true }));
                } else {
                    res.writeHead(500);
                    res.end(JSON.stringify({ error: 'Failed to write file' }));
                }
            } catch (e) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
    } else if (url.pathname === '/api/health' && method === 'GET') {
        // 健康检查
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'ok', dataDir: DATA_DIR }));
    } else if (url.pathname === '/api/llm/chat' && method === 'POST') {
        // LLM API 代理（使用 node-fetch，避免 CORS 问题）
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const requestData = JSON.parse(body);
                const { 
                    provider, 
                    baseUrl, 
                    modelId, 
                    apiKey, 
                    proxyUrl, 
                    proxyKey, 
                    useProxy,
                    messages, 
                    tools, 
                    tool_choice, 
                    temperature, 
                    max_tokens,
                    stream 
                } = requestData;

                if (!baseUrl || !modelId || !apiKey) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: 'Missing required parameters: baseUrl, modelId, apiKey' }));
                    return;
                }

                // 构建请求 URL
                let finalBaseUrl = baseUrl;
                if (useProxy && proxyUrl) {
                    finalBaseUrl = proxyUrl;
                }
                
                // Google 直连应该使用原生 SDK，不应该到这里
                if (provider === 'google' && !useProxy) {
                    throw new Error('Google 直连应该使用原生 SDK，不应该使用后端 API');
                }
                
                // 处理 Google 中转的情况
                if (provider === 'google' && useProxy) {
                    // Google 中转使用 OpenAI 兼容接口
                    finalBaseUrl = finalBaseUrl.replace(/\/$/, '');
                    if (!finalBaseUrl.includes('/v1beta/openai') && !finalBaseUrl.includes('/openai')) {
                        finalBaseUrl = finalBaseUrl.replace(/\/v1beta$/, '').replace(/\/v1$/, '');
                        finalBaseUrl = `${finalBaseUrl}/v1beta/openai`;
                    }
                } else {
                    // 其他 provider：确保 baseUrl 以 /v1 结尾
                    finalBaseUrl = finalBaseUrl.replace(/\/$/, '');
                    if (!finalBaseUrl.endsWith('/v1')) {
                        finalBaseUrl = finalBaseUrl.replace(/\/v1$/, '') + '/v1';
                    }
                }
                
                const endpoint = `${finalBaseUrl}/chat/completions`;

                // 选择 API Key
                const apiKeyToUse = (useProxy && proxyKey) ? proxyKey : apiKey;

                // 构建请求头
                const headers = {
                    'Content-Type': 'application/json'
                };

                // Google 中转使用 x-goog-api-key，其他使用 Authorization
                if (provider === 'google' && useProxy) {
                    headers['x-goog-api-key'] = apiKeyToUse;
                } else {
                    headers['Authorization'] = `Bearer ${apiKeyToUse}`;
                }

                // 构建请求体（所有 provider 都使用 OpenAI 兼容格式，因为 Google 中转也使用 OpenAI 兼容接口）
                const requestBody = {
                    model: modelId.replace(/^models\//, ''),
                    messages: messages,
                    temperature: temperature || 0.7,
                    max_tokens: max_tokens || 8192,
                    stream: stream || false
                };

                if (tools && tools.length > 0) {
                    requestBody.tools = tools;
                    if (tool_choice) {
                        requestBody.tool_choice = tool_choice;
                    }
                }

                console.log(`[LLM代理] 请求 ${provider} API: ${endpoint.substring(0, 100)}...`);

                // 使用 node-fetch 发送请求
                const fetchResponse = await fetch(endpoint, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(requestBody),
                    timeout: 120000 // 120秒超时
                });

                if (!fetchResponse.ok) {
                    const errorText = await fetchResponse.text();
                    console.error(`[LLM代理] API 错误 (${fetchResponse.status}):`, errorText.substring(0, 200));
                    res.writeHead(fetchResponse.status);
                    res.end(JSON.stringify({ 
                        error: `API Error (${fetchResponse.status})`, 
                        message: errorText.substring(0, 500) 
                    }));
                    return;
                }

                const responseData = await fetchResponse.json();
                console.log(`[LLM代理] 请求成功`);
                
                res.writeHead(200);
                res.end(JSON.stringify(responseData));

            } catch (e) {
                console.error('[LLM代理] 错误:', e);
                res.writeHead(500);
                res.end(JSON.stringify({ error: 'Internal server error', message: e.message }));
            }
        });
    } else if (url.pathname === '/api/llm/models' && method === 'POST') {
        // 获取模型列表（用于 API 设置测试）
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const requestData = JSON.parse(body);
                const { provider, baseUrl, apiKey, proxyUrl, proxyKey, useProxy } = requestData;

                if (!baseUrl || !apiKey) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: 'Missing required parameters: baseUrl, apiKey' }));
                    return;
                }

                // 构建请求 URL
                let finalBaseUrl = baseUrl;
                if (useProxy && proxyUrl) {
                    finalBaseUrl = proxyUrl;
                }

                // 选择 API Key
                const apiKeyToUse = (useProxy && proxyKey) ? proxyKey : apiKey;

                // 构建请求头
                const headers = {
                    'Content-Type': 'application/json'
                };

                if (provider === 'google') {
                    headers['x-goog-api-key'] = apiKeyToUse;
                    finalBaseUrl = finalBaseUrl.replace(/\/v1$/, '') + '/v1beta';
                } else {
                    headers['Authorization'] = `Bearer ${apiKeyToUse}`;
                    if (!finalBaseUrl.endsWith('/v1')) {
                        finalBaseUrl = finalBaseUrl.replace(/\/v1$/, '') + '/v1';
                    }
                }

                const endpoint = `${finalBaseUrl}/models`;

                console.log(`[LLM代理] 获取模型列表: ${endpoint.substring(0, 100)}...`);

                // 使用 node-fetch 发送请求
                const fetchResponse = await fetch(endpoint, {
                    method: 'GET',
                    headers: headers,
                    timeout: 10000 // 10秒超时
                });

                if (!fetchResponse.ok) {
                    const errorText = await fetchResponse.text();
                    console.error(`[LLM代理] 获取模型列表失败 (${fetchResponse.status}):`, errorText.substring(0, 200));
                    res.writeHead(fetchResponse.status);
                    res.end(JSON.stringify({ 
                        error: `API Error (${fetchResponse.status})`, 
                        message: errorText.substring(0, 500) 
                    }));
                    return;
                }

                const responseData = await fetchResponse.json();
                console.log(`[LLM代理] 获取模型列表成功`);
                
                res.writeHead(200);
                res.end(JSON.stringify(responseData));

            } catch (e) {
                console.error('[LLM代理] 获取模型列表错误:', e);
                res.writeHead(500);
                res.end(JSON.stringify({ error: 'Internal server error', message: e.message }));
            }
        });
    } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
    }
});

server.listen(PORT, HOST, () => {
    console.log(`========================================`);
    console.log(`StoryForge 数据服务器已启动`);
    console.log(`========================================`);
    console.log(`本地地址: http://127.0.0.1:${PORT}`);
    
    // 获取本机局域网 IP 地址
    const networkInterfaces = os.networkInterfaces();
    const localIPs = [];
    for (const interfaceName in networkInterfaces) {
        const interfaces = networkInterfaces[interfaceName];
        for (const iface of interfaces) {
            if (iface.family === 'IPv4' && !iface.internal) {
                localIPs.push(iface.address);
            }
        }
    }
    
    if (localIPs.length > 0) {
        console.log(`网络地址: http://${localIPs[0]}:${PORT}`);
        console.log(`手机访问: 在手机浏览器中输入 http://${localIPs[0]}:${PORT}/api/health 测试连接`);
        console.log(`提示: 手机和电脑需要在同一局域网内`);
    } else {
        console.log(`警告: 未检测到局域网 IP，手机可能无法访问`);
    }
    
    console.log(`数据目录: ${DATA_DIR}`);
    console.log(`========================================`);
    console.log(`按 Ctrl+C 停止服务器`);
    console.log(`========================================`);
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n正在关闭服务器...');
    server.close(() => {
        console.log('服务器已关闭');
        process.exit(0);
    });
});

