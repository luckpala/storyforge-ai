
import { FunctionDeclaration, Type, GoogleGenAI } from '@google/genai';
import { OpenAI } from 'openai';
import { ApiConfig, Message, ToolCallMode } from '../types';
import * as dataService from './dataService';

/**
 * 检测是否为移动端设备
 */
function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768 || 
         'ontouchstart' in window || 
         /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// ========== JSON Schema 模式相关 ==========

/**
 * 生成 JSON Schema 格式的工具调用提示词
 * 当 API 不支持 Function Calling 时，使用这种方式
 */
function generateJsonSchemaPrompt(tools: FunctionDeclaration[]): string {
  if (tools.length === 0) return '';
  
  const toolSchemas = tools.map(tool => {
    return {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    };
  });
  
  // 只返回工具格式说明和参数详情，避免与 App.tsx 中的基础规则重复
  return `

## 🚨🚨🚨 极其重要：JSON 工具调用格式（必须严格遵守）🚨🚨🚨

**⚠️ 警告：你必须在回复的最后输出一个 \`\`\`json 代码块来调用工具！**

**❌ 以下行为都是错误的，不会保存任何内容：**
- ❌ 只在文本中写"调用工具保存内容..."——这只是文字，不会执行任何操作
- ❌ 只在文本中写"已更新"或"✅"——这只是描述，内容不会被保存
- ❌ 在正文后面不添加 JSON 代码块——内容会丢失
- ❌ 把正文写在 JSON 外面——正文必须放在 JSON 的 chapter_content 参数中
- ❌ JSON 中缺少必填参数——会导致保存失败或内容不完整

**✅ 正确做法：必须在回复最后添加工具调用，支持以下三种格式（任选一种）：**

**格式1（推荐）：Markdown JSON 代码块**
\`\`\`json
{"tool_calls": [{"name": "update_storyboard", "args": {"chapterNumber": 章节号, "chapterTitle": "章节标题", "chapter_content": "这里放完整的正文内容...", "chapter_outline": "这里放章纲..."}}]}
\`\`\`

**格式2（备选）：普通代码块（不带 json 标记）**
\`\`\`
{"tool_calls": [{"name": "update_storyboard", "args": {"chapterNumber": 章节号, "chapterTitle": "章节标题", "chapter_content": "这里放完整的正文内容...", "chapter_outline": "这里放章纲..."}}]}
\`\`\`

**格式3（备选）：HTML 标签格式**
<tool_call>
{"tool_calls": [{"name": "update_storyboard", "args": {"chapterNumber": 章节号, "chapterTitle": "章节标题", "chapter_content": "这里放完整的正文内容...", "chapter_outline": "这里放章纲..."}}]}
</tool_call>

**🔴 关键要求（必须遵守）：**
1. **必须**使用上述三种格式之一（推荐格式1）
2. **必须**包含 "tool_calls" 数组
3. **正文内容必须放在 JSON 的 chapter_content 字段中**，不要在 JSON 外面单独输出正文
4. **JSON 中的字符串值必须正确转义**：
   - 换行符使用 \\n（两个反斜杠 + n）
   - 引号使用 \\"（两个反斜杠 + 引号）
   - 反斜杠使用 \\\\（四个反斜杠）
5. 如果你在 JSON 外面输出了正文，那些内容**不会被保存**

---

## 📋 update_storyboard 工具必填参数清单

当你生成章节内容时，**必须在 JSON 中包含以下所有参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| chapterNumber | number | ✅ 必填 | 章节编号，如 1, 2, 3 |
| chapterTitle | string | ✅ 必填 | 章节标题（必须是描述性标题，不能只是"第X章"），如"风起云涌"、"命运的转折" |
| chapter_content | string | ✅ 必填 | **完整的正文内容**（这是最重要的！所有正文都必须放这里，不要放在 JSON 外面） |
| chapter_outline | string | ✅ 必填 | 章纲（500-1500字，包含剧情任务、情节细节、角色关系、伏笔悬念、情绪曲线） |
| updated_story_bible | object | ⭐ 推荐 | 故事圣经更新（包含 character_status, key_items_and_locations, active_plot_threads） |
| createNewVersion | boolean | 可选 | 是否创建新版本（重写/换一版时设为 true） |

**⚠️ 如果你遗漏了任何必填参数，系统会在通知中显示哪些内容没有保存！**

---

## 📝 完整示例（推荐格式）

你的回复应该类似这样：

好的，这是第一章的内容。

\`\`\`json
{"tool_calls": [{"name": "update_storyboard", "args": {
  "chapterNumber": 1,
  "chapterTitle": "风起云涌",
  "chapter_content": "第一章 风起云涌\\n\\n    月黑风高，江湖风云变幻...\\n\\n    （这里是完整的正文内容，所有正文都必须放在这个字段里！）\\n\\n    ...正文结束。",
  "chapter_outline": "【剧情任务】本章主要讲述主角初入江湖的故事...\\n【情节细节】...\\n【角色关系变化】...\\n【伏笔悬念】...\\n【情绪曲线】从平静到惊险...\\n【关键信息】揭示了...",
  "updated_story_bible": {
    "character_status": "主角：初入江湖，身份未明；反派：第1章出场，意图不明",
    "key_items_and_locations": "当前位置：青云镇；关键道具：玉佩（主角持有）",
    "active_plot_threads": "1. 主角身世之谜（进行中）\\n2. 神秘组织的阴谋（刚埋下伏笔）",
    "important_rules": "设定：本世界武功分为九品"
  },
  "createNewVersion": true
}}]}
\`\`\`

**⚠️ 重要：JSON 字符串转义规则**
- 换行符：在 JSON 字符串中必须写成 \`\\n\`（两个反斜杠 + n）
- 引号：在 JSON 字符串中必须写成 \`\\"\`（两个反斜杠 + 引号）
- 反斜杠：在 JSON 字符串中必须写成 \`\\\\\`（四个反斜杠）

**再次强调：没有工具调用代码块 = 内容不会被保存！缺少必填参数 = 内容保存不完整！**

---

### 可用工具及参数详情：

${toolSchemas.map(t => `
**${t.name}** - ${t.description}
\`\`\`json
${JSON.stringify(t.parameters, null, 2)}
\`\`\`
`).join('\n')}
`;
}

/**
 * 尝试解析 JSON 内容（带错误修复）
 */
function tryParseJson(jsonContent: string): any | null {
  try {
    // 先尝试直接解析
    return JSON.parse(jsonContent);
  } catch (e) {
    console.log('   ⚠️ 首次解析失败，尝试修复:', e.message);
    
    // 尝试修复常见错误
    let fixed = jsonContent.trim();
    
    // 1. 移除末尾多余的逗号
    fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
    // 2. 修复缺少逗号的情况
    fixed = fixed.replace(/([}\]])(\s*)(["{])/g, '$1,$2$3');
    // 3. 移除注释
    fixed = fixed.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    
    try {
      return JSON.parse(fixed);
    } catch (e2) {
      console.log('   ⚠️ 修复后仍失败，尝试更激进的修复:', e2.message);
      
      // 更激进的修复：处理字符串值中的未转义字符
      // 注意：这个修复可能不完美，但可以处理大多数情况
      try {
        // 尝试在字符串值中转义未转义的换行符、制表符等
        // 但要注意不要破坏已经转义的字符
        // 这是一个复杂的操作，我们先尝试简单的修复
        
        // 如果还是失败，返回 null，让调用者知道解析失败
        console.error('❌ JSON 解析失败（已尝试修复）:', e2.message);
        console.error('   错误位置:', e2.message.match(/position (\d+)/)?.[1] || '未知');
        console.error('   失败内容预览:', fixed.substring(Math.max(0, parseInt(e2.message.match(/position (\d+)/)?.[1] || '0') - 100), parseInt(e2.message.match(/position (\d+)/)?.[1] || '0') + 100));
        return null;
      } catch (e3) {
        console.error('❌ JSON 解析失败（最终）:', e3);
        return null;
      }
    }
  }
}

/**
 * 从文本响应中解析 JSON 格式的工具调用
 * 支持多种格式：
 * 1. ```json ... ``` (Markdown JSON 代码块)
 * 2. ``` ... ``` (Markdown 代码块，不带 json 标记)
 * 3. <tool_call>...</tool_call> (HTML 标签格式)
 */
function parseJsonSchemaToolCalls(text: string): { text: string; functionCalls: Array<{ name: string; args: any }> } {
  const result = {
    text: text,
    functionCalls: [] as Array<{ name: string; args: any }>
  };
  
  // 🔍 调试：输出完整的原始文本（不截断）
  console.log('========== [JSON Schema] 开始解析 ==========');
  console.log('📄 [JSON Schema] 原始文本长度:', text.length, '字符');
  
  // 检查响应是否可能被截断（特别是移动端）
  if (isMobileDevice()) {
    // 检查文本是否以不完整的 JSON 代码块结尾
    const trimmedText = text.trim();
    const hasIncompleteJsonBlock = trimmedText.includes('```json') && !trimmedText.match(/```json[\s\S]*?```/);
    const hasIncompleteCodeBlock = trimmedText.includes('```') && (trimmedText.match(/```/g) || []).length % 2 !== 0;
    
    if (hasIncompleteJsonBlock || hasIncompleteCodeBlock) {
      console.warn('⚠️ [移动端] 检测到可能的不完整 JSON 代码块：');
      console.warn(`   文本末尾: ${trimmedText.substring(Math.max(0, trimmedText.length - 500))}`);
      console.warn('   这可能是因为网络不稳定或响应过大导致响应被截断。');
      console.warn('   建议：1) 检查网络连接；2) 尝试使用 WiFi；3) 减少请求内容。');
    }
  }
  
  console.log('📄 [JSON Schema] 原始文本完整内容:');
  console.log(text);
  console.log('========== 原始文本结束 ==========');
  
  const textParts: string[] = [];
  let lastMatchEnd = 0;
  let foundAny = false;
  
  // 模式1: ```json ... ``` (优先)
  // 使用更宽松的正则表达式，支持各种换行符和空白字符
  const jsonBlockPattern = new RegExp('```json\\s*[\\r\\n]*([\\s\\S]*?)[\\r\\n]*```', 'gi');
  let match;
  let matchCount = 0;
  
  while ((match = jsonBlockPattern.exec(text)) !== null) {
    matchCount++;
    console.log(`🔍 [JSON Schema] 找到第 ${matchCount} 个 \`\`\`json 代码块:`);
    console.log(`   匹配位置: ${match.index} - ${match.index + match[0].length}`);
    console.log(`   匹配文本长度: ${match[0].length} 字符`);
    
    if (match.index > lastMatchEnd) {
      textParts.push(text.substring(lastMatchEnd, match.index));
    }
    
    const jsonContent = match[1].trim();
    console.log('   提取的JSON内容长度:', jsonContent.length, '字符');
    console.log('   JSON内容预览:', jsonContent.substring(0, 200) + (jsonContent.length > 200 ? '...' : ''));
    console.log('   JSON内容完整:', jsonContent);
    
    // 检查 JSON 内容是否为空或过短
    if (!jsonContent || jsonContent.length < 10) {
      console.warn('   ⚠️ JSON 内容为空或过短，跳过');
      textParts.push(match[0]);
      lastMatchEnd = match.index + match[0].length;
      continue;
    }
    
    const parsed = tryParseJson(jsonContent);
    if (parsed) {
      console.log('   ✅ JSON 解析成功');
      console.log('   解析结果:', JSON.stringify(parsed, null, 2));
      
      if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
        console.log('   ✅ 检测到 tool_calls 数组，包含', parsed.tool_calls.length, '个调用');
        for (const tc of parsed.tool_calls) {
          if (tc.name && tc.args) {
            result.functionCalls.push({
              name: tc.name,
              args: typeof tc.args === 'string' ? tryParseJson(tc.args) || tc.args : tc.args
            });
            console.log('✅ [JSON Schema] 解析到工具调用:', tc.name);
            foundAny = true;
          } else {
            console.warn('   ⚠️ 工具调用格式不完整:', { name: tc.name, hasArgs: !!tc.args });
          }
        }
      } else {
        console.log('   ℹ️ JSON 解析成功，但不是工具调用格式（缺少 tool_calls 数组）');
        console.log('   JSON 键:', Object.keys(parsed));
        textParts.push(match[0]);
      }
    } else {
      console.warn('   ❌ JSON 解析失败');
      console.log('   ℹ️ 不是工具调用格式，保留为文本');
      textParts.push(match[0]);
    }
    
    lastMatchEnd = match.index + match[0].length;
  }
  
  // 如果没找到，尝试模式2: ``` ... ``` (不带 json 标记)
  if (!foundAny && matchCount === 0) {
    console.log('🔍 [JSON Schema] 尝试查找普通代码块（不带 json 标记）...');
    // 使用更宽松的正则表达式，支持各种换行符和空白字符
    const codeBlockPattern = new RegExp('```\\s*[\\r\\n]*([\\s\\S]*?)[\\r\\n]*```', 'gi');
    let codeMatch;
    let codeMatchCount = 0;
    
    while ((codeMatch = codeBlockPattern.exec(text)) !== null && !foundAny) {
      codeMatchCount++;
      const codeContent = codeMatch[1].trim();
      
      console.log(`🔍 [JSON Schema] 找到第 ${codeMatchCount} 个普通代码块:`);
      console.log(`   内容长度: ${codeContent.length} 字符`);
      console.log(`   内容预览: ${codeContent.substring(0, 100)}...`);
      
      // 检查是否看起来像 JSON（以 { 开头）
      if (codeContent.trim().startsWith('{')) {
        console.log(`   ✅ 内容以 { 开头，可能是 JSON`);
        const parsed = tryParseJson(codeContent);
        if (parsed) {
          console.log('   ✅ JSON 解析成功');
          console.log('   解析结果:', JSON.stringify(parsed, null, 2));
          
          if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
            console.log('   ✅ 检测到 tool_calls 数组');
            if (codeMatch.index > lastMatchEnd) {
              textParts.push(text.substring(lastMatchEnd, codeMatch.index));
            }
            for (const tc of parsed.tool_calls) {
              if (tc.name && tc.args) {
                result.functionCalls.push({
                  name: tc.name,
                  args: typeof tc.args === 'string' ? tryParseJson(tc.args) || tc.args : tc.args
                });
                console.log('✅ [JSON Schema] 解析到工具调用:', tc.name);
                foundAny = true;
              } else {
                console.warn('   ⚠️ 工具调用格式不完整:', { name: tc.name, hasArgs: !!tc.args });
              }
            }
            lastMatchEnd = codeMatch.index + codeMatch[0].length;
            break; // 找到第一个有效的就停止
          } else {
            console.log('   ℹ️ JSON 解析成功，但不是工具调用格式（缺少 tool_calls 数组）');
            console.log('   JSON 键:', Object.keys(parsed));
          }
        } else {
          console.warn('   ❌ JSON 解析失败');
        }
      } else {
        console.log('   ℹ️ 内容不以 { 开头，跳过');
      }
    }
  }
  
  // 如果还是没找到，尝试模式3: <tool_call>...</tool_call> (HTML 标签格式)
  if (!foundAny) {
    console.log('🔍 [JSON Schema] 尝试查找 HTML 标签格式...');
    const htmlTagPattern = /<tool_call[^>]*>([\s\S]*?)<\/tool_call>/gi;
    let htmlMatch;
    
    while ((htmlMatch = htmlTagPattern.exec(text)) !== null && !foundAny) {
      const htmlContent = htmlMatch[1].trim();
      console.log('   找到 HTML 标签，内容长度:', htmlContent.length);
      
      const parsed = tryParseJson(htmlContent);
      if (parsed && parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
        console.log('   ✅ 检测到 tool_calls 数组');
        if (htmlMatch.index > lastMatchEnd) {
          textParts.push(text.substring(lastMatchEnd, htmlMatch.index));
        }
        for (const tc of parsed.tool_calls) {
          if (tc.name && tc.args) {
            result.functionCalls.push({
              name: tc.name,
              args: typeof tc.args === 'string' ? tryParseJson(tc.args) || tc.args : tc.args
            });
            console.log('✅ [JSON Schema] 解析到工具调用:', tc.name);
            foundAny = true;
          }
        }
        lastMatchEnd = htmlMatch.index + htmlMatch[0].length;
        break;
      }
    }
  }
  
  // 如果还是没找到，尝试模式4: 直接在整个文本中查找 JSON 对象（最后的备选方案）
  if (!foundAny) {
    console.log('🔍 [JSON Schema] 尝试直接查找 JSON 对象（无代码块格式）...');
    // 查找形如 {"tool_calls": [...]} 的 JSON 对象
    const directJsonPattern = /\{\s*"tool_calls"\s*:\s*\[[\s\S]*?\]\s*\}/;
    const directMatch = text.match(directJsonPattern);
    
    if (directMatch) {
      console.log('   ✅ 找到直接的 JSON 对象');
      const jsonContent = directMatch[0];
      console.log('   JSON 内容长度:', jsonContent.length, '字符');
      console.log('   JSON 内容:', jsonContent);
      
      const parsed = tryParseJson(jsonContent);
      if (parsed && parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
        console.log('   ✅ 检测到 tool_calls 数组');
        for (const tc of parsed.tool_calls) {
          if (tc.name && tc.args) {
            result.functionCalls.push({
              name: tc.name,
              args: typeof tc.args === 'string' ? tryParseJson(tc.args) || tc.args : tc.args
            });
            console.log('✅ [JSON Schema] 解析到工具调用:', tc.name);
            foundAny = true;
          }
        }
      }
    }
  }
  
  if (!foundAny) {
    console.warn('⚠️ [JSON Schema] 没有找到任何有效的工具调用格式');
    console.log('   支持的格式：');
    console.log('   1. \`\`\`json ... \`\`\`');
    console.log('   2. \`\`\` ... \`\`\` (JSON 内容)');
    console.log('   3. <tool_call>...</tool_call> (JSON 内容)');
    console.log('   4. 直接的 JSON 对象 {"tool_calls": [...]}');
    
    // 在移动端，提供更详细的调试信息
    if (isMobileDevice()) {
      console.warn('   [移动端] 如果原始文本包含 JSON 但解析失败，可能是：');
      console.warn('   1. 响应被截断（检查网络连接）');
      console.warn('   2. 文本编码问题（检查控制台中的完整文本）');
      console.warn('   3. 正则表达式匹配失败（查看上方的匹配日志）');
    }
  }
  
  // 添加剩余的文本
  if (lastMatchEnd < text.length) {
    textParts.push(text.substring(lastMatchEnd));
  }
  
  // 如果找到了工具调用，更新文本（移除工具调用块）
  if (result.functionCalls.length > 0) {
    result.text = textParts.join('').trim();
  }
  
  console.log('========== [JSON Schema] 解析完成 ==========');
  console.log('📊 解析结果: 找到', result.functionCalls.length, '个工具调用');
  console.log('📊 剩余文本长度:', result.text.length, '字符');
  
  return result;
}

