/**
 * 图标渲染工具
 * 
 * 用于在 HTML 内容中渲染 Lucide 图标为 SVG 字符串
 * 支持 dangerouslySetInnerHTML 场景下的图标渲染
 */

import {
  CheckSquare, FileText, Wrench, ClipboardList, Users, Bot,
  Send, Clock, MessageSquare, LayoutDashboard, Calendar,
  Target, Zap, Shield, Globe, Database, Code, Terminal,
  BookOpen, Lightbulb, Rocket, Star, Heart, ThumbsUp,
  AlertCircle, Info, HelpCircle, CheckCircle, XCircle,
  ArrowRight, ArrowLeft, ArrowUp, ArrowDown, ChevronRight,
  ChevronLeft, ChevronUp, ChevronDown, Menu, X, Plus, Minus,
  Search, Filter, Edit, Trash2, Save, Download, Upload,
  RefreshCw, RotateCcw, Copy, ExternalLink, Link, Share2,
  Settings, User, Lock, Unlock, Key, Mail, Phone, MapPin,
  Image, File, Folder, FolderOpen, Home, Building, Briefcase,
  CreditCard, DollarSign, TrendingUp, TrendingDown, BarChart,
  PieChart, Activity, Monitor, Smartphone, Tablet, Wifi,
  Cloud, CloudOff, HardDrive, Server, Cpu, MemoryStick,
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX,
  Bell, BellOff, Timer,
  Check, MoreHorizontal, MoreVertical, GripVertical,
  GripHorizontal, Move, ZoomIn, ZoomOut, Maximize, Minimize,
  Eye, EyeOff, Printer, QrCode, Barcode, Tag, Hash, AtSign,
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter,
  AlignRight, List, ListOrdered, ListChecks, Indent, Outdent,
  Quote, Code as CodeIcon, Link2, Unlink, Table, ImagePlus,
  Paperclip, Smile, Frown, Meh, ThumbsDown, Laugh, Angry,
  HeartHandshake, Sparkles, Wand2, Brain, Cpu as CpuIcon,
  Bot as BotIcon, MessageCircle, MessagesSquare,
  Send as SendIcon, PhoneCall, Video, Mic, Camera, Scan,
  Focus, Crosshair, Layers, Grid, Rows, Columns, Square,
  Circle, Triangle, Hexagon, Octagon, Pentagon, Diamond,
  Badge, Award, Trophy, Crown, Medal, Ribbon, Stamp,
} from 'lucide-react';
import React from 'react';

// 动态导入 react-dom/server（避免 webpack 静态分析问题）
// eslint-disable-next-line @typescript-eslint/no-require-imports
const getRenderToString = () => require('react-dom/server').renderToString;

/**
 * Lucide 图标名称到组件的映射
 * 包含常用的图标，可在需要时扩展
 */
