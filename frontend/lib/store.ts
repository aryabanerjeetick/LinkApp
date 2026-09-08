import { User, Chat, Message, MessageStatus, MessageType } from '../types.ts';
import { db } from './db.ts';
import { network, NetworkEvent } from './network.ts';

class Store {
    private listeners: Set<() => void> = new Set();
    private currentUserId: string | null = sessionStorage.getItem('linkapp_session_uid');
    
    // In-memory cache for fast UI rendering
    private cache = {
        currentUser: null as User | null,
        users: new Map<string, User>(),
        chats: new Map<string, Chat>(),
        messages: new Map<string, Message[]>()
    };

    constructor() {
        network.subscribe(this.handleNetworkEvent.bind(this));
        if (this.currentUserId) {
            this.loadInitialData();
        }
    }

    subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify() {
        this.listeners.forEach(l => l());
    }

    private async handleNetworkEvent(event: NetworkEvent) {
        if (!this.currentUserId) return;

        if (event.type === 'NEW_MESSAGE') {
            const chat = this.cache.chats.get(event.message.chatId);
            if (chat && chat.participantIds.includes(this.currentUserId)) {
                const msgs = this.cache.messages.get(event.message.chatId) || [];
                if (!msgs.find(m => m.id === event.message.id)) {
                    msgs.push(event.message);
                    this.cache.messages.set(event.message.chatId, msgs);
                    
                    if (event.message.senderId !== this.currentUserId) {
                        chat.unreadCount[this.currentUserId] = (chat.unreadCount[this.currentUserId] || 0) + 1;
                        await db.saveChat(chat);
                    }
                }
            }
        } else if (event.type === 'MESSAGE_STATUS_UPDATE') {
            const msgs = this.cache.messages.get(event.chatId);
            if (msgs) {
                const msg = msgs.find(m => m.id === event.messageId);
                if (msg) msg.status = event.status;
            }
        } else if (event.type === 'NEW_CHAT') {
            if (event.chat.participantIds.includes(this.currentUserId)) {
                this.cache.chats.set(event.chat.id, event.chat);
                for (const uid of event.chat.participantIds) {
                    if (!this.cache.users.has(uid)) {
                        const u = await db.getUser(uid);
                        if (u) this.cache.users.set(u.id, u);
                    }
                }
            }
        } else if (event.type === 'USER_ONLINE' || event.type === 'USER_OFFLINE') {
            const u = this.cache.users.get(event.userId);
            if (u) {
                u.isOnline = event.type === 'USER_ONLINE';
                if (event.type === 'USER_OFFLINE') u.lastSeen = event.lastSeen;
            }
        }
        this.notify();
    }

    async loadInitialData() {
        if (!this.currentUserId) return;
        
        const user = await db.getUser(this.currentUserId);
        if (user) {
            this.cache.currentUser = user;
            this.cache.users.set(user.id, user);
            
            const chats = await db.getUserChats(user.id);
            for (const chat of chats) {
                this.cache.chats.set(chat.id, chat);
                
                for (const pid of chat.participantIds) {
                    if (!this.cache.users.has(pid)) {
                        const pUser = await db.getUser(pid);
                        if (pUser) this.cache.users.set(pUser.id, pUser);
                    }
                }

                const msgs = await db.getChatMessages(chat.id);
                this.cache.messages.set(chat.id, msgs);
            }
            
            network.broadcast({ type: 'USER_ONLINE', userId: user.id });
            this.notify();
        } else {
            this.logout();
        }
    }

    getState() {
        return {
            currentUser: this.cache.currentUser,
            users: Object.fromEntries(this.cache.users),
            chats: Object.fromEntries(this.cache.chats),
            messages: Object.fromEntries(this.cache.messages),
            isOnline: network.getOnlineStatus()
        };
    }

    async login(user: User) {
        await db.saveUser(user);
        sessionStorage.setItem('linkapp_session_uid', user.id);
        this.currentUserId = user.id;
        await this.loadInitialData();
    }

    logout() {
        if (this.currentUserId) {
            network.broadcast({ type: 'USER_OFFLINE', userId: this.currentUserId, lastSeen: Date.now() });
        }
        sessionStorage.removeItem('linkapp_session_uid');
        this.currentUserId = null;
        this.cache.currentUser = null;
        this.cache.chats.clear();
        this.cache.messages.clear();
        this.notify();
    }

    async resolveContact(phoneNumber: string): Promise<User | null> {
        let user = await db.getUserByPhone(phoneNumber);
        
        // If user doesn't exist, create a placeholder.
        // This allows User A to message User B before User B registers.
        // When User B registers, they will overwrite this placeholder.
        if (!user) {
            user = {
                id: `u_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                phoneNumber,
                countryCode: '', 
                displayName: phoneNumber,
                about: 'Hey there! I am using LinkApp.',
                lastSeen: Date.now(),
                isOnline: false,
                isRegistered: false, // Marks this as a placeholder
                avatarUrl: `https://picsum.photos/seed/${phoneNumber.replace(/\D/g, '')}/200/200`
            };
            await db.saveUser(user);
        }
        
        this.cache.users.set(user.id, user);
        this.notify();
        return user;
    }

    async createChat(participantIds: string[]): Promise<string | null> {
        if (!this.currentUserId) return null;
        const allIds = [...new Set([...participantIds, this.currentUserId])];
        
        for (const chat of this.cache.chats.values()) {
            if (!chat.isGroup && chat.participantIds.length === allIds.length && 
                allIds.every(id => chat.participantIds.includes(id))) {
                return chat.id;
            }
        }

        const newChat: Chat = {
            id: `c_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            isGroup: false,
            participantIds: allIds,
            updatedAt: Date.now(),
            unreadCount: {}
        };

        await db.saveChat(newChat);
        this.cache.chats.set(newChat.id, newChat);
        this.cache.messages.set(newChat.id, []);
        
        network.broadcast({ type: 'NEW_CHAT', chat: newChat });
        this.notify();
        return newChat.id;
    }

    async sendMessage(chatId: string, content: string, type: MessageType = MessageType.TEXT) {
        if (!this.currentUserId) return;

        const isOnline = network.getOnlineStatus();
        const msg: Message = {
            id: `m_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            chatId,
            senderId: this.currentUserId,
            content,
            type,
            timestamp: Date.now(),
            status: isOnline ? MessageStatus.SENT : MessageStatus.PENDING,
            reactions: []
        };

        const msgs = this.cache.messages.get(chatId) || [];
        msgs.push(msg);
        this.cache.messages.set(chatId, msgs);
        
        const chat = this.cache.chats.get(chatId);
        if (chat) {
            chat.updatedAt = msg.timestamp;
            chat.lastMessageId = msg.id;
            await db.saveChat(chat);
        }

        await db.saveMessage(msg);
        this.notify();

        if (isOnline) {
            network.broadcast({ type: 'NEW_MESSAGE', message: msg });
        }
    }

    async markChatRead(chatId: string) {
        if (!this.currentUserId) return;
        const chat = this.cache.chats.get(chatId);
        if (chat && chat.unreadCount[this.currentUserId] > 0) {
            chat.unreadCount[this.currentUserId] = 0;
            await db.saveChat(chat);
            this.notify();
        }
    }
    
    async updateProfile(updates: Partial<User>) {
        if (!this.currentUserId || !this.cache.currentUser) return;
        const updated = { ...this.cache.currentUser, ...updates };
        await db.saveUser(updated);
        this.cache.currentUser = updated;
        this.cache.users.set(updated.id, updated);
        this.notify();
    }
}

export const store = new Store();