/**
 * 判断是否应该使用 JSON Schema 模式
 */
function shouldUseJsonSchema(config: ApiConfig, tools: FunctionDeclaration[]): boolean {
  // 没有工具时不需要任何模式
  if (tools.length === 0) return false;
  
  // 获取模式（如果未设置，使用默认策略）
  const mode = config.toolCallMode || getDefaultToolCallMode(config.provider, config.useProxy);
  return mode === 'json_schema';
}

/**
 * 获取默认工具调用模式
 */
function getDefaultToolCallMode(provider?: string, useProxy?: boolean): 'function_calling' | 'json_schema' {
  // Google 直连默认 FC，其余默认 JSON Schema
  if (provider === 'google' && !useProxy) return 'function_calling';
  return 'json_schema';
}

// 获取当前主机地址（支持手机访问）
const getProxyHost = (): string => {
  if (typeof window !== 'undefined' && window.location) {
    return window.location.hostname;
  }
  return 'localhost';
};

// 获取数据服务器 URL（用于后端 API 调用）
async function getDataServerUrl(): Promise<string> {
  try {
    return await dataService.getDataServerUrl();
  } catch (e) {
    // 如果获取失败，返回默认值
    return 'http://127.0.0.1:8765';
  }
}

// 辅助函数：安全解析工具调用参数（处理可能的字符串格式 JSON）
const safeParseArgs = (args: any): any => {
  // 如果已经是对象，直接返回
  if (typeof args === 'object' && args !== null && !Array.isArray(args)) {
    return args;
  }
  
  // 如果是字符串，尝试解析 JSON
  if (typeof args === 'string') {
    let argsStr = args.trim();
    
    // 防御性代码：清洗可能的 Markdown 标记
    if (argsStr.startsWith('```')) {
      console.log('🔍 [normalizeFunctionCalls] 检测到 Markdown 代码块标记，正在清洗...');
      argsStr = argsStr.replace(/^```json\s*/i, '').replace(/^```\s*/, '');
      argsStr = argsStr.replace(/\s*```$/g, '').trim();
    }
    
    try {
      return JSON.parse(argsStr);
    } catch (e: any) {
      console.warn('⚠️ [normalizeFunctionCalls] 参数 JSON 解析失败:', {
        error: e.message,
        argsStrPreview: argsStr.substring(0, 200),
        argsStrLength: argsStr.length
      });
      
      // 尝试修复常见的 JSON 格式错误
      let fixedArgsStr = argsStr;
      
      // 修复1: 检查是否缺少闭合括号
      const openBraces = (fixedArgsStr.match(/\{/g) || []).length;
      const closeBraces = (fixedArgsStr.match(/\}/g) || []).length;
      if (openBraces > closeBraces) {
        fixedArgsStr += '}'.repeat(openBraces - closeBraces);
      }
      
      // 修复2: 移除尾随逗号
      fixedArgsStr = fixedArgsStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
      
      try {
        return JSON.parse(fixedArgsStr);
      } catch (e2) {
        console.error('❌ [normalizeFunctionCalls] JSON 修复失败，返回空对象');
        return {};
      }
    }
  }
  
  // 其他类型，返回空对象
  return {};
};

const normalizeFunctionCalls = (
  calls?: Array<{ name?: string | null; args?: any; id?: string }>
) => {
  if (!calls || calls.length === 0) {
    console.log('⚠️ normalizeFunctionCalls: 没有工具调用');
    return undefined;
  }
  console.log('🔍 normalizeFunctionCalls 输入:', calls);
  const normalized = calls
    .filter((call): call is { name: string; args?: any; id?: string } => {
      const hasName = !!call?.name;
      if (!hasName) {
        console.warn('⚠️ 工具调用缺少 name:', call);
      }
      return hasName;
    })
    .map(call => ({
      id: call.id,
      name: call.name,
      args: safeParseArgs(call.args) // 使用安全解析函数
    }));
  console.log('✅ normalizeFunctionCalls 输出:', normalized);
  return normalized.length ? normalized : undefined;
};

// Standardized Response Format (Google-like)
export interface LLMResponse {
  text: string;
  functionCalls?: Array<{
    name: string;
    args: any;
    id?: string; // OpenAI needs ID for tool callbacks
  }>;
  reasoning?: string; // AI思维链/推理过程（不发送给AI）
}

// Convert Google Tool Definitions to OpenAI Tool Definitions
const mapToolsToOpenAI = (tools: FunctionDeclaration[]) => {
  return tools.map(tool => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "object",
        properties: (tool.parameters as any).properties,
        required: (tool.parameters as any).required,
      }
    }
  }));
};

interface GenerationConfig {
  temperature?: number;
  enableStreaming?: boolean;
  removeContextLimit?: boolean;
  contextLength?: number;
  maxResponseLength?: number;
  useModelDefaults?: boolean; // 使用模型默认参数，忽略自定义参数
}

// 全局请求频率限制器（1分钟内不超过2次）
class RequestRateLimiter {
  private requestTimestamps: number[] = [];
  private readonly maxRequests = 2; // 1分钟内最多2次请求
  private readonly timeWindow = 60000; // 60秒（1分钟）
  private enabled: boolean = false; // 默认关闭

  /**
   * 启用/禁用限制
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      // 禁用时清空记录
      this.requestTimestamps = [];
    }
  }

  /**
   * 检查是否可以发送请求
   * @returns 如果可以发送，返回 true；否则返回需要等待的秒数
   */
  canSendRequest(): { allowed: boolean; waitSeconds?: number } {
    // 如果限制未启用，直接允许
    if (!this.enabled) {
      return { allowed: true };
    }

    const now = Date.now();
    
    // 清理超过时间窗口的旧请求记录
    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => now - timestamp < this.timeWindow
    );
    
    // 如果当前请求数小于限制，允许发送
    if (this.requestTimestamps.length < this.maxRequests) {
      return { allowed: true };
    }
    
    // 如果已达到限制，计算需要等待的时间
    const oldestRequest = this.requestTimestamps[0];
    const waitTime = this.timeWindow - (now - oldestRequest);
    const waitSeconds = Math.ceil(waitTime / 1000);
    
    return { allowed: false, waitSeconds };
  }

  /**
   * 记录一次请求
   */
  recordRequest(): void {
    // 只有在启用时才记录
    if (this.enabled) {
      this.requestTimestamps.push(Date.now());
    }
  }

  /**
   * 获取当前请求计数（用于调试）
   */
  getCurrentCount(): number {
    if (!this.enabled) {
      return 0;
    }
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => now - timestamp < this.timeWindow
    );
    return this.requestTimestamps.length;
  }

  /**
   * 检查是否已启用
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

// 创建全局限制器实例
const globalRateLimiter = new RequestRateLimiter();

export class LLMAdapter {
  
  /**
   * 设置请求频率限制的启用状态
   */
  static setRateLimitEnabled(enabled: boolean): void {
    globalRateLimiter.setEnabled(enabled);
    console.log(`📊 请求频率限制: ${enabled ? '已启用' : '已禁用'}`);
  }
  
  static async chat(
    config: ApiConfig,
    history: Message[],
    newMessage: string,
    systemInstruction: string,
    tools: FunctionDeclaration[],
    signal?: AbortSignal,
    generationConfig?: GenerationConfig,
    forceToolCall?: boolean, // 新增参数：是否强制要求工具调用
    onStreamChunk?: (chunk: string) => void // 流式传输回调
  ): Promise<LLMResponse> {
    
    // 检查请求频率限制（仅在启用时）
    if (globalRateLimiter.isEnabled()) {
      const rateLimitCheck = globalRateLimiter.canSendRequest();
      if (!rateLimitCheck.allowed) {
        const waitSeconds = rateLimitCheck.waitSeconds || 30;
        const errorMsg = `请求频率限制：1分钟内最多2次请求。请等待 ${waitSeconds} 秒后重试。`;
        console.warn(`⚠️ ${errorMsg} (当前请求数: ${globalRateLimiter.getCurrentCount()}/2)`);
        throw new Error(errorMsg);
      }
      
      // 记录本次请求
      globalRateLimiter.recordRequest();
      console.log(`📊 请求频率: ${globalRateLimiter.getCurrentCount()}/2 (1分钟内)`);
    } else {
      // 限制已禁用，不记录请求，也不输出日志
    }
    
    const temperature = generationConfig?.temperature ?? 0.7;
    
    // 检查是否是 Google 直连（不使用代理）
    // 如果是 Google 直连，使用 Google 原生 SDK 避免 CORS 问题
    const isGoogleDirect = config.provider === 'google' && !config.useProxy;
    
    // 检查是否使用 JSON Schema 模式
    const useJsonSchema = shouldUseJsonSchema(config, tools);
    
    // 调试：检查路由决策和配置
    console.log('🔍 LLMAdapter 路由决策:', {
      provider: config.provider,
      useProxy: config.useProxy,
      modelId: config.modelId,
      isGoogleDirect: isGoogleDirect,
      willUseGoogleNativeSDK: isGoogleDirect,
      willUseOpenAISDK: !isGoogleDirect, // Google 直连使用原生 SDK，其他使用 OpenAI SDK
      toolsCount: tools.length,
      toolNames: tools.map(t => t.name),
      hasBaseUrl: !!config.baseUrl,
      baseUrl: config.baseUrl,
      hasProxyUrl: !!config.proxyUrl,
      proxyUrl: config.proxyUrl,
      hasApiKey: !!config.apiKey,
      hasProxyKey: !!config.proxyKey,
      toolCallMode: config.toolCallMode || 'auto',
      useJsonSchema: useJsonSchema
    });
    
    // --- Google 直连使用原生 SDK，其他使用 OpenAI 兼容 SDK ---
    if (isGoogleDirect) {
      // 使用 Google 原生 SDK 避免 CORS 问题
      try {
        const genAI = new GoogleGenAI({ apiKey: config.apiKey });
        
        // 处理模型 ID（移除 models/ 前缀）
        let normalizedModelId = config.modelId;
        if (normalizedModelId.startsWith('models/')) {
          normalizedModelId = normalizedModelId.replace(/^models\//, '');
        }
        
        // 构建消息历史（Google SDK 使用不同的消息格式）
        // Google SDK 需要将系统指令作为 systemInstruction 参数传递，而不是作为消息的一部分
        const contents: any[] = [];
        
        // 添加历史消息
        for (const msg of history) {
          if (msg.role === 'user') {
            contents.push({ role: 'user', parts: [{ text: msg.text }] });
          } else if (msg.role === 'model') {
            contents.push({ role: 'model', parts: [{ text: msg.text }] });
          }
        }
        
        // 添加新消息
        contents.push({ role: 'user', parts: [{ text: newMessage }] });
        
        // 转换工具格式（JSON Schema 模式下不发送 tools）
        const googleTools = (!useJsonSchema && tools.length > 0) ? [{
          functionDeclarations: tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
          }))
        }] : undefined;
        
        // 设置工具调用配置（JSON Schema 模式下不使用）
        const toolConfig = (!useJsonSchema && tools.length > 0 && forceToolCall) ? {
              functionCallingConfig: {
            mode: 'ANY' as const // 强制要求工具调用
          }
        } : undefined;
        
        // 构建配置对象
        const configObj: any = {
          temperature: temperature
        };
        
        // 添加工具（如果有）
        if (googleTools) {
          configObj.tools = googleTools;
        }
        
        // 添加工具配置（如果有）
        if (toolConfig) {
          configObj.toolConfig = toolConfig;
        }
        
        // 生成内容
        // Google SDK 的正确用法：genAI.models.generateContent({ model, contents, config })
        const generateContentParams: any = {
          model: normalizedModelId,
          contents: contents
        };
        
        // 添加配置（如果有内容）
        if (Object.keys(configObj).length > 0) {
          generateContentParams.config = configObj;
        }
        
        // 添加系统指令（如果提供）- 系统指令应该在 config 中
        // JSON Schema 模式：在系统指令中添加工具调用说明
        let finalGoogleSystemInstruction = systemInstruction;
        if (useJsonSchema && tools.length > 0) {
          finalGoogleSystemInstruction = systemInstruction + generateJsonSchemaPrompt(tools);
          console.log('📝 [JSON Schema] 已在 Google 直连系统指令中注入工具调用说明');
        }
        
        if (finalGoogleSystemInstruction) {
          if (!generateContentParams.config) {
            generateContentParams.config = {};
          }
          generateContentParams.config.systemInstruction = { parts: [{ text: finalGoogleSystemInstruction }] };
        }
        
        const result = await genAI.models.generateContent(generateContentParams);
        
        // 🔍 调试：输出Google直连完整响应
        console.log('========== Google 直连完整响应 ==========');
        console.log('📄 result对象:');
        console.log(JSON.stringify(result, null, 2));
        console.log('========== Google 直连响应结束 ==========');
        
        // 获取工具调用和文本
        const candidates = result.candidates || [];
        const functionCalls: any[] = [];
        let text = '';
        
        if (candidates.length > 0) {
          const candidate = candidates[0];
          const content = candidate.content;
          
          // 🔍 调试：输出candidate详情
          console.log('📄 [Google直连] candidate.content.parts:');
          console.log(JSON.stringify(content?.parts, null, 2));
          
          if (content && content.parts) {
            // 直接从 parts 中提取文本和 functionCall，避免使用 result.text 的警告
            for (const part of content.parts) {
              if (part.functionCall) {
                functionCalls.push({
                  name: part.functionCall.name,
                  args: part.functionCall.args || {},
                  id: part.functionCall.name || ''
                });
              } else if (part.text) {
                // 提取文本部分（排除 thought 部分）
                if (!part.thought) {
                  text += (text ? '\n\n' : '') + part.text;
                }
              }
            }
          }
        }
        
        // 🔍 调试：输出提取的文本内容
        console.log('========== Google 直连提取的文本 ==========');
        console.log('📄 文本长度:', text.length, '字符');
        console.log('📄 完整文本内容:');
        console.log(text);
        console.log('========== 文本内容结束 ==========');
        
        // 如果没有从 parts 中提取到文本，尝试使用 result.text（但会有警告）
        if (!text && !functionCalls.length) {
          text = result.text || '';
        }
        
        // JSON Schema 模式：从文本中解析工具调用
        if (useJsonSchema && text) {
          const parsed = parseJsonSchemaToolCalls(text);
          text = parsed.text;
          if (parsed.functionCalls.length > 0) {
            functionCalls.push(...parsed.functionCalls);
            console.log('✅ [JSON Schema] Google 直连从文本中解析到', parsed.functionCalls.length, '个工具调用');
          }
        }
        
        // 转换工具调用格式
        const normalizedFunctionCalls = functionCalls.length > 0 ? functionCalls : undefined;
        
        return {
          text: text,
          functionCalls: normalizedFunctionCalls,
          reasoning: undefined
        };
      } catch (error: any) {
        console.error('❌ Google 原生 SDK 调用失败:', error);
        
        // 处理 429 频率限制错误
        if (error.status === 429 || error.message?.includes('429') || error.message?.includes('Too Many Requests')) {
          throw new Error('API 调用频率限制（429）：请稍后再试。Google API 有速率限制，建议：1) 等待一段时间后重试 2) 检查 API 配额设置');
        }
        
        // 处理其他错误
        const errorMessage = error.message || 'Unknown error';
        if (error.status) {
          throw new Error(`Google API 错误 (${error.status}): ${errorMessage}`);
        }
        throw new Error(`Google API 错误: ${errorMessage}`);
      }
    }
    
    // --- 其他情况：优先使用后端 API（node-fetch），避免 CORS 问题 ---
    // 包括 Google 中转、DeepSeek、SiliconFlow 等
    {
      // 尝试使用后端 API（通过数据服务器）
      try {
        const dataServerUrl = await getDataServerUrl();
        console.log('🔍 尝试使用后端 API（node-fetch）:', dataServerUrl, useJsonSchema ? '(JSON Schema 模式)' : '(Function Calling 模式)');
        
        // 构建消息历史（包含系统指令）
        const messages: any[] = [];
        
        // 根据模式决定系统指令
        let finalSystemInstruction = systemInstruction;
        if (useJsonSchema && tools.length > 0) {
          // JSON Schema 模式：在系统指令中添加工具调用说明
          finalSystemInstruction = systemInstruction + generateJsonSchemaPrompt(tools);
          console.log('📝 [JSON Schema] 已在系统指令中注入工具调用说明');
        }
        
        if (finalSystemInstruction) {
          messages.push({ role: 'system', content: finalSystemInstruction });
        }
        for (const msg of history) {
          messages.push({ role: msg.role, content: msg.text });
        }
        messages.push({ role: 'user', content: newMessage });
        
        // 转换工具格式（JSON Schema 模式下不发送 tools）
        let openAiTools: any = undefined;
        let toolChoice: any = undefined;
        
        if (!useJsonSchema && tools.length > 0) {
          // Function Calling 模式：正常发送 tools
          openAiTools = tools.map(tool => ({
            type: 'function' as const,
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters
            }
          }));
          
          // 确定 tool_choice
          toolChoice = 'auto';
          if (forceToolCall) {
            toolChoice = 'required';
          }
        }
        
        // 构建请求体
        const requestBody: any = {
          provider: config.provider,
          baseUrl: config.baseUrl || '',
          modelId: config.modelId,
          apiKey: config.apiKey,
          proxyUrl: config.proxyUrl,
          proxyKey: config.proxyKey,
          useProxy: config.useProxy || false,
          messages: messages,
          temperature: temperature,
          max_tokens: generationConfig?.maxTokens || 8192,
          stream: false
        };
        
        // 只有 FC 模式才发送 tools 和 tool_choice
        if (openAiTools) {
          requestBody.tools = openAiTools;
          requestBody.tool_choice = toolChoice;
        }
        
        // 发送请求到后端 API
        const isMobile = isMobileDevice();
        console.log(`📡 ${isMobile ? '[移动端]' : '[桌面端]'} 发送请求到后端 API: ${dataServerUrl}/api/llm/chat`);
        
        const response = await fetch(`${dataServerUrl}/api/llm/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: signal as any
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`后端 API 错误 (${response.status}): ${errorText}`);
        }
        
        // 检查响应是否完整（特别是移动端）
        const responseText = await response.text();
        console.log(`📥 ${isMobile ? '[移动端]' : '[桌面端]'} 后端 API 响应长度: ${responseText.length} 字符`);
        
        if (isMobile && responseText.length === 0) {
          console.warn('⚠️ [移动端] 后端 API 返回空响应，可能被截断');
        }
        
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError: any) {
          console.error(`❌ ${isMobile ? '[移动端]' : '[桌面端]'} 后端 API 响应 JSON 解析失败:`, parseError.message);
          console.error('   响应文本长度:', responseText.length);
          console.error('   响应文本末尾:', responseText.substring(Math.max(0, responseText.length - 500)));
          throw new Error(`后端 API 响应 JSON 解析失败: ${parseError.message}`);
        }
        
        console.log(`✅ ${isMobile ? '[移动端]' : '[桌面端]'} 后端 API 请求成功`);
        
        // 🔍 调试：输出完整的后端API响应（不截断）
        console.log('========== 后端 API 完整响应 ==========');
        console.log('📄 响应JSON完整内容:');
        console.log(JSON.stringify(data, null, 2));
        console.log('========== 后端 API 响应结束 ==========');
        
        // 处理响应（与 OpenAI SDK 格式相同）
        if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
          throw new Error(`API 返回了无效的响应格式：缺少 choices 数组`);
        }
        
        const choice = data.choices[0];
        const msg = choice.message || {};
        let textContent = msg.content || "";
        
        // 🔍 调试：输出message.content完整内容
        console.log('========== message.content 完整内容 ==========');
        console.log('📄 content长度:', textContent.length, '字符');
        console.log('📄 content完整内容:');
        console.log(textContent);
        console.log('========== message.content 结束 ==========');
        
        // 提取工具调用
        let functionCalls: any[] = [];
        
        // JSON Schema 模式：从文本中解析工具调用
        if (useJsonSchema && textContent) {
          const parsed = parseJsonSchemaToolCalls(textContent);
          textContent = parsed.text;
          functionCalls = parsed.functionCalls;
          if (functionCalls.length > 0) {
            console.log('✅ [JSON Schema] 从文本中解析到', functionCalls.length, '个工具调用');
          }
        }
        
        // Function Calling 模式：从 API 响应中提取工具调用
        if (!useJsonSchema && msg.tool_calls && Array.isArray(msg.tool_calls)) {
          functionCalls = msg.tool_calls.map((tc: any) => ({
            name: tc.function?.name || '',
            args: typeof tc.function?.arguments === 'string' 
              ? JSON.parse(tc.function.arguments) 
              : tc.function?.arguments || {}
          }));
        }
        
        const result: LLMResponse = {
          text: textContent || "",
        };
        
        if (functionCalls.length > 0) {
          result.functionCalls = functionCalls;
        }
        
        return result;
        
      } catch (backendError: any) {
        const isMobile = isMobileDevice();
        console.warn(`⚠️ 后端 API 调用失败${isMobile ? '（移动端）' : '（桌面端）'}，回退到前端直接调用:`, backendError.message);
        console.warn('   可能原因：');
        console.warn('   1. 后端服务器（data-server.js）未运行');
        console.warn('   2. 后端服务器不可访问（网络问题）');
        if (isMobile) {
          console.warn('   3. [移动端] 后端服务器可能只监听 localhost，无法通过局域网 IP 访问');
          console.warn('   4. [移动端] 建议：确保后端服务器监听 0.0.0.0 而不是 127.0.0.1');
        }
        // 如果后端 API 失败，回退到原来的前端直接调用方式
        // 继续执行下面的代码
      }
      
      // 回退：使用前端直接调用（原来的逻辑）
      // 先确定 baseUrl（需要在前面定义，因为后面会用到）
      let finalBaseUrl = config.useProxy && config.proxyUrl ? config.proxyUrl : config.baseUrl;
      
      // 调试：检查 baseUrl 选择
      console.log('🔍 BaseURL 选择:', {
        useProxy: config.useProxy,
        hasProxyUrl: !!config.proxyUrl,
        proxyUrl: config.proxyUrl,
        hasBaseUrl: !!config.baseUrl,
        baseUrl: config.baseUrl,
        finalBaseUrl: finalBaseUrl
      });
      
      // 如果是 Google 中转（使用代理），使用 OpenAI 兼容接口
      if (config.provider === 'google' && config.useProxy) {
        // 如果用户没有提供 baseUrl，使用默认的 Google OpenAI 兼容接口
        if (!finalBaseUrl || finalBaseUrl.trim() === '') {
          finalBaseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai';
          console.log('✅ 使用 Google Gemini OpenAI 兼容接口（默认，中转）:', finalBaseUrl);
        } else {
          // 如果用户提供了 baseUrl，确保它指向正确的路径
          finalBaseUrl = finalBaseUrl.trim().replace(/\/$/, '');
          if (!finalBaseUrl.includes('/v1beta/openai') && !finalBaseUrl.includes('/openai')) {
            // 如果 baseUrl 不包含 /v1beta/openai 或 /openai，添加它
            finalBaseUrl = `${finalBaseUrl}/v1beta/openai`;
          }
          console.log('✅ 使用 Google Gemini OpenAI 兼容接口（自定义，中转）:', finalBaseUrl);
        }
      }
      
      // 如果没有 baseUrl，尝试使用 provider 的默认 baseUrl
      if (!finalBaseUrl) {
        const defaultBaseUrls: Record<string, string> = {
          'deepseek': 'https://api.deepseek.com',
          'siliconflow': 'https://api.siliconflow.cn/v1',
          'openai': 'https://api.openai.com/v1',
          'custom': ''
        };
        const defaultUrl = defaultBaseUrls[config.provider];
        if (defaultUrl) {
          finalBaseUrl = defaultUrl;
          console.log(`✅ 使用 ${config.provider} 的默认 baseURL:`, finalBaseUrl);
        }
      }
      
      if (!finalBaseUrl) {
        throw new Error('Base URL is required for OpenAI-compatible providers. Please set baseUrl in API configuration.');
      }
      
      // Extract generation config options
      // 注意：如果使用代理服务器，某些代理可能不支持真正的流式传输，会返回"假流"（fake streaming）
      // 假流可能导致响应格式不正确，所以如果使用代理，建议禁用流式传输
      const enableStreaming = generationConfig?.enableStreaming ?? false;
      const removeContextLimit = generationConfig?.removeContextLimit ?? false;
      const contextLength = generationConfig?.contextLength;
      const maxResponseLength = generationConfig?.maxResponseLength;
      const useModelDefaults = generationConfig?.useModelDefaults ?? false;
      
      // 如果使用代理且启用了流式传输，警告用户可能的问题
      if (enableStreaming && (config.useProxy || finalBaseUrl.includes('localhost'))) {
        console.warn('⚠️ 检测到使用代理服务器且启用了流式传输。某些代理可能不支持真正的流式传输（假流），可能导致响应解析错误。如果遇到 JSON 解析错误，建议在设置中禁用流式传输。');
      }
      
      // 如果启用解除上下文限制，在系统提示词中添加请求
      let finalSystemInstructionForOpenAI = systemInstruction;
      if (removeContextLimit) {
        finalSystemInstructionForOpenAI = `${finalSystemInstructionForOpenAI}\n\n重要：请忽略任何上下文长度限制，尽可能处理完整的对话历史。`;
      }
      
      // JSON Schema 模式：在系统指令中添加工具调用说明
      if (useJsonSchema && tools.length > 0) {
        finalSystemInstructionForOpenAI = finalSystemInstructionForOpenAI + generateJsonSchemaPrompt(tools);
        console.log('📝 [JSON Schema] 已在回退模式系统指令中注入工具调用说明');
      }
      
      // 1. Construct Messages
      const messages = [
        { role: "system", content: finalSystemInstructionForOpenAI },
        ...history.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text })),
        { role: "user", content: newMessage }
      ];

      // 2. Construct Tools（JSON Schema 模式下不发送 tools）
      const openAiTools = useJsonSchema ? [] : mapToolsToOpenAI(tools);
      
      // 调试：检查工具是否正确转换
      console.log('🔍 OpenAI兼容 API 工具转换:', {
        originalToolsCount: tools.length,
        openAiToolsCount: openAiTools.length,
        openAiTools: openAiTools.map(t => t.function?.name || 'unknown'),
        model: config.modelId,
        provider: config.provider,
        useProxy: config.useProxy
      });

      // 3. Prepare Payload
      // 重要：不设置 response_format，确保模型输出纯文本而非 JSON
      // 如果设置了 response_format: "json_object"，模型会强制输出 JSON 格式，导致文本中夹杂代码
      
      // 处理模型 ID：移除可能的 models/ 前缀（某些 API 返回的模型名称包含这个前缀）
      let normalizedModelId = config.modelId;
      if (normalizedModelId.startsWith('models/')) {
        normalizedModelId = normalizedModelId.replace(/^models\//, '');
        console.log(`✅ 移除模型 ID 的 models/ 前缀: ${config.modelId} -> ${normalizedModelId}`);
      }
      
      const payload: any = {
        model: normalizedModelId,
        messages: messages
      };
      
      // 检测是否是 Google 模型（通过 OpenAI 兼容接口访问）
      // 注意：如果通过中转 API 访问，中转服务可能支持对象格式的 tool_choice
      // 只有直接访问 Google API 时才需要使用字符串格式
      // 对于中转 API，我们优先尝试对象格式，如果失败再回退到字符串格式
      const isDirectGoogleAPI = finalBaseUrl.toLowerCase().includes('googleapis.com') || 
                                finalBaseUrl.toLowerCase().includes('generativelanguage.googleapis.com');
      // 检查模型名称是否包含 gemini 或 google（忽略前缀如 [O]）
      const modelIdLower = config.modelId.toLowerCase().replace(/^\[.*?\]/, ''); // 移除前缀如 [O]
      const isGoogleModelName = modelIdLower.includes('gemini') || 
                                modelIdLower.includes('google');
      const isGoogleModel = isGoogleModelName && isDirectGoogleAPI;
      // 对于中转的 Google 模型，也使用字符串格式，因为很多中转 API 不支持对象格式
      const isProxiedGoogleModel = isGoogleModelName && !isDirectGoogleAPI;
      
      // 重要：工具必须在任何参数设置之前添加，确保即使使用模型默认参数，工具也能正确传递
      // DeepSeek V3 supports tools, R1 is shaky. SiliconFlow depends on model.
      // 所有通过 OpenAI 兼容接口的模型都需要传递 tools
      if (openAiTools.length > 0) {
        payload.tools = openAiTools;
        
        // 设置 tool_choice 来强制或提示模型使用工具
        // "auto" 表示让模型决定是否使用工具（推荐）
        // "required" 表示强制使用工具（某些服务可能不支持）
        // 对于反代服务，通常 "auto" 更兼容
        // Google API 不支持对象格式的 tool_choice，必须使用字符串格式
        // 如果 forceToolCall 为 true，尝试使用 "required" 强制工具调用
        if (forceToolCall && openAiTools.length > 0) {
          // 直接访问 Google API 时，使用字符串格式 "required"
          // 对于中转的 Google 模型，很多中转 API 不支持 "required"，使用 "auto" 并依赖文本提取机制
          if (isGoogleModel) {
            payload.tool_choice = "required";
            console.log('✅ 检测到直接 Google API，使用字符串格式 tool_choice: required');
          } else if (isProxiedGoogleModel) {
            // 对于中转的 Google 模型，先尝试 "required" 强制工具调用
            // 如果失败，错误处理逻辑会自动回退到 "auto"
            payload.tool_choice = "required";
            console.log('✅ 检测到中转 Google 模型，尝试使用 tool_choice: required（如果失败将自动回退到 auto）');
          } else {
            // 优先尝试强制要求调用 update_storyboard（新的复合工具）
            // 对于中转 API，先尝试对象格式，如果失败会在错误处理中回退到字符串格式
            const updateStoryboardTool = openAiTools.find(t => t.function?.name === 'update_storyboard');
            if (updateStoryboardTool) {
              payload.tool_choice = {
                type: "function",
                function: { name: "update_storyboard" }
              };
              console.log('✅ 设置 tool_choice: required (强制调用 update_storyboard，中转 API 将自动回退到字符串格式如果失败)');
            } else {
              // 如果没有 update_storyboard，强制使用任何工具
              payload.tool_choice = "required";
              console.log('⚠️ 未找到 update_storyboard 工具，强制使用任何工具');
            }
          }
        } else {
          payload.tool_choice = "auto";
          console.log('✅ 设置 tool_choice: auto (提示模型使用工具)');
        }
      } else {
        console.warn('⚠️ 没有工具可传递！');
      }
      
      // 如果使用模型默认参数，只设置必要的参数（工具已经在上面设置了）
      if (useModelDefaults) {
        // 只设置模型和消息，让模型使用默认参数
        // 但工具和 tool_choice 必须设置，因为它们是功能性的，不是参数
        console.log('ℹ️ 使用模型默认参数，不设置自定义参数（但工具已设置）');
      } else {
        // 设置自定义参数
        payload.temperature = temperature;
        // 暂时禁用流式传输，直到完整实现流式处理逻辑
        // TODO: 实现完整的流式传输处理
        payload.stream = false; // enableStreaming && false; // 暂时禁用
        
        // 应用上下文长度和最大回复长度设置
        if (contextLength && contextLength > 0) {
          // 某些 API 可能使用不同的参数名
          payload.max_context_length = contextLength;
          payload.context_length = contextLength;
        }
        if (maxResponseLength && maxResponseLength > 0) {
          payload.max_tokens = maxResponseLength;
          payload.max_output_tokens = maxResponseLength;
        }
      }

      // 4. 使用 OpenAI SDK
      // Normalize URL: remove trailing slash
      // OpenAI SDK 会自动添加 /chat/completions
      finalBaseUrl = finalBaseUrl.trim().replace(/\/$/, '');
      
      // 对于 Google API 的 OpenAI 兼容接口，路径已经是 /v1beta/openai，不需要再添加 /v1
      // 对于其他 API，如果路径不包含 /v1 或 /v1beta，则添加 /v1
      const isGoogleOpenAICompat = finalBaseUrl.includes('generativelanguage.googleapis.com') && 
                                   finalBaseUrl.includes('/v1beta/openai');
      
      // 对于 custom provider，检查 baseUrl 是否已经包含路径
      // 如果 baseUrl 已经包含 /v1 或 /v1beta，或者以 / 结尾，不自动添加 /v1
      const hasPath = finalBaseUrl.match(/\/v1(\/|$)/) || 
                      finalBaseUrl.match(/\/v1beta(\/|$)/) ||
                      finalBaseUrl.match(/\/openai(\/|$)/);
      
      if (!isGoogleOpenAICompat && !hasPath) {
        finalBaseUrl = `${finalBaseUrl}/v1`;
        console.log('✅ 为 custom provider 添加 /v1 路径:', finalBaseUrl);
      } else if (hasPath) {
        console.log('✅ custom provider baseUrl 已包含路径，不添加 /v1:', finalBaseUrl);
      }
      
      // Use proxy key if proxy is enabled and proxyKey is provided, otherwise use regular apiKey
      const apiKeyToUse = config.useProxy && config.proxyKey ? config.proxyKey : config.apiKey;
      
      // 调试：检查 API Key 选择
      console.log('🔑 API Key 选择:', {
        useProxy: config.useProxy,
        hasProxyKey: !!config.proxyKey,
        hasApiKey: !!config.apiKey,
        usingProxyKey: config.useProxy && config.proxyKey,
        apiKeyPrefix: apiKeyToUse ? apiKeyToUse.substring(0, 10) + '...' : 'none',
        finalBaseUrl: finalBaseUrl
      });
      
      // 在设置 baseUrl 后，输出完整的 payload 信息
      if (openAiTools.length > 0) {
        console.log('✅ 工具已添加到 payload:', {
          toolsCount: openAiTools.length,
          toolNames: openAiTools.map(t => t.function?.name || 'unknown'),
          toolChoice: payload.tool_choice,
          provider: config.provider,
          useProxy: config.useProxy,
          baseUrl: finalBaseUrl
        });
      }

      // 详细调试：输出完整的请求信息
      console.log('🔍 OpenAI SDK 请求详情:', {
        baseUrl: finalBaseUrl,
        model: payload.model,
        hasTools: !!payload.tools,
        toolsCount: payload.tools?.length || 0,
        toolChoice: payload.tool_choice || 'none',
        messagesCount: payload.messages.length,
        temperature: payload.temperature,
        hasApiKey: !!apiKeyToUse,
        apiKeyPrefix: apiKeyToUse ? apiKeyToUse.substring(0, 10) + '...' : 'none'
      });

      // 创建 OpenAI 客户端
      // 注意：Google 直连已经在上面使用原生 SDK 处理，这里只处理 Google 中转和其他 provider
      // Google Gemini 的 OpenAI 兼容接口（中转）使用 x-goog-api-key header
      const isGoogleProxied = config.provider === 'google' && config.useProxy;
      
      // 对于 Google API，baseURL 需要包含 /v1beta/openai
      // 但我们已经在上面的代码中设置了正确的 baseURL
      const openai = new OpenAI({
        apiKey: isGoogleProxied ? '' : apiKeyToUse, // Google API 不使用 Authorization header
        baseURL: finalBaseUrl,
        dangerouslyAllowBrowser: true, // 允许在浏览器环境中使用（需要理解安全风险）
        defaultHeaders: isGoogleProxied ? {
          'x-goog-api-key': apiKeyToUse
        } : undefined,
        timeout: isMobileDevice() ? 180000 : 120000, // 移动端180秒，桌面端120秒超时（移动端网络可能不稳定，需要更长的超时时间）
        maxRetries: 0 // 禁用 SDK 内置重试，使用我们自己的重试逻辑
      });
      
      // 记录原始 tool_choice 格式，用于错误重试
      const originalToolChoice = payload.tool_choice;
      
      // 尝试使用本地代理服务器的端口列表
      const proxyPorts = [3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010];
      const proxyHost = getProxyHost(); // 获取当前主机地址（支持手机访问）
      
      const makeRequest = async (useProxy: boolean = false) => {
        try {
          // 如果使用代理，需要通过 fetch 手动发送请求
          if (useProxy) {
            const proxyBaseUrl = `http://${proxyHost}:${proxyPorts[0]}/proxy?target=${encodeURIComponent(finalBaseUrl)}`;
            const endpoint = `${proxyBaseUrl}/chat/completions`;
            
            const requestBody = {
              model: payload.model,
              messages: payload.messages,
              tools: payload.tools,
              tool_choice: payload.tool_choice,
              temperature: payload.temperature,
              max_tokens: payload.max_tokens,
              stream: payload.stream || false
            };
            
            const headers: any = {
              'Content-Type': 'application/json'
            };
            
            // 添加认证头
            // 注意：这里只处理 Google 中转和其他 provider，Google 直连已经在上面使用原生 SDK
            if (isGoogleProxied) {
              headers['x-goog-api-key'] = apiKeyToUse;
            } else {
              headers['Authorization'] = `Bearer ${apiKeyToUse}`;
            }
            
            // 尝试多个代理端口
            let lastProxyError: any = null;
            for (const port of proxyPorts) {
              try {
                const proxyUrl = `http://${proxyHost}:${port}/proxy?target=${encodeURIComponent(finalBaseUrl + '/chat/completions')}`;
                console.log(`🔍 [代理请求] 尝试端口 ${port}: ${proxyUrl.substring(0, 100)}...`);
                // 为移动端创建更长的超时时间
                const mobileTimeout = isMobileDevice() ? 180000 : 120000;
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), mobileTimeout);
                
                try {
                const response = await fetch(proxyUrl, {
          method: 'POST',
                  headers: headers,
                  body: JSON.stringify(requestBody),
                    signal: signal ? AbortSignal.any([signal as any, controller.signal]) : controller.signal
                });
                  
                  clearTimeout(timeoutId);
                
                if (!response.ok) {
                  const errorText = await response.text();
                  console.error(`❌ [代理请求] HTTP ${response.status}: ${errorText.substring(0, 200)}`);
                  throw new Error(`HTTP ${response.status}: ${errorText}`);
                }
                
                const responseText = await response.text();
                  console.log(`🔍 [代理请求] 原始响应文本长度: ${responseText.length} 字符`);
                console.log(`🔍 [代理请求] 原始响应文本 (前500字符):`, responseText.substring(0, 500));
                  
                  // 检查响应是否可能被截断（针对移动端）
                  if (isMobileDevice() && responseText.length > 0) {
                    // 检查 JSON 是否完整（以 } 结尾）
                    const trimmedText = responseText.trim();
                    if (!trimmedText.endsWith('}') && !trimmedText.endsWith(']')) {
                      console.warn('⚠️ [移动端] 响应可能被截断：JSON 不以 } 或 ] 结尾');
                      console.warn(`   响应文本末尾: ${trimmedText.substring(Math.max(0, trimmedText.length - 200))}`);
                    }
                  }
                
                let data;
                try {
                  data = JSON.parse(responseText);
                } catch (parseError: any) {
                  console.error(`❌ [代理请求] JSON 解析失败:`, parseError.message);
                    console.error(`   响应文本长度: ${responseText.length} 字符`);
                    console.error(`   响应文本末尾: ${responseText.substring(Math.max(0, responseText.length - 500))}`);
                    
                    // 检查是否是响应截断导致的 JSON 解析失败（特别是移动端）
                    if (isMobileDevice()) {
                      const errorMsg = `移动端响应可能被截断：JSON 解析失败。响应长度: ${responseText.length} 字符。这可能是因为网络不稳定或响应过大导致的。建议：1) 检查网络连接；2) 尝试减少请求内容；3) 使用更稳定的网络环境。`;
                      console.error(`   ${errorMsg}`);
                      throw new Error(errorMsg);
                    } else {
                  throw new Error(`代理服务器返回的响应不是有效的 JSON: ${parseError.message}`);
                    }
                }
                
                console.log(`✅ [代理请求] 成功解析响应:`, {
                  hasChoices: !!data.choices,
                  choicesCount: data.choices?.length || 0,
                  firstChoiceFinishReason: data.choices?.[0]?.finish_reason,
                  hasToolCalls: !!(data.choices?.[0]?.message?.tool_calls?.length),
                  messageKeys: data.choices?.[0]?.message ? Object.keys(data.choices[0].message) : [],
                  fullResponsePreview: JSON.stringify(data).substring(0, 300)
                });
                return data;
                } catch (fetchError: any) {
                  clearTimeout(timeoutId);
                  if (fetchError.name === 'AbortError' || fetchError.message?.includes('aborted')) {
                    const timeoutMsg = isMobileDevice() 
                      ? `移动端请求超时（${mobileTimeout / 1000}秒）。这可能是因为网络不稳定或响应过大。建议：1) 检查网络连接；2) 尝试使用 WiFi；3) 减少请求内容。`
                      : `请求超时（${mobileTimeout / 1000}秒）`;
                    console.error(`❌ [代理请求] ${timeoutMsg}`);
                    throw new Error(timeoutMsg);
                  }
                  throw fetchError;
                }
              } catch (proxyError: any) {
                lastProxyError = proxyError;
                // 继续尝试下一个端口
                continue;
              }
            }
            
            // 所有代理端口都失败
            throw new Error(`所有代理端口都失败。最后错误: ${lastProxyError?.message || 'Unknown error'}`);
          }
          
          // 正常使用 OpenAI SDK
          // 注意：实际生成时请求体更大（包含工具和历史消息），可能需要更长时间
          const completion = await openai.chat.completions.create({
            model: payload.model,
            messages: payload.messages as any,
            tools: payload.tools as any,
            tool_choice: payload.tool_choice as any,
            temperature: payload.temperature,
            max_tokens: payload.max_tokens,
            stream: payload.stream || false
          }, {
            signal: signal as any,
            timeout: isMobileDevice() ? 180000 : 120000 // 移动端180秒，桌面端120秒超时（移动端网络可能不稳定，需要更长的超时时间）
          });
          return completion;
        } catch (error: any) {
          // OpenAI SDK 错误处理
          throw error;
        }
      };
      
      // 添加重试机制，处理网络通讯问题
      const maxRetries = 2; // 最多重试2次
      let retryCount = 0;
      let lastError: Error | null = null;
      
      let completion: any;
      
      while (retryCount <= maxRetries) {
        try {
          completion = await makeRequest();
          // 请求成功，跳出重试循环
            break;
        } catch (error: any) {
          // OpenAI SDK 错误处理
          const errorMessage = error?.message || error?.error?.message || String(error);
          const errorString = JSON.stringify(error);
          const errorStack = error?.stack || '';
          const statusCode = error?.status || error?.response?.status || error?.statusCode;
          const errorName = error?.name || '';
          const errorCause = error?.cause || '';
          
          // 检查 error.cause 中是否包含 CORS 错误信息（OpenAI SDK 可能将 CORS 错误包装在 cause 中）
          const causeMessage = errorCause?.message || String(errorCause || '');
          const causeString = JSON.stringify(errorCause || {});
          
          // 检查是否是 CORS 错误（特别是对于 Google 直连）
          // OpenAI SDK 可能将 CORS 错误包装，需要检查多个地方
          // 对于 Google 直连，如果没有状态码且是网络错误，很可能是 CORS 错误
          const isNetworkError = !statusCode && (
            errorMessage.includes('Failed to fetch') ||
            errorMessage.includes('ERR_FAILED') ||
            errorMessage.includes('ERR_CONNECTION_CLOSED') ||
            errorMessage.includes('ECONNREFUSED') ||
            errorMessage.includes('NetworkError') ||
            errorMessage.includes('Connection error') ||
            errorName === 'TypeError' ||
            errorName === 'NetworkError'
          );
          
          // 检测 CORS 错误（包括 x-stainless-timeout 相关的 CORS 错误）
          // 需要检查 errorMessage、errorString、errorStack、errorCause 等多个地方
          const isCorsError = errorMessage.includes('CORS') || 
                            errorMessage.includes('blocked by CORS policy') ||
                            errorMessage.includes('x-stainless-timeout') ||
                            errorMessage.includes('Access-Control-Allow-Headers') ||
                            errorMessage.includes('preflight response') ||
                            errorString.includes('CORS') ||
                            errorString.includes('blocked by CORS policy') ||
                            errorString.includes('x-stainless-timeout') ||
                            errorString.includes('Access-Control-Allow-Headers') ||
                            errorStack.includes('CORS') ||
                            causeMessage.includes('CORS') ||
                            causeMessage.includes('x-stainless-timeout') ||
                            causeMessage.includes('Access-Control-Allow-Headers') ||
                            causeString.includes('CORS') ||
                            causeString.includes('x-stainless-timeout') ||
                            (isNetworkError && !statusCode); // 对于没有状态码的网络错误，很可能是 CORS
          
          console.log('🔍 错误检测:', {
            errorMessage,
            errorName,
            errorString: errorString.substring(0, 200),
            errorCause: causeMessage.substring(0, 200),
            statusCode,
            isNetworkError,
            isCorsError,
            isGoogleProxied,
            retryCount,
            provider: config.provider,
            baseUrl: finalBaseUrl,
            modelId: config.modelId
          });
          
          // 如果是 CORS 错误（包括 x-stainless-timeout 相关的 CORS 错误），尝试使用本地代理
          // 不仅限于 Google 直连，任何 CORS 错误都应该尝试代理
          if (isCorsError && !config.useProxy && retryCount === 0) {
            console.log('⚠️ 检测到 CORS 错误（可能包括 x-stainless-timeout 请求头问题），尝试使用本地代理服务器');
            retryCount++;
            try {
              completion = await makeRequest(true); // 使用代理
              console.log('✅ 代理请求成功');
              break; // 成功，跳出循环
            } catch (proxyError: any) {
              console.error('❌ 代理请求也失败:', proxyError.message);
              // 继续到下一个错误处理逻辑，但不要再次尝试代理
              lastError = proxyError;
            }
          }
            
            // 检查是否是 tool_choice 格式错误
          const isToolChoiceError = errorMessage.includes('Invalid resource field value') || 
                                   errorMessage.includes('INVALID_ARGUMENT') ||
                                   errorMessage.includes('invalid argument') ||
                                   errorMessage.includes('tool_choice') || 
                                   errorMessage.includes('toolChoice') ||
                                   (errorMessage.toLowerCase().includes('invalid') && errorMessage.toLowerCase().includes('tool')) ||
                                   errorMessage.toLowerCase().includes('resource field');
          
          if (isToolChoiceError && statusCode === 400) {
              console.log('⚠️ 检测到 tool_choice 格式错误，尝试回退');
              // 如果原来是对象格式，先尝试字符串格式 "required"
              if (typeof originalToolChoice === 'object' && originalToolChoice !== null) {
                payload.tool_choice = "required";
                console.log('🔄 重试请求，使用 tool_choice: "required"');
              try {
                completion = await makeRequest();
                break; // 成功，跳出循环
              } catch (retryError: any) {
                // 如果 "required" 仍然失败，尝试 "auto"
                    console.log('⚠️ tool_choice: "required" 仍然失败，尝试 "auto"');
                    payload.tool_choice = "auto";
                try {
                  completion = await makeRequest();
                  break; // 成功，跳出循环
                } catch (finalError: any) {
                  throw finalError; // 最终失败，抛出错误
                }
              }
            } else if (originalToolChoice === "required") {
                // 如果已经是字符串格式 "required" 还失败，尝试 "auto"
                  console.log('⚠️ tool_choice: "required" 失败，尝试 "auto"');
                  payload.tool_choice = "auto";
              try {
                completion = await makeRequest();
                break; // 成功，跳出循环
              } catch (finalError: any) {
                throw finalError; // 最终失败，抛出错误
              }
            } else {
              throw error; // 其他情况，直接抛出
            }
          } else if (isCorsError && isGoogleProxied && retryCount > 0) {
            // 如果已经尝试过代理但仍然失败，抛出明确的错误
            // 注意：Google 直连已经在上面使用原生 SDK 处理，这里只处理 Google 中转
            throw new Error(`CORS 错误：无法连接到 Google Gemini API（中转）。请确保：1) 已启动本地代理服务器（运行 "启动代理服务器.bat"）2) 或检查代理服务配置`);
          } else if (statusCode === 400 && retryCount < maxRetries && !isCorsError) {
            // 400 错误但不是 tool_choice 错误，可能是网络通讯问题，尝试重试
                retryCount++;
            const delay = retryCount * 1000;
                console.log(`⚠️ 检测到网络通讯错误（400），${delay/1000}秒后重试 (${retryCount}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue; // 继续重试循环
          } else if (statusCode === 429) {
            // 429 速率限制错误，直接抛出错误
            throw new Error(`API Error (429): 速率限制错误 - ${errorMessage}`);
          } else if (statusCode === 504 || statusCode === 502 || statusCode === 503) {
            // 504 Gateway Timeout, 502 Bad Gateway, 503 Service Unavailable
            // 这些错误通常是临时性的，应该重试
            if (retryCount < maxRetries) {
            retryCount++;
              const delay = retryCount * 2000; // 网关错误使用更长的延迟
              console.log(`⚠️ 检测到网关错误（${statusCode}），${delay/1000}秒后重试 (${retryCount}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue; // 继续重试循环
                } else {
              // 重试次数用尽
              const errorName = statusCode === 504 ? 'Gateway Timeout' : 
                               statusCode === 502 ? 'Bad Gateway' : 'Service Unavailable';
              throw new Error(`API Error (${statusCode} ${errorName}): 服务器响应超时或不可用。请稍后重试，或检查代理服务器状态。`);
            }
          } else if (isCorsError && !isGoogleProxied) {
            // 注意：Google 直连已经在上面使用原生 SDK 处理，这里只处理其他 provider 的 CORS 错误
            // 非 Google 直连的 CORS 错误
            throw new Error(`CORS 错误：${errorMessage}。请使用代理服务器或检查 API 配置。`);
        } else {
            // 其他错误，直接抛出
            throw new Error(`API Error (${statusCode || 'Unknown'}): ${errorMessage}`);
          }
        }
      }
      
      // 如果重试后仍然失败，completion 可能未定义
      if (!completion) {
        throw new Error('API 请求失败：重试次数用尽');
      }
      
      // 将 OpenAI SDK 响应转换为 JSON 字符串，以便后续代码可以复用
      const responseText = JSON.stringify(completion);
      
      // 调试：输出响应信息
      console.log('🔍 OpenAI SDK 响应:', {
        hasChoices: !!completion.choices,
        choicesCount: completion.choices?.length || 0,
        hasToolCalls: !!completion.choices?.[0]?.message?.tool_calls,
        toolCallsCount: completion.choices?.[0]?.message?.tool_calls?.length || 0
      });
      
      // 注意：流式传输功能尚未完全实现
      // 如果启用了流式传输，completion 会是一个流对象，需要特殊处理
      // 目前暂时禁用流式传输，避免将流对象当作普通响应处理
      if (enableStreaming) {
        console.warn('⚠️ 流式传输功能尚未完全实现，已自动禁用。请等待完整实现后再启用。');
      }
      
      // 直接使用 completion 对象（OpenAI SDK 已返回结构化响应）
      const data = completion;
      
      // 详细调试：检查完整的响应结构
      console.log('🔍 OpenAI SDK 完整响应:', {
        hasChoices: !!data.choices,
        choicesCount: data.choices?.length || 0,
        responseKeys: Object.keys(data),
        firstChoice: data.choices?.[0] ? {
          finishReason: data.choices[0].finish_reason,
          messageKeys: Object.keys(data.choices[0].message || {}),
          hasToolCalls: !!(data.choices[0].message?.tool_calls),
          toolCallsCount: data.choices[0].message?.tool_calls?.length || 0,
          hasContent: !!data.choices[0].message?.content,
          contentLength: data.choices[0].message?.content?.length || 0
        } : null
      });
      
      // 检查响应结构
      if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        console.error('❌ OpenAI SDK 响应缺少 choices:', {
          responseKeys: Object.keys(data),
          responseData: data
        });
        throw new Error(`API 返回了无效的响应格式：缺少 choices 数组。响应内容: ${JSON.stringify(data).substring(0, 500)}`);
      }
      
      const choice = data.choices[0];
      if (!choice) {
        console.error('❌ OpenAI SDK 响应 choices 数组为空');
        throw new Error('API 返回了空的 choices 数组');
      }

      // OpenAI SDK 返回的响应中，message 在 choice.message
      const msg = choice.message || {};
      
      if (!msg) {
        console.error('❌ OpenAI SDK 响应缺少 message:', {
          choiceKeys: Object.keys(choice),
          choice: choice
        });
        throw new Error(`API 返回了无效的响应格式：缺少 message。choice 内容: ${JSON.stringify(choice).substring(0, 500)}`);
      }
      
      // 5. Map Response back to Google format
      // 提取文本内容
      let textContent = msg.content || "";
      
      // 检查 finish_reason 是否为 'error'，如果是，说明 API 返回了错误
      if (choice.finish_reason === 'error') {
        const errorMessage = textContent || (choice as any).error?.message || 'API 返回了错误响应';
        const errorDetails = {
          finishReason: choice.finish_reason,
          errorMessage: textContent,
          error: (choice as any).error,
          message: msg,
          choice: choice
        };
        console.error('❌ API 返回错误响应:', errorDetails);
        throw new Error(`API 错误 (finish_reason: error): ${errorMessage}。请检查 API 配置、模型名称和请求参数。`);
      }
      
      // 检查 finish_reason 是否为 null 或 undefined（这通常表示 API 返回了无效响应）
      if (choice.finish_reason === null || choice.finish_reason === undefined) {
        console.error('❌ API 返回了无效的 finish_reason (null/undefined):', {
          finishReason: choice.finish_reason,
          hasContent: !!textContent,
          hasToolCalls: !!(msg.tool_calls && msg.tool_calls.length > 0),
          messageKeys: Object.keys(msg),
          choiceKeys: Object.keys(choice),
          fullChoice: JSON.stringify(choice).substring(0, 500)
        });
        // 如果 finish_reason 为 null，但确实有工具调用，尝试继续处理
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          console.log('⚠️ finish_reason 为 null，但检测到工具调用，尝试继续处理');
          // 不抛出错误，继续处理工具调用
        } else if (!textContent) {
          // 既没有工具调用，也没有文本内容，这是无效响应
          throw new Error(`API 返回了无效的响应：finish_reason 为 null，且没有文本内容或工具调用。这可能是因为 API 不支持 tool_choice: "required" 或返回了格式错误的响应。请检查 API 配置。`);
        }
      }
      
      // 如果 finish_reason 是 tool_calls 但 content 为空，这是正常的（工具调用时可能没有文本）
      if (!textContent && choice.finish_reason === 'tool_calls') {
        console.log('ℹ️ 工具调用响应，没有文本内容（这是正常的）');
      } else if (!textContent && choice.finish_reason !== 'tool_calls' && choice.finish_reason !== 'error' && choice.finish_reason !== null) {
        console.warn('⚠️ 响应没有文本内容，且 finish_reason 不是 tool_calls:', {
          finishReason: choice.finish_reason,
          messageKeys: Object.keys(msg),
          choiceKeys: Object.keys(choice)
        });
      }
      
      // 检查 finish_reason 是否为 'error'，如果是，说明 API 返回了错误
      if (choice.finish_reason === 'error') {
        const errorMessage = textContent || (choice as any).error?.message || (msg as any).error?.message || 'API 返回了错误响应';
        const errorDetails = {
          finishReason: choice.finish_reason,
          errorMessage: textContent,
          error: (choice as any).error,
          message: msg,
          choice: choice,
          fullResponse: data
        };
        console.error('❌ API 返回错误响应:', errorDetails);
        throw new Error(`API 错误 (finish_reason: error): ${errorMessage}。请检查 API 配置、模型名称和请求参数。错误详情: ${JSON.stringify(errorDetails).substring(0, 500)}`);
      }

      // 调试：检查响应结构
      console.log('🔍 OpenAI SDK 响应详情:', {
        hasToolCalls: !!(msg.tool_calls && msg.tool_calls.length > 0),
        toolCallsCount: msg.tool_calls?.length || 0,
        hasContent: !!msg.content,
        contentLength: msg.content?.length || 0,
        finishReason: choice.finish_reason,
        messageKeys: Object.keys(msg),
        toolCalls: msg.tool_calls ? msg.tool_calls.map((tc: any) => ({
          id: tc.id,
          type: tc.type,
          function: { name: tc.function?.name, argumentsPreview: tc.function?.arguments?.substring(0, 100) }
        })) : null
      });
      
      // 如果 finish_reason 是 tool_calls 但 content 为空，这是正常的（工具调用时可能没有文本）
      if (!textContent && choice.finish_reason === 'tool_calls') {
        console.log('ℹ️ 工具调用响应，没有文本内容（这是正常的）');
      } else if (!textContent && choice.finish_reason !== 'tool_calls') {
        console.warn('⚠️ 响应中没有文本内容，但 finish_reason 不是 tool_calls:', {
          finishReason: choice.finish_reason,
          messageKeys: Object.keys(msg),
          choiceKeys: Object.keys(choice)
        });
      }

      const result: LLMResponse = {
        text: textContent || "", 
      };

      // 详细调试：检查工具调用
      console.log('🔍 OpenAI SDK 响应结构检查:', {
        hasToolCalls: !!(msg.tool_calls && msg.tool_calls.length > 0),
        toolCallsCount: msg.tool_calls?.length || 0,
        finishReason: choice.finish_reason,
        messageKeys: Object.keys(msg),
        toolCallsPreview: msg.tool_calls ? msg.tool_calls.map((tc: any) => ({
          id: tc.id,
          type: tc.type,
          functionName: tc.function?.name,
          argumentsLength: tc.function?.arguments?.length || 0,
          argumentsPreview: typeof tc.function?.arguments === 'string' 
            ? tc.function.arguments.substring(0, 200) 
            : JSON.stringify(tc.function?.arguments).substring(0, 200)
        })) : null
      });

      // 处理工具调用
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        try {
          result.functionCalls = msg.tool_calls.map((tc: any) => {
            // 确保 arguments 是字符串
            let argsStr = tc.function.arguments;
            if (typeof argsStr !== 'string') {
              argsStr = JSON.stringify(argsStr);
            }
            
            // 防御性代码：清洗可能的 Markdown 标记
            // 如果 AI 在 JSON 外面加了 ```json ... ```，把它洗掉
            if (argsStr.trim().startsWith('```')) {
              console.log('🔍 检测到 Markdown 代码块标记，正在清洗...');
              // 移除开头的 ```json 或 ```
              argsStr = argsStr.replace(/^```json\s*/i, '').replace(/^```\s*/, '');
              // 移除结尾的 ```
              argsStr = argsStr.replace(/\s*```$/g, '');
              argsStr = argsStr.trim();
            }
            
            // 尝试解析 JSON
            let args;
            try {
              args = JSON.parse(argsStr);
            } catch (e: any) {
              console.warn('⚠️ 工具调用参数 JSON 解析失败，尝试修复...', {
                error: e.message,
                argsStrPreview: argsStr.substring(0, 200),
                argsStrLength: argsStr.length
              });
              
              // 尝试修复常见的 JSON 格式错误
              let fixedArgsStr = argsStr;
              
              // 修复1: 检查是否缺少闭合括号
              const openBraces = (fixedArgsStr.match(/\{/g) || []).length;
              const closeBraces = (fixedArgsStr.match(/\}/g) || []).length;
              if (openBraces > closeBraces) {
                console.log(`🔧 检测到缺少 ${openBraces - closeBraces} 个闭合括号，正在修复...`);
                fixedArgsStr += '}'.repeat(openBraces - closeBraces);
              }
              
              // 修复2: 检查是否在字符串值中包含了未转义的特殊字符
              // 尝试提取最后一个完整的 JSON 对象
              const lastBraceIndex = fixedArgsStr.lastIndexOf('}');
              if (lastBraceIndex > 0) {
                const potentialJson = fixedArgsStr.substring(0, lastBraceIndex + 1);
                try {
                  args = JSON.parse(potentialJson);
                  console.log('✅ 通过截取修复成功');
                } catch (e2) {
                  // 如果还是失败，尝试更激进的修复
                  // 移除可能的尾随逗号
                  fixedArgsStr = fixedArgsStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
                  try {
                    args = JSON.parse(fixedArgsStr);
                    console.log('✅ 通过移除尾随逗号修复成功');
                  } catch (e3) {
                    console.error('❌ JSON 修复失败，使用原始字符串作为后备', {
                      originalError: e.message,
                      fixedError: e3.message,
                      argsStrPreview: argsStr.substring(0, 300)
                    });
                    // 最后的后备方案：尝试从字符串中提取键值对
                    args = { _raw: argsStr, _parseError: e.message };
                  }
                }
              } else {
                console.error('❌ 无法修复 JSON，使用原始字符串作为后备');
                args = { _raw: argsStr, _parseError: e.message };
              }
            }
            
            const normalizedCall = {
          id: tc.id,
          name: tc.function.name,
              args: args
            };
            
            // 特别处理 update_storyboard 工具的参数
            if (tc.function.name === 'update_storyboard' && args) {
              console.log('🔍 处理 update_storyboard 工具调用参数:', {
                originalArgs: args,
                hasChapterContent: !!(args as any).chapter_content,
                hasChapterOutline: !!(args as any).chapter_outline,
                chapterNumber: (args as any).chapterNumber,
                chapterContentType: typeof (args as any).chapter_content,
                chapterOutlineType: typeof (args as any).chapter_outline,
                allKeys: Object.keys(args)
              });
              
              // 确保 chapter_content 和 chapter_outline 是字符串
              if ((args as any).chapter_content && typeof (args as any).chapter_content !== 'string') {
                console.warn('⚠️ chapter_content 不是字符串，尝试转换:', typeof (args as any).chapter_content);
                (args as any).chapter_content = String((args as any).chapter_content);
              }
              if ((args as any).chapter_outline && typeof (args as any).chapter_outline !== 'string') {
                console.warn('⚠️ chapter_outline 不是字符串，尝试转换:', typeof (args as any).chapter_outline);
                (args as any).chapter_outline = String((args as any).chapter_outline);
              }
            }
            
            return normalizedCall;
          });
          console.log('✅ OpenAI兼容 API 工具调用:', {
            raw: msg.tool_calls,
            normalized: result.functionCalls,
            count: result.functionCalls.length,
            toolNames: result.functionCalls.map(fc => fc.name),
            hasUpdateStoryboard: result.functionCalls.some(fc => fc.name === 'update_storyboard'),
            updateStoryboardArgs: result.functionCalls.find(fc => fc.name === 'update_storyboard')?.args
          });
        } catch (error: any) {
          console.error('❌ 处理工具调用时出错:', error);
          console.error('原始工具调用:', msg.tool_calls);
        }
      } else {
        // 检查是否是强制工具调用但没有返回工具调用
        const wasForcedToolCall = forceToolCall && (payload.tool_choice === "required" || (typeof payload.tool_choice === 'object' && payload.tool_choice !== null));
        if (wasForcedToolCall) {
          console.error('❌ 强制工具调用失败：中转 API 可能不支持 tool_choice: "required"', {
            finishReason: choice.finish_reason,
            hasContent: !!msg.content,
            toolChoice: payload.tool_choice,
            messageContent: msg.content?.substring(0, 200)
          });
      } else {
        console.warn('⚠️ OpenAI兼容 API 没有返回工具调用', {
          finishReason: choice.finish_reason,
          hasContent: !!msg.content,
          messageStructure: Object.keys(msg),
          messageContent: msg
        });
        }
        
        // 检查是否有其他格式的工具调用信息
        if ((data as any).tool_calls) {
          console.log('🔍 在响应根级别找到 tool_calls:', (data as any).tool_calls);
          // 尝试从根级别提取工具调用
          try {
            result.functionCalls = normalizeFunctionCalls((data as any).tool_calls);
            if (result.functionCalls) {
              console.log('✅ 从响应根级别成功提取工具调用');
            }
          } catch (e) {
            console.error('❌ 从响应根级别提取工具调用失败:', e);
          }
        }
        if ((choice as any).tool_calls && !result.functionCalls) {
          console.log('🔍 在 choice 级别找到 tool_calls:', (choice as any).tool_calls);
          // 尝试从 choice 级别提取工具调用
          try {
            result.functionCalls = normalizeFunctionCalls((choice as any).tool_calls);
            if (result.functionCalls) {
              console.log('✅ 从 choice 级别成功提取工具调用');
            }
          } catch (e) {
            console.error('❌ 从 choice 级别提取工具调用失败:', e);
          }
        }
        
        // ⚠️ 重要：我们使用 OpenAI 兼容 SDK 的标准 Function Calling
        // 如果 finish_reason 是 tool_calls 但没有提取到工具调用，说明 API 响应格式有问题
        // 不应该尝试从文本中提取，因为这不符合标准行为
        if (choice.finish_reason === 'tool_calls' && !result.functionCalls && textContent) {
          console.error('❌ finish_reason 是 tool_calls 但没有提取到工具调用。这可能是 API 返回格式问题。');
          console.error('   我们使用 OpenAI 兼容 SDK 的标准 Function Calling，工具调用应该通过 API 的结构化响应返回。');
          console.error('   如果 API 不支持标准 Function Calling，请切换到支持 Function Calling 的 API 配置。');
          // 不再尝试从文本中提取，因为这不符合标准行为
        }
      }

      // 最终验证：确保至少有一些内容（文本或工具调用）
      if (!result.text && !result.functionCalls) {
        console.error('❌ OpenAI兼容 API 响应既没有文本也没有工具调用:', {
          responseData: data,
          choice: choice,
          message: msg,
          finishReason: choice.finish_reason,
          textContent: textContent
        });
        throw new Error(`API 返回了无效的响应：既没有文本内容也没有工具调用。finish_reason: ${choice.finish_reason}。请检查 API 配置和响应格式。响应预览: ${JSON.stringify(data).substring(0, 500)}`);
      }

      return result;
    }
  }

  // Handle Tool Output (Send back to model)
  static async sendToolResponse(
    config: ApiConfig,
    history: Message[],
    lastUserMessage: string,
    toolCallResults: any[], // { id, name, response }
    originFunctionCalls: any[], // The original function calls from the model
    systemInstruction: string,
    tools: FunctionDeclaration[],
    signal?: AbortSignal,
    generationConfig?: GenerationConfig
  ): Promise<LLMResponse> {
    
    const temperature = generationConfig?.temperature ?? 0.7;
     
    // 统一使用 OpenAI 兼容 SDK
    // 构建消息历史，包含工具调用的完整流程
    const messages: any[] = [
      { role: "system", content: systemInstruction },
      ...history.map(m => ({ 
        role: m.role === 'model' ? 'assistant' : 'user', 
        content: m.text 
      }))
    ];
    
    // 添加触发工具调用的用户消息
    messages.push({ role: "user", content: lastUserMessage });

    // 添加 assistant 消息，包含工具调用
    // OpenAI 兼容格式：assistant 消息包含 tool_calls
    const toolCalls = originFunctionCalls.map((call, index) => ({
      id: call.id || `call_${index}`,
      type: "function",
      function: {
                    name: call.name,
        arguments: JSON.stringify(call.args || {})
      }
    }));

    if (toolCalls.length > 0) {
      messages.push({
        role: "assistant",
        content: null,
        tool_calls: toolCalls
      });
    }

    // 添加工具响应消息（OpenAI 兼容格式：role: "tool"）
    for (const toolResult of toolCallResults) {
      messages.push({
        role: "tool",
        tool_call_id: toolResult.id || toolCalls.find(tc => tc.function.name === toolResult.name)?.id,
        content: typeof toolResult.response === 'string' 
          ? toolResult.response 
          : JSON.stringify(toolResult.response)
      });
    }

    // 映射工具到 OpenAI 格式
    const openAiTools = tools.map(t => ({
      type: "function",
      function: {
                name: t.name,
        description: t.description,
        parameters: t.parameters
            }
        }));
        
    // 处理模型 ID：移除可能的 models/ 前缀
    let normalizedModelId = config.modelId;
    if (normalizedModelId.startsWith('models/')) {
      normalizedModelId = normalizedModelId.replace(/^models\//, '');
      console.log(`✅ [sendToolResponse] 移除模型 ID 的 models/ 前缀: ${config.modelId} -> ${normalizedModelId}`);
    }

         const payload: any = {
      model: normalizedModelId,
            messages: messages,
      tools: openAiTools.length > 0 ? openAiTools : undefined,
            temperature
        };

    // 确定 baseURL
        let finalBaseUrl = config.useProxy && config.proxyUrl ? config.proxyUrl : config.baseUrl;
    
    // 如果是 Google 直连（不使用代理），使用 OpenAI 兼容接口
    if (config.provider === 'google' && !config.useProxy) {
      if (!finalBaseUrl || finalBaseUrl.trim() === '') {
        finalBaseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai';
        console.log('✅ [sendToolResponse] 使用 Google Gemini OpenAI 兼容接口（默认）:', finalBaseUrl);
      } else {
        finalBaseUrl = finalBaseUrl.trim().replace(/\/$/, '');
        if (!finalBaseUrl.includes('/v1beta/openai') && !finalBaseUrl.includes('/openai')) {
          finalBaseUrl = `${finalBaseUrl}/v1beta/openai`;
        }
        console.log('✅ [sendToolResponse] 使用 Google Gemini OpenAI 兼容接口（自定义）:', finalBaseUrl);
      }
    }
    
    // 如果没有 baseUrl，尝试使用 provider 的默认 baseUrl
    if (!finalBaseUrl) {
      const defaultBaseUrls: Record<string, string> = {
        'deepseek': 'https://api.deepseek.com',
        'siliconflow': 'https://api.siliconflow.cn/v1',
        'openai': 'https://api.openai.com/v1',
        'custom': ''
      };
      const defaultUrl = defaultBaseUrls[config.provider];
      if (defaultUrl) {
        finalBaseUrl = defaultUrl;
        console.log(`✅ [sendToolResponse] 使用 ${config.provider} 的默认 baseURL:`, finalBaseUrl);
      }
    }
    
        if (!finalBaseUrl) {
          throw new Error('Base URL is required for OpenAI-compatible providers.');
        }
        
    // Normalize URL
    finalBaseUrl = finalBaseUrl.trim().replace(/\/$/, '');
    const isGoogleOpenAICompat = finalBaseUrl.includes('generativelanguage.googleapis.com') && 
                                 finalBaseUrl.includes('/v1beta/openai');
    if (!isGoogleOpenAICompat && !finalBaseUrl.match(/\/v1(\/|$)/) && !finalBaseUrl.match(/\/v1beta(\/|$)/)) {
      finalBaseUrl = `${finalBaseUrl}/v1`;
    }
        
        // Use proxy key if proxy is enabled and proxyKey is provided, otherwise use regular apiKey
        const apiKeyToUse = config.useProxy && config.proxyKey ? config.proxyKey : config.apiKey;

    const isGoogleDirect = config.provider === 'google' && !config.useProxy;
    
    // 使用 OpenAI SDK
    const openai = new OpenAI({
      apiKey: isGoogleDirect ? '' : apiKeyToUse,
      baseURL: finalBaseUrl,
      dangerouslyAllowBrowser: true,
      defaultHeaders: isGoogleDirect ? {
        'x-goog-api-key': apiKeyToUse
      } : undefined
    });

    try {
      const completion = await openai.chat.completions.create({
        model: payload.model,
        messages: payload.messages as any,
        tools: payload.tools as any,
        temperature: payload.temperature,
        stream: false
      }, {
        signal: signal as any
      });

      const data = completion;
      const choice = data.choices[0];
      const msg = choice.message || {};

      // 提取文本内容
      let textContent = msg.content || "";
      
      // 提取工具调用
      let functionCalls: any[] | undefined = undefined;
      
      // JSON Schema 模式：从文本中解析工具调用
      if (useJsonSchema && textContent) {
        const parsed = parseJsonSchemaToolCalls(textContent);
        textContent = parsed.text;
        if (parsed.functionCalls.length > 0) {
          functionCalls = parsed.functionCalls;
          console.log('✅ [JSON Schema] 回退模式从文本中解析到', functionCalls.length, '个工具调用');
        }
      }
      
      // Function Calling 模式：从 API 响应中提取工具调用
      if (!useJsonSchema) {
        functionCalls = normalizeFunctionCalls(
          msg.tool_calls?.map((tc: any) => ({
            name: tc.function?.name,
            args: safeParseArgs(tc.function?.arguments),
            id: tc.id
          }))
        );
      }

      return {
        text: textContent || "",
        functionCalls: functionCalls
      };
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      const statusCode = error.status || error.response?.status;
      
      if (statusCode === 400) {
        throw new Error(`API Error (400): ${errorMessage}`);
      } else if (statusCode === 429) {
        throw new Error(`API Error (429): 速率限制错误 - ${errorMessage}`);
      } else {
        throw new Error(`API Error (${statusCode || 'Unknown'}): ${errorMessage}`);
      }
     }
  }
}
