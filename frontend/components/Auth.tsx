import React, { useState, useRef, useEffect } from 'react';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js/min';
import { store } from '../lib/store.ts';
import { db } from '../lib/db.ts';
import { compressImage } from '../lib/utils.ts';
import { sendRealSMS, SmsConfig } from '../lib/sms.ts';
import { MessageSquare, Globe, ShieldCheck, AlertCircle, X, Smartphone, Camera, Settings, CheckCircle2 } from 'lucide-react';

const COUNTRIES = [
    { code: 'US', dial: '+1', name: 'United States / Canada', flag: '🇺🇸' },
    { code: 'GB', dial: '+44', name: 'United Kingdom', flag: '🇬🇧' },
    { code: 'IN', dial: '+91', name: 'India', flag: '🇮🇳' },
    { code: 'AU', dial: '+61', name: 'Australia', flag: '🇦🇺' },
    { code: 'DE', dial: '+49', name: 'Germany', flag: '🇩🇪' },
    { code: 'JP', dial: '+81', name: 'Japan', flag: '🇯🇵' },
    { code: 'BR', dial: '+55', name: 'Brazil', flag: '🇧🇷' },
    { code: 'ZA', dial: '+27', name: 'South Africa', flag: '🇿🇦' },
    { code: 'FR', dial: '+33', name: 'France', flag: '🇫🇷' },
    { code: 'AE', dial: '+971', name: 'UAE', flag: '🇦🇪' },
];

