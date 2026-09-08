import { Message, MessageStatus, User, Chat } from '../types.ts';
import { db } from './db.ts';

export type NetworkEvent = 
    | { type: 'NEW_MESSAGE', message: Message }
    | { type: 'MESSAGE_STATUS_UPDATE', messageId: string, chatId: string, status: MessageStatus }
    | { type: 'USER_ONLINE', userId: string }
    | { type: 'USER_OFFLINE', userId: string, lastSeen: number }
    | { type: 'NEW_CHAT', chat: Chat };

type EventCallback = (event: NetworkEvent) => void;

/**
 * NetworkTransport abstracts the real-time communication layer.
 * In production, this would wrap a WebSocket connection.
 * For this environment, it uses BroadcastChannel to allow real-time
 * communication between different browser tabs, simulating a global network.
 */
class NetworkTransport {
    private channel: BroadcastChannel;
    private listeners: Set<EventCallback> = new Set();
    private isOnline: boolean = navigator.onLine;

    constructor() {
        this.channel = new BroadcastChannel('linkapp_global_network');
        
        this.channel.onmessage = (e) => {
            const event = e.data as NetworkEvent;
            this.handleIncomingEvent(event);
        };

        window.addEventListener('online', this.handleOnline);
        window.addEventListener('offline', this.handleOffline);
    }

    private handleOnline = async () => {
        this.isOnline = true;
        console.log('[Network] Connection restored. Syncing pending messages...');
        
        // Sync pending messages
        try {
            const pending = await db.getPendingMessages();
            for (const msg of pending) {
                msg.status = MessageStatus.SENT;
                await db.saveMessage(msg);
                this.broadcast({ type: 'NEW_MESSAGE', message: msg });
            }
        } catch (e) {
            console.error('[Network] Failed to sync pending messages', e);
        }
    };

    private handleOffline = () => {
        this.isOnline = false;
        console.log('[Network] Connection lost. Operating in offline mode.');
    };

    private async handleIncomingEvent(event: NetworkEvent) {
        // Persist incoming data to local IndexedDB before notifying UI
        try {
            if (event.type === 'NEW_MESSAGE') {
                await db.saveMessage(event.message);
                
                // Update chat timestamp
                const chat = await db.getChat(event.message.chatId);
                if (chat) {
                    chat.updatedAt = event.message.timestamp;
                    chat.lastMessageId = event.message.id;
                    await db.saveChat(chat);
                }

                // Automatically send a DELIVERED receipt back
                this.broadcast({
                    type: 'MESSAGE_STATUS_UPDATE',
                    messageId: event.message.id,
                    chatId: event.message.chatId,
                    status: MessageStatus.DELIVERED
                });
            } 
            else if (event.type === 'MESSAGE_STATUS_UPDATE') {
                const msgs = await db.getChatMessages(event.chatId);
                const msg = msgs.find(m => m.id === event.messageId);
                if (msg) {
                    msg.status = event.status;
                    await db.saveMessage(msg);
                }
            }
            else if (event.type === 'NEW_CHAT') {
                await db.saveChat(event.chat);
            }
            else if (event.type === 'USER_ONLINE' || event.type === 'USER_OFFLINE') {
                const user = await db.getUser(event.userId);
                if (user) {
                    user.isOnline = event.type === 'USER_ONLINE';
                    if (event.type === 'USER_OFFLINE') user.lastSeen = event.lastSeen;
                    await db.saveUser(user);
                }
            }
        } catch (e) {
            console.error('[Network] Error processing incoming event', e);
        }

        // Notify UI listeners
        this.listeners.forEach(l => l(event));
    }

    subscribe(callback: EventCallback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    broadcast(event: NetworkEvent) {
        if (!this.isOnline && event.type === 'NEW_MESSAGE') {
            // Message is already saved as PENDING by the UI layer
            return;
        }
        this.channel.postMessage(event);
    }

    getOnlineStatus() {
        return this.isOnline;
    }
}

export const network = new NetworkTransport();
