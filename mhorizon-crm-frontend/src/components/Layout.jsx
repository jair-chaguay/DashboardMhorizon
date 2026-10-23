import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Send, Bot, MailOpen, LogOut, Menu, X, Plus } from 'lucide-react';
import logo from '../assets/mhorizon-logo.svg';

const SECTIONS = [
  {
    title: 'Email marketing',
    items: [
      { path: '/', icon: LayoutDashboard, label: 'Panel analítico' },
      { path: '/difusion-manual', icon: Send, label: 'Difusión manual' },
      { path: '/campana-ia', icon: Bot, label: 'Campaña IA' },
    ],
  },
  { title: 'CRM', items: [{ path: '/audiencia', icon: Users, label: 'Base de datos' }] },
  { title: 'Automatización', items: [{ path: '/agente-imap', icon: MailOpen, label: 'Agente IMAP' }] },
];

const ALL_ITEMS = SECTIONS.flatMap(s => s.items);
const todayLabel = () => new Date().toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' });

export default function Layout({ children, user, onLogout }) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const current = ALL_ITEMS.find(item => item.path === location.pathname) || ALL_ITEMS[0];

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4f5f7] text-slate-800">
      {menuOpen && <div className="fixed inset-0 bg-slate-900/50 z-30 lg:hidden" onClick={() => setMenuOpen(false)} />}

      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-60 bg-navy-900 text-white flex flex-col transition-transform duration-200 ${menuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="px-5 h-16 mb-3 flex items-center justify-between">
          <img src={logo} alt="MHORIZON" className="h-5 w-auto" />
          <button className="lg:hidden text-slate-400 hover:text-white cursor-pointer" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 overflow-y-auto space-y-5">
          {SECTIONS.map(section => (
            <div key={section.title}>
              <p className="px-3 pb-1.5 text-[11px] font-medium text-slate-500">{section.title}</p>
              <div className="space-y-0.5">
                {section.items.map(({ path, icon: Icon, label }) => {
                  const isActive = location.pathname === path;
                  return (
                    <Link
                      key={path}
                      to={path}
                      onClick={() => setMenuOpen(false)}
                      className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive ? 'bg-white/[0.08] text-white' : 'text-slate-300/80 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {isActive && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r bg-brand-600" />}
                      <Icon size={17} strokeWidth={1.8} className={isActive ? 'text-brand-500' : 'text-slate-400'} />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mx-3 mb-3 pt-3 px-2 border-t border-white/10 flex items-center gap-3">
          <p className="min-w-0 flex-1 text-sm font-semibold truncate">{user?.nombre || 'Administrador'}</p>
          <button onClick={onLogout} title="Salir del sistema" aria-label="Salir del sistema"
            className="h-8 w-8 grid place-items-center rounded-lg text-slate-400 hover:bg-rose-500/15 hover:text-rose-300 cursor-pointer">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        <header className="shrink-0 h-16 px-4 lg:px-8 flex items-center gap-3 bg-white border-b border-slate-200/80">
          <button className="lg:hidden p-2 -ml-2 text-slate-600 cursor-pointer" onClick={() => setMenuOpen(true)} aria-label="Abrir menú">
            <Menu size={22} />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate lg:hidden">{current.label}</p>
            <p className="text-xs text-slate-500 first-letter:uppercase truncate lg:text-sm">{todayLabel()}</p>
          </div>
          {location.pathname !== '/difusion-manual' && (
            <Link to="/difusion-manual" className="ml-auto h-9 px-3.5 inline-flex items-center gap-2 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors">
              <Plus size={16} /> <span className="hidden sm:inline">Nueva campaña</span>
            </Link>
          )}
        </header>
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-4 lg:p-8"><div key={location.pathname} className="animate-fade-up">{children}</div></div>
        </div>
      </main>
    </div>
  );
}
