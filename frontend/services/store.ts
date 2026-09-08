import { User, Chat, Message, MessageStatus, MessageType, AppState } from '../types.ts';

// Simulated global users database
const MOCK_USERS: Record<string, User> = {
    'u1': { id: 'u1', phoneNumber: '+12025550123', countryCode: '+1', displayName: 'Alex (US)', about: 'Hello from New York!', lastSeen: Date.now(), isOnline: true, avatarUrl: 'https://picsum.photos/seed/u1/200/200' },
    'u2': { id: 'u2', phoneNumber: '+919876543210', countryCode: '+91', displayName: 'Priya (India)', about: 'Available', lastSeen: Date.now() - 3600000, isOnline: false, avatarUrl: 'https://picsum.photos/seed/u2/200/200' },
    'u3': { id: 'u3', phoneNumber: '+447700900077', countryCode: '+44', displayName: 'James (UK)', about: 'Cheerio', lastSeen: Date.now() - 86400000, isOnline: false, avatarUrl: 'https://picsum.photos/seed/u3/200/200' },
    'u4': { id: 'u4', phoneNumber: '+819012345678', countryCode: '+81', displayName: 'Kenji (Japan)', about: 'こんにちは', lastSeen: Date.now() - 500000, isOnline: true, avatarUrl: 'https://picsum.photos/seed/u4/200/200' },
    'u5': { id: 'u5', phoneNumber: '+5511999999999', countryCode: '+55', displayName: 'Maria (Brazil)', about: 'Bom dia!', lastSeen: Date.now() - 10000, isOnline: true, avatarUrl: 'https://picsum.photos/seed/u5/200/200' },
};

const MOCK_CHATS: Record<string, Chat> = {
    'c1': { id: 'c1', isGroup: false, participantIds: ['current_user', 'u1'], updatedAt: Date.now(), unreadCount: { 'current_user': 1 } },
    'c2': { id: 'c2', isGroup: false, participantIds: ['current_user', 'u2'], updatedAt: Date.now() - 10000, unreadCount: { 'current_user': 0 } },
};

const MOCK_MESSAGES: Record<string, Message[]> = {
    'c1': [
        { id: 'm1', chatId: 'c1', senderId: 'u1', content: 'Hey! Are we still on for the global sync?', type: MessageType.TEXT, timestamp: Date.now() - 5000, status: MessageStatus.READ, reactions: [] }
    ],
    'c2': [
        { id: 'm2', chatId: 'c2', senderId: 'u2', content: 'I sent the documents over.', type: MessageType.TEXT, timestamp: Date.now() - 20000, status: MessageStatus.READ, reactions: [{ emoji: '👍', userId: 'current_user' }] },
        { id: 'm3', chatId: 'c2', senderId: 'current_user', content: 'Got them, thanks Priya!', type: MessageType.TEXT, timestamp: Date.now() - 10000, status: MessageStatus.READ, reactions: [] }
    ]
};

class Store {
    private state: AppState;
    private listeners: Set<() => void> = new Set();

    constructor() {
        const saved = localStorage.getItem('linkapp_state');
        if (saved) {
            this.state = JSON.parse(saved);
        } else {
            this.state = {
                currentUser: null,
                users: MOCK_USERS,
                chats: MOCK_CHATS,
                messages: MOCK_MESSAGES
            };
            this.save();
        }
    }

    private save() {
        localStorage.setItem('linkapp_state', JSON.stringify(this.state));
        this.notify();
    }

    subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify() {
        this.listeners.forEach(l => l());
    }

    getState() {
        return this.state;
    }

    // Normalize phone number to E.164 format (basic simulation)
    normalizePhoneNumber(phone: string): string {
        const cleaned = phone.replace(/[\s-()]/g, '');
        return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
    }

    // Auth
    login(countryCode: string, rawPhoneNumber: string) {
        const fullNumber = this.normalizePhoneNumber(`${countryCode}${rawPhoneNumber}`);
        
        let user = Object.values(this.state.users).find(u => u.phoneNumber === fullNumber);
        
        if (!user) {
            user = {
                id: `u_${Date.now()}`,
                phoneNumber: fullNumber,
                countryCode: countryCode,
                displayName: fullNumber, // Default display name is the number until they set a profile
                about: 'Hey there! I am using LinkApp.',
                lastSeen: Date.now(),
                isOnline: true,
                avatarUrl: `https://picsum.photos/seed/${fullNumber.replace(/\D/g, '')}/200/200`
            };
            this.state.users[user.id] = user;
        }
        this.state.currentUser = user;
        
        // Ensure mock chats have the current user if they don't already
        Object.values(this.state.chats).forEach(chat => {
            if (chat.participantIds.includes('current_user')) {
                chat.participantIds = chat.participantIds.map(id => id === 'current_user' ? user!.id : id);
                if (chat.unreadCount['current_user'] !== undefined) {
                    chat.unreadCount[user!.id] = chat.unreadCount['current_user'];
                    delete chat.unreadCount['current_user'];
                }
            }
        });
        
        Object.values(this.state.messages).forEach(msgs => {
            msgs.forEach(m => {
                if (m.senderId === 'current_user') m.senderId = user!.id;
                m.reactions.forEach(r => {
                    if (r.userId === 'current_user') r.userId = user!.id;
                });
            });
        });

        this.save();
    }

