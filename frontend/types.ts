export enum MessageStatus {
    PENDING = 'PENDING',
    SENT = 'SENT',
    DELIVERED = 'DELIVERED',
    READ = 'READ',
    FAILED = 'FAILED'
}

export enum MessageType {
    TEXT = 'TEXT',
    IMAGE = 'IMAGE',
    SYSTEM = 'SYSTEM'
}

export interface User {
    id: string;
    phoneNumber: string; // Primary identity, strictly E.164 format (e.g., +12025550123)
    countryCode: string;
    displayName: string;
    avatarUrl?: string;
    about: string;
    lastSeen: number;
    isOnline: boolean;
    isRegistered: boolean; // True if the user has completed profile setup, false if it's a placeholder
}

export interface Reaction {
    emoji: string;
    userId: string;
}

export interface Message {
    id: string;
    chatId: string;
    senderId: string;
    content: string;
    type: MessageType;
    timestamp: number;
    status: MessageStatus;
    reactions: Reaction[];
    replyToId?: string;
    isEdited?: boolean;
    isDeleted?: boolean;
}

export interface Chat {
    id: string;
    isGroup: boolean;
    participantIds: string[];
    name?: string;
    avatarUrl?: string;
    lastMessageId?: string;
    updatedAt: number;
    unreadCount: Record<string, number>;
}
