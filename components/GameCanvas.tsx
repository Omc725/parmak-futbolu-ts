import React, { useRef, useEffect, useCallback } from 'react';
import { Team, Difficulty, Player, Ball, AppSettings } from '../types';
import { AI_SPEED_MULTIPLIERS } from '../constants';
import { drawSoccerBall, drawPitch } from '../utils/drawing';

interface GameCanvasProps {
  player1Team: Team;
  player2Team: Team;
  isOpponentAI: boolean;
  difficulty: Difficulty;
  isPaused: boolean;
  onGoal: (scorer: 'player1' | 'player2') => void;
  triggerReset: { count: number, kickOffFor: 'player1' | 'player2' | 'random' | null };
  controlSplitRatio: number;
  settings: AppSettings;
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    color: string;
    opacity: number;
    size?: number;
}

// Gameplay tuning constants
const PLAYER_SMOOTHING_FACTOR = 0.75;
const INITIAL_BALL_SPEED = 8;
const MIN_BALL_SPEED = 7;
const MAX_BALL_SPEED = 22;
const PADDLE_POWER_MULTIPLIER = 0.2;
const PADDLE_HIT_SPEED_BOOST = 0.8;
const WALL_DAMPING = 0.97;
const FRICTION = 0.997;
const SPIN_FACTOR = 0.08; 
const MAGNUS_COEFFICIENT = 0.005;
const VERTICAL_ACCELERATION = 0.015;

const LOGICAL_WIDTH = 400;
const LOGICAL_HEIGHT = 640; 

