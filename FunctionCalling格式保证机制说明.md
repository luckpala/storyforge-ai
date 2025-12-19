# Function Calling 格式保证机制说明

## 📋 当前保证机制

### 1. **工具定义的 Schema 验证**

#### 位置：`services/geminiTools.ts`

**工作原理：**
- 使用 Google GenAI 的 `FunctionDeclaration` 定义工具
- 每个工具都有明确的参数类型和必需字段
- API 会根据 Schema 自动验证参数格式

**示例：`update_storyboard` 工具**
```typescript
{
  name: 'update_storyboard',
  parameters: {
    type: Type.OBJECT,
    properties: {
      chapterNumber: { type: Type.NUMBER, description: '...' },
      chapterTitle: { type: Type.STRING, description: '...' },
      chapter_content: { type: Type.STRING, description: '...' },
      // ...
    },
    required: ['chapterNumber', 'chapterTitle', 'chapter_content', 'chapter_outline']
  }
}
```

**优势：**
- ✅ API 层面自动验证类型
- ✅ 强制必需参数
- ✅ 清晰的参数描述帮助 AI 理解

**局限：**
- ⚠️ 不能验证内容质量（如章节标题是否有意义）
- ⚠️ 不能验证复杂格式（如故事圣经的结构）

---

### 2. **参数解析和类型转换**

#### 位置：`services/llmAdapter.ts`

**工作流程：**

**步骤1：安全解析 JSON**
```typescript
const safeParseArgs = (args: any): any => {
  // 1. 如果已经是对象，直接返回
  // 2. 如果是字符串，尝试解析 JSON
  // 3. 自动清洗 Markdown 标记（```json ... ```）
  // 4. 尝试修复常见 JSON 错误（缺少括号、尾随逗号等）
}
```

**步骤2：特殊参数类型转换**
```typescript
// 特别处理 update_storyboard 工具
if (tc.function.name === 'update_storyboard' && args) {
  // 确保 chapter_content 和 chapter_outline 是字符串
  if (typeof args.chapter_content !== 'string') {
    args.chapter_content = String(args.chapter_content);
  }
  // ...
}
```

**优势：**
- ✅ 自动修复常见格式错误
- ✅ 类型安全转换
- ✅ 防御性编程

---

### 3. **参数验证和错误处理**

#### 位置：`App.tsx` 工具执行逻辑

**当前验证机制：**

```typescript
// 示例：update_storyboard 工具验证
else if (call.name === 'update_storyboard') {
  try {
    const { 
      chapterNumber, 
      chapterTitle, 
      chapter_content, 
      chapter_outline,
      updated_story_bible,
      // ...
    } = call.args as any;
    
    // 基础验证
    if (!chapterNumber || !chapterTitle || !chapter_content || !chapter_outline) {
      toolResult = { 
        success: false, 
        message: "缺少必需参数：chapterNumber, chapterTitle, chapter_content, chapter_outline" 
      };
      return;
    }
    
    // 执行更新...
  } catch (e: any) {
    toolResult = { success: false, message: `Error: ${e.message}` };
  }
}
```

**当前问题：**
- ⚠️ 验证不够严格（只检查存在性，不检查格式）
- ⚠️ 错误信息不够详细
- ⚠️ 没有格式标准化处理

---

## 🔧 不同功能场景的格式要求

### 场景1：生成章节正文

**工具：** `update_storyboard`

**必需参数：**
1. `chapterNumber` (NUMBER) - 章节编号
2. `chapterTitle` (STRING) - **必须是描述性标题，不能只是"第X章"**
3. `chapter_content` (STRING) - 完整正文内容
4. `chapter_outline` (STRING) - 详细章纲（500-1500字）

**推荐参数（生成时）：**
5. `updated_story_bible` (OBJECT) - 故事圣经更新
   - `character_status` (STRING) - 格式：`[角色名]：[状态/位置/关键变化]`
   - `key_items_and_locations` (STRING) - 物品与地点
   - `active_plot_threads` (STRING) - 未解决的伏笔
   - `important_rules` (STRING) - 临时规则/备注

**格式要求：**
- ✅ 章节标题必须是描述性的（如"初入江湖"、"命运的转折"）
- ✅ 章纲必须包含：剧情任务、情节细节、角色关系变化、伏笔悬念、情绪曲线、关键信息点
- ✅ 故事圣经必须遵循指定格式

---

### 场景2：提炼信息（从正文提取）

**工具组合：**
- `add_chapter` - 更新章纲
- `add_character` - 添加角色
- `add_world_entry` - 添加世界观设定
- `add_writing_guideline` - 添加写作指导

**格式要求：**
- ✅ 章纲必须有 `number`, `title`, `summary`（必需）
- ✅ 角色必须有 `name`, `role`, `description`（必需）
- ✅ 世界观设定必须有 `category`, `name`, `description`（必需）
- ✅ 写作指导必须有 `category`, `content`（必需）

---

### 场景3：更新故事蓝图

**工具：** `update_structure`

