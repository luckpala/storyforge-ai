/**
 * 工具参数验证函数
 * 确保AI通过Function Calling返回的参数符合格式要求
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  normalized?: any;
}

/**
 * 验证 update_storyboard 工具的参数
 */
export const validateUpdateStoryboardArgs = (args: any): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // 1. 必需参数检查
  if (!args.chapterNumber) {
    errors.push('缺少必需参数：chapterNumber（章节编号）');
  } else if (typeof args.chapterNumber !== 'number') {
    const numValue = Number(args.chapterNumber);
    if (isNaN(numValue)) {
      errors.push('chapterNumber 必须是数字');
    } else {
      args.chapterNumber = numValue; // 自动转换
    }
  }
  
  if (!args.chapterTitle) {
    errors.push('缺少必需参数：chapterTitle（章节标题）');
  } else if (typeof args.chapterTitle !== 'string') {
    args.chapterTitle = String(args.chapterTitle).trim(); // 自动转换
  } else {
    args.chapterTitle = args.chapterTitle.trim();
    
    // 验证标题格式（不能只是"第X章"）
    const trimmedTitle = args.chapterTitle.trim();
    if (/^第\d+章$/i.test(trimmedTitle)) {
      errors.push('chapterTitle 不能只是"第X章"，必须是描述性标题（如"初入江湖"、"命运的转折"）');
    } else if (trimmedTitle.length < 2) {
      errors.push('chapterTitle 太短，至少需要2个字符');
    } else if (trimmedTitle.length > 30) {
      warnings.push('chapterTitle 较长（超过30字符），建议使用更简洁的标题');
    }
  }
  
  if (!args.chapter_content) {
    errors.push('缺少必需参数：chapter_content（章节正文内容）');
  } else if (typeof args.chapter_content !== 'string') {
    args.chapter_content = String(args.chapter_content); // 自动转换
  } else {
    const contentLength = args.chapter_content.length;
    if (contentLength < 100) {
      errors.push(`chapter_content 太短（当前${contentLength}字符），至少需要100字符`);
    } else if (contentLength < 500) {
      warnings.push(`chapter_content 较短（当前${contentLength}字符），建议至少500字符`);
    }
  }
  
  if (!args.chapter_outline) {
    errors.push('缺少必需参数：chapter_outline（详细章纲）');
  } else if (typeof args.chapter_outline !== 'string') {
    args.chapter_outline = String(args.chapter_outline); // 自动转换
  } else {
    const outlineLength = args.chapter_outline.length;
    if (outlineLength < 500) {
      errors.push(`chapter_outline 太短（当前${outlineLength}字），至少需要500字`);
    } else if (outlineLength < 800) {
      warnings.push(`chapter_outline 稍短（当前${outlineLength}字），建议至少800字`);
    } else if (outlineLength > 3000) {
      warnings.push(`chapter_outline 较长（当前${outlineLength}字），建议控制在1500字以内`);
    }
    
    // 检查章纲是否包含必要内容
    const outline = args.chapter_outline.toLowerCase();
    const hasKeyElements = 
      (outline.includes('剧情') || outline.includes('情节') || outline.includes('事件')) &&
      (outline.includes('角色') || outline.includes('人物') || outline.includes('人物关系')) &&
      (outline.includes('伏笔') || outline.includes('悬念') || outline.includes('线索'));
    
    if (!hasKeyElements) {
      warnings.push('chapter_outline 建议包含：剧情任务、角色关系变化、伏笔悬念等要素');
    }
  }
  
  // 2. 故事圣经格式验证（如果提供）
  if (args.updated_story_bible) {
    const bible = args.updated_story_bible;
    
    if (typeof bible !== 'object' || bible === null) {
      errors.push('updated_story_bible 必须是对象');
    } else {
      // 自动转换 character_status：支持数组/对象格式，自动转换为字符串
      if (bible.character_status) {
        if (Array.isArray(bible.character_status)) {
          // 处理对象数组：转换为 "角色名: 状态" 格式
          bible.character_status = bible.character_status.map((item: any) => {
            if (typeof item === 'string') return item;
            // 如果是对象，提取 name 和 status 字段
            if (typeof item === 'object' && item !== null) {
              const name = item.name || item.character || item.角色名 || '未知';
              const status = item.status || item.state || item.状态 || item.description || '';
              return `${name}: ${status}`;
            }
            return String(item);
          }).join('\n');
        } else if (typeof bible.character_status === 'object') {
          bible.character_status = Object.entries(bible.character_status)
            .map(([key, value]: [string, any]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
            .join('\n');
        } else if (typeof bible.character_status !== 'string') {
          bible.character_status = String(bible.character_status);
        }
        // 格式验证：角色状态应该包含冒号分隔的格式
        const statusLines = bible.character_status.split('\n').filter(line => line.trim());
        if (statusLines.length > 0 && !statusLines.some(line => /:/.test(line))) {
          warnings.push('character_status 建议使用"[角色名]：[状态]"格式');
        }
      } else {
        errors.push('updated_story_bible.character_status 是必需的');
      }
      
      // 自动转换 key_items_and_locations：支持数组/对象格式，自动转换为字符串
      // 如果不存在，提供默认空字符串（允许为空，因为某些章节可能不涉及物品和地点变化）
      if (bible.key_items_and_locations) {
        if (Array.isArray(bible.key_items_and_locations)) {
          bible.key_items_and_locations = bible.key_items_and_locations.map((item: any) => {
            if (typeof item === 'string') return item;
            return `${item.name || '未知'}: ${item.status || item.description || ''}`;
          }).join('\n');
        } else if (typeof bible.key_items_and_locations === 'object') {
          bible.key_items_and_locations = Object.entries(bible.key_items_and_locations)
            .map(([key, value]: [string, any]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
            .join('\n');
        } else if (typeof bible.key_items_and_locations !== 'string') {
          bible.key_items_and_locations = String(bible.key_items_and_locations);
        }
      } else {
        // 如果不存在，提供默认空字符串（允许为空）
        bible.key_items_and_locations = '';
        warnings.push('updated_story_bible.key_items_and_locations 未提供，已设置为空字符串（如果本章不涉及物品和地点变化，这是允许的）');
      }
      
      // 自动转换 active_plot_threads：支持数组/对象格式，自动转换为字符串
      // 如果不存在，提供默认空字符串（允许为空，因为某些章节可能不涉及新的伏笔）
      if (bible.active_plot_threads) {
        if (Array.isArray(bible.active_plot_threads)) {
          bible.active_plot_threads = bible.active_plot_threads.map((thread: any) => {
            if (typeof thread === 'string') return thread;
            return `${thread.name || '未知'}: ${thread.description || ''}`;
          }).join('\n');
        } else if (typeof bible.active_plot_threads === 'object') {
          bible.active_plot_threads = Object.entries(bible.active_plot_threads)
            .map(([key, value]: [string, any]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
            .join('\n');
        } else if (typeof bible.active_plot_threads !== 'string') {
          bible.active_plot_threads = String(bible.active_plot_threads);
        }
      } else {
        // 如果不存在，提供默认空字符串（允许为空）
        bible.active_plot_threads = '';
        warnings.push('updated_story_bible.active_plot_threads 未提供，已设置为空字符串（如果本章不涉及新的伏笔，这是允许的）');
      }
      
      // important_rules 是可选的，自动转换
      if (bible.important_rules) {
        if (Array.isArray(bible.important_rules)) {
          bible.important_rules = bible.important_rules.join('\n');
        } else if (typeof bible.important_rules === 'object') {
          bible.important_rules = Object.entries(bible.important_rules)
            .map(([key, value]: [string, any]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
            .join('\n');
        } else if (typeof bible.important_rules !== 'string') {
          bible.important_rules = String(bible.important_rules);
        }
      }
    }
  } else {
    // 生成章节时，故事圣经是推荐的
    warnings.push('建议提供 updated_story_bible 参数以保持故事一致性');
  }
  
  // 3. 可选参数类型转换
  if (args.volumeNumber !== undefined && args.volumeNumber !== null) {
    if (typeof args.volumeNumber !== 'number') {
      const numValue = Number(args.volumeNumber);
      if (isNaN(numValue)) {
        warnings.push('volumeNumber 格式不正确，已忽略');
        delete args.volumeNumber;
      } else {
        args.volumeNumber = numValue;
      }
    }
  }
  
  if (args.createNewVersion !== undefined && typeof args.createNewVersion !== 'boolean') {
    args.createNewVersion = Boolean(args.createNewVersion);
  }
  
  // 4. 类型转换和标准化
  const normalized = {
    ...args,
    chapterNumber: Number(args.chapterNumber),
    chapterTitle: String(args.chapterTitle || '').trim(),
    chapter_content: String(args.chapter_content || ''),
    chapter_outline: String(args.chapter_outline || ''),
  };
  
  // 保留其他字段
  if (args.volumeNumber !== undefined) normalized.volumeNumber = args.volumeNumber;
  if (args.createNewVersion !== undefined) normalized.createNewVersion = Boolean(args.createNewVersion);
  if (args.versionName) normalized.versionName = String(args.versionName);
  if (args.updated_story_bible) normalized.updated_story_bible = args.updated_story_bible;
  if (args.characters) normalized.characters = args.characters;
  if (args.worldEntries) normalized.worldEntries = args.worldEntries;
  if (args.writingGuidelines) normalized.writingGuidelines = args.writingGuidelines;
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    normalized: errors.length === 0 ? normalized : undefined
  };
};

/**
 * 验证 add_chapter 工具的参数
 */
export const validateAddChapterArgs = (args: any): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!args.number) {
    errors.push('缺少必需参数：number（章节编号）');
  } else if (typeof args.number !== 'number') {
    const numValue = Number(args.number);
    if (isNaN(numValue)) {
      errors.push('number 必须是数字');
    } else {
      args.number = numValue;
    }
  }
  
  if (!args.title) {
    errors.push('缺少必需参数：title（章节标题）');
  } else if (typeof args.title !== 'string') {
    args.title = String(args.title).trim();
  } else {
    args.title = args.title.trim();
    if (args.title.length < 2) {
      errors.push('title 太短，至少需要2个字符');
    }
  }
  
  if (!args.summary) {
    errors.push('缺少必需参数：summary（章节概要）');
  } else if (typeof args.summary !== 'string') {
    args.summary = String(args.summary);
  } else {
    if (args.summary.length < 50) {
      warnings.push('summary 较短，建议至少50字');
    }
  }
  
  if (args.summaryDetailed && typeof args.summaryDetailed !== 'string') {
    args.summaryDetailed = String(args.summaryDetailed);
  }
  
  if (args.volumeNumber !== undefined && args.volumeNumber !== null) {
    if (typeof args.volumeNumber !== 'number') {
      const numValue = Number(args.volumeNumber);
      if (!isNaN(numValue)) {
        args.volumeNumber = numValue;
      }
    }
  }
  
  const normalized = {
    number: Number(args.number),
    title: String(args.title || '').trim(),
    summary: String(args.summary || ''),
    ...(args.summaryDetailed && { summaryDetailed: String(args.summaryDetailed) }),
    ...(args.volumeNumber !== undefined && { volumeNumber: Number(args.volumeNumber) })
  };
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    normalized: errors.length === 0 ? normalized : undefined
  };
};

/**
 * 验证 add_character 工具的参数
 */
export const validateAddCharacterArgs = (args: any): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!args.name) {
    errors.push('缺少必需参数：name（角色名称）');
  } else if (typeof args.name !== 'string') {
    args.name = String(args.name).trim();
  } else {
    args.name = args.name.trim();
    if (args.name.length < 1) {
      errors.push('name 不能为空');
    }
  }
  
  if (!args.role) {
    errors.push('缺少必需参数：role（角色定位）');
  } else if (typeof args.role !== 'string') {
    args.role = String(args.role).trim();
  } else {
    args.role = args.role.trim();
  }
  
  if (!args.description) {
    errors.push('缺少必需参数：description（角色描述）');
  } else if (typeof args.description !== 'string') {
    args.description = String(args.description);
  } else {
    if (args.description.length < 50) {
      warnings.push('description 较短，建议至少50字以提供充分的角色信息');
    }
  }
  
  if (args.tags && !Array.isArray(args.tags)) {
    if (typeof args.tags === 'string') {
      args.tags = args.tags.split(',').map(t => t.trim()).filter(t => t);
    } else {
      args.tags = [];
    }
  }
  
  const normalized = {
    name: String(args.name || '').trim(),
    role: String(args.role || '').trim(),
    description: String(args.description || ''),
    ...(args.tags && { tags: Array.isArray(args.tags) ? args.tags : [] }),
    ...(args.behaviorExamples && { behaviorExamples: args.behaviorExamples })
  };
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    normalized: errors.length === 0 ? normalized : undefined
  };
};

