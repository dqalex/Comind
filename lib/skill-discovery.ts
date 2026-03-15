/**
 * Skill 发现工具
 * 扫描项目 skills 文件夹，发现可安装的 Skill
 */

import { readdir, readFile, access } from 'fs/promises';
import { constants, accessSync } from 'fs';
import path from 'path';
import { validateSkillMarkdown, type SkillStructure } from './skill-validator';
import { isVersionHigher, normalizeVersion } from './version-utils';

/**
 * 发现的 Skill 信息
 */
export interface DiscoveredSkill {
  // 基础信息
  name: string;
  description: string;
  version: string;
  category?: SkillStructure['category'];
  
  // 路径信息
  skillPath: string;       // 完整路径
  namespace: string;       // 命名空间（目录名）
  skillKey: string;        // 生成的唯一标识
  
  // 验证状态
  valid: boolean;
  errors: string[];
  warnings: string[];
  
  // 结构化内容
  skill?: SkillStructure;
  
  // 本地记录状态（与数据库对比后填充）
  localStatus?: 'not_recorded' | 'draft' | 'pending_approval' | 'active' | 'rejected';
  localVersion?: string;
  localId?: string;
  
  // 安装状态（需要与数据库对比后填充）
  installStatus?: 'not_installed' | 'installed' | 'update_available';
  installedVersion?: string;
  installedId?: string;
}

/**
 * 发现结果
 */
export interface DiscoveryResult {
  skills: DiscoveredSkill[];
  totalFound: number;
  validCount: number;
  errors: string[];
  skillsFolderPath: string;
}

/**
 * 获取 skills 文件夹路径
 * 优先级: SKILLS_FOLDER_PATH 环境变量 > 项目根目录/skills
 * 
 * standalone 模式下会向上查找项目根目录
 */
