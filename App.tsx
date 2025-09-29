
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
// FIX: Removed duplicate 'Difficulty' import.
import { Team, Difficulty, MatchResult, Career, Fixture, LeagueTableRow, Tournament, LeagueInfo, League, TournamentNode, AppSettings, LanguageCode, ColorTheme, ShapeTheme, BallDesign, TrailEffect, SupportedFont, FieldDesign } from './types';
import { LEAGUES, TOURNAMENTS, DIFFICULTY_LEVELS, GAME_DURATION, HALF_TIME, SUPPORTED_LANGUAGES } from './constants';
import GameCanvas from './components/GameCanvas';
import LeagueTable from './components/LeagueTable';
import TournamentBracket from './components/TournamentBracket';
import PenaltyShootout from './components/PenaltyShootout';
import { loadCareer, saveCareer, createNewCareer, advanceToNextSeason } from './utils/career';
import { simulateMatch, calculateLeagueTable, generateFixtures, generateTournamentBracket } from './utils/gameModes';
import MenuBackgroundCanvas from './components/MenuBackgroundCanvas';
import TeamLogo from './components/TeamLogo';
import { useTranslation } from './hooks/useTranslation';

type GameMode = 'quick' | 'league' | 'tournament' | 'career';
type GameState = 
    'menu' | 
    'continent_selection' | 'country_selection' | 'league_selection' | 'tournament_selection' | 'team_selection' | 
    'quick_match_opponent_continent_selection' | 'quick_match_opponent_country_selection' | 'quick_match_opponent_league_selection' | 'quick_match_opponent_team_selection' |
    'match' | 'career_hub' | 'league_hub' | 'tournament_hub' | 'settings';
type SettingsScreen = 'main' | 'visuals' | 'gameplay' | 'language';

const defaultSettings: AppSettings = {
    language: 'tr',
    colorTheme: 'dark',
    shapeTheme: 'default',
    difficulty: 'normal',
    ballDesign: 'default',
    trailEffect: 'default',
    font: 'Nunito',
    fieldDesign: 'classic_day',
};