**格式要求：**
- ✅ `beat` 必须是枚举值：`hook`, `incitingIncident`, `risingAction`, `climax`, `fallingAction`, `resolution`
- ✅ `content` 必须是字符串

---

## 🎯 改进方案

### 方案1：增强参数验证函数

**创建统一的验证工具：**

```typescript
// services/toolValidators.ts

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  normalized?: any;
}

export const validateUpdateStoryboardArgs = (args: any): ValidationResult => {
  const errors: string[] = [];
  
  // 1. 必需参数检查
  if (!args.chapterNumber || typeof args.chapterNumber !== 'number') {
    errors.push('chapterNumber 必须是数字');
  }
  
  if (!args.chapterTitle || typeof args.chapterTitle !== 'string') {
    errors.push('chapterTitle 必须是字符串');
  } else {
    // 验证标题格式（不能只是"第X章"）
    if (/^第\d+章$/i.test(args.chapterTitle.trim())) {
      errors.push('chapterTitle 不能只是"第X章"，必须是描述性标题');
    }
  }
  
  if (!args.chapter_content || typeof args.chapter_content !== 'string') {
    errors.push('chapter_content 必须是字符串');
  } else if (args.chapter_content.length < 100) {
    errors.push('chapter_content 太短（至少100字符）');
  }
  
  if (!args.chapter_outline || typeof args.chapter_outline !== 'string') {
    errors.push('chapter_outline 必须是字符串');
  } else {
    const outlineLength = args.chapter_outline.length;
    if (outlineLength < 500) {
      errors.push(`chapter_outline 太短（当前${outlineLength}字，至少500字）`);
    } else if (outlineLength > 3000) {
      errors.push(`chapter_outline 太长（当前${outlineLength}字，建议不超过1500字）`);
    }
  }
  
  // 2. 故事圣经格式验证（如果提供）
  if (args.updated_story_bible) {
    const bible = args.updated_story_bible;
    
    if (!bible.character_status || typeof bible.character_status !== 'string') {
      errors.push('updated_story_bible.character_status 必须是字符串');
    }
    
    if (!bible.key_items_and_locations || typeof bible.key_items_and_locations !== 'string') {
      errors.push('updated_story_bible.key_items_and_locations 必须是字符串');
    }
    
    if (!bible.active_plot_threads || typeof bible.active_plot_threads !== 'string') {
      errors.push('updated_story_bible.active_plot_threads 必须是字符串');
    }
    
    // 格式验证：角色状态应该包含冒号分隔的格式
    if (bible.character_status && !/:/.test(bible.character_status)) {
      errors.push('character_status 格式不正确，应为"[角色名]：[状态]"格式');
    }
  }
  
  // 3. 类型转换和标准化
  const normalized = {
    ...args,
    chapterNumber: Number(args.chapterNumber),
    chapterTitle: String(args.chapterTitle).trim(),
    chapter_content: String(args.chapter_content),
    chapter_outline: String(args.chapter_outline),
    // ... 其他字段标准化
  };
  
  return {
    isValid: errors.length === 0,
    errors,
    normalized: errors.length === 0 ? normalized : undefined
  };
};
```

**使用方式：**

```typescript
// App.tsx 中
else if (call.name === 'update_storyboard') {
  const validation = validateUpdateStoryboardArgs(call.args);
  
  if (!validation.isValid) {
    toolResult = { 
      success: false, 
      message: `参数验证失败：\n${validation.errors.join('\n')}` 
    };
    return;
  }
  
  // 使用标准化后的参数
  const args = validation.normalized;
  // ... 执行更新
}
```

---

### 方案2：增强工具定义描述

**改进工具描述，添加格式示例：**

```typescript
// services/geminiTools.ts

chapterTitle: { 
  type: Type.STRING, 
  description: `🚨 REQUIRED: The chapter title. You MUST provide a meaningful, descriptive title based on the chapter content.

**Format Requirements:**
- ✅ GOOD: "初入江湖", "命运的转折", "最后的决战"
- ❌ BAD: "第1章", "第2章", "Chapter 1"

**Extraction Rules:**
1. Extract the main theme or key event from the chapter content
2. Use 2-8 Chinese characters
3. Should reflect the emotional core or narrative function
4. Must NOT be just "第X章"

**Examples:**
- Chapter about first adventure: "初入江湖"
- Chapter about betrayal: "背叛的代价"
- Chapter about discovery: "隐藏的真相"`
}
```

---

### 方案3：场景特定的提示词增强

**为不同功能场景添加专门的格式说明：**

```typescript
// App.tsx - 生成章节正文时的提示词

const getChapterGenerationPrompt = (chapter: Chapter) => {
  return `
**🚨 update_storyboard 工具调用格式要求：**

1. **chapterTitle（章节标题）**：
   - 必须是有意义的描述性标题
   - ✅ 正确示例："初入江湖"、"命运的转折"、"最后的决战"
   - ❌ 错误示例："第1章"、"第2章"、"Chapter 1"
   - 从正文内容中提取主要主题或关键事件

