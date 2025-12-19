
import { FunctionDeclaration, Type } from '@google/genai';

export const updateTitleSynopsisTool: FunctionDeclaration = {
  name: 'update_title_synopsis',
  description: 'Update the story title and main synopsis.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: 'The title of the story.' },
      synopsis: { type: Type.STRING, description: 'A brief summary of the story concept.' },
    },
    required: ['title', 'synopsis'],
  },
};

export const archiveBlueprintTool: FunctionDeclaration = {
  name: 'archive_blueprint',
  description: 'Save the current story structure as a historical version before making major changes.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      versionName: { type: Type.STRING, description: 'Name for this version (e.g., "V1 Original Idea", "Pre-Revision").' },
    },
    required: ['versionName'],
  },
};

export const updateStructureTool: FunctionDeclaration = {
  name: 'update_structure',
  description: 'Update specific beat of the ACTIVE story structure blueprint.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      beat: { 
        type: Type.STRING, 
        enum: ['hook', 'incitingIncident', 'risingAction', 'climax', 'fallingAction', 'resolution'],
        description: 'The specific plot beat to update.'
      },
      content: { type: Type.STRING, description: 'The description of what happens in this beat.' },
    },
    required: ['beat', 'content'],
  },
};

export const manageVolumeTool: FunctionDeclaration = {
  name: 'manage_volume',
  description: 'Create or update a Volume (Book/Arc) in the story. **MUST be called whenever AI creates or updates volume outlines** - this is the ONLY way to save volume information to the story board.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      number: { type: Type.NUMBER, description: 'Volume number (1, 2, etc).' },
      title: { type: Type.STRING, description: 'Title of the volume.' },
      summary: { type: Type.STRING, description: 'High-level summary of this volume/arc.' },
    },
    required: ['number', 'title', 'summary'],
  },
};

export const addChapterTool: FunctionDeclaration = {
  name: 'add_chapter',
  description: 'Add a chapter to the outline. Use "ChX" format in title if possible.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      volumeNumber: { type: Type.NUMBER, description: 'The Volume number this chapter belongs to (optional, defaults to latest).' },
      number: { type: Type.NUMBER, description: 'Chapter number (integer).' },
      title: { type: Type.STRING, description: 'Chapter title (e.g., "Ch1: The Beginning").' },
      summary: { type: Type.STRING, description: 'Summary of events in the chapter (concise version).' },
      summaryDetailed: { type: Type.STRING, description: 'Detailed summary of events in the chapter (optional, for detailed version).' },
    },
    required: ['number', 'title', 'summary'],
  },
};

