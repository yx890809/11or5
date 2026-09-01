import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import DataSourcePage from "@/pages/DataSourcePage";
import DashboardPage from "@/pages/DashboardPage";
import DanPanPage from "@/pages/DanPanPage";

export default function App() {
  return (
    <Router>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<DataSourcePage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/dandan" element={<DanPanPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
