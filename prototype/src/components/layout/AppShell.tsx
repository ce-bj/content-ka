import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  BookCheck,
  Boxes,
  Cable,
  Eye,
  FileText,
  FileInput,
  Images,
  LayoutDashboard,
  Lock,
  Menu,
  ChevronRight,
  Search,
  Send,
  Settings2,
  Sparkles,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { accessOf, LEVEL_LABEL, moduleOfPath, ROLE_CONFIG, type ModuleKey, type RoleId } from './access';
import { flowOfPath } from './flows';
import { useDemo } from '@/lib/demo-store';
import { notify } from '@/components/shared/toast';

interface NavChild {
  label: string;
  to: string;
  module: ModuleKey;
  count?: number;
}
interface NavGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  to?: string;
  module?: ModuleKey;
  children?: NavChild[];
  count?: number;
}

const NAV_SECTIONS: { title: string; groups: NavGroup[] }[] = [
  {
    title: '生产与发布 · 自建',
    groups: [
      { label: '工作台', icon: LayoutDashboard, to: '/', module: 'workbench', count: 9 },
      {
        label: '内容生产',
        icon: Sparkles,
        children: [
          { label: '选题', to: '/production/topics', module: 'production' },
          { label: 'AI 生成', to: '/production/generate', module: 'production' },
          { label: '一稿多用', to: '/production/repurpose', module: 'production' },
          { label: '翻译任务', to: '/production/translations', module: 'production' },
          { label: '生产规范', to: '/production/standards', module: 'standards' },
        ],
      },
      {
        label: '内容管理',
        icon: FileText,
        children: [
          { label: '自产内容', to: '/content', module: 'content' },
          { label: '数据表', to: '/content/tables', module: 'content' },
        ],
      },
      {
        label: '审批与发布',
        icon: Boxes,
        children: [
          { label: '审批中心', to: '/review', module: 'review', count: 8 },
          { label: '发布批次', to: '/content/releases', module: 'content' },
          { label: '内容市场', to: '/market', module: 'market' },
        ],
      },
    ],
  },
  {
    title: '引用源 · 自建',
    groups: [
      {
        label: '事实',
        icon: BookCheck,
        children: [
          { label: '事实库', to: '/facts', module: 'facts' },
          { label: '冲突处理', to: '/facts/conflicts', module: 'conflicts', count: 3 },
        ],
      },
      { label: '外部内容', icon: FileInput, to: '/external', module: 'assets' },
      { label: '资产', icon: Images, to: '/assets', module: 'assets' },
    ],
  },
  {
    title: '对接 · 其他平台',
    groups: [
      {
        label: '对接',
        icon: Cable,
        children: [
          { label: '上游接入', to: '/integrations', module: 'integrations' },
          { label: '效果回流', to: '/insights/usage', module: 'insights' },
        ],
      },
    ],
  },
  {
    title: '配置',
    groups: [
      {
        label: '设置',
        icon: Settings2,
        children: [
          { label: '内容模型', to: '/settings/models', module: 'settings' },
          { label: '组织与范围', to: '/settings/org', module: 'settings' },
          { label: '成员与角色', to: '/settings/members', module: 'settings' },
          { label: '审批流程', to: '/settings/approvals', module: 'settings' },
          { label: '规则', to: '/settings/rules', module: 'rules' },
          { label: 'AI 与模型', to: '/settings/ai', module: 'settings' },
          { label: '审计日志', to: '/settings/audit', module: 'settings' },
        ],
      },
    ],
  },
];

const ROLE_OPTIONS = (Object.keys(ROLE_CONFIG) as RoleId[]).map((r) => ({ value: r, label: `${ROLE_CONFIG[r].label} · ${ROLE_CONFIG[r].person}` }));
const BRAND_OPTIONS = [
  { value: 'all', label: '全部品牌' },
  { value: 'beiling', label: '北岭智造' },
  { value: 'hanchuan', label: '汉川传动' },
];
const REGION_OPTIONS = [
  { value: 'all', label: '全部区域' },
  { value: 'cn', label: '中国大陆' },
  { value: 'eu', label: '欧盟' },
  { value: 'sea', label: '东南亚' },
  { value: 'na', label: '北美' },
];
// 通知示例（外壳组件，不属于页面 DataSlot）
const NOTIFICATIONS = [
  { title: '冲突 CF-018 待处理：BL-R600 防护等级 IP66 / IP65', time: '昨天 18:44', to: '/facts/conflicts' },
  { title: 'RV-553 等你审核：BL-R600 欧盟经销商销售资料', time: '09:30', to: '/review' },
  { title: '飞书云空间鉴权过期，3 个资产未同步', time: '06:10', to: '/integrations' },
];

function NavCount({ n }: { n?: number }) {
  if (!n) return null;
  return (
    <Badge variant="secondary" className="ml-auto h-4 min-w-4 rounded-full px-1.5 text-[10px]">
      {n}
    </Badge>
  );
}