// 新的复合工具：同时保存正文和章纲，并可选择性更新故事板的其他信息（推荐用于生成章节）
export const updateStoryboardTool: FunctionDeclaration = {
  name: 'update_storyboard',
  description: '🚨🚨🚨 **CRITICAL TOOL - MUST BE CALLED WHEN GENERATING CHAPTER CONTENT**: This is a backend writing engine function. **DO NOT output story content in chat messages. YOU MUST use this function to submit generated chapter content and outline.** When user asks you to write a chapter, you MUST: 1) Generate the chapter content (do NOT output it in chat), 2) Extract or create a meaningful chapter title from the content (NOT just "第X章", but a descriptive title like "初入江湖" or "命运的转折"), 3) Generate a detailed chapter outline based on the content, 4) **Update the story bible (updated_story_bible parameter) based on what happened in this chapter** - this is REQUIRED to maintain story consistency, 5) IMMEDIATELY call this function with chapterNumber, chapterTitle (REQUIRED), chapter_content, chapter_outline, and updated_story_bible (REQUIRED when generating chapters). This is the ONLY way to save content to the story board. **CRITICAL: You MUST actually call this function using Function Calling API, NOT just write text - those are just words and will NOT save anything!**\n\n**Additionally, this tool can update other storyboard information in one call**: title, synopsis, characters, world settings, writing guidelines, etc. If you generate or update any of these during chapter creation, include them in the same call.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      // 章节相关（必需）
      chapterNumber: { type: Type.NUMBER, description: 'The chapter number to update.' },
      volumeNumber: { type: Type.NUMBER, description: 'Optional: The volume number this chapter belongs to. Use this when chapters from different volumes have the same number.' },
      chapterTitle: { 
        type: Type.STRING, 
        description: `🚨 REQUIRED: The chapter title. You MUST provide a meaningful, descriptive title based on the chapter content.

**Format Requirements:**
- ✅ CORRECT Examples: "初入江湖", "命运的转折", "最后的决战", "背叛的代价", "隐藏的真相"
- ❌ WRONG Examples: "第1章", "第2章", "Chapter 1", "第一章"

**Rules:**
1. Extract the main theme or key event from the chapter content
2. Use 2-8 Chinese characters (or equivalent length in other languages)
3. Should reflect the emotional core or narrative function of the chapter
4. Must NOT be just "第X章" format
5. Title should be descriptive and meaningful, not just a number

**Extraction Method:**
- Read through your generated chapter content
- Identify the main event, theme, or turning point
- Create a title that captures this essence
- Examples: Chapter about first adventure → "初入江湖", Chapter about betrayal → "背叛的代价"` 
      },
      chapter_content: { type: Type.STRING, description: 'The full body text of the chapter that you just generated. This is where you put the complete chapter manuscript - DO NOT output this in the chat message, put it here as a parameter.' },
      chapter_outline: { 
        type: Type.STRING, 
        description: `A detailed chapter outline/summary extracted from the chapter_content. This is REQUIRED.

**Length Requirement:**
- Minimum: 500 characters/words
- Recommended: 800-1500 characters/words
- Maximum: 3000 characters/words (if exceeds, summarize)

**Required Elements to Include:**
1. **剧情任务 (Plot Task)**: What is the main goal or mission in this chapter?
2. **情节细节 (Plot Details)**: What specific events happen? What are the key scenes?
3. **角色关系变化 (Character Relationship Changes)**: How do relationships between characters evolve?
4. **伏笔悬念 (Foreshadowing/Suspense)**: What mysteries or hints are planted for future chapters?
5. **情绪曲线 (Emotional Arc)**: How does the emotional tone change throughout the chapter?
6. **关键信息点 (Key Information Revealed)**: What important information is disclosed to the reader/characters?

**Format:**
- Write in clear, structured paragraphs
- Use bullet points or numbered lists if helpful
- Focus on narrative progression and character development
- Connect to previous chapters and set up future developments

**Example Structure:**
"本章主要讲述了... [剧情任务]
关键事件包括... [情节细节]
角色关系方面... [角色关系变化]
埋下的伏笔有... [伏笔悬念]
情绪从...到... [情绪曲线]
揭示了... [关键信息点]"`
      },
      createNewVersion: { type: Type.BOOLEAN, description: 'MUST be true when user asks for "another version", "rewrite", "new version", or "different version". If true, creates a new version instead of overwriting the existing one. If false or omitted, updates the current active version.' },
      versionName: { type: Type.STRING, description: 'Name for the new version (e.g., "AI Revision", "Expanded Scene", "Version 2"). Only used when createNewVersion is true.' },
      
      // 故事基本信息（可选）
      title: { type: Type.STRING, description: 'Optional: Update the story title. Only include if you are setting or updating the title.' },
      synopsis: { type: Type.STRING, description: 'Optional: Update the story synopsis/summary. Only include if you are setting or updating the synopsis.' },
      alternativeTitles: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Optional: Alternative titles for the story. Only include if you are setting or updating alternative titles.' },
      
      // 角色（可选）
      characters: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: 'Character name.' },
            role: { type: Type.STRING, description: 'Character role (e.g., "Protagonist", "Antagonist", "Support").' },
            tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Character traits/tags (e.g., ["Brave", "Cynical"]).' },
            description: { type: Type.STRING, description: 'Character description (physical and personality).' },
            behaviorExamples: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  context: { type: Type.STRING, description: 'The situation (e.g., "Betrayed by a friend").' },
                  response: { type: Type.STRING, description: 'How the character acts or speaks in this context.' }
                },
                required: ['context', 'response']
              },
              description: 'Optional: Situational behavior examples.'
            }
          },
          required: ['name', 'role', 'description']
        },
        description: 'Optional: Add or update characters. If a character with the same name exists, it will be updated; otherwise, a new character will be added.'
      },
      
      // 世界观设定（可选）
      worldEntries: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING, description: 'Category (e.g., "Magic", "Factions", "Locations").' },
            name: { type: Type.STRING, description: 'Name of the world entry.' },
            description: { type: Type.STRING, description: 'Detailed description of the world entry.' }
          },
          required: ['category', 'name', 'description']
        },
        description: 'Optional: Add or update world building entries. If an entry with the same category and name exists, it will be updated; otherwise, a new entry will be added.'
      },
      
      // 写作指导（可选）
      writingGuidelines: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING, description: 'Category (e.g., "Style", "Dialogue", "Pacing", "Do Not Use").' },
            content: { type: Type.STRING, description: 'The specific rule or advice to follow in future generation.' },
            isActive: { type: Type.BOOLEAN, description: 'Whether this guideline is active (default: true).' }
          },
          required: ['category', 'content']
        },
        description: 'Optional: Add or update writing guidelines. New guidelines will be added to the list.'
      },
      
      // 故事圣经（生成章节时必需！）
      updated_story_bible: {
        type: Type.OBJECT,
        description: '🚨🚨🚨 **生成章节正文时，此参数是必需的！** 根据本章剧情，对旧的"故事圣经"进行修订。请遵循"增量更新"和"信息压缩"原则。必须明确标记"已死"的角色，只保留主角、反派和当前活跃的配角，删除已退场很久的路人甲以节省空间。如果某个伏笔在本章彻底解决，请从列表中删除。保持简洁：移除那些对未来剧情不再重要的信息。**重要：当你生成章节内容时，必须同时提供此参数更新故事圣经，否则后续章节的逻辑一致性无法保证！**',
        properties: {
          character_status: {
            type: Type.STRING,
            description: '【人物状态表】格式：[角色名]：[状态/位置/关键变化]。要求：1. 必须明确标记"已死"的角色（格式：角色名：第X章已死亡）。2. 只保留主角、反派和当前活跃的配角。3. 删除已退场很久的路人甲以节省空间。示例："陆志星：重伤，在青云门养伤。赵四：第10章已死亡。"'
          },
          key_items_and_locations: {
            type: Type.STRING,
            description: '【物品与地点】记录关键道具的持有者变更、当前所在位置的环境特征。示例："当前位置：万魔窟（禁飞区）。屠龙刀：目前在赵敏手中。"'
          },
          active_plot_threads: {
            type: Type.STRING,
            description: '【当前未解决的伏笔】列出当前悬而未决的冲突或任务。一旦某个伏笔在本章彻底解决，请从列表中删除。示例："1. 寻找解药（进行中）。2. 门派大比（三天后开始）。"'
          },
          important_rules: {
            type: Type.STRING,
            description: '【临时规则/备注】本章新增的、对后续剧情有长期影响的设定。示例："设定补充：主角使用了禁术，三天内无法使用内力。"'
          }
        },
        required: ['character_status', 'key_items_and_locations', 'active_plot_threads']
      }
    },
    required: ['chapterNumber', 'chapterTitle', 'chapter_content', 'chapter_outline'],
  },
};

