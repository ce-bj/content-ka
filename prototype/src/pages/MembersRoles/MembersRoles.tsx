import { useState } from 'react';
import { Lock, Plus, UserPlus } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/PageHeader';
import { FormDialog, type FormValues } from '@/components/shared/FormDialog';
import { notify } from '@/components/shared/toast';
import { ToneBadge } from '@/components/shared/status';
import { cn } from '@/lib/utils';

// ── 配置常量 ──────────────────────────────────────────────
const LEVEL_CONFIG = {
  full: { symbol: '●', label: '完整操作', className: 'text-foreground' },
  scoped: { symbol: '◐', label: '本范围内操作', className: 'text-blue-600' },
  read: { symbol: '○', label: '只读', className: 'text-muted-foreground' },
  none: { symbol: '—', label: '不可见', className: 'text-muted-foreground/50' },
} as const;
type AccessLevel = keyof typeof LEVEL_CONFIG;
const LEVEL_CYCLE: AccessLevel[] = ['full', 'scoped', 'read', 'none'];
const ROLE_OPTIONS = [
  { value: 'platform_admin', label: '平台管理员' },
  { value: 'group_owner', label: '集团内容负责人' },
  { value: 'brand_admin', label: '品牌管理员' },
  { value: 'editor', label: '内容编辑' },
  { value: 'fact_owner', label: '事实负责人' },
  { value: 'compliance', label: '合规审核' },
];
const MODULES = ['内容生产', '内容管理', '事实引用', '冲突处理', '资产', '审批中心', '上游接入', '内容市场', '效果回流', '设置'];

// ── 类型 ──────────────────────────────────────────────────
interface Member {
  memberId: string;
  memberName: string;
  email: string;
  roleNames: string[];
  scopeLabel: string;
  source: 'sso' | 'local';
  lastActiveAt: string;
  status: 'active' | 'invited' | 'disabled';
}
interface RoleDef {
  roleId: string;
  roleName: string;
  description: string;
  memberCount: number;
  builtIn: boolean;
  permissions: Record<string, AccessLevel>;
  redLineEditable: boolean;
}
interface InviteForm {
  email: string;
  roleId: string;
  scope: string;
}

// ── 动态数据（DataSlot）──────────────────────────────────
// PAGINATION: page,pageSize
const mockMembersData: Member[] = [
  { memberId: 'U-01', memberName: '陈立', email: 'chen.li@example.com', roleNames: ['集团内容负责人'], scopeLabel: '全部', source: 'sso', lastActiveAt: '刚刚', status: 'active' },
  { memberId: 'U-02', memberName: '周敏', email: 'zhou.min@example.com', roleNames: ['品牌管理员'], scopeLabel: '北岭智造', source: 'sso', lastActiveAt: '10 分钟前', status: 'active' },
  { memberId: 'U-03', memberName: '林悦', email: 'lin.yue@example.com', roleNames: ['内容编辑'], scopeLabel: '北岭智造 · 工业机器人事业部', source: 'sso', lastActiveAt: '1 小时前', status: 'active' },
  { memberId: 'U-04', memberName: '王拓', email: 'wang.tuo@example.com', roleNames: ['事实负责人', '内容编辑'], scopeLabel: 'BL-R600 / BL-R800 产品线', source: 'sso', lastActiveAt: '今天', status: 'active' },
  { memberId: 'U-05', memberName: 'Anna K.', email: 'anna.k@partner.example', roleNames: ['内容编辑'], scopeLabel: '站点 eu.beiling.com · de-DE', source: 'local', lastActiveAt: '—', status: 'invited' },
  { memberId: 'U-06', memberName: '前员工 A', email: 'former@example.com', roleNames: ['内容编辑'], scopeLabel: '汉川传动', source: 'sso', lastActiveAt: '09-30', status: 'disabled' },
];