/**
 * 验证 add_world_entry 工具的参数
 */
export const validateAddWorldEntryArgs = (args: any): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!args.category) {
    errors.push('缺少必需参数：category（世界观分类）');
  } else if (typeof args.category !== 'string') {
    args.category = String(args.category).trim();
  } else {
    args.category = args.category.trim();
  }
  
  if (!args.name) {
    errors.push('缺少必需参数：name（世界观条目名称）');
  } else if (typeof args.name !== 'string') {
    args.name = String(args.name).trim();
  } else {
    args.name = args.name.trim();
  }
  
  if (!args.description) {
    errors.push('缺少必需参数：description（世界观描述）');
  } else if (typeof args.description !== 'string') {
    args.description = String(args.description);
  } else {
    if (args.description.length < 50) {
      warnings.push('description 较短，建议至少50字以提供充分的世界观信息');
    }
  }
  
  const normalized = {
    category: String(args.category || '').trim(),
    name: String(args.name || '').trim(),
    description: String(args.description || '')
  };
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    normalized: errors.length === 0 ? normalized : undefined
  };
};

/**
 * 验证 add_writing_guideline 工具的参数
 */
export const validateAddWritingGuidelineArgs = (args: any): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!args.category) {
    errors.push('缺少必需参数：category（写作指导分类）');
  } else if (typeof args.category !== 'string') {
    args.category = String(args.category).trim();
  } else {
    args.category = args.category.trim();
  }
  
  if (!args.content) {
    errors.push('缺少必需参数：content（写作指导内容）');
  } else if (typeof args.content !== 'string') {
    args.content = String(args.content);
  } else {
    if (args.content.length < 20) {
      warnings.push('content 较短，建议至少20字以提供充分的指导信息');
    }
  }
  
  const normalized = {
    category: String(args.category || '').trim(),
    content: String(args.content || ''),
    ...(args.isActive !== undefined && { isActive: Boolean(args.isActive) })
  };
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    normalized: errors.length === 0 ? normalized : undefined
  };
};






