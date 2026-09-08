import React, { useState, useMemo } from 'react';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js/min';
import { store } from '../lib/store.ts';
import { Chat, User } from '../types.ts';
import { Search, Edit, Settings, Users, Globe, PhoneForwarded } from 'lucide-react';

interface SidebarProps {
    activeChatId: string | null;
    onSelectChat: (chatId: string) => void;
    onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeChatId, onSelectChat, onOpenSettings }) => {
    const state = store.getState();
    const currentUser = state.currentUser!;
    const [searchQuery, setSearchQuery] = useState('');
    const [showNewChat, setShowNewChat] = useState(false);

    const chatsList = useMemo(() => {
        return Object.values(state.chats)
            .filter(chat => chat.participantIds.includes(currentUser.id))
            .sort((a, b) => b.updatedAt - a.updatedAt);
    }, [state.chats, currentUser.id]);

    const filteredChats = useMemo(() => {
        if (!searchQuery) return chatsList;
        const query = searchQuery.toLowerCase();
        return chatsList.filter(chat => {
            if (chat.isGroup) return chat.name?.toLowerCase().includes(query);
            const otherUserId = chat.participantIds.find(id => id !== currentUser.id);
            const otherUser = otherUserId ? state.users[otherUserId] : null;
            return otherUser?.displayName.toLowerCase().includes(query) || 
                   (otherUser?.phoneNumber && otherUser.phoneNumber.includes(query));
        });
    }, [chatsList, searchQuery, state.users, currentUser.id]);

    const availableUsers = useMemo(() => {
        return Object.values(state.users).filter(u => u.id !== currentUser.id);
    }, [state.users, currentUser.id]);

    const filteredAvailableUsers = useMemo(() => {
        const query = searchQuery.toLowerCase();
        return availableUsers.filter(u => 
            u.displayName.toLowerCase().includes(query) || 
            (u.phoneNumber && u.phoneNumber.includes(query))
        );
    }, [availableUsers, searchQuery]);

    // Validate if search query is a valid E.164 number for global lookup
    const globalSearchNumber = useMemo(() => {
        try {
            // Assume default country is US if no + is provided, but encourage + format
            const parsed = parsePhoneNumber(searchQuery.startsWith('+') ? searchQuery : `+${searchQuery}`);
            if (parsed && parsed.isValid()) {
                return parsed.format('E.164');
            }
        } catch (e) {
            // Ignore parse errors while typing
        }
        return null;
    }, [searchQuery]);

    const exactMatchFound = useMemo(() => {
        if (!globalSearchNumber) return false;
        return availableUsers.some(u => u.phoneNumber === globalSearchNumber);
    }, [availableUsers, globalSearchNumber]);

    const handleCreateChat = async (userId: string) => {
        const chatId = await store.createChat([userId]);
        if (chatId) {
            onSelectChat(chatId);
            setShowNewChat(false);
            setSearchQuery('');
        }
    };

    const handleGlobalSearch = async () => {
        if (!globalSearchNumber) return;
        const user = await store.resolveContact(globalSearchNumber);
        if (user) {
            handleCreateChat(user.id);
        }
    };

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    return (
        <div className="w-full md:w-80 lg:w-96 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col h-full">
            {/* Header */}
            <div className="h-16 px-4 flex items-center justify-between bg-slate-50 border-b border-slate-200 safe-pt">
                <div className="flex items-center gap-3 cursor-pointer" onClick={onOpenSettings}>
                    <img src={currentUser.avatarUrl} alt="Profile" className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                    <div className="flex flex-col hidden md:flex max-w-[120px]">
                        <span className="font-semibold text-slate-800 truncate">{currentUser.displayName}</span>
                        <span className="text-xs text-slate-500 truncate">{currentUser.phoneNumber}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-slate-500">
                    <button onClick={() => { setShowNewChat(!showNewChat); setSearchQuery(''); }} className="p-2 hover:bg-slate-200 rounded-full transition-colors" title={showNewChat ? "Back to Chats" : "New Chat"}>
                        <Edit size={20} className={showNewChat ? "text-brand-600" : ""} />
                    </button>
                    <button onClick={onOpenSettings} className="p-2 hover:bg-slate-200 rounded-full transition-colors" title="Settings">
                        <Settings size={20} />
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="p-3 border-b border-slate-100">
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search size={18} className="text-slate-400" />
                    </div>
                    <input
                        type="text"
                        placeholder={showNewChat ? "Search or enter +1234..." : "Search chats..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-brand-500 focus:border-brand-500 sm:text-sm transition-colors"
                    />
                </div>
            </div>

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto safe-pb">
                {showNewChat ? (
                    <div>
                        {/* Global Search Option */}
                        {globalSearchNumber && !exactMatchFound && (
                            <div className="mb-2">
                                <div className="px-4 py-2 text-xs font-semibold text-brand-600 uppercase tracking-wider bg-brand-50 flex items-center gap-1">
                                    <Globe size={14} /> Global Network Search
                                </div>
                                <div 
                                    onClick={handleGlobalSearch}
                                    className="flex items-center px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-100 group"
                                >
                                    <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 group-hover:bg-brand-600 group-hover:text-white transition-colors">
                                        <PhoneForwarded size={20} />
                                    </div>
                                    <div className="ml-3 flex-1 overflow-hidden">
                                        <div className="font-medium text-slate-900 truncate">Message {globalSearchNumber}</div>
                                        <div className="text-sm text-slate-500 truncate">Search global registry to start chat</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Your Contacts
                        </div>

                        {filteredAvailableUsers.map(user => (
                            <div 
                                key={user.id}
                                onClick={() => handleCreateChat(user.id)}
                                className="flex items-center px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
                            >
                                <img src={user.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
                                <div className="ml-3 flex-1 overflow-hidden">
                                    <div className="font-medium text-slate-900 truncate">{user.displayName}</div>
                                    <div className="text-sm text-slate-500 truncate">
                                        {user.phoneNumber}
                                    </div>
                                </div>
                            </div>
                        ))}
                        
                        {filteredAvailableUsers.length === 0 && !globalSearchNumber && (
                            <div className="p-4 text-center text-slate-500 text-sm">
                                No contacts found. Enter a full international phone number (e.g., +1 234 567 8900) to search globally.
                            </div>
                        )}
                    </div>
                ) : (
                    filteredChats.length > 0 ? filteredChats.map(chat => {
                        const isGroup = chat.isGroup;
                        let title = chat.name;
                        let avatar = chat.avatarUrl;
                        let otherUser: User | null = null;

                        if (!isGroup) {
                            const otherUserId = chat.participantIds.find(id => id !== currentUser.id);
                            otherUser = otherUserId ? state.users[otherUserId] : null;
                            title = otherUser?.displayName || otherUser?.phoneNumber || 'Unknown User';
                            avatar = otherUser?.avatarUrl;
                        }

                        const lastMessage = state.messages[chat.id]?.[state.messages[chat.id].length - 1];
                        const unreadCount = chat.unreadCount[currentUser.id] || 0;
                        const isActive = activeChatId === chat.id;

                        return (
                            <div 
                                key={chat.id}
                                onClick={() => onSelectChat(chat.id)}
                                className={`flex items-center px-4 py-3 cursor-pointer transition-colors border-b border-slate-50 ${isActive ? 'bg-brand-50' : 'hover:bg-slate-50'}`}
                            >
                                <div className="relative">
                                    {isGroup ? (
                                        <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center text-brand-600">
                                            <Users size={24} />
                                        </div>
                                    ) : (
                                        <img src={avatar} alt="" className="w-12 h-12 rounded-full object-cover" />
                                    )}
                                    {!isGroup && otherUser?.isOnline && (
                                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                                    )}
                                </div>
                                <div className="ml-3 flex-1 overflow-hidden">
                                    <div className="flex justify-between items-baseline">
                                        <div className="font-medium text-slate-900 truncate">{title}</div>
                                        {lastMessage && (
                                            <div className={`text-xs whitespace-nowrap ml-2 ${unreadCount > 0 ? 'text-brand-600 font-medium' : 'text-slate-400'}`}>
                                                {formatTime(lastMessage.timestamp)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex justify-between items-center mt-0.5">
                                        <div className={`text-sm truncate ${unreadCount > 0 ? 'text-slate-800 font-medium' : 'text-slate-500'}`}>
                                            {lastMessage ? (
                                                lastMessage.senderId === currentUser.id ? `You: ${lastMessage.content}` : lastMessage.content
                                            ) : (
                                                <span className="italic">No messages yet</span>
                                            )}
                                        </div>
                                        {unreadCount > 0 && (
                                            <div className="ml-2 bg-brand-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                                                {unreadCount}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    }) : (
                        <div className="p-8 text-center text-slate-500 flex flex-col items-center">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                <Search size={24} className="text-slate-300" />
                            </div>
                            <p>No conversations found.</p>
                            <button onClick={() => { setShowNewChat(true); setSearchQuery(''); }} className="mt-4 text-brand-600 hover:underline text-sm font-medium">
                                Start a new chat
                            </button>
                        </div>
                    )
                )}
            </div>
        </div>
    );
};