const mockRolesData: RoleDef[] = [
  { roleId: 'platform_admin', roleName: '平台管理员', description: '全部模块的查看与操作（演示默认角色）', memberCount: 2, builtIn: true, redLineEditable: false, permissions: { 内容管理: 'full', 内容生产: 'full', 事实引用: 'full', 冲突处理: 'full', 资产: 'full', 审批中心: 'full', 内容市场: 'full', 上游接入: 'full', 效果回流: 'full', 设置: 'full' } },
  { roleId: 'group_owner', roleName: '集团内容负责人', description: '跨品牌查看、模板与规范、洞察', memberCount: 1, builtIn: true, redLineEditable: false, permissions: { 内容管理: 'full', 内容生产: 'full', 事实引用: 'read', 冲突处理: 'read', 资产: 'full', 审批中心: 'full', 内容市场: 'read', 上游接入: 'read', 效果回流: 'full', 设置: 'read' } },
  { roleId: 'brand_admin', roleName: '品牌管理员', description: '本品牌内容、资产、Brand Voice、审批', memberCount: 3, builtIn: true, redLineEditable: false, permissions: { 内容管理: 'scoped', 内容生产: 'scoped', 事实引用: 'read', 冲突处理: 'read', 资产: 'scoped', 审批中心: 'scoped', 内容市场: 'none', 上游接入: 'none', 效果回流: 'scoped', 设置: 'none' } },
  { roleId: 'editor', roleName: '内容编辑', description: '创作、生成、送审', memberCount: 18, builtIn: true, redLineEditable: false, permissions: { 内容管理: 'scoped', 内容生产: 'scoped', 事实引用: 'read', 冲突处理: 'none', 资产: 'scoped', 审批中心: 'none', 内容市场: 'none', 上游接入: 'none', 效果回流: 'none', 设置: 'none' } },
  { roleId: 'fact_owner', roleName: '事实负责人', description: '录入与维护事实、处理冲突、确认事实发布', memberCount: 6, builtIn: true, redLineEditable: true, permissions: { 内容管理: 'read', 内容生产: 'none', 事实引用: 'scoped', 冲突处理: 'scoped', 资产: 'read', 审批中心: 'scoped', 内容市场: 'none', 上游接入: 'read', 效果回流: 'none', 设置: 'none' } },
  { roleId: 'compliance', roleName: '合规审核', description: '审核、复核；可查看全部事实', memberCount: 4, builtIn: true, redLineEditable: false, permissions: { 内容管理: 'read', 内容生产: 'none', 事实引用: 'read', 冲突处理: 'read', 资产: 'read', 审批中心: 'full', 内容市场: 'none', 上游接入: 'none', 效果回流: 'read', 设置: 'none' } },
];

// ── 交互句柄（ActionSlot）────────────────────────────────
// ACTION: 获取成员 [GET] /api/v1/members
function handleFetchMembers(params: { keyword: string; roleId: string; page: number; pageSize: number }) {
  console.log('fetch members', params);
}

// ACTION: 邀请成员 [POST] /api/v1/members/invitations
function handleInviteMember(form: InviteForm) {
  console.log('invite', form);
}

// ACTION: 停用成员 [PATCH] /api/v1/members/{id}
function handleDisableMember(memberId: string) {
  alert('已停用：会话立即失效，个人 API 令牌吊销');
}

// ACTION: 获取角色 [GET] /api/v1/roles
function handleFetchRoles() {
  console.log('fetch roles');
}

// ACTION: 更新角色权限 [PUT] /api/v1/roles/{roleId}/permissions
function handleUpdateRolePermissions(roleId: string, permissions: Record<string, AccessLevel>) {
  console.log('update permissions', roleId, permissions);
}

// ACTION: 新建自定义角色 [POST] /api/v1/roles
function handleCreateRole() {
  console.log('create role');
}

// ── 主组件 ────────────────────────────────────────────────
const STATUS_LABEL = { active: '正常', invited: '已邀请', disabled: '已停用' } as const;

