/**
 * Virtual Avatar Component
 * Displays an animated character that reacts to user logging behavior
 */

import React, { useEffect, useState, useCallback } from 'react';
import { AvatarState, getAvatarStatus, subscribeToAvatarChanges, AvatarStatus } from '../services/avatar';

interface AvatarProps {
    size?: 'sm' | 'md' | 'lg';
    showStatus?: boolean;
    onClick?: () => void;
}

// Size configurations
const SIZES = {
    sm: { container: 'w-10 h-10', face: 'w-8 h-8', fontSize: 'text-lg' },
    md: { container: 'w-14 h-14', face: 'w-11 h-11', fontSize: 'text-2xl' },
    lg: { container: 'w-20 h-20', face: 'w-16 h-16', fontSize: 'text-4xl' },
};

// State-specific styles
const STATE_STYLES = {
    [AvatarState.OPTIMAL]: {
        bgGradient: 'from-emerald-400 to-green-500',
        shadow: 'shadow-emerald-200 dark:shadow-emerald-900/40',
        ring: 'ring-emerald-300',
        pulse: false,
    },
    [AvatarState.WARNING]: {
        bgGradient: 'from-amber-400 to-orange-500',
        shadow: 'shadow-amber-200 dark:shadow-amber-900/40',
        ring: 'ring-amber-300',
        pulse: true,
    },
    [AvatarState.CRITICAL]: {
        bgGradient: 'from-red-400 to-rose-600',
        shadow: 'shadow-red-200 dark:shadow-red-900/40',
        ring: 'ring-red-300',
        pulse: true,
    },
};