const App: React.FC = () => {
    const [gameState, setGameState] = useState<GameState>('menu');
    const [settingsScreen, setSettingsScreen] = useState<SettingsScreen>('main');
    const [gameMode, setGameMode] = useState<GameMode | null>(null);
    const [career, setCareer] = useState<Career | null>(null);
    
    // Selection states
    const [selectedContinent, setSelectedContinent] = useState<string | null>(null);
    const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
    const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
    const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);

    // Team states
    const [playerTeam, setPlayerTeam] = useState<Team | null>(null);
    const [aiTeam, setAiTeam] = useState<Team | null>(null);
    
    // Settings
    const [settings, setSettings] = useState<AppSettings>(() => {
        try {
            const saved = localStorage.getItem('parmakFutboluSettings');
            return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
        } catch {
            return defaultSettings;
        }
    });

    const { t } = useTranslation(settings.language);

    useEffect(() => {
        localStorage.setItem('parmakFutboluSettings', JSON.stringify(settings));
        
        // Handle Color Theme
        document.documentElement.className = `theme-${settings.colorTheme}`;
        
        // Handle Shape Themes
        const shapeThemes = ['pixel', 'retro', 'sketch'];
        shapeThemes.forEach(theme => document.documentElement.classList.remove(`theme-${theme}`));
        if (settings.shapeTheme !== 'default') {
            document.documentElement.classList.add(`theme-${settings.shapeTheme}`);
        }
        
        // Handle Font
        document.body.style.fontFamily = `'${settings.font}', sans-serif`;
        if (settings.font === 'Press Start 2P') {
            document.body.classList.add('font-pixel');
        } else {
            document.body.classList.remove('font-pixel');
        }
    }, [settings]);


    // Standalone mode states
    const [currentLeague, setCurrentLeague] = useState<League | null>(null);
    const [currentTournament, setCurrentTournament] = useState<Tournament | null>(null);

    // Match-specific state
    const [score, setScore] = useState({ player1: 0, player2: 0 });
    const [time, setTime] = useState(0);
    const [isPaused, setIsPaused] = useState(true);
    const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
    const [showPenaltyShootout, setShowPenaltyShootout] = useState(false);
    const [triggerReset, setTriggerReset] = useState({ count: 0, kickOffFor: null as 'player1' | 'player2' | 'random' | null });
    const [goalScorer, setGoalScorer] = useState<'player1' | 'player2' | null>(null);
    const [isHalfTime, setIsHalfTime] = useState(false);
    const [hasHalfTimeBeenTriggered, setHasHalfTimeBeenTriggered] = useState(false);
    const [countdown, setCountdown] = useState<number | string | null>(null);


    const [commentary, setCommentary] = useState('');
    
    useEffect(() => {
        const savedCareer = loadCareer();
        if (savedCareer) {
            setCareer(savedCareer);
        }
    }, []);

    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (gameState === 'match' && !isPaused && time < GAME_DURATION) {
            timer = setInterval(() => {
                setTime(prevTime => prevTime + 1);
            }, 1000);
        }

        if (time === HALF_TIME && !hasHalfTimeBeenTriggered && gameState === 'match') {
            setIsPaused(true);
            setIsHalfTime(true);
            setHasHalfTimeBeenTriggered(true);
        }

        if (time >= GAME_DURATION && gameState === 'match') {
            handleMatchFinish();
        }
        return () => clearInterval(timer);
    }, [gameState, isPaused, time, isHalfTime, hasHalfTimeBeenTriggered]);
    
    useEffect(() => {
        if (countdown === null || !isPaused) return;

        if (typeof countdown === 'number' && countdown > 0) {
            const timer = setTimeout(() => setCountdown(c => (typeof c === 'number' ? c - 1 : c)), 1000);
            return () => clearTimeout(timer);
        } else if (countdown === 0) {
            const timer = setTimeout(() => setCountdown(t('countdown_start')), 1000);
            return () => clearTimeout(timer);
        } else if (countdown === t('countdown_start')) {
            const timer = setTimeout(() => {
                setCountdown(null);
                setIsPaused(false);
                
                if (isHalfTime) {
                    setIsHalfTime(false);
                    setTriggerReset(prev => ({ count: prev.count + 1, kickOffFor: 'player1' }));
                } else {
                     setTriggerReset(prev => ({ count: prev.count + 1, kickOffFor: 'random' }));
                }
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [countdown, isHalfTime, isPaused, t]);

    const resetToMenu = () => {
        setGameState('menu');
        setGameMode(null);
        setSelectedContinent(null);
        setSelectedCountry(null);
        setSelectedLeagueId(null);
        setSelectedTournamentId(null);
        setPlayerTeam(null);
        setAiTeam(null);
        // Do not reset currentLeague/Tournament to allow "Continue"
    };

    const startMatch = (p1Team: Team, p2Team: Team) => {
        setPlayerTeam(p1Team);
        setAiTeam(p2Team);
        setScore({ player1: 0, player2: 0 });
        setTime(0);
        setIsPaused(true);
        setMatchResult(null);
        setCommentary('');
        setIsHalfTime(false);
        setHasHalfTimeBeenTriggered(false);
        setTriggerReset({ count: 0, kickOffFor: null }); // Will be triggered by countdown
        setGameState('match');
        setCountdown(3);
    };

    const handleGoal = useCallback((scorer: 'player1' | 'player2') => {
        setScore(prev => ({ ...prev, [scorer]: prev[scorer] + 1 }));
        setGoalScorer(scorer);
        
        setTimeout(() => {
            setGoalScorer(null);
            const concedingTeam = scorer === 'player1' ? 'player2' : 'player1';
            setTriggerReset(prev => ({ count: prev.count + 1, kickOffFor: concedingTeam }));
        }, 3500); // Duration of goal celebration
    }, []);
    
    const generateLocalCommentary = (team1Name: string, team2Name: string, result: MatchResult): string => {
        const { team1Score, team2Score } = result;
        const totalGoals = team1Score + team2Score;
        const diff = Math.abs(team1Score - team2Score);

        let titleKey: string;
        let bodyKey: string;
        let params: any = { team1Name, team2Name, team1Score, team2Score };

        if (team1Score === team2Score) {
            if (team1Score === 0) {
                titleKey = 'commentary_no_score_draw_title';
                bodyKey = 'commentary_no_score_draw_body';
            } else if (team1Score >= 3) {
                titleKey = 'commentary_high_score_draw_title';
                bodyKey = 'commentary_high_score_draw_body';
            } else {
                titleKey = 'commentary_draw_title';
                bodyKey = 'commentary_draw_body';
            }
        } else {
            const isPlayerWinner = team1Score > team2Score;
            const winnerName = isPlayerWinner ? team1Name : team2Name;
            const loserName = isPlayerWinner ? team2Name : team1Name;
            const winningScore = Math.max(team1Score, team2Score);
            const losingScore = Math.min(team1Score, team2Score);
            params = { winnerName, loserName, winningScore, losingScore };

            if (diff >= 5) {
                titleKey = 'commentary_big_win_title';
                bodyKey = 'commentary_big_win_body';
            } else if (diff >= 3) {
                titleKey = 'commentary_show_win_title';
                bodyKey = 'commentary_show_win_body';
            } else if (diff === 1 && totalGoals > 3) {
                titleKey = 'commentary_thriller_win_title';
                bodyKey = 'commentary_thriller_win_body';
            } else if (diff === 1) {
                titleKey = 'commentary_narrow_win_title';
                bodyKey = 'commentary_narrow_win_body';
            } else {
                titleKey = 'commentary_standard_win_title';
                bodyKey = 'commentary_standard_win_body';
            }
        }
        
        return `${t(titleKey, params)}\n\n${t(bodyKey, params)}`;
    };


    const handleMatchFinish = () => {
        if(isPaused) return; // Prevent multiple calls
        setIsPaused(true);
        const result: MatchResult = { team1Score: score.player1, team2Score: score.player2 };
        
        const isTournamentMatch = gameMode === 'tournament' || (gameMode === 'career' && career?.europeanCompetition);

        if (isTournamentMatch && result.team1Score === result.team2Score) {
            setShowPenaltyShootout(true);
        } else {
            setMatchResult(result);
            if(playerTeam && aiTeam) {
                 const commentaryText = generateLocalCommentary(playerTeam.name, aiTeam.name, result);
                 setCommentary(commentaryText);
            }
        }
    };
    
    const handlePenaltyFinish = (winner: 'player' | 'ai', scores: { player: number, ai: number }) => {
        const finalResult: MatchResult = {
            team1Score: score.player1,
            team2Score: score.player2,
            team1Penalties: winner === 'player' ? scores.player : scores.player,
            team2Penalties: winner === 'player' ? scores.ai : scores.ai,
        };

        if (playerTeam && aiTeam) {
             if (winner === 'player') {
                finalResult.team1Score++; // Represent win
             } else {
                finalResult.team2Score++;
             }
        }
        
        setShowPenaltyShootout(false);
        setMatchResult(finalResult);
        if(playerTeam && aiTeam) {
            const commentaryText = generateLocalCommentary(playerTeam.name, aiTeam.name, finalResult);
            setCommentary(commentaryText);
        }
    };

    const startSecondHalf = () => {
        setIsPaused(true);
        setCountdown(3);
    };

    const updateStandaloneLeague = () => {
        if (!currentLeague || !playerTeam || !aiTeam || !matchResult || !selectedLeagueId) return;

        const leagueInfo = LEAGUES[selectedLeagueId];
        const updatedFixtures = [...currentLeague.fixtures];
        const currentWeek = currentLeague.currentWeek;

        const playerFixtureIndex = updatedFixtures.findIndex(f => 
            f.round === currentWeek + 1 && 
            ((f.team1.id === playerTeam.id && f.team2.id === aiTeam.id) || (f.team1.id === aiTeam.id && f.team2.id === playerTeam.id))
        );
        if (playerFixtureIndex !== -1) {
            updatedFixtures[playerFixtureIndex].result = matchResult;
        }

        const weekFixtures = updatedFixtures.filter(f => f.round === currentWeek + 1);
        weekFixtures.forEach((fixture) => {
            const fixtureIndex = updatedFixtures.findIndex(f => f.round === fixture.round && f.team1.id === fixture.team1.id && f.team2.id === fixture.team2.id);
            if (fixtureIndex !== -1 && !updatedFixtures[fixtureIndex].result) {
                updatedFixtures[fixtureIndex].result = simulateMatch();
            }
        });

        const newWeek = currentWeek + 1;
        const newTable = calculateLeagueTable(leagueInfo.teams, updatedFixtures);

        setCurrentLeague({
            fixtures: updatedFixtures,
            table: newTable,
            currentWeek: newWeek,
        });
    };

    const updateStandaloneTournament = () => {
        if (!currentTournament || !playerTeam || !aiTeam || !matchResult) return;
    
        const newTournament = JSON.parse(JSON.stringify(currentTournament)) as Tournament;
        const currentRoundIndex = newTournament.currentRound;
        const currentRound = newTournament.rounds[currentRoundIndex];
    
        const matchIndex = currentRound.findIndex(m => 
            (m.team1?.id === playerTeam.id && m.team2?.id === aiTeam.id) || 
            (m.team1?.id === aiTeam.id && m.team2?.id === playerTeam.id)
        );
    
        if (matchIndex === -1) return;
    
        const playedMatch = currentRound[matchIndex];
        playedMatch.result = matchResult;
    
        const score1 = matchResult.team1Score + (matchResult.team1Penalties || 0);
        const score2 = matchResult.team2Score + (matchResult.team2Penalties || 0);
    
        playedMatch.winner = score1 > score2 ? playedMatch.team1 : playedMatch.team2;

    
        currentRound.forEach(match => {
            if (!match.result && match.team1 && match.team2) {
                const simResult = simulateMatch();
                match.result = simResult;
                match.winner = simResult.team1Score >= simResult.team2Score ? match.team1 : match.team2;
            }
        });
    
        const isRoundComplete = currentRound.every(m => m.winner);
        if (isRoundComplete && currentRoundIndex < newTournament.rounds.length - 1) {
            const nextRound = newTournament.rounds[currentRoundIndex + 1];
            for (let i = 0; i < currentRound.length; i += 2) {
                const nextMatchIndex = Math.floor(i / 2);
                if (nextRound[nextMatchIndex]) {
                    nextRound[nextMatchIndex].team1 = currentRound[i].winner;
                    nextRound[nextMatchIndex].team2 = currentRound[i + 1].winner;
                }
            }
            newTournament.currentRound++;
        } else if (isRoundComplete && currentRoundIndex === newTournament.rounds.length - 1) {
            newTournament.winner = currentRound[0].winner;
        }
        
        setCurrentTournament(newTournament);
    };

    const exitMatch = () => {
        if (!matchResult || !playerTeam) {
             setGameState('menu');
             return;
        }

        switch (gameMode) {
            case 'quick':
                resetToMenu();
                break;
            case 'league':
                updateStandaloneLeague();
                setGameState('league_hub');
                break;
            case 'tournament':
                 updateStandaloneTournament();
                 setGameState('tournament_hub');
                 break;
            case 'career':
                setGameState('career_hub');
                break;
            default:
                setGameState('menu');
        }
    };

    const titleStyle: React.CSSProperties = {
        textShadow: '-3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 3px 3px 0 #000, 0 0 15px rgba(255, 255, 255, 0.2)'
    };
    
    const boxPixelClass = settings.shapeTheme === 'pixel' ? 'box-pixel' : 'bg-slate-800/60 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-700/50';
    const buttonPixelClass = settings.shapeTheme === 'pixel' ? 'btn-pixel' : 'rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105';

    const renderMenu = () => (
        <div className="text-center relative z-10 flex flex-col items-center gap-8">
            <h1 className="text-6xl font-extrabold text-white animate-sway" style={titleStyle}>
                {t('app_title')}
            </h1>
            <div className={`p-6 md:p-8 ${boxPixelClass}`}>
                <div className="main-menu-buttons grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                    <button onClick={() => { setGameMode('quick'); setCurrentLeague(null); setCurrentTournament(null); setGameState('continent_selection'); }} className={`bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3 px-6 text-xl ${buttonPixelClass}`}>{t('quick_match')}</button>
                    
                    {currentLeague && gameMode !== 'league' ? (
                        <button onClick={() => { setGameMode('league'); setGameState('league_hub'); }} className={`bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-6 text-xl ${buttonPixelClass}`}>{t('continue_league')}</button>
                    ) : (
                        <button onClick={() => { setGameMode('league'); setCurrentTournament(null); setCurrentLeague(null); setGameState('continent_selection'); }} className={`bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-6 text-xl ${buttonPixelClass}`}>{t('league_mode')}</button>
                    )}

                    {currentTournament && gameMode !== 'tournament' ? (
                         <button onClick={() => { setGameMode('tournament'); setGameState('tournament_hub'); }} className={`bg-amber-500 hover:bg-amber-400 text-white font-bold py-3 px-6 text-xl ${buttonPixelClass}`}>{t('continue_tournament')}</button>
                    ) : (
                        <button onClick={() => { setGameMode('tournament'); setCurrentLeague(null); setCurrentTournament(null); setGameState('continent_selection'); }} className={`bg-amber-500 hover:bg-amber-400 text-white font-bold py-3 px-6 text-xl ${buttonPixelClass}`}>{t('tournament_mode')}</button>
                    )}

                    {career ? (
                        <button onClick={() => { setGameMode('career'); setGameState('career_hub'); }} className={`bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 px-6 text-xl ${buttonPixelClass}`}>{t('continue_career')}</button>
                    ) : (
                        <button onClick={() => { setGameMode('career'); setGameState('continent_selection'); }} className={`bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 px-6 text-xl ${buttonPixelClass}`}>{t('new_career')}</button>
                    )}
                </div>
            </div>
        </div>
    );

    const renderSelectionScreen = (titleKey: string, items: {key: string, name: string}[], onSelect: (key: string) => void, onBack: () => void, isNameKey = false) => {
        const isContinentSelection = titleKey === 'select_continent' || titleKey === 'select_opponent_continent';
        const gridClass = isContinentSelection
            ? 'flex flex-col gap-4'
            : 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4';

        return (
            <div className="text-center relative z-10 flex flex-col items-center gap-8 w-full max-w-4xl">
                <h1 className="text-5xl md:text-6xl font-extrabold text-white animate-sway" style={titleStyle}>
                    {t(titleKey)}
                </h1>
                <div className={`p-6 md:p-8 w-full ${boxPixelClass}`}>
                    <div className={`${gridClass} mb-6 selection-grid`}>
                        {items.map(item => (
                            <button key={item.key} onClick={() => onSelect(item.key)} className={`p-4 bg-slate-800 hover:bg-slate-700 text-lg font-semibold border border-slate-700 ${buttonPixelClass}`}>
                                {isNameKey ? t(item.name) : item.name}
                            </button>
                        ))}
                    </div>
                    <div className="text-center">
                        <button onClick={onBack} className={`btn-back bg-rose-600 hover:bg-rose-500 text-white font-bold py-2 px-8 shadow-lg ${buttonPixelClass}`}>{t('back')}</button>
                    </div>
                </div>
            </div>
        );
    };

    const continents = useMemo(() => [...new Set(Object.values(LEAGUES).map(l => l.continent))], []);
    const countries = useMemo(() => selectedContinent ? [...new Set(Object.values(LEAGUES).filter(l => l.continent === selectedContinent).map(l => l.country))] : [], [selectedContinent]);
    const leagues = useMemo(() => selectedCountry ? Object.values(LEAGUES).filter(l => l.country === selectedCountry) : [], [selectedCountry]);
    const tournaments = useMemo(() => selectedCountry ? Object.values(TOURNAMENTS).filter(t => t.country === selectedCountry) : [], [selectedCountry]);
    
    const renderMatchUI = () => {
        if (!playerTeam || !aiTeam) return <div>{t('loading_teams')}</div>;
        
        const isMatchOver = matchResult !== null;
        const showPauseMenu = isPaused && !isMatchOver && !isHalfTime && countdown === null;
        const showCountdown = countdown !== null;

        return (
            <div className="flex flex-col w-full h-full bg-slate-800 text-white">
                 {/* Scoreboard */}
                <header className="flex flex-col items-center p-2 bg-slate-900/70 backdrop-blur-sm w-full flex-shrink-0 text-white border-b border-slate-700/50 shadow-lg z-10">
                    <div className="flex justify-between items-center w-full px-2">
                        <div className="flex items-center gap-2 flex-1 justify-start">
                            <TeamLogo team={playerTeam} size={32} shapeTheme={settings.shapeTheme}/>
                            <span className="font-bold text-lg md:text-xl">{playerTeam.abbr}</span>
                        </div>
                        
                        <div className={`text-3xl md:text-4xl font-bold transition-transform duration-500 scoreboard-score whitespace-nowrap ${goalScorer ? 'animate-score-pop' : ''}`}>
                          {score.player1} - {score.player2}
                        </div>
                        
                        <div className="flex items-center gap-2 flex-1 justify-end">
                            <span className="font-bold text-lg md:text-xl">{aiTeam.abbr}</span>
                            <TeamLogo team={aiTeam} size={32} shapeTheme={settings.shapeTheme}/>
                        </div>
                    </div>
                    <div className={`font-mono text-lg tracking-wider scoreboard-timer mt-1`}>
                        {time}'
                    </div>
                </header>

                {/* Game Area */}
                <div className="flex-grow flex items-center justify-center relative overflow-hidden bg-green-900/20">
                    <GameCanvas
                        player1Team={playerTeam}
                        player2Team={aiTeam}
                        isOpponentAI={true}
                        difficulty={settings.difficulty}
                        isPaused={isPaused}
                        onGoal={handleGoal}
                        triggerReset={triggerReset}
                        controlSplitRatio={0.5}
                        settings={settings}
                    />
                </div>
                
                 {/* Controls */}
                <footer className="flex justify-center items-center p-2 bg-slate-900/80 w-full flex-shrink-0 border-t border-slate-700/50">
                    <button onClick={() => setIsPaused(p => !p)} className={`btn-match-control bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2 px-6 shadow-md ${buttonPixelClass}`} disabled={isMatchOver || isHalfTime || showCountdown}>
                        {isPaused && !showPauseMenu ? t('start') : (isPaused ? t('continue') : t('pause'))}
                    </button>
                </footer>

                {/* Overlays */}
                {isMatchOver && renderPostMatch()}
                {isHalfTime && (
                    <div className="absolute inset-0 z-20 bg-black/80 flex flex-col items-center justify-center p-4 gap-4 backdrop-blur-sm">
                        <h2 className="text-5xl font-bold text-white mb-4">{t('half_time')}</h2>
                        <p className="text-4xl font-bold text-yellow-400 mb-6">{score.player1} - {score.player2}</p>
                        <button onClick={startSecondHalf} className={`bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3 px-8 text-xl w-72 ${buttonPixelClass}`}>{t('start_second_half')}</button>
                    </div>
                )}
                {showPauseMenu && (
                    <div className="absolute inset-0 z-20 bg-black/80 flex flex-col items-center justify-center p-4 gap-4 backdrop-blur-sm">
                         <h2 className="text-5xl font-bold text-white mb-4">{t('game_paused')}</h2>
                         <button onClick={() => setIsPaused(false)} className={`bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3 px-8 rounded-lg text-xl w-60 ${buttonPixelClass}`}>{t('continue')}</button>
                         <button onClick={() => setGameState('menu')} className={`btn-back bg-rose-500 hover:bg-rose-400 text-white font-bold py-3 px-8 rounded-lg text-xl w-60 ${buttonPixelClass}`}>{t('return_to_main_menu')}</button>
                    </div>
                )}
                 {showCountdown && (
                     <div className="absolute inset-0 z-30 bg-black/70 flex flex-col items-center justify-center p-4 backdrop-blur-sm pointer-events-none">
                        <div className="text-9xl font-extrabold text-white animate-ping" style={{animationDuration: '1s'}}>{countdown}</div>
                     </div>
                )}
                {showPenaltyShootout && <div className="absolute inset-0 z-30 bg-black/70 flex items-center justify-center"><PenaltyShootout playerTeam={playerTeam} aiTeam={aiTeam} difficulty={settings.difficulty} onFinish={handlePenaltyFinish} t={t} /></div>}
            </div>
        );
    };

    const renderPostMatch = () => (
        <div className="absolute inset-0 z-20 bg-black/80 flex flex-col items-center justify-center p-4 backdrop-blur-sm">
            <h2 className="text-5xl font-bold text-white mb-4">{t('match_finished')}</h2>
            <p className="text-6xl font-bold text-yellow-400 mb-6">{matchResult?.team1Score} - {matchResult?.team2Score}</p>
            {commentary && (
                <div className="post-match-commentary bg-slate-700 p-4 rounded-lg max-w-md text-center mb-6 shadow-lg border border-slate-600">
                    <p className="text-white whitespace-pre-wrap font-semibold">{commentary}</p>
                </div>
            )}
            <button onClick={exitMatch} className={`bg-sky-500 hover:bg-sky-400 text-white font-bold py-3 px-8 text-xl ${buttonPixelClass}`}>{t('continue')}</button>
        </div>
    );
    
    const renderTeamSelection = (teams: Team[], titleKey: string, onBack: () => void, onTeamSelect: (team: Team) => void) => {
        return (
            <div className="text-center relative z-10 flex flex-col items-center gap-8 w-full max-w-6xl h-full py-4">
                <h1 className="text-5xl md:text-6xl font-extrabold text-white animate-sway flex-shrink-0" style={titleStyle}>
                    {t(titleKey)}
                </h1>
                <div className={`p-6 md:p-8 w-full flex-grow flex flex-col min-h-0 ${boxPixelClass}`}>
                    <div className="team-selection-grid grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 overflow-y-auto flex-grow p-1">
                        {teams.map(team => (
                            <button key={team.id} onClick={() => onTeamSelect(team)} className={`flex flex-col items-center p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 ${buttonPixelClass}`}>
                                <TeamLogo team={team} size={64} shapeTheme={settings.shapeTheme} />
                                <span className="text-white text-center font-semibold mt-2">{team.name}</span>
                            </button>
                        ))}
                    </div>
                    <div className="text-center mt-8 flex-shrink-0">
                        <button onClick={onBack} className={`btn-back bg-rose-600 hover:bg-rose-500 text-white font-bold py-2 px-8 ${buttonPixelClass}`}>{t('back')}</button>
                    </div>
                </div>
            </div>
        )
    }

    const renderSettingsScreen = () => {
        const SettingButton = <T extends string>({ value, option, current, setter }: { value: string, option: T, current: T, setter: (value: T) => void }) => (
            <button onClick={() => setter(option)} className={`p-3 font-bold transition-colors duration-200 text-sm ${buttonPixelClass} ${current === option ? 'bg-emerald-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}>
                {value}
            </button>
        );

        const renderBackButton = (target: 'main' | 'menu') => (
             <div className="text-center mt-6">
                <button onClick={() => {
                    if (target === 'menu') {
                        setGameState('menu');
                    }
                    setSettingsScreen('main');
                }} className={`btn-back bg-rose-600 hover:bg-rose-500 text-white font-bold py-2 px-8 ${buttonPixelClass}`}>
                    {t(target === 'menu' ? 'return_to_main_menu' : 'back')}
                </button>
            </div>
        );

        const renderVisualsScreen = () => (
             <div className={`p-6 md:p-8 w-full flex-grow min-h-0 flex flex-col ${boxPixelClass}`}>
                <h2 className="text-3xl font-bold text-white mb-4 text-center flex-shrink-0">{t('visual_settings')}</h2>
                <div className="overflow-y-auto space-y-6 flex-grow">
                  {/* Visual Theme */}
                  <div>
                      <h3 className="text-xl font-semibold text-slate-300 mb-3 text-left">{t('visual_theme')}</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <SettingButton value={t('default')} option="default" current={settings.shapeTheme} setter={(v: ShapeTheme) => setSettings(s => ({...s, shapeTheme: v}))} />
                          <SettingButton value={t('pixel_art')} option="pixel" current={settings.shapeTheme} setter={(v: ShapeTheme) => setSettings(s => ({...s, shapeTheme: v}))} />
                          <SettingButton value={t('retro')} option="retro" current={settings.shapeTheme} setter={(v: ShapeTheme) => setSettings(s => ({...s, shapeTheme: v}))} />
                          <SettingButton value={t('sketch')} option="sketch" current={settings.shapeTheme} setter={(v: ShapeTheme) => setSettings(s => ({...s, shapeTheme: v}))} />
                      </div>
                  </div>
                  {/* Color Theme */}
                  <div>
                      <h3 className="text-xl font-semibold text-slate-300 mb-3 text-left">{t('color_theme')}</h3>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          <SettingButton value={t('dark')} option="dark" current={settings.colorTheme} setter={(v: ColorTheme) => setSettings(s => ({...s, colorTheme: v}))} />
                          <SettingButton value={t('light')} option="light" current={settings.colorTheme} setter={(v: ColorTheme) => setSettings(s => ({...s, colorTheme: v}))} />
                          <SettingButton value={t('synthwave')} option="synthwave" current={settings.colorTheme} setter={(v: ColorTheme) => setSettings(s => ({...s, colorTheme: v}))} />
                          <SettingButton value={t('forest')} option="forest" current={settings.colorTheme} setter={(v: ColorTheme) => setSettings(s => ({...s, colorTheme: v}))} />
                          <SettingButton value={t('sepia')} option="sepia" current={settings.colorTheme} setter={(v: ColorTheme) => setSettings(s => ({...s, colorTheme: v}))} />
                      </div>
                  </div>
                  {/* Field Design */}
                  <div>
                      <h3 className="text-xl font-semibold text-slate-300 mb-3 text-left">{t('field_design')}</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <SettingButton value={t('field_design_classic_day')} option="classic_day" current={settings.fieldDesign} setter={(v: FieldDesign) => setSettings(s => ({...s, fieldDesign: v}))} />
                          <SettingButton value={t('field_design_lush_pitch')} option="lush_pitch" current={settings.fieldDesign} setter={(v: FieldDesign) => setSettings(s => ({...s, fieldDesign: v}))} />
                          <SettingButton value={t('field_design_worn_pitch')} option="worn_pitch" current={settings.fieldDesign} setter={(v: FieldDesign) => setSettings(s => ({...s, fieldDesign: v}))} />
                          <SettingButton value={t('field_design_astro_turf')} option="astro_turf" current={settings.fieldDesign} setter={(v: FieldDesign) => setSettings(s => ({...s, fieldDesign: v}))} />
                          <SettingButton value={t('field_design_street_soccer')} option="street_soccer" current={settings.fieldDesign} setter={(v: FieldDesign) => setSettings(s => ({...s, fieldDesign: v}))} />
                          <SettingButton value={t('field_design_beach_soccer')} option="beach_soccer" current={settings.fieldDesign} setter={(v: FieldDesign) => setSettings(s => ({...s, fieldDesign: v}))} />
                          <SettingButton value={t('field_design_pixel_pitch')} option="pixel_pitch" current={settings.fieldDesign} setter={(v: FieldDesign) => setSettings(s => ({...s, fieldDesign: v}))} />
                          <SettingButton value={t('field_design_retro_grid')} option="retro_grid" current={settings.fieldDesign} setter={(v: FieldDesign) => setSettings(s => ({...s, fieldDesign: v}))} />
                      </div>
                  </div>
                   {/* Ball Design */}
                   <div>
                      <h3 className="text-xl font-semibold text-slate-300 mb-3 text-left">{t('ball_design')}</h3>
                      <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                         <SettingButton value={t('modern')} option="default" current={settings.ballDesign} setter={(v: BallDesign) => setSettings(s => ({...s, ballDesign: v}))} />
                         <SettingButton value={t('classic')} option="classic" current={settings.ballDesign} setter={(v: BallDesign) => setSettings(s => ({...s, ballDesign: v}))} />
                         <SettingButton value={t('simple')} option="simple" current={settings.ballDesign} setter={(v: BallDesign) => setSettings(s => ({...s, ballDesign: v}))} />
                         <SettingButton value={t('star')} option="star" current={settings.ballDesign} setter={(v: BallDesign) => setSettings(s => ({...s, ballDesign: v}))} />
                         <SettingButton value={t('rings')} option="rings" current={settings.ballDesign} setter={(v: BallDesign) => setSettings(s => ({...s, ballDesign: v}))} />
                         <SettingButton value={t('checkered')} option="checkered" current={settings.ballDesign} setter={(v: BallDesign) => setSettings(s => ({...s, ballDesign: v}))} />
                         <SettingButton value={t('atomic')} option="atomic" current={settings.ballDesign} setter={(v: BallDesign) => setSettings(s => ({...s, ballDesign: v}))} />
                         <SettingButton value={t('eye')} option="eye" current={settings.ballDesign} setter={(v: BallDesign) => setSettings(s => ({...s, ballDesign: v}))} />
                         <SettingButton value={t('eight_ball')} option="eight_ball" current={settings.ballDesign} setter={(v: BallDesign) => setSettings(s => ({...s, ballDesign: v}))} />
                         <SettingButton value={t('tennis')} option="tennis" current={settings.ballDesign} setter={(v: BallDesign) => setSettings(s => ({...s, ballDesign: v}))} />
                         <SettingButton value={t('planet')} option="planet" current={settings.ballDesign} setter={(v: BallDesign) => setSettings(s => ({...s, ballDesign: v}))} />
                         <SettingButton value={t('voltage')} option="voltage" current={settings.ballDesign} setter={(v: BallDesign) => setSettings(s => ({...s, ballDesign: v}))} />
                      </div>
                  </div>
                  {/* Trail Effect */}
                   <div>
                      <h3 className="text-xl font-semibold text-slate-300 mb-3 text-left">{t('ball_trail_effect')}</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                         <SettingButton value={t('default')} option="default" current={settings.trailEffect} setter={(v: TrailEffect) => setSettings(s => ({...s, trailEffect: v}))} />
                         <SettingButton value={t('flame')} option="flame" current={settings.trailEffect} setter={(v: TrailEffect) => setSettings(s => ({...s, trailEffect: v}))} />
                         <SettingButton value={t('pixel')} option="pixel" current={settings.trailEffect} setter={(v: TrailEffect) => setSettings(s => ({...s, trailEffect: v}))} />
                         <SettingButton value={t('none')} option="none" current={settings.trailEffect} setter={(v: TrailEffect) => setSettings(s => ({...s, trailEffect: v}))} />
                      </div>
                  </div>
                  {/* Font */}
                   <div>
                      <h3 className="text-xl font-semibold text-slate-300 mb-3 text-left">{t('font')}</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                         <SettingButton value="Nunito" option="Nunito" current={settings.font} setter={(v: SupportedFont) => setSettings(s => ({...s, font: v}))} />
                         <SettingButton value="Roboto" option="Roboto" current={settings.font} setter={(v: SupportedFont) => setSettings(s => ({...s, font: v}))} />
                         <SettingButton value={t('pixel')} option="Press Start 2P" current={settings.font} setter={(v: SupportedFont) => setSettings(s => ({...s, font: v}))} />
                         <SettingButton value={t('retro')} option="VT323" current={settings.font} setter={(v: SupportedFont) => setSettings(s => ({...s, font: v}))} />
                         <SettingButton value={t('stylish')} option="Lobster" current={settings.font} setter={(v: SupportedFont) => setSettings(s => ({...s, font: v}))} />
                      </div>
                  </div>
                </div>
                {renderBackButton('main')}
             </div>
        );

        const renderGameplayScreen = () => (
            <div className={`p-6 md:p-8 w-full ${boxPixelClass}`}>
                <h2 className="text-3xl font-bold text-white mb-4 text-center">{t('gameplay_settings')}</h2>
                <div className="space-y-6">
                    {/* Difficulty */}
                    <div>
                        <h3 className="text-xl font-semibold text-slate-300 mb-3 text-left">{t('difficulty')}</h3>
                        <div className="grid grid-cols-3 lg:grid-cols-5 gap-3">
                            {DIFFICULTY_LEVELS.map(level => <SettingButton key={level.id} value={t(level.labelKey)} option={level.id} current={settings.difficulty} setter={(v: Difficulty) => setSettings(s => ({...s, difficulty: v}))} />)}
                        </div>
                    </div>
                </div>
                 {renderBackButton('main')}
            </div>
        );
        
        const renderLanguageScreen = () => (
             <div className={`p-6 md:p-8 w-full flex-grow min-h-0 flex flex-col ${boxPixelClass}`}>
                <h2 className="text-3xl font-bold text-white mb-4 text-center flex-shrink-0">{t('language')}</h2>
                <div className="overflow-y-auto grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 flex-grow">
                    {SUPPORTED_LANGUAGES.map(lang => <SettingButton key={lang.id} value={lang.label} option={lang.id} current={settings.language} setter={(v: LanguageCode) => setSettings(s => ({...s, language: v}))} />)}
                </div>
                {renderBackButton('main')}
             </div>
        );

        const renderMainSettings = () => (
             <div className={`p-6 md:p-8 w-full ${boxPixelClass}`}>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                    <button onClick={() => setSettingsScreen('visuals')} className={`bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 px-6 text-xl ${buttonPixelClass}`}>{t('visual_settings')}</button>
                    <button onClick={() => setSettingsScreen('gameplay')} className={`bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-6 text-xl ${buttonPixelClass}`}>{t('gameplay_settings')}</button>
                    <button onClick={() => setSettingsScreen('language')} className={`bg-amber-500 hover:bg-amber-400 text-white font-bold py-3 px-6 text-xl md:col-span-2 ${buttonPixelClass}`}>{t('language')}</button>
                 </div>
                 {renderBackButton('menu')}
             </div>
        );

        let screenContent;
        switch(settingsScreen) {
            case 'main': screenContent = renderMainSettings(); break;
            case 'visuals': screenContent = renderVisualsScreen(); break;
            case 'gameplay': screenContent = renderGameplayScreen(); break;
            case 'language': screenContent = renderLanguageScreen(); break;
            default: screenContent = renderMainSettings();
        }

        return (
             <div className="relative w-full h-full flex items-center justify-center p-4">
                <MenuBackgroundCanvas settings={settings}/>
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                    <div className="relative z-10 flex flex-col gap-8 w-full max-w-4xl h-full max-h-[95vh]">
                        { settingsScreen === 'main' && (
                            <div className="text-center">
                                <h1 className="text-5xl md:text-6xl font-extrabold text-white animate-sway" style={titleStyle}>
                                    {t('settings')}
                                </h1>
                            </div>
                        )}
                        {screenContent}
                    </div>
                </div>
            </div>
        );
    };
    
    const renderCareerHub = () => {
        if (!career) return null;
        const playerTeam = Object.values(LEAGUES).flatMap(l => l.teams).find(t => t.id === career.playerTeamId);
        if (!playerTeam) return null;

        const playerLeague = career.leagues[career.playerLeagueId];
        const currentWeek = playerLeague.currentWeek;
        const upcomingFixture = playerLeague.fixtures.find(f => f.round === currentWeek + 1 && (f.team1.id === playerTeam.id || f.team2.id === playerTeam.id));
        
        return (
            <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 text-white">
                 <div className="bg-slate-800/80 p-4 rounded-xl text-center shadow-lg border border-slate-700">
                    <h2 className="text-3xl font-bold">{t('career_hub_title', { season: career.currentSeason })}</h2>
                    <p className="text-slate-300">{playerTeam.name} | {t(`league_${career.playerLeagueId}_name`)}</p>
                 </div>
                 
                 {upcomingFixture && (
                     <div className="bg-slate-800/80 p-6 rounded-xl text-center shadow-lg border border-slate-700">
                        <h3 className="text-xl font-semibold text-slate-300 mb-4">{t('next_match_week', { week: currentWeek + 1 })}</h3>
                        <div className="flex items-center justify-center gap-8 mb-4">
                             <span className="text-2xl font-bold">{upcomingFixture.team1.name}</span>
                             <span className="text-slate-400 text-2xl">{t('vs')}</span>
                             <span className="text-2xl font-bold">{upcomingFixture.team2.name}</span>
                        </div>
                        <button onClick={() => {
                            const opponent = upcomingFixture.team1.id === playerTeam.id ? upcomingFixture.team2 : upcomingFixture.team1;
                            startMatch(playerTeam, opponent);
                        }} className="bg-emerald-500 hover:bg-emerald-400 font-bold py-3 px-8 rounded-lg text-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105">{t('play_match')}</button>
                     </div>
                 )}
                 
                 <LeagueTable table={playerLeague.table} playerTeam={playerTeam} shapeTheme={settings.shapeTheme} t={t} />
                 
                 <button onClick={() => setGameState('menu')} className="bg-rose-600 hover:bg-rose-500 font-bold py-2 px-6 rounded-lg self-center shadow-lg transition-all duration-300">{t('main_menu')}</button>
            </div>
        )
    }

    const renderLeagueHub = () => {
        if (!currentLeague || !playerTeam || !selectedLeagueId) return null;
        
        const leagueInfo = LEAGUES[selectedLeagueId];
        const upcomingFixture = currentLeague.fixtures.find(f => f.round === currentLeague.currentWeek + 1 && (f.team1.id === playerTeam.id || f.team2.id === playerTeam.id));
        const isSeasonOver = currentLeague.currentWeek >= (leagueInfo.teams.length - 1) * 2;
        
        return (
            <div className="flex flex-col h-screen bg-slate-900 text-white">
                <header className="flex-shrink-0 bg-slate-800 p-4 text-center shadow-lg border-b border-slate-700">
                    <h2 className="text-3xl font-bold">{t(`league_${leagueInfo.id}_name`)}</h2>
                    <p className="text-slate-300">{t('week', { week: currentLeague.currentWeek })}</p>
                </header>
                
                <main className="flex-grow overflow-y-auto p-4 space-y-6">
                    {isSeasonOver ? (
                        <div className="bg-slate-800/80 p-6 rounded-xl text-center shadow-lg border border-slate-700">
                             <h3 className="text-2xl font-bold text-yellow-400 mb-4">{t('season_over')}</h3>
                             <p className="mb-4">{t('champion', { teamName: currentLeague.table[0].team.name })}</p>
                        </div>
                    ) : upcomingFixture ? (
                         <div className="bg-slate-800/80 p-6 rounded-xl text-center shadow-lg border border-slate-700">
                            <h3 className="text-xl font-semibold text-slate-300 mb-4">{t('next_match_week', { week: currentLeague.currentWeek + 1 })}</h3>
                            <div className="flex items-center justify-center gap-8 mb-4">
                                 <span className="text-2xl font-bold">{upcomingFixture.team1.name}</span>
                                 <span className="text-slate-400 text-2xl">{t('vs')}</span>
                                 <span className="text-2xl font-bold">{upcomingFixture.team2.name}</span>
                            </div>
                            <button onClick={() => {
                                const opponent = upcomingFixture.team1.id === playerTeam.id ? upcomingFixture.team2 : upcomingFixture.team1;
                                startMatch(playerTeam, opponent);
                            }} className="bg-emerald-500 hover:bg-emerald-400 font-bold py-3 px-8 rounded-lg text-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105">{t('play_match')}</button>
                         </div>
                     ) : null}
                     
                     <LeagueTable table={currentLeague.table} playerTeam={playerTeam} shapeTheme={settings.shapeTheme} t={t} />
                </main>
                 
                <footer className="flex-shrink-0 p-4 text-center border-t border-slate-700 bg-slate-800">
                     <button onClick={() => setGameState('menu')} className="bg-rose-600 hover:bg-rose-500 font-bold py-2 px-8 rounded-lg shadow-lg transition-all duration-300">{t('main_menu')}</button>
                </footer>
            </div>
        )
    };

    const renderTournamentHub = () => {
        if (!currentTournament || !playerTeam || !selectedTournamentId) return null;
    
        const playerIsInNextMatch = currentTournament.rounds[currentTournament.currentRound]?.some(match => match.team1?.id === playerTeam.id || match.team2?.id === playerTeam.id);
        const playerIsEliminated = !playerIsInNextMatch && currentTournament.currentRound > 0;
        const upcomingMatch = currentTournament.rounds[currentTournament.currentRound]?.find(match => match.team1?.id === playerTeam.id || match.team2?.id === playerTeam.id);
    
        return (
            <div className="flex flex-col h-screen bg-slate-900 text-white">
                <header className="flex-shrink-0 bg-slate-800 p-4 text-center shadow-lg border-b border-slate-700">
                    <h2 className="text-3xl font-bold">{t(`tournament_${selectedTournamentId}_name`)}</h2>
                </header>

                <main className="flex-grow flex flex-col p-4 space-y-4 min-h-0">
                    <div className="flex-shrink-0 bg-slate-800/80 p-4 rounded-xl text-center shadow-lg border border-slate-700">
                        {currentTournament.winner ? (
                            <div>
                                <h3 className="text-2xl font-extrabold text-yellow-400">{t('tournament_champion')}</h3>
                                <p className="text-xl mt-1">{currentTournament.winner.name}</p>
                            </div>
                        ) : playerIsEliminated ? (
                            <div>
                                <h3 className="text-2xl font-bold text-red-400">{t('eliminated')}</h3>
                            </div>
                        ) : upcomingMatch && upcomingMatch.team1 && upcomingMatch.team2 ? (
                            <div>
                                <h3 className="text-lg font-semibold text-slate-300 mb-2">{t('next_match')}</h3>
                                <div className="flex items-center justify-center gap-4 mb-3">
                                     <span className="text-xl font-bold">{upcomingMatch.team1.name}</span>
                                     <span className="text-slate-400">{t('vs')}</span>
                                     <span className="text-xl font-bold">{upcomingMatch.team2.name}</span>
                                </div>
                                <button onClick={() => {
                                    const opponent = upcomingMatch.team1.id === playerTeam.id ? upcomingMatch.team2 : upcomingMatch.team1;
                                    startMatch(playerTeam, opponent);
                                }} className="bg-emerald-500 hover:bg-emerald-400 font-bold py-2 px-6 rounded-lg text-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105">{t('play_match')}</button>
                            </div>
                        ) :  (
                            <div>
                                <h3 className="text-lg font-semibold text-slate-300">{t('round_passed_waiting')}</h3>
                            </div>
                        )}
                    </div>
        
                    <div className="flex-grow overflow-x-auto py-4 rounded-lg bg-slate-800/50 border border-slate-700">
                        <TournamentBracket tournament={currentTournament} shapeTheme={settings.shapeTheme} t={t} />
                    </div>
                </main>
    
                <footer className="flex-shrink-0 p-4 text-center border-t border-slate-700 bg-slate-800">
                    <button onClick={() => setGameState('menu')} className="bg-rose-600 hover:bg-rose-500 font-bold py-2 px-8 rounded-lg shadow-lg transition-all duration-300">{t('main_menu')}</button>
                </footer>
            </div>
        );
    };

    const renderContent = () => {
        const menuAndSelectionStates = [
            'menu', 'continent_selection', 'country_selection', 'league_selection', 'tournament_selection', 'team_selection',
            'quick_match_opponent_continent_selection', 'quick_match_opponent_country_selection', 'quick_match_opponent_league_selection', 'quick_match_opponent_team_selection'
        ];
        
        if (gameState === 'settings') {
            return renderSettingsScreen();
        }

        if (menuAndSelectionStates.includes(gameState)) {
            let content;
            switch(gameState) {
                case 'menu':
                    content = renderMenu();
                    break;
                case 'continent_selection':
                    content = renderSelectionScreen('select_continent', continents.map(c => ({ key: c, name: `continent_${c}` })), (c) => { setSelectedContinent(c); setGameState('country_selection'); }, resetToMenu, true);
                    break;
                case 'country_selection':
                    content = renderSelectionScreen('select_country', countries.map(c => ({ key: c, name: `country_${c.replace(' & ', '_')}` })), (c) => { setSelectedCountry(c); setGameState(gameMode === 'tournament' ? 'tournament_selection' : 'league_selection'); }, () => setGameState('continent_selection'), true);
                    break;
                case 'league_selection':
                    content = renderSelectionScreen('select_league', leagues.map(l => ({ key: l.id, name: t(`league_${l.id}_name`) })), (id) => { setSelectedLeagueId(id); setGameState('team_selection'); }, () => setGameState('country_selection'));
                    break;
                case 'tournament_selection':
                    content = renderSelectionScreen('select_tournament', tournaments.map(tourney => ({ key: tourney.id, name: t(`tournament_${tourney.id}_name`) })), (id) => { setSelectedTournamentId(id); setGameState('team_selection'); }, () => setGameState('country_selection'));
                    break;
                case 'team_selection': {
                    if (gameMode === 'tournament' && selectedTournamentId) {
                        const tournamentInfo = TOURNAMENTS[selectedTournamentId];
                        const teams = tournamentInfo.leagueIds.flatMap(id => LEAGUES[id].teams);
                        content = renderTeamSelection(teams, "select_your_team", () => setGameState('tournament_selection'), (team) => {
                            setPlayerTeam(team);
                            const bracket = generateTournamentBracket(teams, team, 32, tournamentInfo.name);
                            setCurrentTournament(bracket);
                            setGameState('tournament_hub');
                        });
                    } else if (selectedLeagueId) {
                        const league = LEAGUES[selectedLeagueId];
                        content = renderTeamSelection(league.teams, "select_your_team", () => setGameState('league_selection'), (team) => {
                             setPlayerTeam(team);
                            if (gameMode === 'career') {
                                const newCareer = createNewCareer(team, league.id);
                                setCareer(newCareer);
                                setGameState('career_hub');
                            } else if (gameMode === 'quick') {
                                setSelectedContinent(null);
                                setSelectedCountry(null);
                                setSelectedLeagueId(null);
                                setGameState('quick_match_opponent_continent_selection');
                            } else if (gameMode === 'league') {
                               const fixtures = generateFixtures(league.teams);
                               const table = calculateLeagueTable(league.teams, []);
                               setCurrentLeague({fixtures, table, currentWeek: 0});
                               setGameState('league_hub');
                            }
                        });
                    }
                    break;
                }
                 case 'quick_match_opponent_continent_selection':
                    content = renderSelectionScreen('select_opponent_continent', continents.map(c => ({ key: c, name: `continent_${c}` })), (c) => { setSelectedContinent(c); setGameState('quick_match_opponent_country_selection'); }, () => setGameState('team_selection'), true);
                    break;
                case 'quick_match_opponent_country_selection':
                    content = renderSelectionScreen('select_opponent_country', countries.map(c => ({ key: c, name: `country_${c.replace(' & ', '_')}` })), (c) => { setSelectedCountry(c); setGameState('quick_match_opponent_league_selection'); }, () => setGameState('quick_match_opponent_continent_selection'), true);
                    break;
                case 'quick_match_opponent_league_selection':
                    content = renderSelectionScreen('select_opponent_league', leagues.map(l => ({ key: l.id, name: t(`league_${l.id}_name`) })), (id) => { setSelectedLeagueId(id); setGameState('quick_match_opponent_team_selection'); }, () => setGameState('quick_match_opponent_country_selection'));
                    break;
                case 'quick_match_opponent_team_selection': {
                     if (selectedLeagueId && playerTeam) {
                        const league = LEAGUES[selectedLeagueId];
                        content = renderTeamSelection(league.teams.filter(t => t.id !== playerTeam.id), "select_opponent_team", () => setGameState('quick_match_opponent_league_selection'), (team) => {
                           startMatch(playerTeam, team);
                        });
                    }
                    break;
                }
            }
            return (
                <div className="relative w-full h-full flex items-center justify-center">
                    <MenuBackgroundCanvas settings={settings}/>
                    <button onClick={() => { setGameState('settings'); setSettingsScreen('main'); }} className="settings-btn" aria-label={t('settings')}>
                        ⚙️
                    </button>
                    <div className="absolute inset-0 flex items-center justify-center p-4">
                        {content}
                    </div>
                </div>
            );
        }

        switch (gameState) {
            case 'match': return renderMatchUI();
            case 'career_hub': return <div className="flex items-center justify-center min-h-screen bg-slate-900 bg-cover bg-center p-4" style={{backgroundImage: "url('https://www.transparenttextures.com/patterns/subtle-stripes.png'), linear-gradient(to bottom, #1e293b, #0f172a)"}}>{renderCareerHub()}</div>;
            case 'league_hub': return renderLeagueHub();
            case 'tournament_hub': return renderTournamentHub();
            default: return <div>Bilinmeyen durum...</div>;
        }
    };

    return (
        <main className="h-full w-full bg-slate-900">
            {renderContent()}
        </main>
    );
};

export default App;