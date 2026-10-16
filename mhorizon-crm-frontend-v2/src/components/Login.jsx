import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import api from '../api/api'
import { getSavedUsername, saveSession, setSavedUsername } from '../utils/session'

export default function Login({ onLoginSuccess }) {
  const [usuario, setUsuario] = useState(getSavedUsername);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => !!getSavedUsername());
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleUsuarioChange = (e) => {
    const sanitizedValue = e.target.value.replace(/[^a-zA-Z0-9@._-]/g, '');
    setUsuario(sanitizedValue);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError("");

    try {
      const { data } = await api.post("/login", { usuario, password });
      const loggedUser = data?.usuario;
      const rolId = Number(loggedUser?.rol_id);

      // Solo roles 1 y 3 sin cliente asociado pueden entrar al panel
      if (!data?.token || (rolId !== 1 && rolId !== 3) || loggedUser.cliente_id !== null) {
        setLoginError("Acceso denegado. Este panel es exclusivo para personal autorizado.");
        return;
      }

      saveSession(data.token, loggedUser);
      setSavedUsername(rememberMe ? usuario : '');

      onLoginSuccess(loggedUser);
    } catch (error) {
      const msg = error?.response?.data?.message || error?.response?.data?.error || "Error al Iniciar Sesión";
      setLoginError(msg);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#171E27] flex items-center justify-center p-4 selection:bg-orange-500/30">
      <div className="bg-white p-8 sm:p-10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] max-w-md w-full border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 left-0 h-1.5 w-full bg-gradient-to-r from-orange-400 to-orange-600"></div>
        <div className="text-center mb-8 mt-2">
          <span className="inline-block bg-orange-500/10 text-orange-500 border border-orange-500/20 px-3 py-1 rounded text-[0.70rem] font-bold tracking-widest uppercase mb-4">
            Panel Administrativo
          </span>
          <h1 className="text-gray-900 font-extrabold text-[1.8rem] tracking-tight leading-tight">MHORIZON CRM</h1>
          <p className="text-gray-500 font-light mt-2 text-[0.90rem]">Entorno seguro de gestión y telemetría.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="usuario" className="block text-[0.80rem] font-bold text-gray-700 uppercase tracking-widest mb-2">Usuario (RUC/Correo)</label>
            <div className="relative group">
              <input 
                id="usuario" type="text" required autoComplete="username" 
                className="block w-full pl-4 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 font-medium focus:bg-white focus:ring-1 focus:ring-orange-500 outline-none transition-all duration-300"
                value={usuario} onChange={handleUsuarioChange} placeholder="admin@mhorizon.com"
              />
            </div>
          </div>
          <div>
            <label htmlFor="password" className="block text-[0.80rem] font-bold text-gray-700 uppercase tracking-widest mb-2">Contraseña</label>
            <div className="relative group">
              <input 
                id="password" type={showPassword ? "text" : "password"} required autoComplete="current-password" 
                className="block w-full pl-4 pr-12 py-3.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 font-medium focus:bg-white focus:ring-1 focus:ring-orange-500 outline-none transition-all duration-300"
                value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••••"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="cursor-pointer absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-orange-500 transition-colors focus:outline-none">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <div className="flex items-center mt-2 pt-1">
            <input id="remember-me" type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 border-gray-300 rounded text-orange-500 focus:ring-orange-500" />
            <label htmlFor="remember-me" className="ml-2 block text-[0.85rem] text-gray-600 cursor-pointer select-none">Recordar sesión</label>
          </div>
          {loginError && <p className='text-red-500 text-sm mt-4 text-center font-medium'>{loginError}</p>}
          <div className="pt-2">
            <button type="submit" disabled={isLoggingIn} className="cursor-pointer w-full flex justify-center py-4 px-4 rounded-md shadow-lg text-[0.95rem] font-bold tracking-[0.15em] uppercase text-white bg-orange-500 hover:bg-orange-600 transition-all disabled:opacity-70 disabled:cursor-not-allowed">
              {isLoggingIn ? 'Verificando...' : 'Iniciar Sesión'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}