2. **chapter_outline（详细章纲）**：
   - 字数要求：500-1500字
   - 必须包含：
     * 剧情任务（本章要完成什么）
     * 情节细节（发生了什么）
     * 角色关系变化（角色间关系如何发展）
     * 伏笔悬念（埋下了什么伏笔）
     * 情绪曲线（情绪如何起伏）
     * 关键信息点（揭示了什么重要信息）

3. **updated_story_bible（故事圣经，生成时必需）**：
   - character_status 格式：[角色名]：[状态/位置/关键变化]
   - 示例："陆志星：重伤，在青云门养伤。赵四：第10章已死亡。"
   - 必须明确标记"已死"的角色（格式：角色名：第X章已死亡）
   - 只保留主角、反派和当前活跃的配角
`;
};
```

---

### 方案4：后处理验证和修复

**在工具执行后验证结果：**

```typescript
// App.tsx 中

// 执行工具后验证结果
if (call.name === 'update_storyboard' && toolResult.success) {
  // 验证保存的内容
  const savedChapter = activeSession.story.outline.find(
    ch => ch.number === args.chapterNumber
  );
  
  if (savedChapter) {
    const issues: string[] = [];
    
    // 验证标题格式
    if (/^第\d+章$/i.test(savedChapter.title)) {
      issues.push('⚠️ 章节标题只是"第X章"格式，建议改为描述性标题');
    }
    
    // 验证章纲长度
    const outline = savedChapter.summaryDetailed || savedChapter.summary;
    if (outline.length < 500) {
      issues.push(`⚠️ 章纲太短（${outline.length}字），建议至少500字`);
    }
    
    if (issues.length > 0) {
      // 发送警告消息给用户
      const warningMsg: Message = {
        id: uuidv4(),
        role: 'model',
        text: `⚠️ 章节已保存，但有以下格式问题：\n${issues.join('\n')}`,
        isToolCall: false
      };
      // ... 添加到消息列表
    }
  }
}
```

---

## 📊 实施优先级

### 高优先级（立即实施）

1. ✅ **增强参数验证函数** - 确保必需参数存在且类型正确
2. ✅ **改进工具定义描述** - 添加格式示例和反例
3. ✅ **场景特定的提示词** - 在生成章节时强调格式要求

### 中优先级（后续优化）

4. ⚠️ **后处理验证** - 保存后验证内容质量
5. ⚠️ **自动修复机制** - 尝试自动修复常见格式问题

### 低优先级（可选）

6. 🔄 **格式模板** - 为复杂参数提供模板
7. 🔄 **交互式验证** - 验证失败时询问用户是否继续

---

## 🎯 不同功能的保证策略

### 1. **生成章节正文**

**策略：**
- 在提示词中明确要求章节标题格式
- 验证 `chapterTitle` 不匹配 "第X章" 模式
- 验证 `chapter_outline` 长度（500-1500字）
- 验证 `updated_story_bible` 结构

**实现位置：**
- `App.tsx` - `getPromptContext()` 中的系统提示词
- `components/StoryBoard.tsx` - 生成正文的提示词
- `App.tsx` - 工具执行时的参数验证

---

### 2. **提炼信息**

**策略：**
- 确保每个工具调用都有必需参数
- 验证参数类型
- 防止重复添加相同信息

**实现位置：**
- `components/StoryBoard.tsx` - `getExtractInfoSystemInstruction()`
- `App.tsx` - 提炼信息工具执行逻辑

---

### 3. **更新故事蓝图**

**策略：**
- 验证 `beat` 参数是有效枚举值
- 验证 `content` 是字符串且不为空

**实现位置：**
- `App.tsx` - `update_structure` 工具执行逻辑

---

## 🔍 监控和调试

### 日志记录

当前已有日志记录：
- ✅ 工具调用参数（`console.log`）
- ✅ 参数类型转换（`console.warn`）
- ✅ JSON 解析错误（`console.error`）

**建议增强：**
- 记录格式验证失败的详细信息
- 记录常见格式问题的统计

### 用户反馈

当前机制：
- ⚠️ 工具执行失败时返回错误消息
- ⚠️ 检测到文本中的工具调用时显示警告

**建议增强：**
- 格式验证失败时提供具体修复建议
- 保存成功后验证内容质量并提示

---

## ✅ 总结

**当前保证机制：**
1. ✅ Schema 验证（API 层面）
2. ✅ 参数解析和类型转换
3. ✅ 基础参数验证

**需要改进的地方：**
1. ⚠️ 增强格式验证（标题格式、章纲长度等）
2. ⚠️ 改进错误消息（更详细的提示）
3. ⚠️ 场景特定的提示词（不同功能强调不同格式）
4. ⚠️ 后处理验证（保存后检查内容质量）

**实施建议：**
1. 首先实现参数验证函数（方案1）
2. 改进工具定义描述（方案2）
3. 增强场景特定提示词（方案3）
4. 最后考虑后处理验证（方案4）















