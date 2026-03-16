/**
 * Markdown 编辑器统一样式配置
 * 确保 textarea、高亮层、行号列使用完全一致的样式
 * 
 * 所有数值都使用固定值，避免 Tailwind 类名导致的计算差异
 */

// 基础常量
const FONT_FAMILY = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
const FONT_SIZE = '0.875rem'; // 14px
const LINE_HEIGHT = 1.625;
const PADDING = '1.5rem'; // 24px
const SPLIT_MODE_PADDING_TOP = '3rem'; // 48px，split 模式下需要额外的顶部空间
const TAB_SIZE = 2;

// 编辑器内容区基础样式（textarea 和 高亮层共用）
export const editorContentStyles = {
  // 字体 - 必须完全一致
  fontFamily: FONT_FAMILY,
  fontSize: FONT_SIZE,
  lineHeight: LINE_HEIGHT,
  fontWeight: 400,
  fontStyle: 'normal' as const,
  letterSpacing: 'normal',

  // 盒模型 - 必须完全一致
  boxSizing: 'border-box' as const,
  width: '100%',
  height: '100%',
  padding: PADDING,
  margin: 0,
  border: 'none',

  // 文本换行 - 必须完全一致
  whiteSpace: 'pre-wrap' as const,
  wordWrap: 'break-word' as const,
  overflowWrap: 'break-word' as const,
  wordBreak: 'break-all' as const,
  tabSize: TAB_SIZE,
  MozTabSize: TAB_SIZE,

  // 布局
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  overflow: 'auto' as const,

  // 防止外部样式干扰
  textTransform: 'none' as const,
  textDecoration: 'none',
  textIndent: 0,
};

// textarea 专用样式
export const textareaStyles = {
  ...editorContentStyles,
  color: 'transparent',
  backgroundColor: 'transparent',
  caretColor: 'inherit',
  resize: 'none' as const,
  outline: 'none',
  zIndex: 1,
  // 防止 textarea 默认样式干扰
  WebkitAppearance: 'none' as const,
  MozAppearance: 'none' as const,
  appearance: 'none' as const,
};

// 高亮层专用样式
export const highlightLayerStyles = {
  ...editorContentStyles,
  color: 'inherit',
  backgroundColor: 'transparent',
  pointerEvents: 'none' as const,
  zIndex: 0,
};

// 行号列样式
export const lineNumberColumnStyles = {
  // 布局
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'flex-end',
  flexShrink: 0,
  width: '3rem', // w-12 = 48px
  paddingTop: PADDING,
  paddingBottom: PADDING,
  paddingLeft: 0,
  paddingRight: '0.5rem', // pr-2 = 8px
  overflow: 'hidden',

  // 背景
  backgroundColor: 'transparent',

  // 字体 - 与编辑器一致
  fontFamily: FONT_FAMILY,
  fontSize: FONT_SIZE,
  lineHeight: LINE_HEIGHT,
  fontWeight: 400,
  color: 'var(--tw-prose-invert-body, #94a3b8)',

  // 其他
  userSelect: 'none' as const,
};

// 单个行号样式
export const lineNumberItemStyles = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  height: '22.75px', // 默认行高 = 14px * 1.625
};

// 行内容包装器样式（高亮层中的每行）
export const editorLineStyles = {
  whiteSpace: 'pre-wrap' as const,
  wordWrap: 'break-word' as const,
  overflowWrap: 'break-word' as const,
  wordBreak: 'break-all' as const,
  lineHeight: LINE_HEIGHT,
  tabSize: TAB_SIZE,
  MozTabSize: TAB_SIZE,
  fontFamily: 'inherit',
  fontSize: 'inherit',
  fontWeight: 'inherit',
  // 最小高度确保空行也有高度
  minHeight: `${LINE_HEIGHT}em`,
};

// split 模式下的顶部偏移样式
export const splitModeOffsetStyles = {
  paddingTop: SPLIT_MODE_PADDING_TOP,
};

// 导出常量供其他模块使用
export const EDITOR_CONSTANTS = {
  FONT_FAMILY,
  FONT_SIZE,
  LINE_HEIGHT,
  PADDING,
  SPLIT_MODE_PADDING_TOP,
  TAB_SIZE,
  // 计算后的行高像素值
  LINE_HEIGHT_PX: 14 * 1.625, // 22.75px
};

/**
 * 创建 editorContentStyles 的 style 对象（用于 React）
 */
export function createEditorContentStyle(isSplitMode: boolean): React.CSSProperties {
  return {
    ...editorContentStyles,
    paddingTop: isSplitMode ? SPLIT_MODE_PADDING_TOP : PADDING,
  };
}

/**
 * 创建 textarea 的 style 对象
 */
export function createTextareaStyle(isSplitMode: boolean): React.CSSProperties {
  return {
    ...textareaStyles,
    paddingTop: isSplitMode ? SPLIT_MODE_PADDING_TOP : PADDING,
  };
}

/**
 * 创建高亮层的 style 对象
 */
export function createHighlightLayerStyle(isSplitMode: boolean): React.CSSProperties {
  return {
    ...highlightLayerStyles,
    paddingTop: isSplitMode ? SPLIT_MODE_PADDING_TOP : PADDING,
  };
}
