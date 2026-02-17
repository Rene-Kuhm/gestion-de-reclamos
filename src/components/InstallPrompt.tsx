import React, { useEffect, useState } from 'react';
import { Download, X, Share, PlusSquare } from 'lucide-react';

export const InstallPrompt: React.FC = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Detect iOS
    const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIosDevice);

    // Check if already in standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    
    if (isStandalone) return; // Already installed

    // Handle Android/Desktop installation
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    });

    // Show iOS prompt after a delay if not standalone
    if (isIosDevice && !isStandalone) {
      setTimeout(() => setShowPrompt(true), 3000);
    }
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setShowPrompt(false);
      }
    }
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-10 fade-in duration-500">
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 relative overflow-hidden">
        {/* Close Button */}
        <button 
          onClick={() => setShowPrompt(false)}
          className="absolute top-2 right-2 p-1 text-slate-400 hover:text-white rounded-full"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start space-x-4 pr-6">
          <div className="bg-blue-600 p-3 rounded-xl shadow-lg shadow-blue-900/50 flex-shrink-0">
            <Download className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-lg leading-tight mb-1">Instalar App</h3>
            <p className="text-slate-300 text-sm mb-3">
              Instala Cospec Ltd en tu pantalla de inicio para un acceso rápido y notificaciones.
            </p>
            
            {isIOS ? (
              <div className="text-sm bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                <p className="flex items-center mb-1">
                  1. Toca el botón <Share className="w-4 h-4 mx-1 text-blue-400" /> <strong>Compartir</strong>
                </p>
                <p className="flex items-center">
                  2. Selecciona <PlusSquare className="w-4 h-4 mx-1 text-blue-400" /> <strong>Añadir a Inicio</strong>
                </p>
              </div>
            ) : (
              <button
                onClick={handleInstallClick}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-6 rounded-lg transition-colors shadow-md w-full sm:w-auto"
              >
                Instalar Ahora
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