export const updateChapterContentTool: FunctionDeclaration = {
  name: 'update_chapter_content',
  description: '🚨🚨🚨 **CRITICAL TOOL - MUST BE CALLED IMMEDIATELY AFTER GENERATING CHAPTER CONTENT**: Write or update the actual body text (manuscript) of a specific chapter. **YOU MUST CALL THIS TOOL whenever you generate chapter content** - this is the ONLY way to save manuscript text to the story board. **CRITICAL: You MUST actually call this function/tool using Function Calling API, NOT just write text saying "故事板已更新" or "已调用update_chapter_content" - those are just words and will NOT save anything!** If you generate chapter content but do not call this tool, the content will NOT be saved. **WHEN USER ASKS YOU TO WRITE A CHAPTER, YOU MUST: 1) Generate the chapter content, 2) IMMEDIATELY call this tool with the generated content. DO NOT skip this step!** When user asks for "another version", "rewrite", or "new version", you MUST set createNewVersion to true.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      chapterNumber: { type: Type.NUMBER, description: 'The chapter number to update.' },
      volumeNumber: { type: Type.NUMBER, description: 'Optional: The volume number this chapter belongs to. Use this when chapters from different volumes have the same number.' },
      content: { type: Type.STRING, description: 'The full body text of the chapter.' },
      createNewVersion: { type: Type.BOOLEAN, description: 'MUST be true when user asks for "another version", "rewrite", "new version", or "different version". If true, creates a new version instead of overwriting the existing one. If false or omitted, updates the current active version.' },
      versionName: { type: Type.STRING, description: 'Name for the new version (e.g., "AI Revision", "Expanded Scene", "Version 2"). Only used when createNewVersion is true.' }
    },
    required: ['chapterNumber', 'content'],
  },
};

