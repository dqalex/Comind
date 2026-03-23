/**
 * ARCH-OPT-001: Props 命名规范测试
 *
 * 测试目的：验证组件 Props 接口命名是否符合规范
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// 需要检查的文件列表（已迁移到 src/ 目录）
const FILES_TO_CHECK = [
  'src/features/task-board/ProjectEditDialog.tsx',
  'src/shared/layout/ErrorBoundary.tsx',
  'src/features/task-board/TaskDrawer.tsx',
  'src/features/chat-panel/ChatPanel.tsx',
  'src/features/chat-panel/ChatMessageList.tsx',
  'src/features/chat-panel/ChatInputArea.tsx',
  'src/features/chat-panel/ChatSessionList.tsx',
];

describe('ARCH-OPT-001: Props Naming Convention', () => {
  const projectRoot = path.resolve(__dirname, '../../../');

  FILES_TO_CHECK.forEach((filePath) => {
    const fullPath = path.join(projectRoot, filePath);
    const fileName = path.basename(filePath, '.tsx');

    it(`${fileName} 应该使用 ${fileName}Props 命名`, () => {
      // 检查文件是否存在
      expect(fs.existsSync(fullPath)).toBe(true);

      // 读取文件内容
      const content = fs.readFileSync(fullPath, 'utf-8');

      // 不应该有泛化的 interface Props
      const hasGenericProps = /interface\s+Props\s*[<{]/m.test(content);

      // 应该有具体的 ComponentNameProps
      const hasSpecificProps = new RegExp(`interface\\s+${fileName}Props`, 'm').test(content);

      // 如果文件中有 Props 接口定义，则必须使用具体命名
      if (hasGenericProps) {
        // 如果存在泛化 Props，检查是否也有具体命名
        expect(hasSpecificProps).toBe(true);
        // 并且不应该单独使用 interface Props（必须与 ComponentNameProps 一起）
        const standaloneProps = /(?:^|\n)\s*interface\s+Props\s*[<{]/m.test(content);
        expect(standaloneProps).toBe(false);
      }
    });
  });

  it('所有检查的组件文件都存在', () => {
    let existingCount = 0;
    FILES_TO_CHECK.forEach((filePath) => {
      const fullPath = path.join(projectRoot, filePath);
      if (fs.existsSync(fullPath)) {
        existingCount++;
      }
    });
    expect(existingCount).toBe(FILES_TO_CHECK.length);
  });
});
