import { HashRouter, Route, Routes, useParams } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/shared/toast';
import { DemoStoreProvider } from '@/lib/demo-store';
import AppShell from '@/components/layout/AppShell';
import Workbench from '@/pages/Workbench/Workbench';
import ContentList from '@/pages/ContentList/ContentList';
import ContentEditor from '@/pages/ContentEditor/ContentEditor';
import GenerateWizard from '@/pages/GenerateWizard/GenerateWizard';
import FactLibrary from '@/pages/FactLibrary/FactLibrary';
import ConflictCenter from '@/pages/ConflictCenter/ConflictCenter';
import AssetLibrary from '@/pages/AssetLibrary/AssetLibrary';
import ReviewCenter from '@/pages/ReviewCenter/ReviewCenter';
import ExternalContentPage from '@/pages/ExternalContent/ExternalContent';
import IntegrationCenter from '@/pages/IntegrationCenter/IntegrationCenter';
import ContentModelDesigner from '@/pages/ContentModelDesigner/ContentModelDesigner';
import DataTables from '@/pages/DataTables/DataTables';
import ReleaseBatches from '@/pages/ReleaseBatches/ReleaseBatches';
import Repurpose from '@/pages/Repurpose/Repurpose';
import TranslationTasks from '@/pages/TranslationTasks/TranslationTasks';
import ProductionStandards from '@/pages/ProductionStandards/ProductionStandards';
import UsageInsights from '@/pages/UsageInsights/UsageInsights';
import AuditLog from '@/pages/AuditLog/AuditLog';
import OrgScopes from '@/pages/OrgScopes/OrgScopes';
import MembersRoles from '@/pages/MembersRoles/MembersRoles';
import ApprovalFlows from '@/pages/ApprovalFlows/ApprovalFlows';
import RulesSettings from '@/pages/RulesSettings/RulesSettings';
import AiSettings from '@/pages/AiSettings/AiSettings';
import TopicPlanner from '@/pages/TopicPlanner/TopicPlanner';
import ContentMarket from '@/pages/ContentMarket/ContentMarket';

// 不同内容之间切换时重新挂载编辑器，避免沿用上一条内容的编辑状态
function EditorRoute() {
  const { id } = useParams();
  return <ContentEditor key={id} />;
}

export default function App() {
  return (
    <DemoStoreProvider>
    <TooltipProvider>
      <HashRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<Workbench />} />
            <Route path="/content" element={<ContentList />} />
            <Route path="/content/edit/:id" element={<EditorRoute />} />
            <Route path="/production/generate" element={<GenerateWizard />} />
            <Route path="/facts" element={<FactLibrary />} />
            <Route path="/facts/conflicts" element={<ConflictCenter />} />
            <Route path="/assets" element={<AssetLibrary />} />
            <Route path="/review" element={<ReviewCenter />} />
            <Route path="/market" element={<ContentMarket />} />
            <Route path="/external" element={<ExternalContentPage />} />
            <Route path="/integrations" element={<IntegrationCenter />} />
            <Route path="/settings/models" element={<ContentModelDesigner />} />
            <Route path="/content/tables" element={<DataTables />} />
            <Route path="/content/releases" element={<ReleaseBatches />} />
            <Route path="/production/repurpose" element={<Repurpose />} />
            <Route path="/production/translations" element={<TranslationTasks />} />
            <Route path="/production/standards" element={<ProductionStandards />} />
            <Route path="/insights/usage" element={<UsageInsights />} />
            <Route path="/settings/audit" element={<AuditLog />} />
            <Route path="/settings/org" element={<OrgScopes />} />
            <Route path="/settings/members" element={<MembersRoles />} />
            <Route path="/settings/approvals" element={<ApprovalFlows />} />
            <Route path="/settings/rules" element={<RulesSettings />} />
            <Route path="/settings/ai" element={<AiSettings />} />
            <Route path="/production/topics" element={<TopicPlanner />} />
          </Route>
        </Routes>
      </HashRouter>
      <Toaster />
    </TooltipProvider>
    </DemoStoreProvider>
  );
}
