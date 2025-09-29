import React, { useState, useEffect, useCallback } from 'react';
import { Team, Difficulty } from '../types';

interface PenaltyShootoutProps {
  playerTeam: Team;
  aiTeam: Team;
  difficulty: Difficulty;
  onFinish: (winner: 'player' | 'ai', scores: { player: number, ai: number }) => void;
  // FIX: The translation function `t` should return a string, not void.
  t: (key: string, params?: { [key: string]: string | number }) => string;
}

const DIFFICULTY_SETTINGS = {
  'very-easy': { aiShotSuccess: 0.25, aiSaveSuccess: 0.05 },
  'easy': { aiShotSuccess: 0.35, aiSaveSuccess: 0.15 },
  'normal': { aiShotSuccess: 0.5, aiSaveSuccess: 0.3 },
  'hard': { aiShotSuccess: 0.65, aiSaveSuccess: 0.45 },
  'very-hard': { aiShotSuccess: 0.75, aiSaveSuccess: 0.55 },
  'impossible': { aiShotSuccess: 0.85, aiSaveSuccess: 0.65 },
};

type GamePhase = 'player_shoots' | 'player_saves' | 'animating' | 'show_result' | 'game_over';
type ShotDirection = 'left' | 'center' | 'right';
type Outcome = 'goal' | 'miss';

const directionToStyle = (dir: ShotDirection): React.CSSProperties => {
    if (dir === 'left') return { transform: 'translateX(-100%) translateY(-60%)' };
    if (dir === 'right') return { transform: 'translateX(100%) translateY(-60%)' };
    return { transform: 'translateY(-20%)' }; // center
};