export const Avatar: React.FC<AvatarProps> = ({
    size = 'md',
    showStatus = false,
    onClick,
}) => {
    const [status, setStatus] = useState<AvatarStatus | null>(null);
    const [isFeeding, setIsFeeding] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const loadStatus = useCallback(async () => {
        try {
            const avatarStatus = await getAvatarStatus();
            setStatus(avatarStatus);
        } catch (e) {
            console.error('Failed to load avatar status:', e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadStatus();

        // Subscribe to avatar state changes
        const unsubscribe = subscribeToAvatarChanges(() => {
            loadStatus();
        });

        // Handle feed animation
        const handleFeed = () => {
            setIsFeeding(true);
            setTimeout(() => setIsFeeding(false), 800);
        };
        window.addEventListener('avatar-feed', handleFeed);

        return () => {
            unsubscribe();
            window.removeEventListener('avatar-feed', handleFeed);
        };
    }, [loadStatus]);

    const sizeConfig = SIZES[size];
    const state = status?.state || AvatarState.WARNING;
    const stateStyle = STATE_STYLES[state];

    if (isLoading) {
        return (
            <div className={`${sizeConfig.container} rounded-full bg-gray-200 dark:bg-white/10 animate-pulse`} />
        );
    }

    return (
        <div className="relative inline-block">
            {/* Main Avatar Container */}
            <button
                onClick={onClick}
                className={`
          ${sizeConfig.container} 
          relative rounded-full 
          bg-gradient-to-br ${stateStyle.bgGradient}
          shadow-lg ${stateStyle.shadow}
          flex items-center justify-center
          transition-all duration-500 ease-out
          hover:scale-110 active:scale-95
          ${stateStyle.pulse ? 'animate-pulse' : ''}
          ${isFeeding ? 'animate-bounce scale-125' : ''}
          ${onClick ? 'cursor-pointer' : 'cursor-default'}
        `}
                disabled={!onClick}
                type="button"
            >
                {/* Inner glow effect */}
                <div className="absolute inset-1 bg-white/20 rounded-full blur-sm" />

                {/* Face container */}
                <div className={`${sizeConfig.face} relative z-10 flex items-center justify-center`}>
                    <AvatarFace state={state} fontSize={sizeConfig.fontSize} isFeeding={isFeeding} />
                </div>

                {/* Feed sparkles animation */}
                {isFeeding && <FeedSparkles />}
            </button>

            {/* Status indicator dot */}
            <div className={`
        absolute -bottom-0.5 -right-0.5
        w-3 h-3 rounded-full
        border-2 border-white dark:border-[#0c0e17]
        ${state === AvatarState.OPTIMAL ? 'bg-emerald-500' :
                    state === AvatarState.WARNING ? 'bg-amber-500' : 'bg-red-500'}
        ${stateStyle.pulse ? 'animate-ping' : ''}
      `} />

            {/* Optional status tooltip */}
            {showStatus && status && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 
          bg-white dark:bg-[#1a1c26] rounded-xl px-3 py-2 
          shadow-lg border border-gray-100 dark:border-white/10
          whitespace-nowrap z-50
          animate-in fade-in slide-in-from-top-2 duration-300
        ">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                        {status.stateReason}
                    </p>
                </div>
            )}
        </div>
    );
};

// Avatar face SVG component with expressions
const AvatarFace: React.FC<{ state: AvatarState; fontSize: string; isFeeding: boolean }> = ({
    state,
    fontSize,
    isFeeding,
}) => {
    // SVG-based face for better visual quality
    return (
        <svg viewBox="0 0 100 100" className="w-full h-full">
            {/* Face background - skin tone */}
            <circle cx="50" cy="50" r="45" fill="#FFE4C4" />

            {/* Blush circles */}
            <circle cx="25" cy="55" r="8" fill="#FFB6C1" opacity="0.5" />
            <circle cx="75" cy="55" r="8" fill="#FFB6C1" opacity="0.5" />

            {/* Eyes */}
            {state === AvatarState.OPTIMAL ? (
                // Happy eyes (closed crescents)
                <>
                    <path d="M30 42 Q35 38 40 42" stroke="#333" strokeWidth="3" fill="none" strokeLinecap="round" />
                    <path d="M60 42 Q65 38 70 42" stroke="#333" strokeWidth="3" fill="none" strokeLinecap="round" />
                </>
            ) : state === AvatarState.WARNING ? (
                // Worried eyes (open, slightly raised brows)
                <>
                    <ellipse cx="35" cy="42" rx="6" ry="7" fill="#333" />
                    <ellipse cx="65" cy="42" rx="6" ry="7" fill="#333" />
                    <circle cx="37" cy="40" r="2" fill="white" />
                    <circle cx="67" cy="40" r="2" fill="white" />
                    {/* Sweat drop */}
                    <path d="M78 35 Q80 40 78 45 Q76 40 78 35" fill="#87CEEB" />
                </>
            ) : (
                // Critical eyes (droopy, tired)
                <>
                    <ellipse cx="35" cy="45" rx="6" ry="4" fill="#333" />
                    <ellipse cx="65" cy="45" rx="6" ry="4" fill="#333" />
                    <path d="M28 38 L42 42" stroke="#333" strokeWidth="2" strokeLinecap="round" />
                    <path d="M72 38 L58 42" stroke="#333" strokeWidth="2" strokeLinecap="round" />
                </>
            )}

            {/* Mouth */}
            {state === AvatarState.OPTIMAL ? (
                // Big happy smile
                <path
                    d="M35 60 Q50 78 65 60"
                    stroke="#333"
                    strokeWidth="3"
                    fill="none"
                    strokeLinecap="round"
                />
            ) : state === AvatarState.WARNING ? (
                // Nervous/wavy mouth
                <path
                    d="M35 65 Q42 62 50 65 Q58 68 65 65"
                    stroke="#333"
                    strokeWidth="3"
                    fill="none"
                    strokeLinecap="round"
                />
            ) : (
                // Sad/exhausted mouth
                <path
                    d="M38 68 Q50 60 62 68"
                    stroke="#333"
                    strokeWidth="3"
                    fill="none"
                    strokeLinecap="round"
                />
            )}

            {/* Feeding animation - open mouth with fork */}
            {isFeeding && (
                <>
                    <ellipse cx="50" cy="65" rx="12" ry="10" fill="#FF6B6B" />
                    <ellipse cx="50" cy="63" rx="8" ry="6" fill="#1a1a1a" />
                </>
            )}

            {/* Sparkle effect when optimal */}
            {state === AvatarState.OPTIMAL && (
                <>
                    <path d="M15 25 L17 30 L15 35 L13 30 Z" fill="#FFD700" />
                    <path d="M85 20 L87 25 L85 30 L83 25 Z" fill="#FFD700" />
                </>
            )}
        </svg>
    );
};

// Feed animation sparkles
const FeedSparkles: React.FC = () => (
    <div className="absolute inset-0 pointer-events-none overflow-visible">
        {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
                key={i}
                className="absolute animate-ping"
                style={{
                    left: `${50 + Math.cos((i * Math.PI) / 3) * 60}%`,
                    top: `${50 + Math.sin((i * Math.PI) / 3) * 60}%`,
                    animationDelay: `${i * 0.1}s`,
                    animationDuration: '0.6s',
                }}
            >
                <span className="text-yellow-400 text-lg">✨</span>
            </div>
        ))}
    </div>
);

export default Avatar;
