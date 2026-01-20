import React, { useEffect, useState } from 'react';
import { Sparkles, Zap } from 'lucide-react';

interface ScanningAnimationProps {
    isActive: boolean;
    onComplete?: () => void;
    message?: string;
}

export const ScanningAnimation: React.FC<ScanningAnimationProps> = ({ isActive, onComplete, message = "Analyzing Meal..." }) => {
    const [progress, setProgress] = useState(0);

    // Reset progress when activated
    useEffect(() => {
        if (isActive) {
            setProgress(0);
        }
    }, [isActive]);

    // Simulate progress
    useEffect(() => {
        if (!isActive) return;

        const interval = setInterval(() => {
            setProgress(prev => {
                // Fast at start, slow at end, cap at 92% until external completion
                if (prev >= 92) return 92;

                // Dynamic speed based on current progress
                const increment = prev < 30 ? 2 : prev < 60 ? 1 : 0.5;
                return Math.min(prev + increment, 92);
            });
        }, 70);

        return () => clearInterval(interval);
    }, [isActive]);

    // Cleanup effect
    useEffect(() => {
        if (!isActive && progress > 0) {
            // If we became inactive but had progress, jump to 100 for a moment if needed,
            // but usually the component will be unmounted by parent.
            // If the parent uses this component's presence to block UI, we might depend on unmount.
        }
    }, [isActive]);

    if (!isActive) return null;

    const radius = 60;
    const stroke = 6;
    const normalizedRadius = radius - stroke * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center pointer-events-none">
            {/* Dimmed backdrop - optional, kept minimal to focus on 'window' aspect */}
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity" />

            <div className="relative bg-[#1a1c26]/95 backdrop-blur-xl p-8 rounded-[40px] border border-white/10 shadow-2xl pointer-events-auto flex flex-col items-center animate-in zoom-in-95 duration-300 min-w-[300px]">

                {/* Glowing Background Effect - Contained */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-royal-500/20 blur-3xl rounded-full animate-pulse pointer-events-none" />

                {/* Main Circle Container */}
                <div className="relative w-40 h-40 flex items-center justify-center mb-6">

                    {/* Rotating Outer Ring */}
                    <div className="absolute inset-0 border-4 border-royal-500/10 rounded-full border-t-royal-500/30 animate-[spin_3s_linear_infinite]" />

                    {/* SVG Progress Circle */}
                    <svg
                        height={radius * 2}
                        width={radius * 2}
                        className="rotate-[-90deg] drop-shadow-[0_0_10px_rgba(124,58,237,0.3)]"
                    >
                        <circle
                            stroke="rgba(255,255,255,0.1)"
                            strokeWidth={stroke}
                            fill="transparent"
                            r={normalizedRadius}
                            cx={radius}
                            cy={radius}
                        />
                        <circle
                            stroke="url(#gradient)"
                            strokeWidth={stroke}
                            strokeDasharray={circumference + ' ' + circumference}
                            style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.1s linear' }}
                            strokeLinecap="round"
                            fill="transparent"
                            r={normalizedRadius}
                            cx={radius}
                            cy={radius}
                        />
                        <defs>
                            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#7c3aed" /> {/* royal-600 */}
                                <stop offset="100%" stopColor="#a78bfa" /> {/* royal-400 */}
                            </linearGradient>
                        </defs>
                    </svg>

                    {/* Center Content */}
                    <div className="absolute flex flex-col items-center justify-center text-white">
                        <span className="text-3xl font-black tracking-tighter tabular-nums text-transparent bg-clip-text bg-gradient-to-br from-white to-white/70">
                            {Math.round(progress)}%
                        </span>
                    </div>
                </div>

                {/* Text and Status */}
                <div className="text-center space-y-2 relative z-10">
                    <h3 className="text-lg font-bold text-white tracking-tight flex items-center justify-center gap-2">
                        <Sparkles size={18} className="text-yellow-400 animate-pulse" />
                        {message}
                    </h3>
                    <p className="text-xs text-white/50 font-medium">
                        Identifying ingredients...
                    </p>
                </div>
            </div>
        </div>
    );
};
