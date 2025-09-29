import React from 'react';
import { Tournament, TournamentNode, Team, AppSettings } from '../types';
import TeamLogo from './TeamLogo';

interface TournamentBracketProps {
  tournament: Tournament;
  shapeTheme: AppSettings['shapeTheme'];
  t: (key: string, params?: { [key: string]: string | number }) => string;
}

const Matchup: React.FC<{ node: TournamentNode, isFinal: boolean, shapeTheme: AppSettings['shapeTheme'], t: (key: string) => string }> = ({ node, isFinal, shapeTheme, t }) => {
    const isWinner1 = node.winner && node.team1 && node.winner.id === node.team1.id;
    const isWinner2 = node.winner && node.team2 && node.winner.id === node.team2.id;
    
    const getScoreDisplay = (team: 'team1' | 'team2') => {
        if (!node.result || !node.winner || !node.team1 || !node.team2) {
            return <div className="w-8 text-center">-</div>;
        }

        const isTeam1Winner = node.winner.id === node.team1.id;
        const team1Won = team === 'team1' ? isTeam1Winner : !isTeam1Winner;
        
        const score = team1Won ? Math.max(node.result.team1Score, node.result.team2Score) : Math.min(node.result.team1Score, node.result.team2Score);
        const penalties = team1Won ? (node.result.team1Penalties ?? node.result.team2Penalties) : (node.result.team1Penalties === undefined ? node.result.team2Penalties : node.result.team1Penalties);
        
        const scoreColor = team1Won ? 'text-white' : 'text-slate-400';

        return (
            <div className={`w-8 text-center font-bold ${scoreColor}`}>
                <span>{score}</span>
                {penalties !== undefined && <span className="text-xs opacity-70 ml-1">({penalties})</span>}
            </div>
        );
    };

    return (
        <div className={`flex flex-col gap-1 w-56 ${isFinal ? 'p-2 border-2 border-yellow-500 rounded-lg bg-slate-800/50 shadow-lg' : ''}`}>
            <div className={`flex items-center p-2 rounded transition-opacity duration-300 ${node.result && !isWinner1 ? 'opacity-50' : ''}`} style={{ backgroundColor: node.team1 ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.1)' }}>
                {node.team1 ? (
                    <>
                        <TeamLogo team={node.team1} size={20} shapeTheme={shapeTheme} />
                        <span className="font-semibold text-sm truncate flex-grow ml-2">{node.team1.name}</span>
                        {getScoreDisplay('team1')}
                    </>
                ) : <span className="text-sm text-slate-500 italic">{t('undetermined')}</span>}
            </div>
             <div className={`flex items-center p-2 rounded transition-opacity duration-300 ${node.result && !isWinner2 ? 'opacity-50' : ''}`} style={{ backgroundColor: node.team2 ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.1)' }}>
                {node.team2 ? (
                     <>
                        <TeamLogo team={node.team2} size={20} shapeTheme={shapeTheme} />
                        <span className="font-semibold text-sm truncate flex-grow ml-2">{node.team2.name}</span>
                        {getScoreDisplay('team2')}
                    </>
                ) : <span className="text-sm text-slate-500 italic">{t('undetermined')}</span>}
            </div>
        </div>
    );
};


const BracketHalf: React.FC<{ rounds: TournamentNode[][], side: 'left' | 'right', shapeTheme: AppSettings['shapeTheme'], t: (key: string) => string }> = ({ rounds, side, shapeTheme, t }) => {
    return (
        <div className={`flex ${side === 'right' ? 'flex-row-reverse' : 'flex-row'} items-center`}>
            {rounds.map((round, roundIndex) => (
                <div key={roundIndex} className={`flex items-center ${side === 'right' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className="flex flex-col items-center justify-around h-full" style={{ gap: `${Math.pow(2, roundIndex) * 20 + 8}px` }}>
                        {round.map(node => <Matchup key={node.matchId} node={node} isFinal={false} shapeTheme={shapeTheme} t={t} />)}
                    </div>
                    {roundIndex < rounds.length - 1 && (
                        <div className="flex flex-col items-center justify-around h-full" style={{ width: '40px' }}>
                            {Array.from({ length: round.length / 2 }).map((_, i) => (
                                <div key={i} className="flex-grow flex items-center relative" style={{ minHeight: `${Math.pow(2, roundIndex + 1) * 52}px`}}>
                                    <div className={`absolute w-1/2 h-full border-slate-600 ${side === 'left' ? 'border-r' : 'border-l'}`} ></div>
                                    <div className={`absolute w-1/2 h-px bg-slate-600 ${side === 'left' ? 'right-0' : 'left-0'}`}></div>
                                    <div className={`absolute w-px h-[calc(100%+1px)] bg-slate-600 top-[-0.5px] ${side === 'left' ? 'left-0' : 'right-0'}`}></div>
                                    <div className={`absolute w-px h-[calc(100%+1px)] bg-slate-600 top-[-0.5px] ${side === 'left' ? 'left-0' : 'right-0'}`}></div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

const getRoundName = (roundIndex: number, totalRounds: number, isFinal: boolean, t: (key: string, params?: { [key: string]: string | number }) => string) => {
    if (isFinal) return t("final");
    const teamsInRound = Math.pow(2, totalRounds - roundIndex);
    if (teamsInRound === 2) return t("semi_final");
    if (teamsInRound === 4) return t("quarter_final");
    return t("round_of", { teams: teamsInRound });
};


const TournamentBracket: React.FC<TournamentBracketProps> = ({ tournament, shapeTheme, t }) => {
    if (!tournament || !tournament.rounds || tournament.rounds.length === 0) {
        return <div className="text-white">Loading tournament...</div>;
    }

    const rounds = tournament.rounds;
    const finalRoundIndex = rounds.length - 1;
    const semiFinalRoundIndex = finalRoundIndex - 1;

    const leftRounds: TournamentNode[][] = [];
    const rightRounds: TournamentNode[][] = [];

    for (let i = 0; i < finalRoundIndex; i++) {
        const round = rounds[i];
        const half = round.length / 2;
        leftRounds.push(round.slice(0, half));
        rightRounds.push(round.slice(half));
    }

    const finalMatch = rounds[finalRoundIndex][0];
    
    const finalTeam1 = semiFinalRoundIndex >= 0 ? rounds[semiFinalRoundIndex][0]?.winner : finalMatch.team1;
    const finalTeam2 = semiFinalRoundIndex >= 0 ? rounds[semiFinalRoundIndex][1]?.winner : finalMatch.team2;


    return (
        <div className="flex justify-center items-center text-white min-w-max p-8">
            <BracketHalf rounds={leftRounds} side="left" shapeTheme={shapeTheme} t={t}/>
            
            <div className="flex flex-col items-center mx-8">
                <h3 className="font-bold text-xl mb-4 text-yellow-400 tracking-widest">{getRoundName(0, 0, true, t)}</h3>
                 <Matchup node={{
                    ...finalMatch,
                    team1: finalMatch.team1 ?? finalTeam1,
                    team2: finalMatch.team2 ?? finalTeam2,
                }} isFinal={true} shapeTheme={shapeTheme} t={t}/>
            </div>

            <BracketHalf rounds={rightRounds} side="right" shapeTheme={shapeTheme} t={t}/>
        </div>
    );
};

export default TournamentBracket;