const GameCanvas: React.FC<GameCanvasProps> = ({
  player1Team,
  player2Team,
  isOpponentAI,
  difficulty,
  isPaused,
  onGoal,
  triggerReset,
  controlSplitRatio,
  settings
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameState = useRef({
    player1: null as Player | null,
    player2: null as Player | null,
    ball: null as Ball | null,
    mouse: { p1_x: LOGICAL_WIDTH / 2, p2_x: LOGICAL_WIDTH / 2 },
    ballTrail: [] as { x: number; y: number, opacity: number }[],
    confettiParticles: [] as Particle[],
    impactParticles: [] as Particle[],
    speedSparks: [] as Particle[],
    shockwaveParticles: [] as {x: number, y: number, radius: number, maxRadius: number, opacity: number, width: number, color: string}[],
    animatedGoalText: null as { type: 'default-scroll' | 'wave-scroll' | 'zoom-scroll'; text: string; progress: number; y: number; colors: [string, string]; } | null,
    screenShake: { intensity: 0, duration: 0 },
    paddleWidth: 70,
    paddleHeight: 8,
    playerRadius: 18,
    ballRadius: 10,
    goalWidth: 180,
    cornerBarrierSize: 30,
    ballHitFlash: 0,
  });
  const animationFrameId = useRef<number | null>(null);
  const isPausedRef = useRef(isPaused);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastTimeRef = useRef<number>(0);
  const goalScoredInFrame = useRef(false);
  
  const playSound = useCallback((sound: 'hit' | 'goal' | 'bounce') => {
    if (!audioContextRef.current) {
        try {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch (e) {
            console.error("Web Audio API is not supported in this browser");
            return;
        }
    }
    const audioCtx = audioContextRef.current;
    
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;

    if (sound === 'hit') {
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(800, now);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
        oscillator.start(now);
        oscillator.stop(now + 0.1);
    } else if (sound === 'bounce') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(400, now);
        gainNode.gain.setValueAtTime(0.15, now);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
        oscillator.start(now);
        oscillator.stop(now + 0.15);
    } else if (sound === 'goal') {
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, now);
        oscillator.frequency.setValueAtTime(523.25, now); // C5
        oscillator.frequency.linearRampToValueAtTime(659.25, now + 0.1); // E5
        oscillator.frequency.linearRampToValueAtTime(783.99, now + 0.2); // G5
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
        oscillator.start(now);
        oscillator.stop(now + 0.3);
    }
  }, []);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.parentElement) return;

    const dpr = window.devicePixelRatio || 1;
    const parentRect = canvas.parentElement.getBoundingClientRect();

    const logicalAspectRatio = LOGICAL_WIDTH / LOGICAL_HEIGHT;
    const parentAspectRatio = parentRect.width / parentRect.height;

    let cssWidth, cssHeight;
    if (parentAspectRatio > logicalAspectRatio) {
      cssHeight = parentRect.height;
      cssWidth = cssHeight * logicalAspectRatio;
    } else {
      cssWidth = parentRect.width;
      cssHeight = cssWidth / logicalAspectRatio;
    }

    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
  }, []);

  const resetPositions = useCallback((kickOffFor?: 'player1' | 'player2' | 'random' | null) => {
    goalScoredInFrame.current = false;
    const gs = gameState.current;
    const aiSpeed = AI_SPEED_MULTIPLIERS[difficulty] || 0.1;
    gs.animatedGoalText = null;

    gs.player1 = {
      x: LOGICAL_WIDTH / 2, y: LOGICAL_HEIGHT - gs.playerRadius * 3, radius: gs.playerRadius, width: gs.paddleWidth, prevX: LOGICAL_WIDTH / 2, velocityX: 0, hitAnimation: 0,
    };
    gs.player2 = {
      x: LOGICAL_WIDTH / 2, y: gs.playerRadius * 3, radius: gs.playerRadius, width: gs.paddleWidth, speed: 6, aiReact: aiSpeed, prevX: LOGICAL_WIDTH / 2, velocityX: 0, hitAnimation: 0,
    };
    gs.ball = {
      x: LOGICAL_WIDTH / 2, y: LOGICAL_HEIGHT / 2, radius: gs.ballRadius, speed: 0, vx: 0, vy: 0, spin: 0, rotation: 0,
    };
    
    setTimeout(() => {
      if(!gs.ball) return;
      if (kickOffFor === 'player1') gs.ball.vy = -INITIAL_BALL_SPEED;
      else if (kickOffFor === 'player2') gs.ball.vy = INITIAL_BALL_SPEED;
      else if (kickOffFor === 'random') gs.ball.vy = (Math.random() > 0.5 ? 1 : -1) * INITIAL_BALL_SPEED;
    }, 100); // Short delay to ensure kickoff happens after state is set

    gs.mouse.p1_x = LOGICAL_WIDTH / 2;
    gs.mouse.p2_x = LOGICAL_WIDTH / 2;
    gs.ballTrail = [];
  }, [difficulty]);
  
  const createImpactParticles = useCallback((x: number, y: number, count: number, options: { color?: string, direction?: 'up' | 'down' | 'all' } = {}) => {
        const { color = 'white', direction = 'all' } = options;
        const newParticles = Array.from({ length: count }).map(() => {
            let vx = (Math.random() - 0.5) * 4;
            let vy = (Math.random() - 0.5) * 4;
            if (direction === 'up') vy = -Math.random() * 4 - 1;
            if (direction === 'down') vy = Math.random() * 4 + 1;

            return {
                x, y, vx, vy,
                radius: Math.random() * 1.5 + 0.5,
                color,
                opacity: 1,
            };
        });
        gameState.current.impactParticles.push(...newParticles);
    }, []);

  const triggerConfetti = useCallback((logicalX: number, logicalY: number, colors: [string, string]) => {
    const gs = gameState.current;
    const newParticles = Array.from({ length: 150 }).map(() => ({
        x: logicalX,
        y: logicalY,
        vx: (Math.random() - 0.5) * 25,
        vy: (Math.random() - 0.7) * 25,
        radius: Math.random() * 4 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        opacity: 1,
    }));
    gs.confettiParticles.push(...newParticles);
  }, []);

  const triggerScreenShake = useCallback((intensity: number, duration: number) => {
      gameState.current.screenShake = { intensity, duration };
  }, []);
  
  const createShockwave = useCallback((x: number, y: number, radius: number, color: string) => {
    gameState.current.shockwaveParticles.push({
        x, y, radius: 0, maxRadius: radius, opacity: 1, width: radius * 0.2, color
    });
  }, []);


  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    const gs = gameState.current;
    const { player1, player2, ball, ballTrail, confettiParticles, impactParticles, speedSparks, screenShake, shockwaveParticles, animatedGoalText } = gs;
    
    ctx.imageSmoothingEnabled = settings.shapeTheme !== 'pixel';

    const scaleX = canvas.width / LOGICAL_WIDTH;
    const scaleY = canvas.height / LOGICAL_HEIGHT;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    if (screenShake.duration > 0) {
        const dx = (Math.random() - 0.5) * screenShake.intensity * 2;
        const dy = (Math.random() - 0.5) * screenShake.intensity * 2;
        ctx.translate(dx, dy);
    }
    ctx.scale(scaleX, scaleY);

    drawPitch(ctx, LOGICAL_WIDTH, LOGICAL_HEIGHT, settings.fieldDesign, settings.shapeTheme);
    
    // Draw goals and nets
    const goalDepth = 15;
    const postThickness = 5;
    const goalStartX = (LOGICAL_WIDTH - gs.goalWidth) / 2;
    const goalEndX = (LOGICAL_WIDTH + gs.goalWidth) / 2;

    const drawGoalAndNet = (isTopGoal: boolean) => {
        const y_front = isTopGoal ? 0 : LOGICAL_HEIGHT;
        const y_back = isTopGoal ? goalDepth : LOGICAL_HEIGHT - goalDepth;
        
        // Draw Net
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        const netLines = 15;
        for (let i = 1; i < netLines; i++) {
            const x = goalStartX + i * (gs.goalWidth / netLines);
            ctx.moveTo(x, y_front);
            ctx.lineTo(x, y_back);
        }
        ctx.moveTo(goalStartX, y_back);
        ctx.lineTo(goalEndX, y_back);
        ctx.stroke();
        ctx.restore();

        // Draw Goal Frame
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = postThickness;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(goalStartX, y_back);
        ctx.lineTo(goalStartX, y_front);
        ctx.lineTo(goalEndX, y_front);
        ctx.lineTo(goalEndX, y_back);
        ctx.stroke();
    };

    drawGoalAndNet(true); // Top Goal
    drawGoalAndNet(false); // Bottom Goal
    
    if (player1 && player2 && ball) {
      const currentSpeed = Math.sqrt(ball.vx**2 + ball.vy**2);
      const speedRatio = Math.max(0, Math.min((currentSpeed - INITIAL_BALL_SPEED) / (MAX_BALL_SPEED - INITIAL_BALL_SPEED), 1));
      
      const getTrailColor = (ratio: number, alpha: number) => {
          let r = 255, g = 255, b = 255;
          if (settings.trailEffect === 'flame') {
              if (ratio < 0.4) {} 
              else if (ratio < 0.7) { b = Math.floor(255 * (1 - (ratio - 0.4) / 0.3)); } 
              else { g = Math.floor(255 * (1 - (ratio - 0.7) / 0.3)); b = 0; }
          }
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      };

      if (settings.trailEffect !== 'none' && ballTrail.length > 1) {
          ctx.save();
          if (settings.trailEffect === 'pixel') {
              ballTrail.forEach(p => {
                  ctx.globalAlpha = p.opacity;
                  ctx.fillStyle = getTrailColor(speedRatio, p.opacity);
                  ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
              });
          } else {
              const pointsLeft: {x: number, y: number}[] = [];
              const pointsRight: {x: number, y: number}[] = [];

              for (let i = 0; i < ballTrail.length - 1; i++) {
                  const p1 = ballTrail[i];
                  const p2 = ballTrail[i + 1];
                  const dx = p2.x - p1.x;
                  const dy = p2.y - p1.y;
                  const len = Math.sqrt(dx * dx + dy * dy);
                  if (len < 0.1) continue;

                  const perpX = -dy / len;
                  const perpY = dx / len;
                  
                  const progress = i / (ballTrail.length - 1);
                  const width = ball.radius * Math.pow(1 - progress, 1.5);

                  pointsLeft.push({ x: p1.x + perpX * width, y: p1.y + perpY * width });
                  pointsRight.push({ x: p1.x - perpX * width, y: p1.y - perpY * width });
              }

              if (pointsLeft.length > 0) {
                  ctx.beginPath();
                  ctx.moveTo(pointsLeft[0].x, pointsLeft[0].y);
                  for (let i = 1; i < pointsLeft.length; i++) {
                      ctx.lineTo(pointsLeft[i].x, pointsLeft[i].y);
                  }
                  for (let i = pointsRight.length - 1; i >= 0; i--) {
                      ctx.lineTo(pointsRight[i].x, pointsRight[i].y);
                  }
                  ctx.closePath();
                  
                  const firstPoint = ballTrail[0];
                  const lastPoint = ballTrail[ballTrail.length - 1];
                  const gradient = ctx.createLinearGradient(firstPoint.x, firstPoint.y, lastPoint.x, lastPoint.y);
                  gradient.addColorStop(0, getTrailColor(speedRatio, 0.7));
                  gradient.addColorStop(1, getTrailColor(speedRatio, 0));

                  ctx.fillStyle = gradient;
                  ctx.fill();
              }
          }
          ctx.restore();
      }

      drawSoccerBall(ctx, ball.x, ball.y, ball.radius, ball.rotation, settings.ballDesign, settings.shapeTheme, gs.ballHitFlash);

      const drawPlayer = (p: Player, isTop: boolean, team: Team) => {
          ctx.save();
          
          if (settings.shapeTheme !== 'pixel') {
              ctx.beginPath(); ctx.arc(p.x, p.y + 4, p.radius, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fill();
          }

          ctx.save();
          ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.clip();
          ctx.fillStyle = team.color1; ctx.fillRect(p.x - p.radius, p.y - p.radius, p.radius * 2, p.radius * 2);
          ctx.fillStyle = team.color2; ctx.fillRect(p.x, p.y - p.radius, p.radius, p.radius * 2);
          ctx.restore();

          const paddleY = isTop ? p.y + p.radius - gs.paddleHeight*1.5 : p.y - p.radius + gs.paddleHeight/2;
          ctx.fillStyle = '#333333'; 
          ctx.fillRect(p.x - p.width / 2, paddleY, p.width, gs.paddleHeight);

          ctx.restore();
      }
      drawPlayer(player1, false, player1Team);
      drawPlayer(player2, true, player2Team);
    }
    
    const renderParticles = (particles: Particle[]) => {
        particles.forEach((p, index) => {
            if (p.opacity <= 0) {
                particles.splice(index, 1);
            } else {
                ctx.beginPath();
                 if (false && particles === speedSparks) {
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate(p.vx * 0.1);
                    ctx.fillStyle = p.color;
                    ctx.globalAlpha = p.opacity;
                    for (let i = 0; i < 5; i++) {
                        ctx.lineTo(0, p.radius);
                        ctx.translate(0, p.radius);
                        ctx.rotate(Math.PI * 2 / 5 * 2);
                        ctx.lineTo(0, -p.radius);
                        ctx.translate(0, -p.radius);
                    }
                    ctx.fill();
                    ctx.restore();
                } else {
                    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                    ctx.fillStyle = p.color;
                    ctx.globalAlpha = p.opacity;
                    ctx.fill();
                }
                ctx.globalAlpha = 1;
            }
        });
    }

    renderParticles(confettiParticles);
    renderParticles(impactParticles);
    renderParticles(speedSparks);

    shockwaveParticles.forEach(p => {
      if (p.opacity > 0) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.width * (p.opacity);
          ctx.globalAlpha = p.opacity;
          ctx.stroke();
      }
    });
    ctx.globalAlpha = 1;

    if (animatedGoalText) {
        const { type, text, progress, y, colors } = animatedGoalText;

        ctx.save();
        const fontSize = 80;
        ctx.font = `bold ${fontSize}px '${settings.font}', sans-serif`;
        const textMetrics = ctx.measureText(text);
        const textWidth = textMetrics.width;

        const x = (progress * (LOGICAL_WIDTH + textWidth)) - textWidth;
        
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        
        const gradient = ctx.createLinearGradient(0, y - fontSize / 2, 0, y + fontSize / 2);
        gradient.addColorStop(0, colors[0]);
        gradient.addColorStop(1, colors[1]);
        ctx.fillStyle = gradient;

        ctx.strokeStyle = `rgba(0, 0, 0, 0.5)`;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.7)';
        ctx.shadowBlur = 15;
        ctx.lineWidth = 9;

        let currentX = x;
        
        for (let i = 0; i < text.length; i++) {
            const char = text.charAt(i);
            const charWidth = ctx.measureText(char).width;
            
            ctx.save();
            
            let finalY = y;
            let finalScale = 1;
            const time = performance.now() / 150;
            const waveOffset = i * 0.4;
            
            switch(type) {
                case 'wave-scroll':
                    finalY = y + Math.sin(time + waveOffset) * 15;
                    break;
                case 'zoom-scroll':
                    const charScreenX = currentX + charWidth / 2;
                    const distFromCenter = Math.abs(charScreenX - LOGICAL_WIDTH / 2);
                    const maxDist = LOGICAL_WIDTH / 2;
                    finalScale = 1 + Math.max(0, 1 - distFromCenter / maxDist) * 0.5;
                    break;
                case 'default-scroll':
                default:
                     if (char.toLowerCase() === 'o') {
                        finalScale = 1 + Math.sin(time + waveOffset) * 0.3;
                    }
                    break;
            }

            ctx.translate(currentX + charWidth / 2, finalY);
            ctx.scale(finalScale, finalScale);
             if (char.toLowerCase() === 'o') {
                const rotation = Math.sin(time / 2 + waveOffset) * 0.1;
                ctx.rotate(rotation);
            }
            
            ctx.strokeText(char, -charWidth / 2, 0);
            ctx.fillText(char, -charWidth / 2, 0);
            ctx.restore();

            currentX += charWidth;
        }
        ctx.restore();
    }


    ctx.restore(); // Restore from scale
    ctx.restore(); // Restore from screen shake
  }, [player1Team, player2Team, settings]);

  const update = useCallback((deltaTime: number) => {
    const gs = gameState.current;
    if (!gs.player1 || !gs.player2 || !gs.ball) return;
    const { screenShake, confettiParticles, impactParticles, speedSparks, ballTrail, animatedGoalText } = gs;
    
    if (goalScoredInFrame.current) {
        gs.ball.vx = 0;
        gs.ball.vy = 0;
        gs.ball.spin = 0;
    }

    ballTrail.forEach(p => p.opacity -= 0.01 * deltaTime);
    gs.ballTrail = ballTrail.filter(p => p.opacity > 0);

    confettiParticles.forEach(p => {
        p.vy += 0.5 * deltaTime;
        p.vx *= 0.99; p.vy *= 0.99;
        p.x += p.vx * deltaTime; p.y += p.vy * deltaTime;
        p.opacity -= 0.005 * deltaTime;
    });

    impactParticles.forEach(p => {
        p.x += p.vx * deltaTime; p.y += p.vy * deltaTime;
        p.opacity -= 0.05 * deltaTime;
    });
    
    speedSparks.forEach(p => {
        p.x += p.vx * deltaTime; p.y += p.vy * deltaTime;
        p.opacity -= 0.04 * deltaTime;
    });

    gs.shockwaveParticles.forEach((p, index) => {
        p.radius += 2 * deltaTime; // expansion speed
        p.opacity -= 0.04 * deltaTime;
        if (p.opacity <= 0 || p.radius >= p.maxRadius) {
            gs.shockwaveParticles.splice(index, 1);
        }
    });

    if (animatedGoalText) {
        animatedGoalText.progress += (1 / 210) * deltaTime; // Slower progress for ~3.5s animation
        if (animatedGoalText.progress >= 1.2) {
            gs.animatedGoalText = null;
        }
    }

    if(screenShake.duration > 0) {
        screenShake.duration -= deltaTime;
        if(screenShake.duration <= 0) screenShake.intensity = 0;
    }

    if (gs.player1.hitAnimation > 0) gs.player1.hitAnimation = Math.max(0, gs.player1.hitAnimation - 0.08 * deltaTime);
    if (gs.player2.hitAnimation > 0) gs.player2.hitAnimation = Math.max(0, gs.player2.hitAnimation - 0.08 * deltaTime);
    if (gs.ballHitFlash > 0) gs.ballHitFlash = Math.max(0, gs.ballHitFlash - 0.05 * deltaTime);

    if (isPausedRef.current || goalScoredInFrame.current) return;
    
    const currentBallSpeed = Math.sqrt(gs.ball.vx**2 + gs.ball.vy**2);
    const subSteps = Math.min(10, Math.max(1, Math.ceil(currentBallSpeed / (gs.ballRadius * 0.5))));
    const subDeltaTime = deltaTime / subSteps;

    for (let i = 0; i < subSteps; i++) {
        const { player1, player2, ball } = gs;

        player1.velocityX = (player1.x - player1.prevX) / subDeltaTime;
        player1.prevX = player1.x;
        player2.velocityX = (player2.x - player2.prevX) / subDeltaTime;
        player2.prevX = player2.x;

        const effectiveSmoothing = 1 - Math.pow(1 - PLAYER_SMOOTHING_FACTOR, subDeltaTime);

        player1.x += (gs.mouse.p1_x - player1.x) * effectiveSmoothing;

        if (isOpponentAI) {
            if (ball.vy < 0) {
                const targetX = ball.x;
                const idealMovement = (targetX - player2.x) * (player2.aiReact || 0.1) * 5;
                const maxSpeedPerFrame = 9;
                const difficultySpeedFactor = (player2.aiReact || 0.1) / 0.1;
                const cappedMaxSpeed = maxSpeedPerFrame * difficultySpeedFactor;
                const finalMovement = Math.max(-cappedMaxSpeed, Math.min(cappedMaxSpeed, idealMovement));
                player2.x += finalMovement * subDeltaTime;
            }
        } else {
            player2.x += (gs.mouse.p2_x - player2.x) * effectiveSmoothing;
        }

        player1.x = Math.max(player1.width / 2, Math.min(LOGICAL_WIDTH - player1.width / 2, player1.x));
        player2.x = Math.max(player2.width / 2, Math.min(LOGICAL_WIDTH - player2.width / 2, player2.x));

        ball.vx += -ball.spin * ball.vy * MAGNUS_COEFFICIENT * subDeltaTime;
        ball.vy += ball.spin * ball.vx * MAGNUS_COEFFICIENT * subDeltaTime;
        ball.spin *= (1 - 0.01 * subDeltaTime);
        
        ball.vx *= (1 - (1 - FRICTION) * subDeltaTime);
        ball.vy *= (1 - (1 - FRICTION) * subDeltaTime);

        // Apply constant vertical acceleration
        if (ball.vy !== 0) {
            ball.vy += Math.sign(ball.vy) * VERTICAL_ACCELERATION * subDeltaTime;
        }
        
        ball.x += ball.vx * subDeltaTime;
        ball.y += ball.vy * subDeltaTime;
        
        const speed = Math.sqrt(ball.vx**2 + ball.vy**2);
        if (speed < MIN_BALL_SPEED && speed > 0) {
            const ratio = MIN_BALL_SPEED / speed;
            ball.vx *= ratio;
            ball.vy *= ratio;
        }
        
        const handleBounceEffects = (x: number, y: number) => {
            playSound('bounce');
            const currentSpeed = Math.sqrt(ball.vx**2 + ball.vy**2);
            const particleCount = 3 + Math.floor((currentSpeed / MAX_BALL_SPEED) * 10);
            createImpactParticles(x, y, particleCount);
            gs.ball.spin = 0;
            ball.vx *= WALL_DAMPING;
            ball.vy *= WALL_DAMPING;
            gs.ballTrail = [];
            
            if (currentSpeed > MAX_BALL_SPEED * 0.9) triggerScreenShake(0.5, 5);
        };
        
        const handlePostCollisions = () => {
            const goalDepth = 15;
            const goalStartX = (LOGICAL_WIDTH - gs.goalWidth) / 2;
            const goalEndX = (LOGICAL_WIDTH + gs.goalWidth) / 2;

            const checkCollision = (cx: number, cy: number, r: number, x1: number, y1: number, x2: number, y2: number) => {
                const dx = x2 - x1;
                const dy = y2 - y1;
                const lenSq = dx * dx + dy * dy;
                const t = Math.max(0, Math.min(1, ((cx - x1) * dx + (cy - y1) * dy) / lenSq));
                const closestX = x1 + t * dx;
                const closestY = y1 + t * dy;
                const distSq = (cx - closestX) * (cx - closestX) + (cy - closestY) * (cy - closestY);
                return distSq < r * r;
            };

            if (ball.vy < 0 && ball.y < goalDepth + ball.radius) {
                if (checkCollision(ball.x, ball.y, ball.radius, goalStartX, 0, goalStartX, goalDepth)) { ball.vx *= -1; ball.x = goalStartX + ball.radius; handleBounceEffects(ball.x, ball.y); return true; }
                if (checkCollision(ball.x, ball.y, ball.radius, goalEndX, 0, goalEndX, goalDepth)) { ball.vx *= -1; ball.x = goalEndX - ball.radius; handleBounceEffects(ball.x, ball.y); return true; }
            }
            if (ball.vy > 0 && ball.y > LOGICAL_HEIGHT - goalDepth - ball.radius) {
                if (checkCollision(ball.x, ball.y, ball.radius, goalStartX, LOGICAL_HEIGHT, goalStartX, LOGICAL_HEIGHT - goalDepth)) { ball.vx *= -1; ball.x = goalStartX + ball.radius; handleBounceEffects(ball.x, ball.y); return true; }
                if (checkCollision(ball.x, ball.y, ball.radius, goalEndX, LOGICAL_HEIGHT, goalEndX, LOGICAL_HEIGHT - goalDepth)) { ball.vx *= -1; ball.x = goalEndX - ball.radius; handleBounceEffects(ball.x, ball.y); return true; }
            }
            return false;
        };

        const handleGoalAndWallCollisions = () => {
            if (goalScoredInFrame.current) return;

            const goalStartX = (LOGICAL_WIDTH / 2) - (gs.goalWidth / 2);
            const goalEndX = (LOGICAL_WIDTH / 2) + (gs.goalWidth / 2);
            const postRadius = 5;
            const goalDepth = 15;

            const checkPostCollision = (postX: number, postY1: number, postY2: number) => {
                const ballX = ball.x;
                const ballY = ball.y;

                // Find closest point on the line segment (post) to the ball's center
                const closestY = Math.max(Math.min(postY1, postY2), Math.min(ballY, Math.max(postY1, postY2)));
                const closestX = postX;

                const dist = Math.hypot(ballX - closestX, ballY - closestY);

                if (dist < ball.radius + postRadius) {
                    let normalX = ballX - closestX;
                    let normalY = ballY - closestY;
                    const mag = Math.hypot(normalX, normalY);

                    if (mag === 0) {
                        normalX = (ballX > postX) ? 1 : -1;
                        normalY = 0;
                    } else {
                        normalX /= mag;
                        normalY /= mag;
                    }

                    const dot = ball.vx * normalX + ball.vy * normalY;
                    
                    ball.vx -= 2 * dot * normalX;
                    ball.vy -= 2 * dot * normalY;

                    const overlap = ball.radius + postRadius - dist;
                    ball.x += normalX * overlap;
                    ball.y += normalY * overlap;

                    handleBounceEffects(ball.x, ball.y);
                    return true;
                }
                return false;
            };

            // Top Goal area
            if (ball.y - ball.radius < goalDepth) {
                if (checkPostCollision(goalStartX, 0, -goalDepth) || checkPostCollision(goalEndX, 0, -goalDepth)) return;

                if (ball.y - ball.radius < 0) {
                    if (ball.x > goalStartX && ball.x < goalEndX) {
                        if (ball.vy > 0 && ball.y < ball.radius) { // Hit crossbar from inside
                            ball.y = ball.radius; ball.vy *= -1; handleBounceEffects(ball.x, 0); return;
                        }
                        goalScoredInFrame.current = true;
                        onGoal('player1'); 
                        playSound('goal'); 
                        triggerConfetti(ball.x, 0, [player2Team.color1, player2Team.color2]); 
                        createShockwave(ball.x, 0, 100, '#FFFF00');

                        const goalTexts = ['GOOOOOOOOOOL!', 'HARİKA GOL!', 'MÜKEMMEL!'];
                        const animationTypes: ('default-scroll' | 'wave-scroll' | 'zoom-scroll')[] = ['default-scroll', 'wave-scroll', 'zoom-scroll'];
                        gs.animatedGoalText = {
                            type: animationTypes[Math.floor(Math.random() * animationTypes.length)],
                            text: goalTexts[Math.floor(Math.random() * goalTexts.length)],
                            progress: 0,
                            y: LOGICAL_HEIGHT / 2,
                            colors: [player1Team.color1, player1Team.color2]
                        };
                        ball.x = LOGICAL_WIDTH / 2;
                        ball.y = LOGICAL_HEIGHT / 2;
                    } 
                    else { ball.y = ball.radius; ball.vy *= -1; handleBounceEffects(ball.x, ball.y); }
                }
            }
            // Bottom Goal area
            if (ball.y + ball.radius > LOGICAL_HEIGHT - goalDepth) {
                if (checkPostCollision(goalStartX, LOGICAL_HEIGHT, LOGICAL_HEIGHT + goalDepth) || checkPostCollision(goalEndX, LOGICAL_HEIGHT, LOGICAL_HEIGHT + goalDepth)) return;
                
                if (ball.y + ball.radius > LOGICAL_HEIGHT) {
                    if (ball.x > goalStartX && ball.x < goalEndX) { 
                        if (ball.vy < 0 && ball.y > LOGICAL_HEIGHT - ball.radius) { // Hit crossbar from inside
                            ball.y = LOGICAL_HEIGHT - ball.radius; ball.vy *= -1; handleBounceEffects(ball.x, LOGICAL_HEIGHT); return;
                        }
                        goalScoredInFrame.current = true;
                        onGoal('player2'); 
                        playSound('goal'); 
                        triggerConfetti(ball.x, LOGICAL_HEIGHT, [player1Team.color1, player1Team.color2]); 
                        createShockwave(ball.x, LOGICAL_HEIGHT, 100, '#FFFF00');
                        
                        const goalTexts = ['GOOOOOOOOOOL!', 'HARİKA GOL!', 'MÜKEMMEL!'];
                        const animationTypes: ('default-scroll' | 'wave-scroll' | 'zoom-scroll')[] = ['default-scroll', 'wave-scroll', 'zoom-scroll'];
                        gs.animatedGoalText = {
                            type: animationTypes[Math.floor(Math.random() * animationTypes.length)],
                            text: goalTexts[Math.floor(Math.random() * goalTexts.length)],
                            progress: 0,
                            y: LOGICAL_HEIGHT / 2,
                            colors: [player2Team.color1, player2Team.color2]
                        };
                        ball.x = LOGICAL_WIDTH / 2;
                        ball.y = LOGICAL_HEIGHT / 2;
                    } 
                    else { ball.y = LOGICAL_HEIGHT - ball.radius; ball.vy *= -1; handleBounceEffects(ball.x, ball.y); }
                }
            }
        };
        
        const handleCornerCollisions = () => {
            const w = LOGICAL_WIDTH, h = LOGICAL_HEIGHT, r = ball.radius, b = gs.cornerBarrierSize;
            let collided = false;
            if (ball.x < b && ball.y < b && (ball.x + ball.y < b + r)) { const tempVx = ball.vx; ball.vx = -ball.vy; ball.vy = -tempVx; collided = true; } 
            else if (ball.x > w - b && ball.y < b && ((w - ball.x) + ball.y < b + r)) { const tempVx = ball.vx; ball.vx = ball.vy; ball.vy = tempVx; collided = true; } 
            else if (ball.x < b && ball.y > h - b && (ball.x + (h - ball.y) < b + r)) { const tempVx = ball.vx; ball.vx = ball.vy; ball.vy = tempVx; collided = true; } 
            else if (ball.x > w - b && ball.y > h - b && ((w - ball.x) + (h - ball.y) < b + r)) { const tempVx = ball.vx; ball.vx = -ball.vy; ball.vy = -tempVx; collided = true; }
            if(collided) handleBounceEffects(ball.x, ball.y);
            return collided;
        };
        
        const hitPost = handlePostCollisions();
        if (!hitPost) {
            const hitCorner = handleCornerCollisions();
            if (!hitCorner) {
                if (ball.x - ball.radius < 0 || ball.x + ball.radius > LOGICAL_WIDTH) {
                    ball.vx *= -1;
                    const newX = ball.x < ball.radius ? ball.radius : LOGICAL_WIDTH - ball.radius;
                    handleBounceEffects(newX, ball.y); ball.x = newX;
                }
                handleGoalAndWallCollisions();
            }
        }
        
        const handlePaddleCollision = (player: Player, isTopPlayer: boolean) => {
            const paddleY = isTopPlayer ? player.y + player.radius - gs.paddleHeight*1.5 : player.y - player.radius + gs.paddleHeight/2;
            const paddleStartX = player.x - player.width/2;
            const paddleEndX = player.x + player.width/2;

            const isVerticallyAligned = isTopPlayer ? (ball.y - ball.radius < paddleY + 2 && ball.y + ball.radius > player.y) : (ball.y + ball.radius > paddleY - 2 && ball.y - ball.radius < player.y);

            if(isVerticallyAligned && ball.x + ball.radius > paddleStartX && ball.x - ball.radius < paddleEndX) {
                let collidePoint = (ball.x - player.x) / (player.width / 2);
                let angleRad = collidePoint * (Math.PI / 3);
                let direction = isTopPlayer ? 1 : -1;
                
                const baseSpeed = Math.sqrt(ball.vx**2 + ball.vy**2);
                const paddleContribution = Math.abs(player.velocityX) * PADDLE_POWER_MULTIPLIER;
                const newSpeed = Math.min(MAX_BALL_SPEED, Math.max(MIN_BALL_SPEED, baseSpeed + paddleContribution + PADDLE_HIT_SPEED_BOOST));
                
                playSound('hit');
                createImpactParticles(ball.x, paddleY, 10 + Math.floor(newSpeed / MAX_BALL_SPEED * 15), { color: '#FFEB3B' });
                createShockwave(ball.x, paddleY, 30, 'rgba(255,255,255,0.5)');

                ball.vx = newSpeed * Math.sin(angleRad);
                ball.vy = direction * newSpeed * Math.cos(angleRad);
                ball.spin = (player.velocityX * SPIN_FACTOR) + (collidePoint * 0.05);
                gs.ballTrail = [];
                gs.ballHitFlash = 1.0;
                
                player.hitAnimation = 0;
                const hitPower = Math.abs(player.velocityX);
                if (hitPower > 25) triggerScreenShake(Math.min(2, hitPower / 25), Math.min(10, hitPower / 4));
            }
        };
        
        handlePaddleCollision(player1, false);
        handlePaddleCollision(player2, true);
    } 
    
    const { ball } = gs;
    gs.ballTrail.unshift({ x: ball.x, y: ball.y, opacity: 1 });
    if (gs.ballTrail.length > 10) gs.ballTrail.pop();
    ball.rotation += ball.spin * 0.1 * deltaTime;

    const finalSpeed = Math.sqrt(ball.vx**2 + ball.vy**2);
    if (finalSpeed > MAX_BALL_SPEED * 0.8) {
        const sparkCount = Math.floor((finalSpeed / MAX_BALL_SPEED) * 2);
        for (let i = 0; i < sparkCount; i++) {
            gs.speedSparks.push({
                x: ball.x - (ball.vx / finalSpeed) * ball.radius,
                y: ball.y - (ball.vy / finalSpeed) * ball.radius,
                vx: -ball.vx * 0.1 + (Math.random() - 0.5) * 2,
                vy: -ball.vy * 0.1 + (Math.random() - 0.5) * 2,
                radius: Math.random() * 1.5 + 0.5,
                color: Math.random() > 0.5 ? '#FFD700' : '#FF8C00',
                opacity: 0.8
            });
        }
    }
  }, [onGoal, isOpponentAI, playSound, resetPositions, triggerConfetti, triggerScreenShake, createImpactParticles, player1Team, player2Team, settings, createShockwave]);


  const gameLoop = useCallback((currentTime: number) => {
    if (lastTimeRef.current === 0) lastTimeRef.current = currentTime;
    const deltaTime = (currentTime - lastTimeRef.current) / 16.67;
    lastTimeRef.current = currentTime;
    update(deltaTime);
    draw();
    animationFrameId.current = requestAnimationFrame(gameLoop);
  }, [draw, update]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.parentElement) return;
    const resizeObserver = new ResizeObserver(() => resizeCanvas());
    resizeObserver.observe(canvas.parentElement);
    lastTimeRef.current = performance.now();
    animationFrameId.current = requestAnimationFrame(gameLoop);
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      resizeObserver.disconnect();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') audioContextRef.current.close();
    };
  }, [gameLoop, resizeCanvas]);

  useEffect(() => {
    if (triggerReset.count > 0) resetPositions(triggerReset.kickOffFor);
  }, [triggerReset, resetPositions]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = LOGICAL_WIDTH / rect.width;
    const controlLine = rect.top + (rect.height * controlSplitRatio);
    const gs = gameState.current;
    if (e.clientY > controlLine) gs.mouse.p1_x = (e.clientX - rect.left) * scaleX;
    else if (!isOpponentAI) gs.mouse.p2_x = (e.clientX - rect.left) * scaleX;
}, [controlSplitRatio, isOpponentAI]);

const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = LOGICAL_WIDTH / rect.width;
    const controlLine = rect.top + (rect.height * controlSplitRatio);
    const gs = gameState.current;
    let p1_touch_found = false;
    let p2_touch_found = false;

    for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        if (touch.clientY > controlLine) {
            if (!p1_touch_found) { gs.mouse.p1_x = (touch.clientX - rect.left) * scaleX; p1_touch_found = true; }
        } else {
            if (!isOpponentAI && !p2_touch_found) { gs.mouse.p2_x = (touch.clientX - rect.left) * scaleX; p2_touch_found = true; }
        }
    }
}, [controlSplitRatio, isOpponentAI]);
  
  return (
    <canvas ref={canvasRef} onMouseMove={handleMouseMove} onTouchMove={handleTouchMove} onTouchStart={handleTouchMove} className="cursor-none" />
  );
};

export default GameCanvas;