export default function MembersRoles() {
  const [memberList, setMemberList] = useState(mockMembersData);
  const [roleOpen, setRoleOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [roles, setRoles] = useState(mockRolesData);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [form, setForm] = useState<InviteForm>({ email: '', roleId: 'editor', scope: '' });
  const members = memberList.filter((m) => !keyword || m.memberName.includes(keyword) || m.email.includes(keyword));

  const cycleLevel = (roleId: string, module: string) => {
    const role = roles.find((r) => r.roleId === roleId)!;
    const next = LEVEL_CYCLE[(LEVEL_CYCLE.indexOf(role.permissions[module]) + 1) % LEVEL_CYCLE.length];
    const permissions = { ...role.permissions, [module]: next };
    setRoles((prev) => prev.map((r) => (r.roleId === roleId ? { ...r, permissions } : r)));
    handleUpdateRolePermissions(roleId, permissions);
  };

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title="成员与角色"
        description="账号来自平台统一账号（SSO），范围（品牌 / 区域 / 产品线）与 KDH 共用同一套划分。成员 = 角色 × 范围。角色决定能做什么，范围（品牌 / 事业部 / 区域 / 产品线）决定能对哪些数据做。成员默认通过企业 SSO 同步。"
      />

      <Tabs defaultValue="members" onValueChange={(v) => v === 'roles' && handleFetchRoles()}>
        <TabsList>
          <TabsTrigger value="members">成员 {memberList.length}</TabsTrigger>
          <TabsTrigger value="roles">角色与权限</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="pt-3">
          <Card>
            <CardHeader>
              <Input
                className="h-8 max-w-xs"
                placeholder="搜索姓名或邮箱"
                value={keyword}
                onChange={(e) => { setKeyword(e.target.value); handleFetchMembers({ keyword: e.target.value, roleId: 'all', page: 1, pageSize: 50 }); }}
              />
              <CardAction>
                <Button size="sm" onClick={() => setInviteOpen(true)}>
                  <UserPlus /> 邀请成员
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>成员</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>范围</TableHead>
                    <TableHead>来源</TableHead>
                    <TableHead>最近活跃</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => (
                    <TableRow key={m.memberId} className={cn(m.status === 'disabled' && 'opacity-50')}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="size-7">
                            <AvatarFallback className="text-xs">{m.memberName.slice(0, 1)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{m.memberName}</div>
                            <div className="text-xs text-muted-foreground">{m.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {m.roleNames.map((r) => (
                            <ToneBadge key={r} tone="blue">
                              {r}
                            </ToneBadge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{m.scopeLabel}</TableCell>
                      <TableCell className="text-xs">{m.source === 'sso' ? 'SSO' : '本地账号'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.lastActiveAt}</TableCell>
                      <TableCell>
                        <ToneBadge tone={m.status === 'active' ? 'green' : m.status === 'invited' ? 'amber' : 'gray'}>{STATUS_LABEL[m.status]}</ToneBadge>
                      </TableCell>
                      <TableCell className="text-right">
                        {m.status === 'active' && (
                          <Button size="xs" variant="ghost" onClick={() => handleDisableMember(m.memberId)}>
                            停用
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="pt-3">
          <Card>
            <CardHeader>
              <CardTitle>菜单权限矩阵</CardTitle>
              <CardDescription>
                点击单元格切换：
                {LEVEL_CYCLE.map((l) => (
                  <span key={l} className="ml-2">
                    <span className={LEVEL_CONFIG[l].className}>{LEVEL_CONFIG[l].symbol}</span> {LEVEL_CONFIG[l].label}
                  </span>
                ))}
              </CardDescription>
              <CardAction>
                <Button size="sm" variant="outline" onClick={() => setRoleOpen(true)}>
                  <Plus /> 自定义角色
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>角色</TableHead>
                    {MODULES.map((m) => (
                      <TableHead key={m} className="text-center text-xs">
                        {m}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((r) => (
                    <TableRow key={r.roleId}>
                      <TableCell>
                        <div className="font-medium">{r.roleName}</div>
                        <div className="text-xs text-muted-foreground">{r.memberCount} 人</div>
                      </TableCell>
                      {MODULES.map((m) => {
                        const lv = r.permissions[m];
                        return (
                          <TableCell key={m} className="p-0 text-center">
                            <button className={cn('h-10 w-full text-base hover:bg-muted', LEVEL_CONFIG[lv].className)} title={LEVEL_CONFIG[lv].label} onClick={() => cycleLevel(r.roleId, m)}>
                              {LEVEL_CONFIG[lv].symbol}
                            </button>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                <Lock className="mt-0.5 size-4 shrink-0" />
                字段级例外：价格、交期、承诺类字段对所有角色只读，修改需走红线审批（设置 → 审批流程）。事实负责人可以发起修改。
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>邀请成员</DialogTitle>
            <DialogDescription>企业成员建议通过 SSO 同步；这里用于外部协作者（翻译、代理商）。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>邮箱</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@partner.example" />
            </div>
            <div className="space-y-1.5">
              <Label>角色</Label>
              <Select items={ROLE_OPTIONS} value={form.roleId} onValueChange={(v) => setForm({ ...form, roleId: v as string })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>范围</Label>
              <Input value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} placeholder="例如：欧盟 · de-DE" />
            </div>
            <Label className="flex items-center gap-2 font-normal">
              <Checkbox defaultChecked /> 30 天后自动失效
            </Label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              取消
            </Button>
            <Button disabled={!form.email} onClick={() => { handleInviteMember(form); setMemberList((prev) => [...prev, { memberId: `U-${Date.now()}`, memberName: form.email.split('@')[0], email: form.email, roleNames: [ROLE_OPTIONS.find((o) => o.value === form.roleId)?.label ?? form.roleId], scopeLabel: form.scope || '待指定', source: 'local', lastActiveAt: '—', status: 'invited' }]); notify(`已向 ${form.email} 发送邀请`); setInviteOpen(false); }}>
              发送邀请
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <FormDialog
        open={roleOpen}
        onOpenChange={setRoleOpen}
        title="新建自定义角色"
        description="从已有角色复制权限，创建后在矩阵里点击单元格调整。"
        fields={[
          { key: 'name', label: '角色名称', kind: 'text', required: true, placeholder: '例如：区域市场负责人' },
          { key: 'from', label: '复制自', kind: 'select', options: roles.map((r) => ({ value: r.roleId, label: r.roleName })) },
          { key: 'desc', label: '说明', kind: 'text', placeholder: '本区域内容、翻译与审批' },
        ]}
        onSubmit={(v: FormValues) => {
          handleCreateRole();
          const base = roles.find((r) => r.roleId === v.from)!;
          setRoles((prev) => [...prev, { ...base, roleId: `custom-${Date.now()}`, roleName: String(v.name), description: String(v.desc) || `复制自${base.roleName}`, memberCount: 0, builtIn: false }]);
          notify(`已创建角色「${v.name}」`);
        }}
      />
    </div>
  );
}