function NavList({ role, onNavigate }: { role: RoleId; onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const visible = (m?: ModuleKey) => !m || accessOf(role, m) !== 'none';
  return (
    <nav className="flex-1 overflow-y-auto p-2 text-sm">
      {NAV_SECTIONS.map((sec) => {
        const groups = sec.groups.filter((g) => (g.to ? visible(g.module) : (g.children ?? []).some((c) => visible(c.module))));
        if (groups.length === 0) return null;
        return (
          <div key={sec.title} className="mb-2 space-y-0.5">
            <div className="px-2.5 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground/70">{sec.title}</div>
      {groups.map((g) => {
        const Icon = g.icon;
        if (g.to) {
          if (!visible(g.module)) return null;
          return (
            <NavLink
              key={g.label}
              to={g.to}
              end={g.to === '/'}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn('flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sidebar-foreground hover:bg-sidebar-accent', isActive && 'bg-sidebar-accent font-medium')
              }
            >
              <Icon className="size-4 text-muted-foreground" />
              {g.label}
              <NavCount n={g.count} />
            </NavLink>
          );
        }
        const children = g.children?.filter((c) => visible(c.module)) ?? [];
        if (children.length === 0) return null;
        const groupActive = children.some((c) => pathname.startsWith(c.to));
        return (
          <div key={g.label} className="pt-1">
            <div className={cn('flex items-center gap-2 px-2.5 py-1.5 text-sidebar-foreground', groupActive && 'font-medium')}>
              <Icon className="size-4 text-muted-foreground" />
              {g.label}
            </div>
            <div className="ml-4 border-l pl-2">
              {children.map((c) => (
                <NavLink
                  key={c.label}
                  to={c.to}
                  end
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center rounded-md px-2 py-1 text-[13px] text-muted-foreground hover:bg-sidebar-accent hover:text-foreground',
                      isActive && 'bg-sidebar-accent font-medium text-foreground',
                    )
                  }
                >
                  {c.label}
                  <NavCount n={c.count} />
                </NavLink>
              ))}
            </div>
          </div>
        );
      })}
          </div>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex h-14 items-center gap-2 px-4">
      <div className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">CK</div>
      <div className="leading-tight">
        <div className="text-sm font-semibold">内容中台</div>
        <div className="text-[11px] text-muted-foreground">北岭集团</div>
      </div>
    </div>
  );
}

function RoleSelect({ role, onChange, className }: { role: RoleId; onChange: (r: RoleId) => void; className?: string }) {
  return (
    <Select items={ROLE_OPTIONS} value={role} onValueChange={(v) => onChange(v as RoleId)}>
      <SelectTrigger size="sm" className={className}>
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
  );
}

function Notifications() {
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<button className="relative rounded-md p-1.5 hover:bg-muted" aria-label="通知" />}>
        <Bell className="size-4" />
        <span className="absolute top-1 right-1 size-1.5 rounded-full bg-red-500" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuGroup>
          <DropdownMenuLabel>通知</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {NOTIFICATIONS.map((n) => (
            <DropdownMenuItem key={n.title} onClick={() => navigate(n.to)} className="flex-col items-start gap-0.5">
              <span className="text-sm whitespace-normal">{n.title}</span>
              <span className="text-xs text-muted-foreground">{n.time}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TopBar({ role, onRoleChange, onOpenMenu, onReset }: { role: RoleId; onRoleChange: (r: RoleId) => void; onOpenMenu: () => void; onReset: () => void }) {
  const [brand, setBrand] = useState('all');
  const [region, setRegion] = useState('all');
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3 md:gap-3 md:px-4">
      <Button size="icon-sm" variant="ghost" className="md:hidden" aria-label="打开菜单" onClick={onOpenMenu}>
        <Menu />
      </Button>
      <div className="flex items-center gap-2">
        <span className="hidden text-xs text-muted-foreground lg:inline">范围</span>
        <Select items={BRAND_OPTIONS} value={brand} onValueChange={(v) => setBrand(v as string)}>
          <SelectTrigger size="sm" className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BRAND_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select items={REGION_OPTIONS} value={region} onValueChange={(v) => setRegion(v as string)}>
          <SelectTrigger size="sm" className="hidden w-28 sm:flex">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REGION_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="relative ml-2 hidden max-w-md flex-1 lg:block">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="h-8 pl-8" placeholder="搜索内容、事实、资产，支持自然语言描述" />
      </div>
      <div className="ml-auto flex items-center gap-2 md:gap-3">
        <Notifications />
        <RoleSelect role={role} onChange={onRoleChange} className="hidden w-52 md:flex" />
        <DropdownMenu>
          <DropdownMenuTrigger render={<button className="rounded-full" aria-label="账号菜单" />}>
            <Avatar className="size-7">
              <AvatarFallback className="text-xs">{ROLE_CONFIG[role].person.slice(0, 1)}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                {ROLE_CONFIG[role].person} · {ROLE_CONFIG[role].label}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onReset}>重置演示数据</DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function locate(pathname: string): string[] {
  let best: { trail: string[]; len: number } | null = null;
  for (const sec of NAV_SECTIONS) {
    for (const g of sec.groups) {
      const items = g.to ? [{ label: g.label, to: g.to }] : (g.children ?? []);
      for (const c of items) {
        const hit = c.to === '/' ? pathname === '/' : pathname === c.to || pathname.startsWith(c.to + '/');
        if (hit && (!best || c.to.length > best.len)) {
          best = { trail: g.to ? [sec.title, g.label] : [sec.title, g.label, c.label], len: c.to.length };
        }
      }
    }
  }
  const trail = best?.trail ?? [];
  if (pathname.startsWith('/content/edit')) trail.push(pathname.endsWith('/new') ? '新建' : '编辑');
  return trail;
}

function LocationBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const trail = locate(pathname);
  const flow = flowOfPath(pathname);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b bg-background px-4 py-1.5 text-xs md:px-6">
      <div className="flex items-center gap-1 text-muted-foreground">
        {trail.map((t, i) => (
          <span key={t + i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="size-3" />}
            <span className={cn(i === trail.length - 1 && 'font-medium text-foreground')}>{t}</span>
          </span>
        ))}
      </div>
      {flow && (
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <span className="mr-1 text-muted-foreground">{flow.flow.title}</span>
          {flow.flow.steps.map((st, i) => {
            const current = st.key === flow.currentKey;
            return (
              <span key={st.key} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="size-3 text-muted-foreground/60" />}
                <button
                  onClick={() => navigate(st.to)}
                  className={cn(
                    'rounded px-1.5 py-0.5 hover:bg-muted',
                    current ? 'bg-primary font-medium text-primary-foreground hover:bg-primary/90' : st.owner === '对接' ? 'border border-dashed text-muted-foreground' : 'text-foreground',
                  )}
                  title={st.owner === '对接' ? '对接其他平台' : 'CMS 自建'}
                >
                  {i + 1} {st.label}
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AccessBanner({ role, module }: { role: RoleId; module: ModuleKey }) {
  const level = accessOf(role, module);
  if (level === 'full' || level === 'none') return null;
  const r = ROLE_CONFIG[role];
  return (
    <div
      className={cn(
        'flex items-center gap-2 border-b px-6 py-2 text-xs',
        level === 'read' ? 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100' : 'bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100',
      )}
    >
      {level === 'read' ? <Eye className="size-3.5 shrink-0" /> : <Lock className="size-3.5 shrink-0" />}
      {level === 'read'
        ? `「${r.label}」对本模块只读：可以查看，正式版中新建、编辑、审批等操作不显示。`
        : `「${r.label}」本范围内操作：只能看到和修改「${r.scopeLabel}」的数据。`}
    </div>
  );
}

function NoAccess({ role, module, onSwitch }: { role: RoleId; module: ModuleKey; onSwitch: (r: RoleId) => void }) {
  const navigate = useNavigate();
  return (
    <div className="p-6">
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="size-4" /> 没有访问权限
          </CardTitle>
          <CardDescription>
            「{ROLE_CONFIG[role].label}」对该模块的权限为“{LEVEL_LABEL[accessOf(role, module)]}”，菜单中也不会显示。权限按产品 PRD 第 5.7 节的矩阵配置，可在「设置 → 成员与角色」调整。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {(Object.keys(ROLE_CONFIG) as RoleId[])
            .filter((r) => accessOf(r, module) !== 'none')
            .slice(0, 3)
            .map((r) => (
              <Button key={r} size="sm" variant="outline" onClick={() => onSwitch(r)}>
                以「{ROLE_CONFIG[r].label} · {ROLE_CONFIG[r].person}」查看
              </Button>
            ))}
          <Button size="sm" onClick={() => navigate('/')}>回到工作台</Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AppShell() {
  const { pathname } = useLocation();
  const { state: demo, dispatch } = useDemo();
  const role = demo.role;
  const setRole = (r: RoleId) => { dispatch({ type: 'setRole', role: r }); notify(`已切换为「${ROLE_CONFIG[r].label} · ${ROLE_CONFIG[r].person}」`); };
  const resetDemo = () => { dispatch({ type: 'reset' }); notify('演示数据已重置'); };
  const [menuOpen, setMenuOpen] = useState(false);
  const module = moduleOfPath(pathname);
  const level = accessOf(role, module);

  return (
    <div className="flex h-svh bg-muted/30 text-foreground">
      <aside className="hidden w-56 shrink-0 flex-col border-r bg-sidebar md:flex">
        <Brand />
        <Separator />
        <NavList role={role} />
      </aside>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 gap-0 bg-sidebar p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>菜单</SheetTitle>
          </SheetHeader>
          <Brand />
          <Separator />
          <div className="p-3">
            <RoleSelect role={role} onChange={setRole} className="w-full" />
          </div>
          <NavList role={role} onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar role={role} onRoleChange={setRole} onOpenMenu={() => setMenuOpen(true)} onReset={resetDemo} />
        <LocationBar />
        <AccessBanner role={role} module={module} />
        <main className="min-h-0 flex-1 overflow-y-auto">{level === 'none' ? <NoAccess role={role} module={module} onSwitch={setRole} /> : <Outlet />}</main>
      </div>
    </div>
  );
}
