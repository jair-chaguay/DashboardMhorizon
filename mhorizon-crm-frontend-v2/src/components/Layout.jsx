import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Send, Bot, MailOpen, LogOut } from 'lucide-react';

export default function Layout({ children, user, onLogout }) {
  const location = useLocation();

  const menuItems = [
    { path: '/', icon: <LayoutDashboard size={20} />, label: 'Panel Analítico' },
    { path: '/audiencia', icon: <Users size={20} />, label: 'Base de Datos CRM' },
    { path: '/difusion-manual', icon: <Send size={20} />, label: 'Difusión Manual' },
    { path: '/campana-ia', icon: <Bot size={20} />, label: 'Campaña IA Autónoma' },
    { path: '/agente-imap', icon: <MailOpen size={20} />, label: 'Panel IMAP' },
  ];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans text-gray-800">
      <aside className="w-64 bg-blue-200 text-white flex flex-col shadow-xl">
        <div className="p-6 border-b border-gray-700/50">
          <span className="inline-block bg-orange-500/10 text-orange-500 border border-orange-500/20 px-2 py-1 rounded text-[0.65rem] font-bold tracking-widest uppercase mb-2">
            Panel Administrativo
          </span>
          <h1 className="text-xl font-medium tracking-tight">MHORIZON CRM</h1>
        </div>
        
        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link 
                key={item.path} 
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                  isActive ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                }`}
              >
                {item.icon}
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-700/50">
          <div className="flex items-center gap-3 px-4 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center font-bold text-sm">
              {user?.nombre?.charAt(0) || 'A'}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-gray-200">{user?.nombre || 'Administrador'}</span>
              <span className="text-[10px] text-gray-500">Autorizado</span>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut size={18} /> Salir del sistema
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-350 mx-auto bg-white border border-gray-200 shadow-sm rounded-lg min-h-[85vh]">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}