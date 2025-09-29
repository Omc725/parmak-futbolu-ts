import React, { useRef, useEffect } from 'react';
import { AppSettings } from '../types';
import { drawSoccerBall, drawPitch } from '../utils/drawing';

interface MenuBackgroundCanvasProps {
    settings: AppSettings;
}

interface SoccerBall {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    rotation: number;
    spin: number;
}

const MenuBackgroundCanvas: React.FC<MenuBackgroundCanvasProps> = ({ settings }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        const soccerBalls: SoccerBall[] = [];
        const ballCount = 20;

        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            
            if (settings.shapeTheme === 'pixel') {
                ctx.imageSmoothingEnabled = false;
            } else {
                ctx.imageSmoothingEnabled = true;
            }

            soccerBalls.length = 0;
            for (let i = 0; i < ballCount; i++) {
                const radius = Math.random() * 20 + 15;
                soccerBalls.push({
                    x: Math.random() * (canvas.width - radius * 2) + radius,
                    y: Math.random() * (canvas.height - radius * 2) + radius,
                    vx: (Math.random() - 0.5) * 1.5,
                    vy: (Math.random() - 0.5) * 1.5,
                    radius,
                    rotation: Math.random() * Math.PI * 2,
                    spin: (Math.random() - 0.5) * 0.02,
                });
            }
        };
        
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        const draw = () => {
            if (!ctx || !canvas) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            drawPitch(ctx, canvas.width, canvas.height, settings.fieldDesign, settings.shapeTheme);

            soccerBalls.forEach(ball => {
                ball.x += ball.vx;
                ball.y += ball.vy;
                ball.rotation += ball.spin;

                if (ball.x - ball.radius < 0 || ball.x + ball.radius > canvas.width) {
                    ball.vx *= -1;
                    ball.x = Math.max(ball.radius, Math.min(ball.x, canvas.width - ball.radius));
                }
                if (ball.y - ball.radius < 0 || ball.y + ball.radius > canvas.height) {
                    ball.vy *= -1;
                    ball.y = Math.max(ball.radius, Math.min(ball.y, canvas.height - ball.radius));
                }

                drawSoccerBall(ctx, ball.x, ball.y, ball.radius, ball.rotation, settings.ballDesign, settings.shapeTheme);
            });

            animationFrameId = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', resizeCanvas);
        };
    }, [settings]);

    return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
};

export default MenuBackgroundCanvas;
