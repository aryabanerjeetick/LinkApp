import React, { useState, useEffect, useRef } from 'react';
import { store } from '../lib/store.ts';
import { compressImage } from '../lib/utils.ts';
import { Message, MessageStatus, MessageType, User } from '../types.ts';
import { Phone, Video, MoreVertical, Paperclip, Send, Smile, Check, CheckCheck, ArrowLeft, Image as ImageIcon, FileText, Clock, WifiOff } from 'lucide-react';

interface ChatAreaProps {
    chatId: string | null;
    onBack: () => void;
    onCall: (type: 'audio' | 'video') => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({ chatId, onBack, onCall }) => {
    const state = store.getState();
    const currentUser = state.currentUser!;
    const [inputText, setInputText] = useState('');
    const [showAttachments, setShowAttachments] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const chat = chatId ? state.chats[chatId] : null;
    const messages = chatId ? (state.messages[chatId] || []) : [];

    useEffect(() => {
        if (chatId) {
            store.markChatRead(chatId);
            scrollToBottom();
        }
    }, [chatId, messages.length]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSendText = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputText.trim() || !chatId) return;
        const text = inputText.trim();
        setInputText('');
        setShowAttachments(false);
        await store.sendMessage(chatId, text, MessageType.TEXT);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !chatId) return;
        
        try {
            // Compress image to max 800px width/height to prevent DB/Network limits
            const compressedBase64 = await compressImage(file, 800);
            setShowAttachments(false);
            await store.sendMessage(chatId, compressedBase64, MessageType.IMAGE);
        } catch (err) {
            console.error("Image upload failed", err);
        }
        
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    if (!chatId || !chat) {
        return (
            <div className="hidden md:flex flex-1 bg-slate-50 items-center justify-center flex-col text-slate-400">
                <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center mb-6">
                    <GlobeIcon size={48} className="text-slate-400" />
                </div>
                <h2 className="text-2xl font-medium text-slate-700 mb-2">LinkApp Global</h2>
                <p className="text-slate-500 max-w-md text-center">Select a chat to start messaging or search for an international number to connect globally.</p>
            </div>
        );
    }

    let title = chat.name;
    let avatar = chat.avatarUrl;
    let subtitle = '';
    let otherUser: User | null = null;

    if (!chat.isGroup) {
        const otherUserId = chat.participantIds.find(id => id !== currentUser.id);
        otherUser = otherUserId ? state.users[otherUserId] : null;
        title = otherUser?.displayName || otherUser?.phoneNumber || 'Unknown User';
        avatar = otherUser?.avatarUrl;
        subtitle = otherUser?.isOnline ? 'Online' : `Last seen ${new Date(otherUser?.lastSeen || 0).toLocaleDateString()}`;
    } else {
        subtitle = `${chat.participantIds.length} members`;
    }

    const formatMessageTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const renderMessageStatus = (status: MessageStatus) => {
        switch (status) {
            case MessageStatus.PENDING: return <Clock size={12} className="text-slate-400" />;
            case MessageStatus.SENT: return <Check size={14} className="text-slate-400" />;
            case MessageStatus.DELIVERED: return <CheckCheck size={14} className="text-slate-400" />;
            case MessageStatus.READ: return <CheckCheck size={14} className="text-blue-500" />;
            case MessageStatus.FAILED: return <span className="text-red-500 text-[10px]">Failed</span>;
            default: return null;
        }
    };