const iconMap: Record<string, React.ComponentType<any>> = {
  // 通用操作
  'check-square': CheckSquare,
  'file-text': FileText,
  'wrench': Wrench,
  'clipboard-list': ClipboardList,
  'users': Users,
  'bot': Bot,
  'send': Send,
  'clock': Clock,
  'message-square': MessageSquare,
  'layout-dashboard': LayoutDashboard,
  'calendar': Calendar,
  'target': Target,
  'zap': Zap,
  'shield': Shield,
  'globe': Globe,
  'database': Database,
  'code': Code,
  'terminal': Terminal,
  
  // 文档与知识
  'book-open': BookOpen,
  'lightbulb': Lightbulb,
  'rocket': Rocket,
  'star': Star,
  'heart': Heart,
  'thumbs-up': ThumbsUp,
  
  // 状态提示
  'alert-circle': AlertCircle,
  'info': Info,
  'help-circle': HelpCircle,
  'check-circle': CheckCircle,
  'x-circle': XCircle,
  
  // 方向箭头
  'arrow-right': ArrowRight,
  'arrow-left': ArrowLeft,
  'arrow-up': ArrowUp,
  'arrow-down': ArrowDown,
  'chevron-right': ChevronRight,
  'chevron-left': ChevronLeft,
  'chevron-up': ChevronUp,
  'chevron-down': ChevronDown,
  
  // UI 操作
  'menu': Menu,
  'x': X,
  'plus': Plus,
  'minus': Minus,
  'search': Search,
  'filter': Filter,
  'edit': Edit,
  'trash-2': Trash2,
  'save': Save,
  'download': Download,
  'upload': Upload,
  'refresh-cw': RefreshCw,
  'rotate-ccw': RotateCcw,
  'copy': Copy,
  'external-link': ExternalLink,
  'link': Link,
  'share-2': Share2,
  
  // 设置与用户
  'settings': Settings,
  'user': User,
  'lock': Lock,
  'unlock': Unlock,
  'key': Key,
  'mail': Mail,
  'phone': Phone,
  'map-pin': MapPin,
  
  // 文件与目录
  'image': Image,
  'file': File,
  'folder': Folder,
  'folder-open': FolderOpen,
  'home': Home,
  'building': Building,
  'briefcase': Briefcase,
  
  // 财务与统计
  'credit-card': CreditCard,
  'dollar-sign': DollarSign,
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  'bar-chart': BarChart,
  'pie-chart': PieChart,
  'activity': Activity,
  
  // 设备
  'monitor': Monitor,
  'smartphone': Smartphone,
  'tablet': Tablet,
  'wifi': Wifi,
  'cloud': Cloud,
  'cloud-off': CloudOff,
  'hard-drive': HardDrive,
  'server': Server,
  'cpu': Cpu,
  'memory-stick': MemoryStick,
  
  // 媒体控制
  'play': Play,
  'pause': Pause,
  'stop': Square,
  'skip-forward': SkipForward,
  'skip-back': SkipBack,
  'volume-2': Volume2,
  'volume-x': VolumeX,
  
  // 通知与时间
  'bell': Bell,
  'bell-off': BellOff,
  'timer': Timer,
  
  // 确认与取消
  'check': Check,
  
  // 布局
  'more-horizontal': MoreHorizontal,
  'more-vertical': MoreVertical,
  'grip-vertical': GripVertical,
  'grip-horizontal': GripHorizontal,
  'move': Move,
  'zoom-in': ZoomIn,
  'zoom-out': ZoomOut,
  'maximize': Maximize,
  'minimize': Minimize,
  
  // 可见性
  'eye': Eye,
  'eye-off': EyeOff,
  'printer': Printer,
  'qr-code': QrCode,
  'barcode': Barcode,
  'tag': Tag,
  'hash': Hash,
  'at-sign': AtSign,
  
  // 文本格式
  'bold': Bold,
  'italic': Italic,
  'underline': Underline,
  'strikethrough': Strikethrough,
  'align-left': AlignLeft,
  'align-center': AlignCenter,
  'align-right': AlignRight,
  'list': List,
  'list-ordered': ListOrdered,
  'list-checks': ListChecks,
  'indent': Indent,
  'outdent': Outdent,
  'quote': Quote,
  'link-2': Link2,
  'unlink': Unlink,
  'table': Table,
  'image-plus': ImagePlus,
  'paperclip': Paperclip,
  
  // 表情
  'smile': Smile,
  'frown': Frown,
  'meh': Meh,
  'thumbs-down': ThumbsDown,
  'laugh': Laugh,
  'angry': Angry,
  'heart-handshake': HeartHandshake,
  
  // AI 与智能
  'sparkles': Sparkles,
  'wand-2': Wand2,
  'brain': Brain,
  'message-circle': MessageCircle,
  'messages-square': MessagesSquare,
  'chat-bubble': MessageCircle,
  
  // 通讯
  'phone-call': PhoneCall,
  'video': Video,
  'mic': Mic,
  'camera': Camera,
  'scan': Scan,
  
  // 聚焦
  'focus': Focus,
  'crosshair': Crosshair,
  
  // 图层与布局
  'layers': Layers,
  'grid': Grid,
  'rows': Rows,
  'columns': Columns,
  
  // 形状
  'square': Square,
  'circle': Circle,
  'triangle': Triangle,
  'hexagon': Hexagon,
  'octagon': Octagon,
  'pentagon': Pentagon,
  'diamond': Diamond,
  
  // 奖励与认证
  'badge': Badge,
  'award': Award,
  'trophy': Trophy,
  'crown': Crown,
  'medal': Medal,
  'ribbon': Ribbon,
  // 'seal': Seal, // 图标不存在，使用其他替代
  'stamp': Stamp,
};