    logout() {
        this.state.currentUser = null;
        this.save();
    }

    // Simulate backend resolving a global phone number
    resolveGlobalContact(searchQuery: string): string {
        const normalized = this.normalizePhoneNumber(searchQuery);
        
        // Check if user already exists in our local/mock database
        let user = Object.values(this.state.users).find(u => u.phoneNumber === normalized);

        if (user) return user.id;

        // Simulate backend finding a registered user anywhere in the world
        // In a real app, this would be an API call to check if the number is registered.
        // For this demo, we create a mock user to allow the chat flow to proceed.
        const newUser: User = {
            id: `u_global_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            phoneNumber: normalized,
            countryCode: '', // We might not know the exact split without a library, but we have the full E.164
            displayName: normalized,
            about: 'Hey there! I am using LinkApp.',
            lastSeen: Date.now(),
            isOnline: false,
            avatarUrl: `https://picsum.photos/seed/${normalized.replace(/\D/g, '')}/200/200`
        };
        
        this.state.users[newUser.id] = newUser;
        this.save();
        return newUser.id;
    }

    // Messaging
    sendMessage(chatId: string, content: string, type: MessageType = MessageType.TEXT, replyToId?: string) {
        if (!this.state.currentUser) return;

        const newMessage: Message = {
            id: `m_${Date.now()}`,
            chatId,
            senderId: this.state.currentUser.id,
            content,
            type,
            timestamp: Date.now(),
            status: MessageStatus.SENT,
            reactions: [],
            replyToId
        };

        if (!this.state.messages[chatId]) {
            this.state.messages[chatId] = [];
        }
        this.state.messages[chatId].push(newMessage);
        
        if (this.state.chats[chatId]) {
            this.state.chats[chatId].updatedAt = Date.now();
            this.state.chats[chatId].lastMessageId = newMessage.id;
        }

        this.save();

        // Simulate network delay and delivery across the globe
        setTimeout(() => {
            const msg = this.state.messages[chatId].find(m => m.id === newMessage.id);
            if (msg) {
                msg.status = MessageStatus.DELIVERED;
                this.save();
            }
        }, 1500);
    }

    markChatRead(chatId: string) {
        if (!this.state.currentUser || !this.state.chats[chatId]) return;
        this.state.chats[chatId].unreadCount[this.state.currentUser.id] = 0;
        this.save();
    }

    addReaction(chatId: string, messageId: string, emoji: string) {
        if (!this.state.currentUser) return;
        const msg = this.state.messages[chatId]?.find(m => m.id === messageId);
        if (msg) {
            const existing = msg.reactions.findIndex(r => r.userId === this.state.currentUser!.id);
            if (existing >= 0) {
                if (msg.reactions[existing].emoji === emoji) {
                    msg.reactions.splice(existing, 1); // Toggle off
                } else {
                    msg.reactions[existing].emoji = emoji; // Change
                }
            } else {
                msg.reactions.push({ emoji, userId: this.state.currentUser.id });
            }
            this.save();
        }
    }

    createChat(participantIds: string[], isGroup: boolean = false, name?: string) {
        if (!this.state.currentUser) return null;
        const allParticipants = [...new Set([...participantIds, this.state.currentUser.id])];
        
        // Check if direct chat already exists
        if (!isGroup && allParticipants.length === 2) {
            const existing = Object.values(this.state.chats).find(c => 
                !c.isGroup && 
                c.participantIds.includes(allParticipants[0]) && 
                c.participantIds.includes(allParticipants[1])
            );
            if (existing) return existing.id;
        }

        const newChat: Chat = {
            id: `c_${Date.now()}`,
            isGroup,
            participantIds: allParticipants,
            name,
            updatedAt: Date.now(),
            unreadCount: {}
        };
        this.state.chats[newChat.id] = newChat;
        this.state.messages[newChat.id] = [];
        this.save();
        return newChat.id;
    }
    
    updateProfile(updates: Partial<User>) {
        if (!this.state.currentUser) return;
        this.state.currentUser = { ...this.state.currentUser, ...updates };
        this.state.users[this.state.currentUser.id] = this.state.currentUser;
        this.save();
    }
}

export const store = new Store();
