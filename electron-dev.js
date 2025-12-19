/**
 * Electron 开发模式启动脚本
 * 自动检测 Vite 服务器端口并启动 Electron
 */

import { spawn } from 'child_process';
import http from 'http';

// 检查端口是否是 Vite 服务器
function checkVitePort(port) {
    return new Promise((resolve) => {
        const req = http.get(`http://localhost:${port}`, (res) => {
            const contentType = res.headers['content-type'] || '';
            
            // 快速检查：如果是 HTML 类型，很可能是 Vite
            if (contentType.includes('text/html') && res.statusCode === 200) {
                // 读取前 500 字节来确认
                let data = '';
                let resolved = false;
                
                res.on('data', (chunk) => {
                    if (!resolved) {
                        data += chunk.toString();
                        // 如果已经读取到足够的数据来判断，立即返回
                        if (data.length > 200) {
                            res.destroy();
                            resolved = true;
                            // 检查是否是代理服务器的 JSON 错误
                            const isProxy = data.includes('"error"') && data.includes('Invalid target URL');
                            if (!isProxy) {
                                // 很可能是 Vite 服务器
                                resolve(true);
                            } else {
                                resolve(false);
                            }
                        }
                    }
                });
                
                res.on('end', () => {
                    if (!resolved) {
                        resolved = true;
                        // 检查是否是代理服务器的 JSON 错误
                        const isProxy = data.includes('"error"') && data.includes('Invalid target URL');
                        // 如果是 HTML 且不是代理错误，就是 Vite
                        const isVite = !isProxy && (data.includes('<html') || data.includes('<!DOCTYPE') || data.length > 0);
                        resolve(isVite);
                    }
                });
            } else {
                // 不是 HTML 或状态码不是 200，可能是代理服务器或其他服务
                resolve(false);
            }
        });
        req.on('error', (err) => {
            resolve(false);
        });
        req.setTimeout(2000, () => {
            req.destroy();
            resolve(false);
        });
    });
}


// 检测 Vite 服务器端口
async function detectVitePort() {
    console.log('等待 Vite 服务器启动...');
    
    // 等待最多 60 秒，每 500ms 检查一次
    for (let i = 0; i < 120; i++) {
        // 先检查 3000
        const port3000 = await checkVitePort(3000);
        if (port3000) {
            console.log('✓ 检测到 Vite 服务器在端口 3000');
            return 3000;
        }
        
        // 再检查 3001
        const port3001 = await checkVitePort(3001);
        if (port3001) {
            console.log('✓ 检测到 Vite 服务器在端口 3001');
            return 3001;
        }
        
        // 每 5 秒显示一次进度
        if (i % 10 === 0 && i > 0) {
            console.log(`   等待中... (${Math.round(i * 0.5)}秒)`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // 如果超时，尝试直接使用 3001（因为 Vite 通常会在 3001 启动）
    console.log('⚠️  检测超时，尝试直接连接端口 3001...');
    return 3001;
}

// 启动 Electron
async function startElectron() {
    try {
        const port = await detectVitePort();
        console.log(`启动 Electron，连接到 http://localhost:${port}`);
        
        const electron = spawn('electron', ['.'], {
            env: {
                ...process.env,
                ELECTRON_DEV: 'true',
                VITE_PORT: port.toString()
            },
            stdio: 'inherit',
            shell: true
        });
        
        electron.on('error', (err) => {
            console.error('Electron 启动失败:', err);
            process.exit(1);
        });
        
        electron.on('exit', (code) => {
            process.exit(code || 0);
        });
    } catch (error) {
        console.error('启动失败:', error.message);
        process.exit(1);
    }
}

startElectron();

