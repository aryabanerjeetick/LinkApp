import React, { useState, useRef } from 'react';
import { store } from '../lib/store.ts';
import { compressImage } from '../lib/utils.ts';
import { X, Camera, LogOut, User as UserIcon, Bell, Lock, HelpCircle } from 'lucide-react';

interface SettingsProps {
    onClose: () => void;
}

export const SettingsModal: React.FC<SettingsProps> = ({ onClose }) => {
    const state = store.getState();
    const currentUser = state.currentUser!;
    const [displayName, setDisplayName] = useState(currentUser.displayName);
    const [about, setAbout] = useState(currentUser.about);
    const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl || '');
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSave = async () => {
        setIsSaving(true);
        await store.updateProfile({ displayName, about, avatarUrl });
        setIsSaving(false);
    };

    const handleLogout = () => {
        store.logout();
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const compressedBase64 = await compressImage(file, 400);
                setAvatarUrl(compressedBase64);
            } catch (err) {
                console.error("Failed to compress image", err);
            }
        }
    };

    const hasChanges = displayName !== currentUser.displayName || 
                       about !== currentUser.about || 
                       avatarUrl !== currentUser.avatarUrl;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 sm:p-0 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h2 className="text-xl font-semibold text-slate-800">Settings</h2>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 p-6">
                    {/* Profile Section */}
                    <div className="flex flex-col items-center mb-8">
                        <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            ref={fileInputRef} 
                            onChange={handleImageUpload} 
                        />
                        <div 
                            className="relative group cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <img src={avatarUrl} alt="Profile" className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-md bg-slate-100" />
                            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Camera className="text-white" size={28} />
                            </div>
                        </div>
                        <div className="mt-4 w-full space-y-4">
                            <div className="text-center mb-4">
                                <span className="inline-block bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-sm font-medium tracking-wide">
                                    {currentUser.phoneNumber}
                                </span>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Your Name</label>
                                <input 
                                    type="text" 
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    className="w-full border-b-2 border-slate-200 focus:border-brand-500 py-2 outline-none text-slate-800 font-medium transition-colors bg-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">About</label>
                                <input 
                                    type="text" 
                                    value={about}
                                    onChange={(e) => setAbout(e.target.value)}
                                    className="w-full border-b-2 border-slate-200 focus:border-brand-500 py-2 outline-none text-slate-800 transition-colors bg-transparent"
                                />
                            </div>
                            {hasChanges && (
                                <button 
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="w-full py-2 bg-brand-100 text-brand-700 rounded-lg font-medium hover:bg-brand-200 transition-colors disabled:opacity-50"
                                >
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Menu Items */}
                    <div className="space-y-1">
                        <MenuItem icon={<UserIcon size={20} />} title="Account" subtitle="Privacy, security, change number" />
                        <MenuItem icon={<Bell size={20} />} title="Notifications" subtitle="Message, group & call tones" />
                        <MenuItem icon={<Lock size={20} />} title="Privacy" subtitle="Block contacts, disappearing messages" />
                        <MenuItem icon={<HelpCircle size={20} />} title="Help" subtitle="Help center, contact us, privacy policy" />
                    </div>
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50">
                    <button 
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 py-2.5 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors"
                    >
                        <LogOut size={18} />
                        Log Out / Switch Account
                    </button>
                </div>
            </div>
        </div>
    );
};

const MenuItem = ({ icon, title, subtitle }: { icon: React.ReactNode, title: string, subtitle: string }) => (
    <div className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors">
        <div className="text-slate-500">{icon}</div>
        <div>
            <div className="text-slate-800 font-medium">{title}</div>
            <div className="text-slate-500 text-sm">{subtitle}</div>
        </div>
    </div>
);
