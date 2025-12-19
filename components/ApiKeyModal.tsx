
import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, Check, AlertCircle, Loader2, Zap, Settings, Server, Box, List, ChevronDown, Save, Trash2, Plus, FileEdit, RefreshCw, Download, Upload, Key } from 'lucide-react';
import { ApiConfig, ApiProvider, ToolCallMode } from '../types';
import { LLMAdapter } from '../services/llmAdapter';
import { FunctionDeclaration, GoogleGenAI } from '@google/genai';
import * as dataService from '../services/dataService';

// 获取当前主机地址（支持手机访问）
const getProxyHost = (): string => {
  if (typeof window !== 'undefined' && window.location) {
    return window.location.hostname;
  }
  return 'localhost';
};

interface ApiKeyModalProps {
  isOpen: boolean;
  onSave: (config: ApiConfig) => void;
  onClose: () => void;
  forced?: boolean;
  savedConfigs?: ApiConfig[];
  onExportApiConfigs?: () => void;
  onImportApiConfigs?: (configs: ApiConfig[]) => void;
  onDeleteConfig?: (index: number) => void;
  currentConfig?: ApiConfig | null; // Current active config
}

const PROVIDERS: { id: ApiProvider; name: string; defaultBaseUrl: string; defaultModel: string; icon: any; getKeyUrl?: string }[] = [
  { id: 'google', name: 'Google Gemini', defaultBaseUrl: '', defaultModel: 'gemini-2.5-pro', icon: Zap, getKeyUrl: 'https://aistudio.google.com/app/apikey' },
  { id: 'deepseek', name: 'DeepSeek', defaultBaseUrl: 'https://api.deepseek.com', defaultModel: 'deepseek-chat', icon: Box, getKeyUrl: 'https://platform.deepseek.com/api_keys' },
  { id: 'siliconflow', name: '硅基流动 (SF)', defaultBaseUrl: 'https://api.siliconflow.cn/v1', defaultModel: 'deepseek-ai/DeepSeek-V3', icon: Server, getKeyUrl: 'https://cloud.siliconflow.cn/account/ak' },
  { id: 'openai', name: 'OpenAI / Proxy', defaultBaseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o', icon: Settings, getKeyUrl: 'https://platform.openai.com/api-keys' },
  { id: 'custom', name: 'Custom', defaultBaseUrl: '', defaultModel: '', icon: Settings },
];

const getDefaultToolCallMode = (provider?: ApiProvider, useProxy?: boolean): ToolCallMode => {
  // Google 直连默认 FC，其余默认 JSON Schema（不再有自动模式）
  if (provider === 'google' && !useProxy) return 'function_calling';
  return 'json_schema';
};

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onSave, onClose, forced = false, savedConfigs: propSavedConfigs, onExportApiConfigs, onImportApiConfigs, onDeleteConfig, currentConfig }) => {
  // Data Store
  const [savedConfigs, setSavedConfigs] = useState<ApiConfig[]>([]);
  
  // Use prop savedConfigs if provided, otherwise use local state
  const effectiveSavedConfigs = propSavedConfigs || savedConfigs;
  
  // UI Mode: 'new' or index of editing config
  const [editMode, setEditMode] = useState<number | 'new'>('new');

  // Form State
  const [configName, setConfigName] = useState('');
  const [provider, setProvider] = useState<ApiProvider>('google');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [modelId, setModelId] = useState('');
  const [useProxy, setUseProxy] = useState(false);
  const [proxyUrl, setProxyUrl] = useState('');
  const [proxyKey, setProxyKey] = useState('');
  const [toolCallMode, setToolCallMode] = useState<ToolCallMode>(getDefaultToolCallMode('google', false));
  
  // Status State
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [fcTestStatus, setFcTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [fcTestResult, setFcTestResult] = useState<string>('');
  const [geminiFcTestStatus, setGeminiFcTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [geminiFcTestResult, setGeminiFcTestResult] = useState<string>('');
  const [geminiNativeFcTestStatus, setGeminiNativeFcTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [geminiNativeFcTestResult, setGeminiNativeFcTestResult] = useState<string>('');
  const [jsonSchemaTestStatus, setJsonSchemaTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [jsonSchemaTestResult, setJsonSchemaTestResult] = useState<string>('');
  
  // Model Fetching State
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [showModelList, setShowModelList] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Load Saved Data
  useEffect(() => {
    if (isOpen) {
      // If propSavedConfigs is provided, use it; otherwise load from localStorage
      let loadedConfigs: ApiConfig[] = [];
      if (propSavedConfigs) {
        setSavedConfigs(propSavedConfigs);
        loadedConfigs = propSavedConfigs;
      } else {
        const savedConfigsStr = localStorage.getItem('storyforge_saved_api_configs');
      if (savedConfigsStr) {
        try {
          loadedConfigs = JSON.parse(savedConfigsStr);
          setSavedConfigs(loadedConfigs);
        } catch (e) { console.error(e); }
        }
      }

      // Determine initial state based on current config (prefer prop, then localStorage)
      const activeConfig = currentConfig || (() => {
      const activeStr = localStorage.getItem('storyforge_api_config');
      if (activeStr) {
          try {
            return JSON.parse(activeStr) as ApiConfig;
          } catch (e) {}
        }
        return null;
      })();

      if (activeConfig) {
        // Try to find the config in saved list by name first, then by apiKey+provider
        let idx = -1;
        if (activeConfig.name) {
          idx = loadedConfigs.findIndex(c => c.name === activeConfig.name);
        }
        if (idx < 0) {
          idx = loadedConfigs.findIndex(c => 
            c.apiKey === activeConfig.apiKey && 
            c.provider === activeConfig.provider &&
            c.baseUrl === activeConfig.baseUrl
          );
        }
        
              if (idx >= 0) {
          // Found in saved list, load it for editing
                  loadConfigIntoForm(loadedConfigs[idx], idx);
              } else {
                  // It's an unsaved or legacy config, load it as "New"
                  setEditMode('new');
          loadConfigIntoForm(activeConfig, 'new');
              }
      } else {
          resetForm();
      }
    }
  }, [isOpen, currentConfig, propSavedConfigs]);

  const resetForm = () => {
      setEditMode('new');
      const defaultProvider = 'google';
      const pInfo = PROVIDERS.find(p => p.id === defaultProvider)!;
      setConfigName('');
      setProvider(defaultProvider);
      setApiKey('');
      setBaseUrl(pInfo.defaultBaseUrl);
      setModelId(pInfo.defaultModel);
      setUseProxy(false);
      setProxyUrl('');
      setProxyKey('');
      setToolCallMode(getDefaultToolCallMode(defaultProvider, false));
      setTestStatus('idle');
      setErrorMsg('');
      setAvailableModels([]);
  };

  const loadConfigIntoForm = (config: ApiConfig, index: number | 'new') => {
      setEditMode(index);
      setConfigName(config.name || '');
      setProvider(config.provider);
      setApiKey(config.apiKey || '');
      setBaseUrl(config.baseUrl || '');
      setModelId(config.modelId || '');
      setUseProxy(config.useProxy || false);
      setProxyUrl(config.proxyUrl || '');
      setProxyKey(config.proxyKey || '');
      setToolCallMode(config.toolCallMode || getDefaultToolCallMode(config.provider, config.useProxy));
      setTestStatus('idle');
      setErrorMsg('');
      // Load saved available models if they exist
      setAvailableModels(config.availableModels || []);
  };

  // Handlers
  const handleProviderChange = (newProvider: ApiProvider) => {
    setProvider(newProvider);
    const pInfo = PROVIDERS.find(p => p.id === newProvider);
    if (pInfo) {
        // If creating new, auto-fill defaults
        if (editMode === 'new') {
            setBaseUrl(pInfo.defaultBaseUrl);
            setModelId(pInfo.defaultModel);
            setConfigName(`${pInfo.name} Config`);
            setToolCallMode(getDefaultToolCallMode(newProvider, useProxy));
        }
    }
  };

  const handleDeleteConfig = (index: number) => {
      if (confirm("确定要删除这个配置吗？")) {
        const newConfigs = [...effectiveSavedConfigs];
        newConfigs.splice(index, 1);
        setSavedConfigs(newConfigs);
        localStorage.setItem('storyforge_saved_api_configs', JSON.stringify(newConfigs));
        // Notify parent component to update its state
        if (onDeleteConfig) {
          onDeleteConfig(index);
        }
        resetForm();
      }
  };

  const fetchModels = async () => {
      // Use proxy key if proxy is enabled and proxyKey is provided, otherwise use regular apiKey
      const cleanKey = (useProxy && proxyKey.trim()) ? proxyKey.trim() : apiKey.trim();
      // For Google: only use proxyUrl when proxy is enabled, ignore baseUrl (Google doesn't need baseUrl)
      // For other providers: use proxyUrl if proxy enabled, otherwise use baseUrl
      const cleanBaseUrl = provider === 'google' 
        ? (useProxy && proxyUrl.trim() ? proxyUrl.trim() : '')
        : (useProxy && proxyUrl.trim() ? proxyUrl.trim() : baseUrl.trim());

      if (!cleanKey) {
          setErrorMsg(useProxy ? "请先输入代理的 API Key" : "请先输入 API Key");
          return;
      }
      setLoadingModels(true);
      setErrorMsg('');
      
      try {
          // 优先使用后端 API（node-fetch），避免 CORS 问题
          try {
              const dataServerUrl = await dataService.getDataServerUrl();
              console.log('[ApiKeyModal] 尝试使用后端 API 获取模型列表');
              
              const requestBody = {
                  provider: provider,
                  baseUrl: cleanBaseUrl || '',
                  apiKey: cleanKey,
                  proxyUrl: proxyUrl,
                  proxyKey: proxyKey,
                  useProxy: useProxy || false
              };
              
              const response = await fetch(`${dataServerUrl}/api/llm/models`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(requestBody)
              });
              
              if (response.ok) {
                  const data = await response.json();
                  console.log('[ApiKeyModal] 后端 API 获取模型列表成功');
                  
                  // 处理响应
                  let models = [];
                  if (data.models && Array.isArray(data.models)) {
                      models = data.models.map((m: any) => {
                          // 统一处理模型名称格式
                          let modelName = m.id || m.name || '';
                          if (modelName.startsWith('models/')) {
                              modelName = modelName.replace(/^models\//, '');
                          }
                          return {
                              id: modelName,
                              name: m.displayName || modelName,
                              description: m.description || ''
                          };
                      });
                  }
                  
                  setAvailableModels(models);
                  setErrorMsg('');
                  return; // 成功，直接返回
              } else {
                  const errorText = await response.text();
                  console.warn('[ApiKeyModal] 后端 API 获取模型列表失败，回退到前端直接调用:', errorText);
                  // 继续执行下面的前端直接调用逻辑
              }
          } catch (backendError: any) {
              console.warn('[ApiKeyModal] 后端 API 调用失败，回退到前端直接调用:', backendError.message);
              // 继续执行下面的前端直接调用逻辑
          }
          
          // 回退：使用前端直接调用（原来的逻辑）
          let url = '';
          let requestOptions: RequestInit = { method: 'GET' };

          if (provider === 'google') {
              // Google Gemini Logic
              // For Google: use proxyUrl if proxy is enabled, otherwise use default Google API
              let base = 'https://generativelanguage.googleapis.com';
              if (useProxy && cleanBaseUrl) {
                  // When using proxy, use the proxy URL
                  base = cleanBaseUrl.trim();
                  // Remove trailing slash
                  base = base.replace(/\/$/, '');
              }
              
              // 检查是否是 Google Gemini 代理服务（如 gcli.ggchan.dev）
              const isGoogleProxyService = base.includes('ggchan.dev') || 
                                          base.includes('generativelanguage') ||
                                          (modelId && modelId.toLowerCase().includes('gemini'));
              
              // 构建基础 URL（不包含路径）
              let baseUrl = base;
              if (base.includes('/v1beta') || base.includes('/openai') || base.includes('/v1')) {
                  // 如果 base 已经包含路径，提取基础部分
                  try {
                      const urlObj = new URL(base);
                      baseUrl = `${urlObj.protocol}//${urlObj.host}`;
                  } catch (e) {
                      const match = base.match(/^(https?:\/\/[^\/]+)/);
                      if (match) {
                          baseUrl = match[1];
                      }
                  }
              }
              
              // 对于 Google Gemini 代理服务，准备多个可能的端点路径（将在后续循环中尝试）
              if (isGoogleProxyService && useProxy) {
                  // 默认使用第一个可能的端点
                  url = `${baseUrl}/v1beta/openai/models?key=${cleanKey}`;
              } else {
                  // 标准 Google API 路径
              let path = '/v1beta/models';
              if (base.includes('/v1beta') || base.includes('/v1')) { path = '/models'; }
              if (base.endsWith('/models')) { path = ''; }
              url = `${base}${path}?key=${cleanKey}`;
              }
              
              requestOptions.headers = undefined; 

          } else {
              // OpenAI / DeepSeek / Others Logic (including proxy services)
              let base = cleanBaseUrl;
              if (!base) {
                  const p = PROVIDERS.find(p => p.id === provider);
                  base = p?.defaultBaseUrl || '';
              }
              base = base.replace(/\/$/, ''); // Remove trailing slash
              base = base.replace(/\/chat\/completions$/, ''); // Fix common mistake
              
              // 检查是否是 Google Gemini 代理服务（通过 baseURL 或模型名称判断）
              const isGoogleProxy = base.includes('ggchan.dev') || 
                                   base.includes('generativelanguage') ||
                                   (modelId && modelId.toLowerCase().includes('gemini'));
              
              if (isGoogleProxy) {
                  // 对于 Google Gemini 代理，先移除 baseUrl 中已有的路径，然后添加正确的路径
                  // 移除末尾的 /v1, /v1beta, /openai 等路径
                  base = base.replace(/\/v1beta(\/|$)/, '').replace(/\/v1(\/|$)/, '').replace(/\/openai(\/|$)/, '');
                  base = base.replace(/\/$/, ''); // 移除末尾的斜杠
                  
                  // 尝试使用 /v1beta/models 或 /openai/v1/models
                  let path = '/v1beta/models';
                  url = `${base}${path}?key=${cleanKey}`;
                  requestOptions.headers = undefined; // Google API 使用 query parameter
              } else {
              // Normalize: remove /v1, then add /v1/models
              base = base.replace(/\/v1$/, '');
              url = `${base}/v1/models`;
              
              requestOptions.headers = { 
                  'Authorization': `Bearer ${cleanKey}`,
                  'Content-Type': 'application/json'
              };
              }
          }

          // 尝试多个代理端口（3001-3010），如果直接请求失败
          const proxyPorts = [3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010];
          const isExternalUrl = url.startsWith('http://') || url.startsWith('https://');
          const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');
          
          // 检查是否是 Google Gemini 代理服务（从 URL 或模型名称判断）
          const isGoogleProxy = url.includes('ggchan.dev') || 
                               url.includes('generativelanguage') ||
                               (modelId && modelId.toLowerCase().includes('gemini'));
          
          // 从 URL 中提取 base（用于后续尝试其他端点）
          let baseFromUrl = url;
          try {
              const urlObj = new URL(url);
              baseFromUrl = `${urlObj.protocol}//${urlObj.host}`;
          } catch (e) {
              // 如果 URL 解析失败，尝试从 URL 中提取
              const match = url.match(/^(https?:\/\/[^\/]+)/);
              if (match) {
                  baseFromUrl = match[1];
              }
          }

          let res: Response;
          let lastError: any = null;
          
          // 对于 Google 代理服务，如果第一个端点失败，尝试其他可能的端点
          const googleEndpoints = isGoogleProxy ? [
              url, // 原始 URL
              `${baseFromUrl}/v1beta/openai/models?key=${cleanKey}`,  // Google OpenAI 兼容接口
              `${baseFromUrl}/v1beta/models?key=${cleanKey}`,        // Google 原生接口
              `${baseFromUrl}/openai/v1/models?key=${cleanKey}`,      // 一些代理可能使用这个路径
              `${baseFromUrl}/v1/models?key=${cleanKey}`              // OpenAI 兼容格式
          ] : [url];
          
          let fetchSuccess = false;
          for (const endpointUrl of googleEndpoints) {
              try {
                  res = await fetch(endpointUrl, requestOptions);
                  if (res.ok) {
                      fetchSuccess = true;
                      url = endpointUrl; // 更新 url 以便后续使用
                      break;
                  } else if (res.status !== 404) {
                      // 如果不是 404，可能是认证错误等，直接抛出
                      const txt = await res.text();
                      let parsedErr = txt;
                      try {
                          const json = JSON.parse(txt);
                          parsedErr = json.error?.message || json.message || txt;
                      } catch(e) {}
                      throw new Error(`(${res.status}) ${parsedErr.slice(0, 150)}`);
                  }
          } catch (fetchError: any) {
                  lastError = fetchError;
              // 如果是CORS或网络错误，尝试使用本地代理服务器
              const errorMsg = fetchError.message || 'Network error';
                  const isCorsError = errorMsg.includes('CORS') || errorMsg.includes('Failed to fetch') || 
                                    errorMsg.includes('ERR_CONNECTION_CLOSED') || errorMsg.includes('ECONNREFUSED');
              
              if (isCorsError && isExternalUrl && !isLocalhost) {
                  // 尝试使用本地代理服务器
                  let proxySuccess = false;
                  
                  for (const proxyPort of proxyPorts) {
                      try {
                              const proxyUrl = `http://localhost:${proxyPort}/proxy?target=${encodeURIComponent(endpointUrl)}`;
                          console.log(`[ApiKeyModal] 尝试使用本地代理 (端口${proxyPort})`);
                          res = await fetch(proxyUrl, requestOptions);
                              if (res.ok) {
                          proxySuccess = true;
                                  fetchSuccess = true;
                                  url = endpointUrl; // 更新 url 以便后续使用
                          console.log(`[ApiKeyModal] 代理成功 (端口${proxyPort})`);
                          break;
                              }
                      } catch (proxyError: any) {
                          // 继续尝试下一个端口
                      }
                  }
                  
                      if (proxySuccess) {
                          break; // 代理成功，跳出循环
                      }
                  }
                  
                  // 如果所有端点都失败，继续尝试下一个端点
                  if (endpointUrl === googleEndpoints[googleEndpoints.length - 1]) {
                      // 这是最后一个端点，如果还是失败，抛出错误
                      if (!fetchSuccess) {
                          if (isCorsError && isExternalUrl && !isLocalhost) {
                      throw new Error(`CORS错误: ${errorMsg}。请运行 "启动代理服务器.bat" 启动代理服务器以解决CORS限制。`);
              } else {
                  throw fetchError;
                          }
                      }
                  }
              }
          }
          
          if (!fetchSuccess || !res.ok) {
              const txt = await res?.text() || '';
              let parsedErr = txt;
              try {
                  const json = JSON.parse(txt);
                  parsedErr = json.error?.message || json.message || txt;
              } catch(e) {}
              throw new Error(`(${res?.status || 'Unknown'}) ${parsedErr.slice(0, 150) || lastError?.message || '获取模型列表失败'}`);
          }

          const data = await res.json();
          console.log('[ApiKeyModal] API 响应数据:', {
              hasData: !!data,
              dataKeys: data ? Object.keys(data) : [],
              dataPreview: JSON.stringify(data).substring(0, 500)
          });
          
          let models: string[] = [];

          if (provider === 'google') {
              // Google 格式：{ models: [{ name: "models/xxx" }, ...] }
              if (data.models && Array.isArray(data.models)) {
                  models = data.models.map((m: any) => {
                      const name = m.name || m.id || m.model || '';
                      return name.replace('models/', '').replace('models\\/', '');
                  }).filter((name: string) => name.length > 0);
              }
          } else {
              // OpenAI 格式：{ data: [{ id: "..." }, ...] }
              if (data.data && Array.isArray(data.data)) {
                  models = data.data.map((m: any) => m.id || m.name || m.model || '').filter((id: string) => id.length > 0);
              } else if (Array.isArray(data)) {
                  // 有些 API 直接返回数组
                  models = data.map((m: any) => m.id || m.name || m.model || '').filter((id: string) => id.length > 0);
              } else if (data.models && Array.isArray(data.models)) {
                  // 有些 API 使用 models 字段但不是 Google 格式
                  models = data.models.map((m: any) => m.id || m.name || m.model || '').filter((id: string) => id.length > 0);
              }
          }

          console.log('[ApiKeyModal] 解析后的模型列表:', {
              modelsCount: models.length,
              models: models.slice(0, 10) // 只显示前10个
          });

          if (models.length > 0) {
              setAvailableModels(models);
              setShowModelList(true);
          } else {
              // 提供更详细的错误信息
              const dataStr = JSON.stringify(data).substring(0, 500);
              throw new Error(`API 返回了空模型列表。响应数据: ${dataStr}。请检查 API 配置和响应格式是否正确。`);
          }
      } catch (e: any) {
          console.error("Fetch Error", e);
          setErrorMsg("获取失败: " + e.message);
      } finally {
          setLoadingModels(false);
      }
  };

  const handleTest = async () => {
    // Use proxy key if proxy is enabled and proxyKey is provided, otherwise use regular apiKey
    const keyToUse = (useProxy && proxyKey.trim()) ? proxyKey.trim() : apiKey.trim();
    if (!keyToUse) {
        setErrorMsg(useProxy ? "请先输入代理的 API Key" : "请先输入 API Key");
        return;
    }
    setTestStatus('testing');
    setErrorMsg('');
    try {
        const config: ApiConfig = { 
            provider, 
            apiKey: apiKey.trim(), 
            baseUrl: baseUrl.trim(), 
            modelId, 
            name: configName,
            useProxy: useProxy,
            proxyUrl: useProxy ? proxyUrl.trim() : undefined,
            proxyKey: useProxy ? proxyKey.trim() : undefined,
            // FC 测试必须强制走 Function Calling，避免被自动/默认策略改成 JSON Schema
            toolCallMode: 'function_calling'
        };
        await LLMAdapter.chat(config, [], "Hi", "Test", []);
        setTestStatus('success');
        setTimeout(() => setTestStatus('idle'), 3000);
    } catch (e: any) {
        setTestStatus('error');
        setErrorMsg(e.message || "Connection failed");
    }
  };

  // 测试 OpenAI 兼容的 Function Calling
  const handleTestOpenAIFunctionCalling = async () => {
    const keyToUse = (useProxy && proxyKey.trim()) ? proxyKey.trim() : apiKey.trim();
    if (!keyToUse) {
        setFcTestResult('请先输入 API Key');
        setFcTestStatus('error');
        return;
    }
    if (!modelId.trim()) {
        setFcTestResult('请先输入模型 ID');
        setFcTestStatus('error');
        return;
    }
    
    setFcTestStatus('testing');
    setFcTestResult('正在测试...');
    
    try {
        const config: ApiConfig = { 
            provider, 
            apiKey: apiKey.trim(), 
            baseUrl: baseUrl.trim(), 
            modelId, 
            name: configName,
            useProxy: useProxy,
            proxyUrl: useProxy ? proxyUrl.trim() : undefined,
            proxyKey: useProxy ? proxyKey.trim() : undefined,
            toolCallMode: 'function_calling' // 强制使用 Function Calling 模式进行测试
        };
        
        // 创建一个简单的测试工具（使用 FunctionDeclaration 格式）
        const testTool: FunctionDeclaration = {
            name: 'test_function',
            description: 'A simple test function to verify function calling support',
            parameters: {
                type: 'object',
                properties: {
                    message: {
                        type: 'string',
                        description: 'A test message'
                    }
                },
                required: ['message']
            }
        };
        
        // 尝试调用，强制要求工具调用
        const result = await LLMAdapter.chat(
            config, 
            [], 
            "请调用 test_function 工具，参数 message 设为 'Function Calling 测试成功'", 
            "你是一个测试助手。当用户要求调用工具时，你必须调用工具。", 
            [testTool],
            undefined,
            { temperature: 0.7 },
            true // forceToolCall
        );
        
        if (result.functionCalls && result.functionCalls.length > 0) {
            const toolCall = result.functionCalls[0];
            if (toolCall.name === 'test_function' && toolCall.args.message === 'Function Calling 测试成功') {
                setFcTestResult('✅ OpenAI 兼容 Function Calling 测试成功！模型支持工具调用。');
                setFcTestStatus('success');
            } else {
                setFcTestResult(`⚠️ 工具调用返回了，但格式不正确：${JSON.stringify(toolCall)}`);
                setFcTestStatus('error');
            }
        } else {
            setFcTestResult('❌ 模型没有返回工具调用。可能原因：\n1. API 不支持 tool_choice: "required"\n2. 模型不支持 Function Calling\n3. 中转服务不支持强制工具调用\n\n建议：将工具调用模式切换为 "JSON Schema 模式"');
            setFcTestStatus('error');
            setFcTestPassed(false);
        }
    } catch (e: any) {
        setFcTestResult(`❌ 测试失败：${e.message || "未知错误"}\n\n建议：将工具调用模式切换为 "JSON Schema 模式"`);
        setFcTestStatus('error');
        setFcTestPassed(false);
    }
  };

  // 测试 Gemini Function Calling（使用 Google 原生 SDK）
  const handleTestGeminiFunctionCalling = async () => {
    const keyToUse = (useProxy && proxyKey.trim()) ? proxyKey.trim() : apiKey.trim();
    if (!keyToUse) {
        setGeminiFcTestResult('请先输入 API Key');
        setGeminiFcTestStatus('error');
        return;
    }
    if (!modelId.trim()) {
        setGeminiFcTestResult('请先输入模型 ID');
        setGeminiFcTestStatus('error');
        return;
    }
    
    setGeminiFcTestStatus('testing');
    setGeminiFcTestResult('正在测试 Gemini Function Calling...');
    
    try {
        // 检查是否是 Google provider
        if (provider !== 'google') {
            setGeminiFcTestResult('⚠️ Gemini Function Calling 测试仅适用于 Google provider。当前 provider: ' + provider);
            setGeminiFcTestStatus('error');
            return;
        }
        
        const config: ApiConfig = { 
            provider: 'google', 
            apiKey: apiKey.trim(), 
            baseUrl: baseUrl.trim(), 
            modelId, 
            name: configName,
            useProxy: useProxy,
            proxyUrl: useProxy ? proxyUrl.trim() : undefined,
            proxyKey: useProxy ? proxyKey.trim() : undefined,
            toolCallMode: 'function_calling'
        };
        
        // 创建一个简单的测试工具（使用 FunctionDeclaration 格式）
        const testTool: FunctionDeclaration = {
            name: 'test_function',
            description: 'A simple test function to verify Gemini function calling support',
            parameters: {
                type: 'object',
                properties: {
                    message: {
                        type: 'string',
                        description: 'A test message'
                    }
                },
                required: ['message']
            }
        };
        
        // 尝试调用，强制要求工具调用
        const result = await LLMAdapter.chat(
            config, 
            [], 
            "请调用 test_function 工具，参数 message 设为 'Gemini Function Calling 测试成功'", 
            "你是一个测试助手。当用户要求调用工具时，你必须调用工具。", 
            [testTool],
            undefined,
            { temperature: 0.7 },
            true // forceToolCall
        );
        
        if (result.functionCalls && result.functionCalls.length > 0) {
            const toolCall = result.functionCalls[0];
            if (toolCall.name === 'test_function' && toolCall.args.message === 'Gemini Function Calling 测试成功') {
                setGeminiFcTestResult('✅ Gemini Function Calling 测试成功！模型支持 Google 原生工具调用。');
                setGeminiFcTestStatus('success');
            } else {
                setGeminiFcTestResult(`⚠️ 工具调用返回了，但格式不正确：${JSON.stringify(toolCall)}`);
                setGeminiFcTestStatus('error');
            }
        } else {
            setGeminiFcTestResult('❌ 模型没有返回工具调用。可能原因：\n1. API 不支持 tool_choice: "required"\n2. 模型不支持 Function Calling\n3. 中转服务不支持强制工具调用');
            setGeminiFcTestStatus('error');
        }
    } catch (e: any) {
        setGeminiFcTestResult(`❌ 测试失败：${e.message || "未知错误"}`);
        setGeminiFcTestStatus('error');
    }
  };

  // 测试 Gemini Function Calling（使用 Google 原生 SDK，不通过 OpenAI 兼容接口）
  const handleTestGeminiNativeFunctionCalling = async () => {
    const keyToUse = (useProxy && proxyKey.trim()) ? proxyKey.trim() : apiKey.trim();
    if (!keyToUse) {
        setGeminiNativeFcTestResult('请先输入 API Key');
        setGeminiNativeFcTestStatus('error');
        return;
    }
    if (!modelId.trim()) {
        setGeminiNativeFcTestResult('请先输入模型 ID');
        setGeminiNativeFcTestStatus('error');
        return;
    }
    
    setGeminiNativeFcTestStatus('testing');
    setGeminiNativeFcTestResult('正在测试 Gemini 原生 SDK Function Calling...');
    
    try {
        // 检查是否是 Google provider
        if (provider !== 'google') {
            setGeminiNativeFcTestResult('⚠️ Gemini 原生 SDK 测试仅适用于 Google provider。当前 provider: ' + provider);
            setGeminiNativeFcTestStatus('error');
            return;
        }

        // 使用 Google 原生 SDK
        const genAI = new GoogleGenAI({ apiKey: keyToUse });
        
        // 处理模型 ID（移除 models/ 前缀）
        let normalizedModelId = modelId.trim();
        if (normalizedModelId.startsWith('models/')) {
            normalizedModelId = normalizedModelId.replace(/^models\//, '');
        }

        // 创建测试工具
        const testTool: FunctionDeclaration = {
            name: 'test_function',
            description: 'A simple test function to verify Gemini native SDK function calling support',
            parameters: {
                type: 'object',
                properties: {
                    message: {
                        type: 'string',
                        description: 'A test message'
                    }
                },
                required: ['message']
            }
        };

        // 构建请求
        const prompt = "请调用 test_function 工具，参数 message 设为 'Gemini 原生 SDK Function Calling 测试成功'";
        
        // Google SDK 的正确用法：genAI.models.generateContent({ model, contents, config })
        const result = await genAI.models.generateContent({
            model: normalizedModelId,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                tools: [{ functionDeclarations: [testTool] }],
                toolConfig: {
                    functionCallingConfig: {
                        mode: 'ANY', // 强制要求工具调用
                    }
                }
            }
        });

        // 获取工具调用（直接从 candidates 中提取，避免使用 result.text 的警告）
        const candidates = result.candidates || [];
        const functionCalls: any[] = [];
        
        if (candidates.length > 0) {
            const candidate = candidates[0];
            const content = candidate.content;
            if (content && content.parts) {
                for (const part of content.parts) {
                    if (part.functionCall) {
                        functionCalls.push({
                            name: part.functionCall.name,
                            args: part.functionCall.args || {},
                            id: part.functionCall.name || ''
                        });
                    }
                }
            }
        }

        if (functionCalls && functionCalls.length > 0) {
            const toolCall = functionCalls[0];
            if (toolCall.name === 'test_function') {
                const args = toolCall.args as any;
                if (args && args.message === 'Gemini 原生 SDK Function Calling 测试成功') {
                    setGeminiNativeFcTestResult('✅ Gemini 原生 SDK Function Calling 测试成功！模型支持 Google 原生工具调用。');
                    setGeminiNativeFcTestStatus('success');
                } else {
                    setGeminiNativeFcTestResult(`⚠️ 工具调用返回了，但参数不正确：${JSON.stringify(args)}`);
                    setGeminiNativeFcTestStatus('error');
                }
            } else {
                setGeminiNativeFcTestResult(`⚠️ 工具调用返回了，但工具名称不正确：${toolCall.name}`);
                setGeminiNativeFcTestStatus('error');
            }
        } else {
            setGeminiNativeFcTestResult('❌ 模型没有返回工具调用。可能原因：\n1. 模型不支持 Function Calling\n2. 中转服务不支持 Google 原生 SDK\n3. API Key 或模型 ID 不正确');
            setGeminiNativeFcTestStatus('error');
        }
    } catch (e: any) {
        let errorMessage = e.message || "未知错误";
        
        // 处理 429 频率限制错误
        if (e.status === 429 || errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
            errorMessage = 'API 调用频率限制（429）：请稍后再试。Google API 有速率限制，建议等待一段时间后重试。';
        }
        
        setGeminiNativeFcTestResult(`❌ 测试失败：${errorMessage}\n\n提示：如果使用中转服务，请确保中转服务支持 Google 原生 SDK（不是 OpenAI 兼容接口）。`);
        setGeminiNativeFcTestStatus('error');
    }
  };

  // 测试 JSON Schema
  const handleTestJsonSchema = async () => {
    const keyToUse = (useProxy && proxyKey.trim()) ? proxyKey.trim() : apiKey.trim();
    if (!keyToUse) {
        setJsonSchemaTestResult('请先输入 API Key');
        setJsonSchemaTestStatus('error');
        return;
    }
    if (!modelId.trim()) {
        setJsonSchemaTestResult('请先输入模型 ID');
        setJsonSchemaTestStatus('error');
        return;
    }
    
    setJsonSchemaTestStatus('testing');
    setJsonSchemaTestResult('正在测试 JSON Schema...');
    
    try {
        const config: ApiConfig = { 
            provider, 
            apiKey: apiKey.trim(), 
            baseUrl: baseUrl.trim(), 
            modelId, 
            name: configName,
            useProxy: useProxy,
            proxyUrl: useProxy ? proxyUrl.trim() : undefined,
            proxyKey: useProxy ? proxyKey.trim() : undefined,
            toolCallMode: 'json_schema' // 强制使用 JSON Schema 模式
        };
        
        // 创建一个简单的测试工具
        const testTool: FunctionDeclaration = {
            name: 'test_function',
            description: 'A simple test function to verify JSON Schema support',
            parameters: {
                type: 'object',
                properties: {
                    message: {
                        type: 'string',
                        description: 'A test message'
                    }
                },
                required: ['message']
            }
        };
        
        // 测试调用
        const result = await LLMAdapter.chat(
            config, 
            [], 
            "请调用 test_function 工具，参数 message 设为 'JSON Schema 测试成功'", 
            "你是一个测试助手。当用户要求调用工具时，你必须按照 JSON Schema 格式返回。", 
            [testTool],
            undefined,
            { temperature: 0.7 },
            true // forceToolCall
        );
        
        // 🔍 显示完整的返回内容（用于调试）
        console.log('========== JSON Schema 测试完整结果 ==========');
        console.log('📄 result.text 完整内容:');
        console.log(result.text);
        console.log('📄 result.functionCalls:');
        console.log(JSON.stringify(result.functionCalls, null, 2));
        console.log('📄 result.reasoning:');
        console.log(result.reasoning);
        console.log('========== JSON Schema 测试结果结束 ==========');
        
        // 构建详细的结果显示
        let resultDetails = '';
        resultDetails += `【原始返回文本】(${result.text?.length || 0}字符):\n`;
        resultDetails += result.text || '(空)';
        resultDetails += '\n\n';
        
        if (result.functionCalls && result.functionCalls.length > 0) {
            const toolCall = result.functionCalls[0];
            resultDetails += `【解析到的工具调用】:\n`;
            resultDetails += JSON.stringify(result.functionCalls, null, 2);
            resultDetails += '\n\n';
            
            if (toolCall.name === 'test_function' && toolCall.args.message === 'JSON Schema 测试成功') {
                setJsonSchemaTestResult('✅ JSON Schema 测试成功！\n\n' + resultDetails);
                setJsonSchemaTestStatus('success');
            } else {
                setJsonSchemaTestResult(`⚠️ 工具调用返回了，但格式不完全正确:\n\n` + resultDetails);
                setJsonSchemaTestStatus('error');
            }
        } else {
            resultDetails += `【解析到的工具调用】: 无\n\n`;
            resultDetails += `❌ 可能原因：\n`;
            resultDetails += `1. 模型没有在回复末尾使用 \`\`\`json ... \`\`\` 格式\n`;
            resultDetails += `2. JSON 格式有语法错误\n`;
            resultDetails += `3. JSON 中缺少 tool_calls 数组\n`;
            resultDetails += `4. 模型不适合使用 JSON Schema 模式\n\n`;
            resultDetails += `💡 请查看上方【原始返回文本】分析问题`;
            setJsonSchemaTestResult(resultDetails);
            setJsonSchemaTestStatus('error');
        }
    } catch (e: any) {
        setJsonSchemaTestResult(`❌ 测试失败：${e.message || "未知错误"}`);
        setJsonSchemaTestStatus('error');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    const finalName = configName.trim() || `${PROVIDERS.find(p=>p.id===provider)?.name} Config`;
    const newConfig: ApiConfig = { 
        name: finalName, 
        provider, 
        apiKey: apiKey.trim(), 
        baseUrl: baseUrl.trim(), 
        modelId,
        useProxy: useProxy,
        proxyUrl: useProxy ? proxyUrl.trim() : undefined,
        proxyKey: useProxy ? proxyKey.trim() : undefined,
        availableModels: availableModels.length > 0 ? availableModels : undefined,
        toolCallMode: toolCallMode
    };
    
    let newSavedConfigs = [...effectiveSavedConfigs];
    if (editMode === 'new') newSavedConfigs.push(newConfig);
    else newSavedConfigs[editMode] = newConfig;

    setSavedConfigs(newSavedConfigs);
    localStorage.setItem('storyforge_saved_api_configs', JSON.stringify(newSavedConfigs));
    localStorage.setItem('storyforge_api_config', JSON.stringify(newConfig));
    onSave(newConfig);
    onClose();
  };

  const handleImportButtonClick = () => {
    importInputRef.current?.click();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        if (!Array.isArray(parsed)) throw new Error('文件格式不正确');
        const validConfigs: ApiConfig[] = parsed.filter((c: any) => c && c.provider && c.apiKey);
        if (validConfigs.length === 0) throw new Error('没有可用的配置');
        if (onImportApiConfigs) {
          onImportApiConfigs(validConfigs);
        } else {
          setSavedConfigs(validConfigs);
          localStorage.setItem('storyforge_saved_api_configs', JSON.stringify(validConfigs));
        }
        if (!propSavedConfigs) {
          setSavedConfigs(validConfigs);
        }
        loadConfigIntoForm(validConfigs[0], 0);
        setErrorMsg('');
      } catch (err: any) {
        setErrorMsg(err.message || '导入失败，请检查文件格式');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (!isOpen) return null;

  const currentProvider = PROVIDERS.find(p => p.id === provider);
  const getKeyUrl = currentProvider?.getKeyUrl;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      {/* Width fixed for mobile responsiveness: w-[95vw] md:max-w-md */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-[95vw] md:max-w-md flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/50 rounded-t-2xl flex-shrink-0">
           <div>
             <h2 className="text-lg md:text-xl font-bold text-white">API 连接配置</h2>
           </div>
           {!forced && <button onClick={onClose} className="text-slate-500 hover:text-white"><Plus className="rotate-45 w-6 h-6"/></button>}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 pb-32">
            
            {/* Profile Manager */}
            <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">选择模式</label>
                <div className="flex gap-2">
                    <button 
                        type="button"
                        onClick={() => resetForm()}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors flex items-center gap-2 flex-shrink-0 ${editMode === 'new' ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                    >
                        <Plus className="w-4 h-4" /> 新建
                    </button>
                    
                    <div className="relative flex-1 min-w-0">
                        <select 
                            className={`w-full h-full appearance-none bg-slate-800 border border-slate-700 rounded-lg px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer truncate ${editMode !== 'new' ? 'text-white bg-slate-700' : 'text-slate-400'}`}
                            value={editMode === 'new' ? '' : editMode}
                            onChange={(e) => {
                               const val = e.target.value;
                               if (val !== '') loadConfigIntoForm(effectiveSavedConfigs[Number(val)], Number(val));
                               else resetForm();
                            }}
                        >
                            <option value="" disabled>加载已有配置...</option>
                            {effectiveSavedConfigs.map((c, idx) => (
                                <option key={idx} value={idx}>{c.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    </div>
                </div>
            </div>

            <div className="h-px bg-slate-800" />

            <form id="apiForm" onSubmit={handleSubmit} className="space-y-4">
                {/* Config Name */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">配置名称</label>
                    <div className="flex gap-2">
                        <input
                            type="text" 
                            value={configName}
                            onChange={(e) => setConfigName(e.target.value)}
                            placeholder="例如: 我的 DeepSeek Key"
                            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none text-sm min-w-0"
                        />
                        {typeof editMode === 'number' && (
                            <button type="button" onClick={() => handleDeleteConfig(editMode)} className="p-2 bg-red-900/20 border border-red-900/50 text-red-400 rounded-lg hover:bg-red-900/40 transition-colors flex-shrink-0" title="删除此配置">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Provider */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">AI 供应商</label>
                    <div className="relative">
                        <select 
                            value={provider} 
                            onChange={e => handleProviderChange(e.target.value as ApiProvider)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500 appearance-none pl-9"
                        >
                            {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <div className="absolute left-3 top-2.5 pointer-events-none text-purple-400">
                            {currentProvider ? <currentProvider.icon className="w-4 h-4"/> : <Settings className="w-4 h-4"/>}
                        </div>
                        <ChevronDown className="absolute right-3 top-2.5 pointer-events-none w-4 h-4 text-slate-500"/>
                    </div>
                </div>

                {/* API Key */}
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">API Key <span className="text-red-400">*</span></label>
                        {getKeyUrl && (
                            <a href={getKeyUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-400 hover:underline flex items-center gap-1">
                                获取 Key <ExternalLink className="w-3 h-3" />
                            </a>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="text" 
                            value={apiKey}
                            onChange={(e) => { setApiKey(e.target.value); setTestStatus('idle'); }}
                            placeholder="sk-..."
                            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none font-mono text-sm min-w-0"
                        />
                        <button
                            type="button"
                            onClick={handleTest}
                            disabled={!apiKey.trim() || testStatus === 'testing'}
                            className={`px-3 rounded-lg border font-medium transition-colors flex items-center gap-2 flex-shrink-0 ${testStatus === 'success' ? 'bg-emerald-900/20 border-emerald-500 text-emerald-400' : testStatus === 'error' ? 'bg-red-900/20 border-red-500 text-red-400' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
                            title="验证连接"
                        >
                            {testStatus === 'testing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                {/* Base URL - Hidden for Google (only use proxyUrl when proxy is enabled) */}
                {provider !== 'google' && (
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                        Base URL {provider === 'custom' ? '(反代服务地址)' : ''}
                    </label>
                    <input
                        type="text"
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        placeholder={provider === 'custom' ? "https://反代地址.com/v1 或 https://反代地址.com" : "https://api.example.com/v1"}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none font-mono text-sm"
                    />
                    {provider === 'custom' && (
                        <p className="text-xs text-slate-400 mt-1">
                            填写反代服务地址，如: https://mcxbx.daybreakhk.com/v1 或 https://gcli.ggchan.dev/v1
                        </p>
                    )}
                </div>
                )}

                {/* Model ID - Optimized Flex Wrap for Mobile */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">模型 ID (Model ID)</label>
                    <div className="flex flex-wrap gap-2 relative">
                        <div className="relative flex-1 min-w-[140px]">
                            <input
                                type="text"
                                value={modelId}
                                onChange={(e) => setModelId(e.target.value)}
                                placeholder="gemini-2.5-pro (推荐) 或 gemini-2.5-flash"
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none font-mono text-sm"
                            />
                            {showModelList && availableModels.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 min-w-full">
                                    {availableModels.map(m => (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => { setModelId(m); setShowModelList(false); }}
                                            className="w-full text-left px-3 py-2 text-xs md:text-sm text-slate-300 hover:bg-slate-700 hover:text-white break-words whitespace-normal border-b border-slate-700/50"
                                        >
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={fetchModels}
                            disabled={loadingModels || !apiKey.trim()}
                            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors flex items-center justify-center gap-1 flex-shrink-0"
                        >
                            {loadingModels ? <Loader2 className="w-4 h-4 animate-spin" /> : <List className="w-4 h-4" />}
                            <span className="text-xs whitespace-nowrap">获取列表</span>
                        </button>
                    </div>
                </div>

                {/* Tool Call Mode Selection */}
                <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">工具调用模式</label>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => setToolCallMode('function_calling')}
                            className={`px-3 py-2 rounded-lg border font-medium transition-colors flex items-center gap-2 text-sm ${
                                toolCallMode === 'function_calling' 
                                    ? 'bg-emerald-900/30 border-emerald-500 text-emerald-400' 
                                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                            }`}
                        >
                            <Settings className="w-4 h-4" />
                            <span className="text-xs">Function Calling</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setToolCallMode('json_schema')}
                            className={`px-3 py-2 rounded-lg border font-medium transition-colors flex items-center gap-2 text-sm ${
                                toolCallMode === 'json_schema' 
                                    ? 'bg-amber-900/30 border-amber-500 text-amber-400' 
                                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                            }`}
                        >
                            <Box className="w-4 h-4" />
                            <span className="text-xs">JSON Schema</span>
                        </button>
                    </div>
                    <p className="text-xs text-slate-500">
                        {toolCallMode === 'function_calling' && 'Function Calling：使用 API 原生工具调用（需要 API 支持）'}
                        {toolCallMode === 'json_schema' && 'JSON Schema：在提示词中嵌入 JSON 格式要求（兼容性更好，推荐）'}
                    </p>
                </div>

                {/* Tool Calling Tests */}
                <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">工具调用测试</label>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={handleTestJsonSchema}
                            disabled={!apiKey.trim() || !modelId.trim() || jsonSchemaTestStatus === 'testing'}
                            className={`px-3 py-2 rounded-lg border font-medium transition-colors flex items-center gap-2 flex-shrink-0 text-sm ${
                                jsonSchemaTestStatus === 'success' 
                                    ? 'bg-emerald-900/20 border-emerald-500 text-emerald-400' 
                                    : jsonSchemaTestStatus === 'error' 
                                    ? 'bg-red-900/20 border-red-500 text-red-400' 
                                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                            }`}
                            title="测试 JSON Schema 模式"
                        >
                            {jsonSchemaTestStatus === 'testing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Box className="w-4 h-4" />}
                            <span className="text-xs whitespace-nowrap">测试 JSON Schema</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleTestOpenAIFunctionCalling}
                            disabled={!apiKey.trim() || !modelId.trim() || fcTestStatus === 'testing'}
                            className={`px-3 py-2 rounded-lg border font-medium transition-colors flex items-center gap-2 flex-shrink-0 text-sm ${
                                fcTestStatus === 'success' 
                                    ? 'bg-emerald-900/20 border-emerald-500 text-emerald-400' 
                                    : fcTestStatus === 'error' 
                                    ? 'bg-red-900/20 border-red-500 text-red-400' 
                                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                            }`}
                            title="测试 OpenAI 兼容的 Function Calling"
                        >
                            {fcTestStatus === 'testing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                            <span className="text-xs whitespace-nowrap">测试 OpenAI FC</span>
                        </button>
                        {provider === 'google' && (
                            <>
                                <button
                                    type="button"
                                    onClick={handleTestGeminiFunctionCalling}
                                    disabled={!apiKey.trim() || !modelId.trim() || geminiFcTestStatus === 'testing'}
                                    className={`px-3 py-2 rounded-lg border font-medium transition-colors flex items-center gap-2 flex-shrink-0 text-sm ${
                                        geminiFcTestStatus === 'success' 
                                            ? 'bg-emerald-900/20 border-emerald-500 text-emerald-400' 
                                            : geminiFcTestStatus === 'error' 
                                            ? 'bg-red-900/20 border-red-500 text-red-400' 
                                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                                    }`}
                                    title="测试 Gemini Function Calling (OpenAI 兼容接口)"
                                >
                                    {geminiFcTestStatus === 'testing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                    <span className="text-xs whitespace-nowrap">测试 Gemini FC (OpenAI)</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleTestGeminiNativeFunctionCalling}
                                    disabled={!apiKey.trim() || !modelId.trim() || geminiNativeFcTestStatus === 'testing'}
                                    className={`px-3 py-2 rounded-lg border font-medium transition-colors flex items-center gap-2 flex-shrink-0 text-sm ${
                                        geminiNativeFcTestStatus === 'success' 
                                            ? 'bg-emerald-900/20 border-emerald-500 text-emerald-400' 
                                            : geminiNativeFcTestStatus === 'error' 
                                            ? 'bg-red-900/20 border-red-500 text-red-400' 
                                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                                    }`}
                                    title="测试 Gemini Function Calling (Google 原生 SDK)"
                                >
                                    {geminiNativeFcTestStatus === 'testing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                    <span className="text-xs whitespace-nowrap">测试 Gemini FC (原生)</span>
                                </button>
                            </>
                        )}
                    </div>
                    {(jsonSchemaTestResult || fcTestResult || geminiFcTestResult || geminiNativeFcTestResult) && (
                        <div className="space-y-2">
                            {jsonSchemaTestResult && (
                                <div className={`p-3 rounded-lg border text-xs ${
                                    jsonSchemaTestStatus === 'success'
                                        ? 'bg-emerald-900/20 border-emerald-500 text-emerald-400'
                                        : jsonSchemaTestStatus === 'error'
                                        ? 'bg-red-900/20 border-red-500 text-red-400'
                                        : 'bg-slate-800 border-slate-700 text-slate-400'
                                }`}>
                                    <div className="font-bold mb-1">JSON Schema 测试结果:</div>
                                    <div className="max-h-[400px] overflow-y-auto whitespace-pre-wrap break-all font-mono text-[11px] bg-slate-950/50 p-2 rounded">
                                        {jsonSchemaTestResult}
                                    </div>
                                </div>
                            )}
                            {fcTestResult && (
                                <div className={`p-3 rounded-lg border text-xs whitespace-pre-wrap ${
                                    fcTestStatus === 'success'
                                        ? 'bg-emerald-900/20 border-emerald-500 text-emerald-400'
                                        : fcTestStatus === 'error'
                                        ? 'bg-red-900/20 border-red-500 text-red-400'
                                        : 'bg-slate-800 border-slate-700 text-slate-400'
                                }`}>
                                    <div className="font-bold mb-1">OpenAI 兼容 FC:</div>
                                    {fcTestResult}
                                </div>
                            )}
                            {geminiFcTestResult && (
                                <div className={`p-3 rounded-lg border text-xs whitespace-pre-wrap ${
                                    geminiFcTestStatus === 'success'
                                        ? 'bg-emerald-900/20 border-emerald-500 text-emerald-400'
                                        : geminiFcTestStatus === 'error'
                                        ? 'bg-red-900/20 border-red-500 text-red-400'
                                        : 'bg-slate-800 border-slate-700 text-slate-400'
                                }`}>
                                    <div className="font-bold mb-1">Gemini FC (OpenAI 兼容):</div>
                                    {geminiFcTestResult}
                                </div>
                            )}
                            {geminiNativeFcTestResult && (
                                <div className={`p-3 rounded-lg border text-xs whitespace-pre-wrap ${
                                    geminiNativeFcTestStatus === 'success'
                                        ? 'bg-emerald-900/20 border-emerald-500 text-emerald-400'
                                        : geminiNativeFcTestStatus === 'error'
                                        ? 'bg-red-900/20 border-red-500 text-red-400'
                                        : 'bg-slate-800 border-slate-700 text-slate-400'
                                }`}>
                                    <div className="font-bold mb-1">Gemini FC (Google 原生 SDK):</div>
                                    {geminiNativeFcTestResult}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Reverse Proxy Settings */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-500 uppercase">反向代理服务</label>
                        <button
                            type="button"
                            onClick={() => setUseProxy(!useProxy)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                useProxy ? 'bg-purple-600' : 'bg-slate-600'
                            }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    useProxy ? 'translate-x-6' : 'translate-x-1'
                                }`}
                            />
                        </button>
                    </div>
                    {useProxy && (
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">代理服务地址</label>
                                <input
                                    type="text"
                                    value={proxyUrl}
                                    onChange={(e) => setProxyUrl(e.target.value)}
                                    placeholder="https://proxy.example.com"
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none font-mono text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">代理的 API Key</label>
                                <input
                                    type="text"
                                    value={proxyKey}
                                    onChange={(e) => setProxyKey(e.target.value)}
                                    placeholder="代理服务的 API Key（与 Base URL 的 Key 区分）"
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none font-mono text-sm"
                                />
                                <p className="text-xs text-slate-400 mt-1">代理服务专用的 API Key，与上方 Base URL 的 Key 区分开来</p>
                            </div>
                            <p className="text-xs text-slate-400">通过反向代理服务转发API请求，适用于需要代理访问的场景</p>
                        </div>
                    )}
                </div>
            </form>

            {/* Error Message */}
            {errorMsg && (
                <div className="bg-red-900/20 border border-red-900/50 text-red-400 text-xs px-3 py-2 rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div className="break-all">{errorMsg}</div>
                </div>
            )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-800 bg-slate-950/50 flex-shrink-0 space-y-3">
            <button
              onClick={handleSubmit}
              disabled={!apiKey.trim()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 font-bold transition-all shadow-lg hover:shadow-purple-500/20 flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {editMode === 'new' ? '保存新配置' : '更新配置'}
            </button>
            <div className="grid grid-cols-1 gap-2">
            <button
              onClick={handleImportButtonClick}
              className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              导入API配置
            </button>
            {onExportApiConfigs && effectiveSavedConfigs.length > 0 && (
              <button
                onClick={onExportApiConfigs}
                className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                导出所有API配置
              </button>
            )}
            </div>
            <input
              type="file"
              accept="application/json"
              ref={importInputRef}
              onChange={handleImportFile}
              className="hidden"
            />
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;
