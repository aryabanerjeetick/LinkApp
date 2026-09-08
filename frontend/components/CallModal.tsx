import React, { useState, useEffect } from 'react';
import { PhoneOff, Mic, MicOff, Video, VideoOff, Volume2 } from 'lucide-react';
import { store } from '../services/store.ts';

interface CallModalProps {
    chatId: string;
    type: 'audio' | 'video';
    onEnd: () => void;
}

export const CallModal: React.FC<CallModalProps> = ({ chatId, type, onEnd }) => {
    const state = store.getState();
    const chat = state.chats[chatId];
    const currentUser = state.currentUser!;
    
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(type === 'audio');
    const [duration, setDuration] = useState(0);
    const [status, setStatus] = useState('Calling...');

    let title = chat.name;
    let avatar = chat.avatarUrl;
    if (!chat.isGroup) {
        const otherUserId = chat.participantIds.find(id => id !== currentUser.id);
        const otherUser = otherUserId ? state.users[otherUserId] : null;
        title = otherUser?.displayName || 'Unknown User';
        avatar = otherUser?.avatarUrl;
    }

    useEffect(() => {
        // Simulate call connection
        const timer = setTimeout(() => {
            setStatus('Connected');
        }, 2000);

        let interval: number;
        if (status === 'Connected') {
            interval = window.setInterval(() => {
                setDuration(d => d + 1);
            }, 1000);
        }

        return () => {
            clearTimeout(timer);
            if (interval) clearInterval(interval);
        };
    }, [status]);

    const formatDuration = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="fixed inset-0 bg-slate-900 z-[60] flex flex-col items-center justify-between py-12 animate-in fade-in">
            {/* Background blur for video simulation */}
            {type === 'video' && !isVideoOff && (
                <div className="absolute inset-0 z-[-1] opacity-30">
                    <img src={avatar} alt="" className="w-full h-full object-cover blur-xl" />
                </div>
            )}

            <div className="flex flex-col items-center mt-10">
                <img 
                    src={avatar} 
                    alt={title} 
                    className={`w-32 h-32 rounded-full object-cover border-4 border-slate-700 shadow-2xl mb-6 ${status === 'Calling...' ? 'animate-pulse' : ''}`} 
                />
                <h2 className="text-3xl font-semibold text-white mb-2">{title}</h2>
                <p className="text-slate-300 text-lg">
                    {status === 'Connected' ? formatDuration(duration) : status}
                </p>
            </div>

            <div className="flex items-center gap-6 bg-slate-800/80 backdrop-blur-md px-8 py-4 rounded-full">
                <button 
                    onClick={() => setIsMuted(!isMuted)}
                    className={`p-4 rounded-full transition-colors ${isMuted ? 'bg-white text-slate-900' : 'bg-slate-700 text-white hover:bg-slate-600'}`}
                >
                    {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                </button>
                
                {type === 'video' && (
                    <button 
                        onClick={() => setIsVideoOff(!isVideoOff)}
                        className={`p-4 rounded-full transition-colors ${isVideoOff ? 'bg-white text-slate-900' : 'bg-slate-700 text-white hover:bg-slate-600'}`}
                    >
                        {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
                    </button>
                )}

                <button className="p-4 rounded-full bg-slate-700 text-white hover:bg-slate-600 transition-colors">
                    <Volume2 size={24} />
                </button>

                <button 
                    onClick={onEnd}
                    className="p-4 rounded-full bg-red-500 text-white hover:bg-red-600 transition-transform hover:scale-105 shadow-lg shadow-red-500/30 ml-4"
                >
                    <PhoneOff size={28} />
                </button>
            </div>
        </div>
    );
};
