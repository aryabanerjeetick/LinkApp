import { User, Chat, Message } from '../types.ts';

const DB_NAME = 'LinkAppGlobalDB';
const DB_VERSION = 1;

class Database {
    private db: IDBDatabase | null = null;
    private initPromise: Promise<void>;

    constructor() {
        this.initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                
                if (!db.objectStoreNames.contains('users')) {
                    const userStore = db.createObjectStore('users', { keyPath: 'id' });
                    userStore.createIndex('phoneNumber', 'phoneNumber', { unique: true });
                }
                
                if (!db.objectStoreNames.contains('chats')) {
                    const chatStore = db.createObjectStore('chats', { keyPath: 'id' });
                    chatStore.createIndex('participantIds', 'participantIds', { multiEntry: true });
                    chatStore.createIndex('updatedAt', 'updatedAt');
                }
                
                if (!db.objectStoreNames.contains('messages')) {
                    const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
                    msgStore.createIndex('chatId', 'chatId');
                    msgStore.createIndex('timestamp', 'timestamp');
                    msgStore.createIndex('status', 'status');
                }
            };
        });
    }

    async ensureInit() {
        await this.initPromise;
        if (!this.db) throw new Error("Database not initialized");
        return this.db;
    }

    // --- Users ---
    async getUser(id: string): Promise<User | undefined> {
        const db = await this.ensureInit();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('users', 'readonly');
            const request = tx.objectStore('users').get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getUserByPhone(phoneNumber: string): Promise<User | undefined> {
        const db = await this.ensureInit();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('users', 'readonly');
            const index = tx.objectStore('users').index('phoneNumber');
            const request = index.get(phoneNumber);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async saveUser(user: User): Promise<void> {
        const db = await this.ensureInit();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('users', 'readwrite');
            tx.objectStore('users').put(user);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async getAllUsers(): Promise<User[]> {
        const db = await this.ensureInit();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('users', 'readonly');
            const request = tx.objectStore('users').getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // --- Chats ---
    async getChat(id: string): Promise<Chat | undefined> {
        const db = await this.ensureInit();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('chats', 'readonly');
            const request = tx.objectStore('chats').get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async saveChat(chat: Chat): Promise<void> {
        const db = await this.ensureInit();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('chats', 'readwrite');
            tx.objectStore('chats').put(chat);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async getUserChats(userId: string): Promise<Chat[]> {
        const db = await this.ensureInit();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('chats', 'readonly');
            const index = tx.objectStore('chats').index('participantIds');
            const request = index.getAll(userId);
            request.onsuccess = () => {
                const chats = request.result as Chat[];
                resolve(chats.sort((a, b) => b.updatedAt - a.updatedAt));
            };
            request.onerror = () => reject(request.error);
        });
    }

    // --- Messages ---
    async saveMessage(message: Message): Promise<void> {
        const db = await this.ensureInit();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('messages', 'readwrite');
            tx.objectStore('messages').put(message);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async getChatMessages(chatId: string): Promise<Message[]> {
        const db = await this.ensureInit();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('messages', 'readonly');
            const index = tx.objectStore('messages').index('chatId');
            const request = index.getAll(chatId);
            request.onsuccess = () => {
                const msgs = request.result as Message[];
                resolve(msgs.sort((a, b) => a.timestamp - b.timestamp));
            };
            request.onerror = () => reject(request.error);
        });
    }
    
    async getPendingMessages(): Promise<Message[]> {
        const db = await this.ensureInit();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('messages', 'readonly');
            const index = tx.objectStore('messages').index('status');
            const request = index.getAll('PENDING');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}

export const db = new Database();