/**
 * 图标渲染配置
 */
export interface IconRenderConfig {
  /** 图标尺寸（像素） */
  size?: number;
  /** 描边宽度 */
  strokeWidth?: number;
  /** 颜色（CSS 颜色值） */
  color?: string;
  /** 是否继承父元素颜色（设置后 color 参数失效） */
  inheritColor?: boolean;
}

/**
 * 默认渲染配置
 */
const DEFAULT_CONFIG: IconRenderConfig = {
  size: 22,
  strokeWidth: 2,
  color: '#0056ff',
  inheritColor: false,
};

/**
 * 渲染单个图标为 SVG 字符串
 */
export function renderIconToSvg(
  iconName: string,
  config: IconRenderConfig = {}
): string | null {
  const IconComponent = iconMap[iconName];
  if (!IconComponent) return null;

  const { size, strokeWidth, color, inheritColor } = { ...DEFAULT_CONFIG, ...config };

  try {
    // 使用 require 动态获取 renderToString（避免 webpack 打包问题）
    const renderToString = getRenderToString();
    const svgString = renderToString(
      React.createElement(IconComponent, {
        size,
        strokeWidth,
        ...(inheritColor ? {} : { color }),
      })
    );
    return svgString;
  } catch (err) {
    console.error(`Failed to render icon "${iconName}":`, err);
    return null;
  }
}

/**
 * 在 HTML 中渲染所有 Lucide 图标
 * 将 <i data-lucide="xxx"></i> 替换为实际的 SVG
 *
 * @param html - 包含图标占位符的 HTML 字符串
 * @param config - 图标渲染配置
 * @returns 渲染后的 HTML 字符串
 */
export function renderIconsInHtml(
  html: string,
  config: IconRenderConfig = {}
): string {
  if (!html) return html;

  // 匹配 <i data-lucide="xxx"></i> 或 <i data-lucide="xxx" />
  const iconPattern = /<i\s+data-lucide="([a-z0-9-]+)"[^>]*><\/i>|<i\s+data-lucide="([a-z0-9-]+)"[^>]*\/>/gi;

  return html.replace(iconPattern, (match, name1, name2) => {
    const iconName = name1 || name2;
    const svg = renderIconToSvg(iconName, config);
    return svg || match; // 如果渲染失败，保留原始占位符
  });
}

/**
 * 生成图标渲染脚本（用于 iframe 注入）
 * 在 iframe 加载后执行，将所有 data-lucide 元素渲染为 SVG
 */
export function generateIconRenderScript(config: IconRenderConfig = {}): string {
  const { size = 22, strokeWidth = 2, color = '#0056ff', inheritColor = false } = config;
  
  // 注意：iframe 中无法使用 React，需要内嵌 SVG 数据
  // 这个脚本主要用于 DOMPurify 清洗后的内容，图标占位符需要被渲染
  return `
(function() {
  // 图标 SVG 数据（内嵌常用图标）
  // 注意：这里需要服务端预渲染 SVG 字符串
  // 由于 iframe 无法访问 React，此脚本仅作为占位
  // 实际渲染应在父窗口预处理 HTML
})();
  `.trim();
}

/**
 * 获取所有可用图标名称列表
 */
export function getAvailableIconNames(): string[] {
  return Object.keys(iconMap);
}

/**
 * 检查图标是否可用
 */
export function isIconAvailable(iconName: string): boolean {
  return iconName in iconMap;
}
