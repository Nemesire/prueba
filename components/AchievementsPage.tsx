import React from 'react';
import { useApp } from '../context/AppContext.tsx';
import { Card } from './common/UIComponents.tsx';
import { ACHIEVEMENT_DEFINITIONS, IconTrophy } from '../constants.tsx';
import { Achievement } from '../types.ts';

const AchievementsPage: React.FC = () => {
    const { achievements } = useApp();

    const unlockedAchievements = new Map<string, Achievement>(achievements.map(a => [a.id, a]));

    const allAchievements = ACHIEVEMENT_DEFINITIONS.map(def => ({
        ...def,
        unlocked: unlockedAchievements.has(def.id),
        unlockedDate: unlockedAchievements.get(def.id)?.unlockedDate,
    }));

    const unlockedCount = unlockedAchievements.size;
    const totalCount = ACHIEVEMENT_DEFINITIONS.length;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <IconTrophy className="w-8 h-8"/>
                    Mis Logros
                </h1>
                <div className="text-right">
                    <p className="font-bold text-xl text-primary">{unlockedCount} / {totalCount}</p>
                    <p className="text-sm text-slate-400">Logros Desbloqueados</p>
                </div>
            </div>

            <Card>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {allAchievements.map(ach => (
                        <div
                            key={ach.id}
                            className={`p-6 rounded-lg border-2 transition-all duration-300 flex flex-col items-center text-center ${
                                ach.unlocked
                                ? 'bg-slate-700/50 border-primary shadow-lg shadow-primary/10'
                                : 'bg-slate-800/50 border-slate-700 opacity-60'
                            }`}
                        >
                            <div className={`text-6xl mb-4 transition-transform duration-300 ${ach.unlocked ? 'transform scale-110' : ''}`}>
                                {ach.icon}
                            </div>
                            <h3 className={`font-bold text-xl ${ach.unlocked ? 'text-white' : 'text-slate-400'}`}>
                                {ach.name}
                            </h3>
                            <p className="text-sm text-slate-400 mt-2 flex-grow">
                                {ach.description}
                            </p>
                            {ach.unlocked && ach.unlockedDate && (
                                <p className="text-xs text-secondary mt-4 font-semibold">
                                    Desbloqueado: {new Date(ach.unlockedDate).toLocaleDateString()}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
};

export default AchievementsPage;