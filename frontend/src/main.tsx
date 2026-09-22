import React from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  NavLink,
  Route,
  Routes,
  Link,
  useLocation,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Activity,
  Boxes,
  CircleDot,
  LayoutDashboard,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import { useData } from "./shared";
import { Empty } from "./ui";
import "@fontsource-variable/noto-sans-sc";
import "@fontsource-variable/noto-serif-sc";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./style.css";
import Dashboard from "./pages/Dashboard";
import AssetPage from "./pages/AssetPage";
import Maintenance from "./pages/Maintenance";
import ComponentsPage from "./pages/ComponentsPage";
import Recalls from "./pages/Recalls";

const client = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 10000 } },
});
function Shell() {
  const health = useData<{ status: string }>("health", "/health");
  const { pathname } = useLocation();
  const section = pathname.startsWith("/assets")
    ? "资产档案"
    : pathname.startsWith("/maintenance")
      ? "维修工作台"
      : pathname.startsWith("/components")
        ? "部件溯源"
        : pathname.startsWith("/recalls")
          ? "召回中心"
          : "工作空间总览";
  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">
        跳转到主内容
      </a>
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <Activity size={25} />
          </span>
          <span>
            LifeTrace<small>物理资产 · 生命周期溯源</small>
          </span>
        </Link>
        <div className="workspace">
          <span className="workspace-icon">01</span>
          <div>
            智能硬件实验室<small>LAB WORKSPACE</small>
          </div>
          <span className="online-dot" />
        </div>
        <div className="nav-label">工作空间</div>
        <nav aria-label="主导航">
          <NavLink to="/" end>
            <LayoutDashboard size={19} />
            总览<span>01</span>
          </NavLink>
          <NavLink to="/maintenance">
            <Wrench size={19} />
            维修工作台<span>02</span>
          </NavLink>
          <NavLink to="/components">
            <Boxes size={19} />
            部件溯源<span>03</span>
          </NavLink>
          <NavLink to="/recalls">
            <ShieldAlert size={19} />
            召回中心<span>04</span>
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <div className="trace-note">
            <CircleDot size={18} />
            <strong>物有所属，变有所据。</strong>
            <p>
              从部件身份到历史组成，
              <br />
              连接资产的每一个时刻。
            </p>
          </div>
          <span className="version">
            LIFETRACE <b>v1.0</b>
          </span>
        </div>
      </aside>
      <div className="main-shell">
        <div className="topbar">
          <span>
            <span className="topbar-index">LAB / 01</span> <b>{section}</b>
          </span>
          <div>
            <span className={`online-dot ${health.isError ? "offline" : ""}`} />
            {health.isError
              ? "服务连接异常"
              : health.isPending
                ? "连接中"
                : "服务已连接"}
            <span className="avatar">LT</span>
          </div>
        </div>
        <main id="main-content" key={pathname} tabIndex={-1}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/assets/:id" element={<AssetPage />} />
            <Route path="/maintenance" element={<Maintenance />} />
            <Route path="/components" element={<ComponentsPage />} />
            <Route path="/components/:id" element={<ComponentsPage />} />
            <Route path="/recalls" element={<Recalls />} />
            <Route
              path="*"
              element={
                <Empty>
                  页面不存在，<Link to="/">返回总览</Link>
                </Empty>
              }
            />
          </Routes>
        </main>
        <footer>
          LifeTrace · 让物理资产的历史可被看见
          <span>时间显示：北京时间 UTC+8</span>
        </footer>
      </div>
    </div>
  );
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