const PenaltyShootout: React.FC<PenaltyShootoutProps> = ({ playerTeam, aiTeam, difficulty, onFinish, t }) => {
  const [playerOutcomes, setPlayerOutcomes] = useState<Outcome[]>([]);
  const [aiOutcomes, setAiOutcomes] = useState<Outcome[]>([]);
  const [phase, setPhase] = useState<GamePhase>('player_shoots');
  const [message, setMessage] = useState('');
  const [ballStyle, setBallStyle] = useState<React.CSSProperties>({});
  const [keeperStyle, setKeeperStyle] = useState<React.CSSProperties>({});

  const scores = {
      player: playerOutcomes.filter(o => o === 'goal').length,
      ai: aiOutcomes.filter(o => o === 'goal').length
  };
  const attempts = {
      player: playerOutcomes.length,
      ai: aiOutcomes.length
  };

  const getWinner = useCallback(() => {
    const { player: playerAttempts, ai: aiAttempts } = attempts;
    const { player: playerGoals, ai: aiGoals } = scores;

    if (playerAttempts >= 5 && aiAttempts >= 5 && playerAttempts === aiAttempts && playerGoals !== aiGoals) {
      return playerGoals > aiGoals ? 'player' : 'ai';
    }
    const playerShotsLeft = 5 - playerAttempts;
    const aiShotsLeft = 5 - aiAttempts;
    if (playerGoals > aiGoals + aiShotsLeft) return 'player';
    if (aiGoals > playerGoals + playerShotsLeft) return 'ai';
    
    return null;
  }, [scores, attempts]);
  
  const handleNextPhase = useCallback(() => {
    setMessage('');
    setBallStyle({});
    setKeeperStyle({});
    const winner = getWinner();
    if (winner) {
      setPhase('game_over');
      setMessage(t('penalty_winner_message', { teamName: winner === 'player' ? playerTeam.name : aiTeam.name }));
      setTimeout(() => onFinish(winner, scores), 2000);
      return;
    }
    setPhase(attempts.player > attempts.ai ? 'player_saves' : 'player_shoots');
  }, [getWinner, attempts, onFinish, playerTeam, aiTeam, scores, t]);

  useEffect(() => {
    if (phase === 'show_result') {
      const timer = setTimeout(handleNextPhase, 1500);
      return () => clearTimeout(timer);
    }
  }, [phase, handleNextPhase]);
  
  const handleShot = (playerDirection: ShotDirection, isPlayerShooting: boolean) => {
      if(phase !== 'player_shoots' && phase !== 'player_saves') return;
      setPhase('animating');

      const settings = DIFFICULTY_SETTINGS[difficulty];
      const directions: ShotDirection[] = ['left', 'center', 'right'];

      let shotByPlayer = isPlayerShooting;
      let shotDirection = shotByPlayer ? playerDirection : directions[Math.floor(Math.random() * 3)];
      let saveDirection = shotByPlayer ? (Math.random() < settings.aiSaveSuccess ? playerDirection : directions.filter(d => d !== playerDirection)[Math.floor(Math.random()*2)]) : playerDirection;
      
      const isGoal = shotDirection !== saveDirection && (shotByPlayer || Math.random() < settings.aiShotSuccess);

      setBallStyle(directionToStyle(shotDirection));
      setKeeperStyle(directionToStyle(saveDirection));

      setTimeout(() => {
        if(shotByPlayer) {
          setPlayerOutcomes(o => [...o, isGoal ? 'goal' : 'miss']);
          setMessage(isGoal ? t('penalty_goal') : t('penalty_saved'));
        } else {
          setAiOutcomes(o => [...o, isGoal ? 'goal' : 'miss']);
          setMessage(isGoal ? t('penalty_ai_scores') : t('penalty_you_saved'));
        }
        setPhase('show_result');
      }, 500);
  };


  const renderActionUI = () => {
    if (phase === 'game_over' || phase === 'show_result' || phase === 'animating') {
      return <p className="text-4xl h-12 font-bold animate-pulse">{message}</p>;
    }
    const isShooting = phase === 'player_shoots';
    const instructionKey = isShooting ? 'penalty_shoot_instruction' : 'penalty_save_instruction';
    const attemptCount = isShooting ? attempts.player + 1 : attempts.ai + 1;

    return (
      <div className="flex flex-col items-center">
        <h2 className="text-2xl font-bold mb-4 h-12">{t(instructionKey, { attempt: attemptCount })}</h2>
      </div>
    );
  };
  
  const totalRounds = Math.max(5, attempts.player, attempts.ai);

  return (
    <div className="w-full max-w-xl bg-slate-800/80 p-6 rounded-2xl shadow-2xl border border-slate-700/50 flex flex-col justify-between items-center text-white text-center">
      <h1 className="text-4xl font-extrabold mb-4">{t('penalty_shootout_title')}</h1>
      {/* Scoreboard */}
      <div className="w-full grid grid-cols-3 items-center mb-4">
        <div className="text-left">
          <p className="font-bold text-lg truncate">{playerTeam.name}</p>
          <div className="flex mt-1">
             {[...Array(totalRounds)].map((_, i) => <div key={`p1-${i}`} className={`w-4 h-4 rounded-full mr-1 border-2 ${i < attempts.player ? (playerOutcomes[i] === 'goal' ? 'bg-green-500' : 'bg-red-500') : 'bg-slate-600'}`}></div>)}
          </div>
        </div>
        <p className="text-5xl font-extrabold">{scores.player} - {scores.ai}</p>
        <div className="text-right">
          <p className="font-bold text-lg truncate">{aiTeam.name}</p>
          <div className="flex mt-1 justify-end">
             {[...Array(totalRounds)].map((_, i) => <div key={`p2-${i}`} className={`w-4 h-4 rounded-full ml-1 border-2 ${i < attempts.ai ? (aiOutcomes[i] === 'goal' ? 'bg-green-500' : 'bg-red-500') : 'bg-slate-600'}`}></div>)}
          </div>
        </div>
      </div>

      {/* Game Area */}
      <div className="w-full bg-green-800/50 p-4 rounded-lg relative aspect-[4/3]">
        {/* Goal */}
        <div className="absolute inset-x-0 top-0 h-full border-4 border-white" style={{ clipPath: 'polygon(0 0, 100% 0, 95% 100%, 5% 100%)' }}>
             {/* Net */}
            <div className="absolute inset-0" style={{
                backgroundImage: `
                    repeating-linear-gradient(45deg, rgba(255,255,255,0.15) 0, rgba(255,255,255,0.15) 1px, transparent 1px, transparent 10px),
                    repeating-linear-gradient(-45deg, rgba(255,255,255,0.15) 0, rgba(255,255,255,0.15) 1px, transparent 1px, transparent 10px)
                `,
            }}></div>
             {/* Clickable zones */}
             <div className={`absolute inset-0 flex z-10 ${phase === 'animating' ? 'pointer-events-none' : ''}`}>
                 <div className="w-1/3 h-full cursor-pointer" onClick={() => handleShot('left', phase === 'player_shoots')}></div>
                 <div className="w-1/3 h-full cursor-pointer" onClick={() => handleShot('center', phase === 'player_shoots')}></div>
                 <div className="w-1/3 h-full cursor-pointer" onClick={() => handleShot('right', phase === 'player_shoots')}></div>
             </div>

             {/* Goalkeeper */}
             <div className="absolute bottom-[-10px] left-1/2 -translate-x-1/2 w-12 h-12 transition-transform duration-300 ease-out" style={keeperStyle}>
                 <div className="w-full h-full rounded-full border-2 relative" style={{ background: `linear-gradient(to right, ${phase === 'player_shoots' ? aiTeam.color1 : playerTeam.color1} 50%, ${phase === 'player_shoots' ? aiTeam.color2 : playerTeam.color2} 50%)`}}>
                    <div className="absolute top-1/2 -translate-y-1/2 -left-1 w-5 h-5 bg-white rounded-full border-2 border-black z-10"></div>
                    <div className="absolute top-1/2 -translate-y-1/2 -right-1 w-5 h-5 bg-white rounded-full border-2 border-black z-10"></div>
                 </div>
             </div>
        </div>
        
        {/* Ball */}
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 transition-transform duration-500 ease-in-out" style={ballStyle}>
          <div className="relative w-6 h-6 bg-white rounded-full border-2 border-black overflow-hidden">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-black" style={{ clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)' }}></div>
          </div>
        </div>
      </div>

      <div className="w-full h-32 flex items-center justify-center">
        {renderActionUI()}
      </div>
    </div>
  );
};
export default PenaltyShootout;