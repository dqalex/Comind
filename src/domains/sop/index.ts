/**
 * SOP 领域模块
 */

// Store
export { useSOPTemplateStore } from './store';

// 类型
export type { 
  SOPTemplate, 
  NewSOPTemplate, 
  ReferenceFile, 
  ReferenceType,
  ScriptFile,
  ScriptType,
  SOPStage,
  SOPCategory,
  StageRecord,
  StageType,
  StageOutputType,
  InputDef,
  OutputConfig,
  KnowledgeConfig,
} from '@/db/schema';
