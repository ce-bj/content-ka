import type { Tone } from '@/components/shared/status';
import type { SourceKind } from '@/lib/demo-store';

// 内容来源（静态配置）：内容管理里判断一条内容从哪里来
export const SOURCE_CONFIG: Record<SourceKind, { label: string; tone: Tone; hint: string }> = {
  ai_generate: { label: 'AI 生成', tone: 'violet', hint: '在「AI 生成」中按写作要求和所选引用生成' },
  repurpose: { label: '一稿多用', tone: 'blue', hint: '由一篇已生效内容按目标格式模板改写' },
  translation: { label: '翻译', tone: 'teal', hint: '由源语种版本翻译，强制使用术语库' },
  manual: { label: '人工新建', tone: 'gray', hint: '在编辑器中手动新建' },
  import: { label: '外部纳管', tone: 'amber', hint: '从「外部内容」纳管而来，之后由 CMS 编辑、审批和发布' },
};

export const REF_KIND_LABEL = { fact: '事实', content: '已有内容', kdh: '知识库片段', asset: '资产', external: '外部内容' } as const;