    return (
        <div className="flex-1 flex flex-col bg-[#efeae2] h-full relative">
            {/* Header */}
            <div className="h-16 px-4 flex items-center justify-between bg-white border-b border-slate-200 shadow-sm z-10 safe-pt">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full">
                        <ArrowLeft size={20} />
                    </button>
                    <img src={avatar} alt="" className="w-10 h-10 rounded-full object-cover cursor-pointer bg-slate-100" />
                    <div className="flex flex-col cursor-pointer">
                        <span className="font-semibold text-slate-800">{title}</span>
                        <span className="text-xs text-slate-500">{subtitle}</span>
                    </div>
                </div>
                <div className="flex items-center gap-1 sm:gap-2 text-slate-500">
                    <button onClick={() => onCall('audio')} className="p-2 hover:bg-slate-100 rounded-full transition-colors" title="Voice Call">
                        <Phone size={20} />
                    </button>
                    <button onClick={() => onCall('video')} className="p-2 hover:bg-slate-100 rounded-full transition-colors" title="Video Call">
                        <Video size={20} />
                    </button>
                    <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block"></div>
                    <button className="p-2 hover:bg-slate-100 rounded-full transition-colors hidden sm:block" title="More options">
                        <MoreVertical size={20} />
                    </button>
                </div>
            </div>

            {/* Offline Banner */}
            {!state.isOnline && (
                <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-1.5 flex items-center justify-center gap-2 text-yellow-700 text-xs font-medium z-10">
                    <WifiOff size={14} />
                    You are offline. Messages will be sent when connection is restored.
                </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/cubes.png")', backgroundBlendMode: 'overlay', backgroundColor: '#efeae2' }}>
                {messages.map((msg, index) => {
                    const isMine = msg.senderId === currentUser.id;
                    const sender = state.users[msg.senderId];
                    const showSenderName = chat.isGroup && !isMine && (index === 0 || messages[index - 1].senderId !== msg.senderId);
                    
                    return (
                        <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} group`}>
                            <div className={`relative max-w-[85%] sm:max-w-[75%] md:max-w-[65%] rounded-lg px-3 py-2 shadow-sm ${isMine ? 'bg-[#d9fdd3] rounded-tr-none' : 'bg-white rounded-tl-none'}`}>
                                {showSenderName && (
                                    <div className="text-xs font-bold text-brand-600 mb-1">{sender?.displayName || sender?.phoneNumber}</div>
                                )}
                                
                                {msg.type === MessageType.IMAGE ? (
                                    <img src={msg.content} alt="Shared image" className="max-w-full max-h-64 object-contain rounded-md mb-1" />
                                ) : (
                                    <div className="text-slate-800 text-[15px] leading-relaxed break-words">
                                        {msg.content}
                                    </div>
                                )}

                                <div className="flex items-center justify-end gap-1 mt-1">
                                    <span className="text-[11px] text-slate-500">{formatMessageTime(msg.timestamp)}</span>
                                    {isMine && renderMessageStatus(msg.status)}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Composer */}
            <div className="bg-slate-50 px-4 py-3 flex items-end gap-2 border-t border-slate-200 relative safe-pb">
                
                {/* Hidden file input for images */}
                <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef} 
                    onChange={handleImageUpload} 
                />

                {showAttachments && (
                    <div className="absolute bottom-16 left-4 bg-white rounded-2xl shadow-lg border border-slate-100 p-4 flex gap-4 animate-in slide-in-from-bottom-2">
                        <button 
                            className="flex flex-col items-center gap-2 group" 
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                                <ImageIcon size={24} />
                            </div>
                            <span className="text-xs text-slate-600">Photos</span>
                        </button>
                        <button className="flex flex-col items-center gap-2 group" onClick={() => setShowAttachments(false)}>
                            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                                <FileText size={24} />
                            </div>
                            <span className="text-xs text-slate-600">Document</span>
                        </button>
                    </div>
                )}

                <button className="p-2 text-slate-500 hover:text-slate-700 transition-colors mb-1">
                    <Smile size={24} />
                </button>
                <button 
                    className={`p-2 transition-colors mb-1 ${showAttachments ? 'text-brand-600 bg-brand-50 rounded-full' : 'text-slate-500 hover:text-slate-700'}`}
                    onClick={() => setShowAttachments(!showAttachments)}
                >
                    <Paperclip size={24} />
                </button>
                
                <form onSubmit={handleSendText} className="flex-1 flex items-end bg-white rounded-xl border border-slate-300 focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500 overflow-hidden transition-shadow">
                    <textarea
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendText();
                            }
                        }}
                        placeholder="Type a message"
                        className="w-full max-h-32 py-3 px-4 outline-none resize-none bg-transparent text-slate-800"
                        rows={1}
                        style={{ minHeight: '44px' }}
                    />
                </form>
                
                {inputText.trim() ? (
                    <button onClick={handleSendText} className="p-3 bg-brand-600 text-white rounded-full hover:bg-brand-700 transition-colors shadow-sm mb-0.5 flex-shrink-0">
                        <Send size={20} className="ml-0.5" />
                    </button>
                ) : (
                    <button className="p-3 bg-brand-600 text-white rounded-full hover:bg-brand-700 transition-colors shadow-sm mb-0.5 flex-shrink-0">
                        <Phone size={20} className="fill-current" />
                    </button>
                )}
            </div>
        </div>
    );
};

const GlobeIcon = ({ size, className }: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="2" y1="12" x2="22" y2="12"></line>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
    </svg>
);
