import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useStore } from './state/store';
import { Layout } from './components/Layout';
import Login from './pages/Login';
import SetPassword from './pages/SetPassword';
import Home from './pages/Home';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Tasks from './pages/Tasks';
import Agenda from './pages/Agenda';
import Team from './pages/Team';
import Admin from './pages/Admin';
import Profile from './pages/Profile';
import Messages from './pages/Messages';
import Announcements from './pages/Announcements';
import Docs from './pages/Docs';
import Absences from './pages/Absences';
import Links from './pages/Links';

export default function App() {
  const { me, booting, recovery } = useStore();
  const loc = useLocation();

  if (booting) {
    return (
      <div className="grid min-h-screen place-items-center bg-mab-wash">
        <img src="/mabeautyplus-lotus.svg" alt="Chargement" className="h-12 w-12 animate-pulse" />
      </div>
    );
  }

  if (recovery || loc.pathname === '/mot-de-passe') return me || recovery ? <SetPassword /> : <Navigate to="/connexion" replace />;
  if (!me) return loc.pathname === '/connexion' ? <Login /> : <Navigate to="/connexion" replace />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/projets" element={<Projects />} />
        <Route path="/projets/:id" element={<ProjectDetail />} />
        <Route path="/taches" element={<Tasks />} />
        <Route path="/agenda" element={<Agenda />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/annonces" element={<Announcements />} />
        <Route path="/documents" element={<Docs />} />
        <Route path="/documents/:id" element={<Docs />} />
        <Route path="/absences" element={<Absences />} />
        <Route path="/liens" element={<Links />} />
        <Route path="/messages/:id" element={<Messages />} />
        <Route path="/equipe" element={<Team />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/profil" element={<Profile />} />
        <Route path="/connexion" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
