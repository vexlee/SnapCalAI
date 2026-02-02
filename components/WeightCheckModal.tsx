import React, { useState, useEffect } from 'react';
import { X, Scale, Check, RefreshCw } from 'lucide-react';
import { getUserProfile, saveUserProfile } from '../services/storage';
import { UserProfile } from '../types';

interface WeightCheckModalProps {
    onClose: () => void;
    onConfirm: (weight: number) => void;
}

export const WeightCheckModal: React.FC<WeightCheckModalProps> = ({ onClose, onConfirm }) => {
    const [currentWeight, setCurrentWeight] = useState<number>(0);
    const [newWeight, setNewWeight] = useState<string>('');
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [profile, setProfile] = useState<UserProfile | null>(null);

    useEffect(() => {
        const loadProfile = async () => {
            const p = await getUserProfile();
            if (p) {
                setProfile(p);
                setCurrentWeight(p.weight);
                setNewWeight(p.weight.toString());
            }
            setIsLoading(false);
        };
        loadProfile();
    }, []);

    const handleConfirmWeight = async () => {
        const weightValue = parseFloat(newWeight) || currentWeight;

        if (isEditing && profile && weightValue !== currentWeight) {
            setIsSaving(true);
            try {
                await saveUserProfile({ ...profile, weight: weightValue });
                setCurrentWeight(weightValue);
            } catch (error) {
                console.error('Failed to save weight:', error);
            }
            setIsSaving(false);
        }

        onConfirm(weightValue);
    };

    if (isLoading) {
        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center animate-in fade-in duration-300">
                <div className="bg-white[#1A1C26] rounded-[28px] p-8 w-[90%] max-w-sm shadow-2xl">
                    <div className="flex justify-center">
                        <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center animate-in fade-in duration-300"
            onClick={onClose}
        >
            <div
                className="bg-white[#1A1C26] rounded-t-[28px] sm:rounded-[28px] p-6 w-full sm:w-[90%] sm:max-w-sm shadow-2xl animate-in slide-in-from-bottom duration-500"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                            <Scale size={20} className="text-primary-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-gray-900">Weight Check</h2>
                            <p className="text-[10px] text-gray-400 font-medium">Before viewing your report</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200:bg-white/10 transition-colors"
                    >
                        <X size={16} className="text-gray-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="bg-gray-50 rounded-2xl p-5 mb-6">
                    <p className="text-xs text-gray-500 mb-4 text-center">
                        Is your current weight still accurate?
                    </p>

                    {!isEditing ? (
                        <div className="text-center">
                            <div className="text-4xl font-black text-gray-900 mb-1">
                                {currentWeight}
                                <span className="text-lg font-bold text-gray-400 ml-1">kg</span>
                            </div>
                            <button
                                onClick={() => setIsEditing(true)}
                                className="text-xs text-primary-600 font-bold flex items-center gap-1 mx-auto hover:underline"
                            >
                                <RefreshCw size={12} />
                                Update weight
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-3">
                            <div className="relative">
                                <input
                                    type="number"
                                    value={newWeight}
                                    onChange={(e) => setNewWeight(e.target.value)}
                                    className="w-28 text-center text-3xl font-black text-gray-900 bg-white[#0F111A] border-2 border-primary-200 rounded-xl py-2 focus:outline-none focus:border-primary-500"
                                    step="0.1"
                                    min="20"
                                    max="300"
                                    autoFocus
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">kg</span>
                            </div>
                            <button
                                onClick={() => {
                                    setIsEditing(false);
                                    setNewWeight(currentWeight.toString());
                                }}
                                className="text-xs text-gray-400 font-medium hover:text-gray-600"
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3.5 rounded-xl bg-gray-100 text-gray-600 font-bold text-sm hover:bg-gray-200:bg-white/10 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirmWeight}
                        disabled={isSaving}
                        className="flex-1 py-3.5 rounded-xl bg-primary-600 text-white font-bold text-sm hover:bg-primary-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isSaving ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <Check size={16} />
                                Confirm
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