export function getSkillsFolderPath(): string {
  // 1. 检查环境变量
  const envPath = process.env.SKILLS_FOLDER_PATH;
  if (envPath) {
    return envPath;
  }
  
  // 2. 检查 process.cwd()/skills 是否存在（开发模式）
  const cwdSkillsPath = path.join(process.cwd(), 'skills');
  try {
    accessSync(cwdSkillsPath, constants.R_OK);
    return cwdSkillsPath;
  } catch {
    // 继续查找
  }
  
  // 3. standalone 模式：从当前文件位置向上查找项目根目录
  // __dirname 可能是 .next/standalone/.next/server/chunks/ 或类似路径
  let currentDir = __dirname;
  for (let i = 0; i < 10; i++) {
    const skillsPath = path.join(currentDir, 'skills');
    try {
      accessSync(skillsPath, constants.R_OK);
      return skillsPath;
    } catch {
      // 继续向上查找
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break; // 已到达根目录
    currentDir = parentDir;
  }
  
  // 4. 默认返回 process.cwd()/skills
  return cwdSkillsPath;
}

/**
 * 检查路径是否是目录
 */
async function isDirectory(dirPath: string): Promise<boolean> {
  try {
    const stats = await access(dirPath, constants.R_OK);
    const entries = await readdir(dirPath, { withFileTypes: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * 解析 SKILL.md 的 Front Matter
 * 支持 YAML front matter 格式
 */
function parseFrontMatter(content: string): Record<string, unknown> {
  const frontMatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  
  if (!frontMatterMatch) {
    return {};
  }
  
  const frontMatter = frontMatterMatch[1];
  const result: Record<string, unknown> = {};
  
  // 简单的 YAML 解析（仅支持 key: value 格式）
  const lines = frontMatter.split('\n');
  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      const key = match[1];
      let value: unknown = match[2].trim();
      
      // 尝试解析 JSON 值
      if (typeof value === 'string') {
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        } else if (value === 'true') {
          value = true;
        } else if (value === 'false') {
          value = false;
        } else if (value === 'null') {
          value = null;
        } else if (/^\d+$/.test(value as string)) {
          value = parseInt(value as string, 10);
        } else if (/^\d+\.\d+$/.test(value as string)) {
          value = parseFloat(value as string);
        }
      }
      
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * 从 SKILL.md 提取版本号
 * 优先级: teamclaw_version > version
 */
function extractVersion(content: string, frontMatter: Record<string, unknown>): string {
  // 1. 检查 front matter 中的 teamclaw_version
  if (frontMatter.teamclaw_version) {
    return String(frontMatter.teamclaw_version);
  }
  
  // 2. 检查 front matter 中的 version
  if (frontMatter.version) {
    return String(frontMatter.version);
  }
  
  // 3. 检查正文中的版本号（兼容旧格式）
  const versionMatch = content.match(/^版本[：:]\s*(.+)$/m);
  if (versionMatch) {
    return versionMatch[1].trim();
  }
  
  // 4. 检查 v 开头的版本号
  const vMatch = content.match(/>?\s*\*?\*?版本\*?\*?:\s*v?(\d+\.\d+\.\d+)/i);
  if (vMatch) {
    return vMatch[1];
  }
  
  return '1.0.0';
}

/**
 * 从 SKILL.md 提取名称
 * 优先级: front matter name > 标题
 */
function extractName(content: string, frontMatter: Record<string, unknown>): string {
  // 1. 检查 front matter 中的 name
  if (frontMatter.name) {
    return String(frontMatter.name);
  }
  
  // 2. 提取标题
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    return titleMatch[1].trim();
  }
  
  return 'Unknown';
}

/**
 * 从 SKILL.md 提取描述
 */
function extractDescription(content: string, frontMatter: Record<string, unknown>): string {
  // 1. 检查 front matter 中的 description
  if (frontMatter.description) {
    return String(frontMatter.description);
  }
  
  // 2. 提取第一个段落
  const descMatch = content.match(/^#\s+.+\n\n([\s\S]+?)(?:\n\n|$)/);
  if (descMatch) {
    return descMatch[1].trim();
  }
  
  return '';
}

/**
 * 扫描 skills 文件夹
 */
export async function discoverSkills(): Promise<DiscoveryResult> {
  const errors: string[] = [];
  const skills: DiscoveredSkill[] = [];
  
  const skillsFolderPath = getSkillsFolderPath();
  
  try {
    // 检查 skills 文件夹是否存在
    await access(skillsFolderPath, constants.R_OK);
  } catch {
    return {
      skills: [],
      totalFound: 0,
      validCount: 0,
      errors: [`Skills folder not found: ${skillsFolderPath}`],
      skillsFolderPath,
    };
  }
  
  // 读取文件夹列表
  let entries;
  try {
    entries = await readdir(skillsFolderPath, { withFileTypes: true });
  } catch (error) {
    return {
      skills: [],
      totalFound: 0,
      validCount: 0,
      errors: [`Failed to read skills folder: ${error}`],
      skillsFolderPath,
    };
  }
  
  // 遍历每个子目录
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    
    const namespace = entry.name;
    const skillDir = path.join(skillsFolderPath, namespace);
    const skillMdPath = path.join(skillDir, 'SKILL.md');
    
    // 检查 SKILL.md 是否存在
    try {
      await access(skillMdPath, constants.R_OK);
    } catch {
      // 不是 Skill 目录，跳过
      continue;
    }
    
    // 读取并解析 SKILL.md
    try {
      const content = await readFile(skillMdPath, 'utf-8');
      const frontMatter = parseFrontMatter(content);
      
      // 提取基础信息
      const name = extractName(content, frontMatter);
      const description = extractDescription(content, frontMatter);
      const version = extractVersion(content, frontMatter);
      const category = frontMatter.category as SkillStructure['category'] | undefined;
      
      // 验证结构
      const validation = await validateSkillMarkdown(content);
      
      // 生成 skillKey - 使用目录名（与 Gateway 保持一致）
      // Gateway 使用目录名作为 skillKey，例如 "teamclaw"
      const skillKey = namespace;
      
      skills.push({
        name,
        description,
        version: normalizeVersion(version),
        category,
        skillPath: skillDir,
        namespace,
        skillKey,
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings,
        skill: validation.skill,
      });
      
    } catch (error) {
      errors.push(`Failed to parse ${skillMdPath}: ${error}`);
    }
  }
  
  return {
    skills,
    totalFound: skills.length,
    validCount: skills.filter(s => s.valid).length,
    errors,
    skillsFolderPath,
  };
}

/**
 * 对比发现的 Skill 与已安装的 Skill
 * 填充 installStatus、installedVersion、installedId 和 localStatus
 */
export function compareWithInstalledSkills(
  discovered: DiscoveredSkill[],
  installed: Array<{ id: string; skillKey: string; version: string | null; status: string }>
): DiscoveredSkill[] {
  return discovered.map(skill => {
    const installedSkill = installed.find(
      inst => inst.skillKey === skill.skillKey
    );
    
    // 未在数据库中找到记录
    if (!installedSkill) {
      return {
        ...skill,
        localStatus: 'not_recorded' as const,
        installStatus: 'not_installed' as const,
      };
    }
    
    const localVersion = installedSkill.version || '1.0.0';
    const localStatus = installedSkill.status as 'draft' | 'pending_approval' | 'active' | 'rejected';
    const isHigherVersion = isVersionHigher(skill.version, localVersion);
    
    // active 状态才算是已安装到 Gateway
    const installStatus = localStatus === 'active' 
      ? (isHigherVersion ? 'update_available' as const : 'installed' as const)
      : 'not_installed' as const;
    
    return {
      ...skill,
      localStatus,
      localVersion,
      localId: installedSkill.id,
      installStatus,
      installedVersion: localVersion,
      installedId: installedSkill.id,
    };
  });
}