export const Auth: React.FC = () => {
    const [step, setStep] = useState<'PHONE' | 'OTP' | 'PROFILE'>('PHONE');
    const [country, setCountry] = useState(COUNTRIES[0]);
    const [rawPhone, setRawPhone] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    // SMS Config State
    const [showSmsConfig, setShowSmsConfig] = useState(false);
    const [smsConfig, setSmsConfig] = useState<SmsConfig | null>(null);
    const [tempConfig, setTempConfig] = useState<SmsConfig>({ accountSid: '', authToken: '', fromNumber: '' });

    // OTP State
    const [expectedOtp, setExpectedOtp] = useState('');
    const [enteredOtp, setEnteredOtp] = useState('');
    const [simulatedSms, setSimulatedSms] = useState<{title: string, body: string} | null>(null);
    
    // Profile State
    const [displayName, setDisplayName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [validatedE164, setValidatedE164] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const savedConfig = localStorage.getItem('twilio_config');
        if (savedConfig) {
            try {
                const parsed = JSON.parse(savedConfig);
                setSmsConfig(parsed);
                setTempConfig(parsed);
            } catch (e) {}
        }
    }, []);

    const saveSmsConfig = () => {
        if (tempConfig.accountSid && tempConfig.authToken && tempConfig.fromNumber) {
            localStorage.setItem('twilio_config', JSON.stringify(tempConfig));
            setSmsConfig(tempConfig);
            setShowSmsConfig(false);
            setError('');
        } else {
            setError('All Twilio fields are required to enable real SMS.');
        }
    };

    const clearSmsConfig = () => {
        localStorage.removeItem('twilio_config');
        setSmsConfig(null);
        setTempConfig({ accountSid: '', authToken: '', fromNumber: '' });
        setShowSmsConfig(false);
    };

    const handleRequestOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSimulatedSms(null);
        
        try {
            const fullNumber = `${country.dial}${rawPhone}`;
            if (!isValidPhoneNumber(fullNumber, country.code as any)) {
                setError('Please enter a valid phone number for this country.');
                return;
            }

            const parsed = parsePhoneNumber(fullNumber, country.code as any);
            const e164 = parsed.format('E.164');
            setValidatedE164(e164);

            setIsLoading(true);
            const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
            setExpectedOtp(generatedOtp);
            
            if (smsConfig) {
                // REAL SMS MODE
                try {
                    await sendRealSMS(e164, `Your LinkApp verification code is: ${generatedOtp}`, smsConfig);
                    setIsLoading(false);
                    setStep('OTP');
                } catch (err: any) {
                    setIsLoading(false);
                    setError(`Twilio Error: ${err.message}. Check your credentials or use Development Mode.`);
                }
            } else {
                // SIMULATED SMS MODE
                setTimeout(() => {
                    setSimulatedSms({
                        title: 'Messages',
                        body: `Your LinkApp code is ${generatedOtp}.`
                    });
                    setIsLoading(false);
                    setStep('OTP');
                }, 1500);
            }

        } catch (err) {
            setError('Invalid phone number format.');
        }
    };

    const handleVerifyOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (enteredOtp !== expectedOtp) {
            setError('Incorrect verification code.');
            return;
        }

        setIsLoading(true);
        setSimulatedSms(null);
        
        const existingUser = await db.getUserByPhone(validatedE164);
        
        setIsLoading(false);
        // If user exists AND is fully registered, log them in directly.
        // If they exist but isRegistered is false, they are a placeholder and must complete profile.
        if (existingUser && existingUser.isRegistered) {
            store.login(existingUser);
        } else {
            setStep('PROFILE');
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                // Compress image to max 400px width/height to ensure it saves properly
                const compressedBase64 = await compressImage(file, 400);
                setAvatarUrl(compressedBase64);
                setError('');
            } catch (err) {
                setError('Failed to process image. Please try another one.');
            }
        }
    };

    const handleCompleteProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!displayName.trim()) return;

        setIsLoading(true);
        
        const existingUser = await db.getUserByPhone(validatedE164);
        
        const newUser = {
            // If a placeholder exists, take over its ID so chat history is preserved
            id: existingUser ? existingUser.id : `u_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            phoneNumber: validatedE164,
            countryCode: country.dial,
            displayName: displayName.trim(),
            about: 'Hey there! I am using LinkApp.',
            lastSeen: Date.now(),
            isOnline: true,
            isRegistered: true, // Mark as fully registered
            avatarUrl: avatarUrl || `https://picsum.photos/seed/${validatedE164.replace(/\D/g, '')}/200/200`
        };

        await store.login(newUser);
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative">
            
            {/* Settings Button */}
            <button 
                onClick={() => setShowSmsConfig(true)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 bg-white rounded-full shadow-sm border border-slate-200 transition-colors"
                title="Configure Real SMS"
            >
                <Settings size={20} />
            </button>

            {/* SMS CONFIG MODAL */}
            {showSmsConfig && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in-95">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-slate-900">Real SMS Configuration</h3>
                            <button onClick={() => setShowSmsConfig(false)} className="text-slate-400 hover:text-slate-700"><X size={20}/></button>
                        </div>
                        <p className="text-sm text-slate-600 mb-4">
                            To receive actual SMS messages to your phone, enter your Twilio credentials. Otherwise, leave this blank to use simulated on-screen OTPs.
                        </p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">Account SID</label>
                                <input type="text" value={tempConfig.accountSid} onChange={e => setTempConfig({...tempConfig, accountSid: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="AC..." />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">Auth Token</label>
                                <input type="password" value={tempConfig.authToken} onChange={e => setTempConfig({...tempConfig, authToken: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="••••••••" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">Twilio Phone Number</label>
                                <input type="text" value={tempConfig.fromNumber} onChange={e => setTempConfig({...tempConfig, fromNumber: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="+1234567890" />
                            </div>
                        </div>
                        <div className="mt-6 flex gap-3">
                            <button onClick={clearSmsConfig} className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200">Use Simulated</button>
                            <button onClick={saveSmsConfig} className="flex-1 py-2 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700">Save & Enable</button>
                        </div>
                    </div>
                </div>
            )}

            {/* SIMULATED SMS NOTIFICATION POPUP */}
            {simulatedSms && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-slate-800/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl z-50 flex items-start gap-4 animate-in slide-in-from-top-8 fade-in duration-300 border border-slate-700">
                    <div className="bg-green-500 p-2 rounded-full shrink-0 mt-1">
                        <MessageSquare size={20} className="text-white" />
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{simulatedSms.title}</span>
                            <span className="text-xs text-slate-400">Just now</span>
                        </div>
                        <div className="font-medium text-sm leading-snug">{simulatedSms.body}</div>
                    </div>
                    <button onClick={() => setSimulatedSms(null)} className="text-slate-400 hover:text-white shrink-0 p-1">
                        <X size={16} />
                    </button>
                </div>
            )}

            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center text-brand-600">
                    <MessageSquare size={56} strokeWidth={1.5} />
                </div>
                <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900">
                    LinkApp Global
                </h2>
                <p className="mt-2 text-center text-sm text-slate-600 flex items-center justify-center gap-1">
                    <Globe size={16} /> Connect with anyone, anywhere.
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow-xl sm:rounded-xl sm:px-10 border border-slate-100">
                    
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-700 text-sm">
                            <AlertCircle size={18} className="shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    {step === 'PHONE' && (
                        <form className="space-y-6 animate-in fade-in slide-in-from-bottom-4" onSubmit={handleRequestOTP}>
                            
                            {smsConfig ? (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex gap-3 items-center">
                                    <CheckCircle2 className="text-green-600 shrink-0" size={18} />
                                    <div className="text-xs text-green-800 font-medium">
                                        Real SMS Delivery Enabled via Twilio.
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-3 items-start">
                                    <AlertCircle className="text-blue-600 shrink-0 mt-0.5" size={18} />
                                    <div className="text-xs text-blue-800 leading-relaxed">
                                        <strong>Development Mode:</strong> OTPs will appear on-screen. To receive real SMS to your phone, click the gear icon ⚙️ to configure Twilio.
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Verify your phone number
                                </label>
                                
                                <div className="flex flex-col gap-3">
                                    <select
                                        value={country.code}
                                        onChange={(e) => setCountry(COUNTRIES.find(c => c.code === e.target.value) || COUNTRIES[0])}
                                        className="block w-full px-3 py-3 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-sm bg-slate-50"
                                    >
                                        {COUNTRIES.map(c => (
                                            <option key={c.code} value={c.code}>
                                                {c.flag} {c.name} ({c.dial})
                                            </option>
                                        ))}
                                    </select>
                                    
                                    <div className="flex rounded-lg shadow-sm">
                                        <span className="inline-flex items-center px-4 rounded-l-lg border border-r-0 border-slate-300 bg-slate-100 text-slate-500 sm:text-sm font-medium">
                                            {country.dial}
                                        </span>
                                        <input
                                            type="tel"
                                            required
                                            value={rawPhone}
                                            onChange={(e) => setRawPhone(e.target.value.replace(/[^\d\s-]/g, ''))}
                                            className="flex-1 block w-full px-4 py-3 border border-slate-300 rounded-none rounded-r-lg focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-lg tracking-wide"
                                            placeholder="Phone number"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading || rawPhone.length < 5}
                                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50 transition-colors"
                            >
                                {isLoading ? 'Connecting...' : 'Next'}
                            </button>
                        </form>
                    )}

                    {step === 'OTP' && (
                        <form className="space-y-6 animate-in fade-in slide-in-from-right-4" onSubmit={handleVerifyOTP}>
                            <div className="text-center">
                                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                                    <ShieldCheck className="h-6 w-6 text-green-600" />
                                </div>
                                <h3 className="text-lg font-medium text-slate-900">Enter verification code</h3>
                                <p className="text-sm text-slate-500 mt-2">
                                    We've sent a code to <br/>
                                    <span className="font-semibold text-slate-800">{validatedE164}</span>
                                </p>
                                <button 
                                    type="button" 
                                    onClick={() => { setStep('PHONE'); setEnteredOtp(''); setError(''); setSimulatedSms(null); }}
                                    className="text-xs text-brand-600 hover:underline mt-1"
                                >
                                    Wrong number?
                                </button>
                            </div>

                            <div>
                                <input
                                    type="text"
                                    required
                                    maxLength={6}
                                    value={enteredOtp}
                                    onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                                    className="block w-full text-center px-4 py-3 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500 text-2xl tracking-[0.5em] font-mono"
                                    placeholder="------"
                                />
                                {!smsConfig && (
                                    <p className="text-xs text-center text-brand-600 mt-3 font-medium flex items-center justify-center gap-1">
                                        <Smartphone size={14} /> Check the simulated notification above.
                                    </p>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading || enteredOtp.length !== 6}
                                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50 transition-colors"
                            >
                                {isLoading ? 'Verifying...' : 'Verify & Login'}
                            </button>
                        </form>
                    )}

                    {step === 'PROFILE' && (
                        <form className="space-y-6 animate-in fade-in slide-in-from-right-4" onSubmit={handleCompleteProfile}>
                            <div className="text-center">
                                <h3 className="text-lg font-medium text-slate-900">Profile Info</h3>
                                <p className="text-sm text-slate-500 mt-1">Please provide your name and an optional photo.</p>
                            </div>

                            <div className="flex justify-center">
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    ref={fileInputRef} 
                                    onChange={handleImageUpload} 
                                />
                                <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-24 h-24 bg-slate-100 rounded-full border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:bg-slate-200 transition-colors overflow-hidden relative group"
                                >
                                    {avatarUrl ? (
                                        <>
                                            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Camera className="text-white" size={24} />
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <Camera size={24} className="mb-1" />
                                            <span className="text-xs font-medium">Add Photo</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div>
                                <input
                                    type="text"
                                    required
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    className="block w-full px-4 py-3 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-sm"
                                    placeholder="Type your name here"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading || !displayName.trim()}
                                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50 transition-colors"
                            >
                                {isLoading ? 'Saving...' : 'Complete Setup'}
                            </button>
                        </form>
                    )}
                    
                </div>
            </div>
        </div>
    );
};
