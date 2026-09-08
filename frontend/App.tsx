import React, { useState, useEffect } from 'react';
import { store } from './lib/store.ts';
import { Auth } from './components/Auth.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { ChatArea } from './components/ChatArea.tsx';
import { SettingsModal } from './components/Settings.tsx';
import { CallModal } from './components/CallModal.tsx';

const App: React.FC = () => {
    const [state, setState] = useState(store.getState());
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [activeCall, setActiveCall] = useState<{chatId: string, type: 'audio'|'video'} | null>(null);
    const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobileView(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const unsubscribe = store.subscribe(() => {
            setState(store.getState());
        });
        return unsubscribe;
    }, []);

    if (!state.currentUser) {
        return <Auth />;
    }

    const showSidebar = !isMobileView || !activeChatId;
    const showChatArea = !isMobileView || activeChatId;

    return (
        <div className="h-screen w-screen flex overflow-hidden bg-slate-100 font-sans">
            {/* Main Layout */}
            <div className="flex w-full h-full max-w-[1600px] mx-auto shadow-2xl bg-white overflow-hidden">
                {showSidebar && (
                    <Sidebar 
                        activeChatId={activeChatId} 
                        onSelectChat={setActiveChatId}
                        onOpenSettings={() => setShowSettings(true)}
                    />
                )}
                
                {showChatArea && (
                    <ChatArea 
                        chatId={activeChatId} 
                        onBack={() => setActiveChatId(null)}
                        onCall={(type) => activeChatId && setActiveCall({ chatId: activeChatId, type })}
                    />
                )}
            </div>

            {/* Modals */}
            {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
            {activeCall && (
                <CallModal 
                    chatId={activeCall.chatId} 
                    type={activeCall.type} 
                    onEnd={() => setActiveCall(null)} 
                />
            )}
        </div>
    );
};

export default App;