export const addCharacterTool: FunctionDeclaration = {
  name: 'add_character',
  description: 'Add or update a character.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: 'Name of the character.' },
      role: { type: Type.STRING, description: 'Role (Protagonist, Antagonist, etc.).' },
      tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Traits.' },
      description: { type: Type.STRING, description: 'Physical and personality description.' },
    },
    required: ['name', 'role', 'description'],
  },
};

export const addCharacterBehaviorTool: FunctionDeclaration = {
  name: 'add_character_behavior',
  description: 'Add a behavior example or scenario response to a character to deepen their personality.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      characterName: { type: Type.STRING, description: 'Name of the character.' },
      context: { type: Type.STRING, description: 'The situation or context (e.g., "When betrayed", "In battle").' },
      response: { type: Type.STRING, description: 'How the character acts or speaks in this context.' },
    },
    required: ['characterName', 'context', 'response'],
  },
};

export const addWorldEntryTool: FunctionDeclaration = {
  name: 'add_world_entry',
  description: 'Save a world building detail, setting, relationship, or lore item.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      category: { type: Type.STRING, description: 'Category (Magic, Factions, etc).' },
      name: { type: Type.STRING, description: 'Name of the entry.' },
      description: { type: Type.STRING, description: 'Detailed description.' },
    },
    required: ['category', 'name', 'description'],
  },
};

export const addWritingGuidelineTool: FunctionDeclaration = {
  name: 'add_writing_guideline',
  description: 'Save a specific writing rule, style preference, or technique summary to the Style Guide.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      category: { type: Type.STRING, description: 'Category (e.g., "Style", "Dialogue", "Pacing", "Negative Constraint").' },
      content: { type: Type.STRING, description: 'The specific rule or advice to follow in future generation.' },
    },
    required: ['category', 'content'],
  },
};

export const updateChapterDeconstructionTool: FunctionDeclaration = {
  name: 'update_chapter_deconstruction',
  description: '🚨🚨🚨 **保存逆向拆解结果到模板**: 将叙事功能逆向拆解的分析结果保存到故事模板中对应章节的逆向拆解位置。**当你完成逆向拆解分析后，必须调用此工具保存结果，否则结果不会保存到模板！**',
  parameters: {
    type: Type.OBJECT,
    properties: {
      chapterNumber: { 
        type: Type.NUMBER, 
        description: '要保存的章节号。' 
      },
      content: { 
        type: Type.STRING, 
        description: '逆向拆解的分析结果，应该是纯文本列表格式，每行一个功能描述，例如：\n1. [抽象功能描述]\n2. [抽象功能描述]\n3. [抽象功能描述]\n...' 
      },
    },
    required: ['chapterNumber', 'content'],
  },
};

export const toolsList = [
  updateTitleSynopsisTool,
  archiveBlueprintTool,
  updateStructureTool,
  // manageVolumeTool, // 已移除：不再使用分卷功能
  addChapterTool,
  updateStoryboardTool, // 复合工具：同时保存章节正文和章纲（推荐使用）
  // updateChapterContentTool 已废弃，使用 update_storyboard 替代
  addCharacterTool,
  addCharacterBehaviorTool,
  addWorldEntryTool,
  addWritingGuidelineTool,
  updateChapterDeconstructionTool
];
