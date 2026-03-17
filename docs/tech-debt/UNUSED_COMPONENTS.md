# 未使用但有价值的组件清单

> **技术债类型**: 潜在可复用资产  
> **风险等级**: 低（不影响功能，但占用维护成本）  
> **处理策略**: 保留并监控，新功能优先使用

---

## 背景

以下组件/工具当前未被业务代码使用（由 `knip` 扫描识别），但它们属于**基础设施级别的可复用资产**，不应删除。应在后续功能开发中优先使用。

---

## UI 组件（shadcn/ui 风格）

| 组件 | 路径 | 功能 | 复用场景 |
|------|------|------|----------|
| **Dropdown** | `components/ui/dropdown.tsx` | 下拉菜单 | 需要下拉选择的交互场景 |
| **Spinner** | `components/ui/spinner.tsx` | 加载状态 | Loading 遮罩、按钮 loading 状态 |
| **Progress** | `components/ui/progress.tsx` | 进度条 | 文件上传、任务进度展示 |
| **Table** | `components/ui/table.tsx` | 表格 | 数据列表展示 |
| **Tabs** | `components/ui/tabs.tsx` | 标签页 | 内容分区展示 |

### 复用建议
```tsx
// 新增功能需要下拉菜单时，优先使用
import { Dropdown, DropdownItem, DropdownSeparator } from '@/components/ui';

// 而不是重新实现
```

---

## Markdown 编辑器组件

| 组件 | 路径 | 功能 | 复用场景 |
|------|------|------|----------|
| **CollapsibleSection** | `components/markdown-editor/CollapsibleSection.tsx` | 可折叠区块 | 长文档分级展示 |
| **CollapsibleMarkdown** | `components/markdown-editor/CollapsibleMarkdown.tsx` | 可折叠 Markdown | 自动将 h2/h3 转为可折叠 |
| **FrontmatterBadges** | `components/markdown-editor/FrontmatterBadges.tsx` | Frontmatter 标签 | 展示文档元数据 |

### 工具函数

| 函数 | 路径 | 功能 | 复用场景 |
|------|------|------|----------|
| `parseCollapsibleSections` | `components/markdown-editor/parsers.ts` | 解析可折叠区块 | 处理带折叠标记的 Markdown |
| `parseFrontmatter` | `components/markdown-editor/parsers.ts` | 解析 YAML Frontmatter | 提取文档元数据 |
| `escapeHtml` | `components/markdown-editor/parsers.ts` | HTML 转义 | 安全渲染用户输入 |

### 复用建议
```tsx
// 需要展示文档元数据时
import { FrontmatterBadges } from '@/components/markdown-editor';

// 需要折叠长文档时
import { CollapsibleMarkdown } from '@/components/markdown-editor';
```

---

## Studio/可视化组件

| 组件 | 路径 | 功能 | 复用场景 |
|------|------|------|----------|
| **HtmlPreview** | `components/studio/HtmlPreview.tsx` | HTML 预览/编辑 | 邮件模板、页面可视化编辑 |

### 复用建议
```tsx
// 需要 HTML 预览功能时
import HtmlPreview from '@/components/studio/HtmlPreview';

<HtmlPreview 
  htmlContent={html} 
  editMode={true}
  onElementSelected={handleSelect}
/>
```

---

## 业务工具模块

| 模块 | 路径 | 功能 | 复用场景 |
|------|------|------|----------|
| **SkillAccess** | `lib/skill-access.ts` | Skill 权限检查 | 多用户权限模型 |
| **StoreFactory** | `lib/store-factory.ts` | Store CRUD 工厂 | 标准化新 Store 开发 |

### StoreFactory 使用示例
```ts
// 新增实体 Store 时，优先使用工厂
import { createCrudStore } from '@/lib/store-factory';

export const useNewEntityStore = createCrudStore<Entity>({
  entityName: 'newEntity',
  api: newEntityApi,
});
```

---

## 监控与检查

### 如何发现新组件
```bash
# 查看当前未使用导出
npx knip --no-progress | grep "Unused exports"

# 查看未使用文件
npx knip --no-progress | grep "Unused files"
```

### 决策流程
```
knip 报告未使用
     │
     ▼
是否属于基础设施/UI组件/工具函数？
     │
    YES → 保留，记录到本文档
     │
     NO → 是否确定不再使用？
              │
             YES → 删除
              │
              NO → 保留并记录原因
```

---

## 更新记录

| 日期 | 操作 | 内容 |
|------|------|------|
| 2026-03-17 | 创建 | 恢复误删的 11 个有价值组件/工具 |
| 2026-03-17 | 恢复 | UI组件: dropdown, spinner, progress, table, tabs |
| 2026-03-17 | 恢复 | Markdown组件: CollapsibleSection, CollapsibleMarkdown, FrontmatterBadges, parsers |
| 2026-03-17 | 恢复 | 业务模块: HtmlPreview, skill-access.ts, store-factory.ts |

---

## 备注

1. **不要添加到 knip ignore** - 保持 knip 报告，持续跟踪
2. **新功能优先使用** - 避免重复造轮子
3. **定期 review** - 每季度检查是否已被使用，从本文档移除
4. **文档同步** - 如有新增未使用但有价值的组件，及时更新本文档
