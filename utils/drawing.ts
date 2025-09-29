import { AppSettings } from '../types';

// Cache for field images to prevent reloading
const fieldImageCache: Partial<Record<AppSettings['fieldDesign'], HTMLImageElement>> = {};
const fieldImageStatus: Partial<Record<AppSettings['fieldDesign'], 'loading' | 'loaded' | 'error'>> = {};

function getFieldImage(design: AppSettings['fieldDesign']): HTMLImageElement | null {
    if (fieldImageCache[design] && fieldImageStatus[design] === 'loaded') {
        return fieldImageCache[design]!;
    }

    if (fieldImageStatus[design] === 'loading' || fieldImageStatus[design] === 'error') {
        return null;
    }

    try {
        const img = new Image();
        img.src = `./assets/fields/${design}.png`;
        fieldImageStatus[design] = 'loading';
        img.onload = () => {
            fieldImageStatus[design] = 'loaded';
        };
        img.onerror = () => {
            console.error(`Failed to load field image for design: ${design}`);
            fieldImageStatus[design] = 'error';
        };
        fieldImageCache[design] = img;
        return null; // Return null on first load attempt
    } catch (e) {
        console.error(e);
        fieldImageStatus[design] = 'error';
        return null;
    }
}

export const drawPitch = (ctx: CanvasRenderingContext2D, width: number, height: number, design: AppSettings['fieldDesign'], shapeTheme: AppSettings['shapeTheme']) => {
    ctx.save();
    
    const fieldImage = getFieldImage(design);

    if (fieldImage && fieldImage.complete && fieldImage.naturalWidth > 0) {
        ctx.drawImage(fieldImage, 0, 0, width, height);
    } else {
        // Fallback drawing logic
        ctx.fillStyle = '#417d49';
        ctx.fillRect(0, 0, width, height);
        const stripeCount = 12;
        const stripeHeight = height / stripeCount;
        for (let i = 0; i < stripeCount; i++) {
            if (i % 2 === 0) {
                ctx.fillStyle = '#4a8a53';
                ctx.fillRect(0, i * stripeHeight, width, stripeHeight);
            }
        }
    }
    
    const isPixel = shapeTheme === 'pixel';
    const pixelSize = isPixel ? Math.max(1, Math.floor(width / 100)) : 1;

    // Field Lines (Drawn after image/fallback)
    if (shapeTheme === 'retro') {
        ctx.strokeStyle = '#00ff41';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#00ff41';
        ctx.shadowBlur = 8;
    } else if (shapeTheme === 'sketch') {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
    } else {
         ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'; 
         ctx.lineWidth = isPixel ? pixelSize * 1.5 : 3;
    }
    
    const w = width, h = height, midY = h / 2;
    
    const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
        ctx.beginPath();
        if(isPixel) {
            ctx.moveTo(Math.floor(x1/pixelSize)*pixelSize, Math.floor(y1/pixelSize)*pixelSize);
            ctx.lineTo(Math.floor(x2/pixelSize)*pixelSize, Math.floor(y2/pixelSize)*pixelSize);
        } else if (shapeTheme === 'sketch') {
            ctx.moveTo(x1 + (Math.random()-0.5)*2, y1 + (Math.random()-0.5)*2);
            ctx.lineTo(x2 + (Math.random()-0.5)*2, y2 + (Math.random()-0.5)*2);
        } else {
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
        }
        ctx.stroke();
    }
    const drawArc = (x: number, y: number, r: number, start: number, end: number) => {
        ctx.beginPath();
        if (isPixel) {
            const steps = Math.max(6, Math.floor(r * (end-start) / pixelSize / 2));
            for(let i=0; i<=steps; i++) {
                const angle = start + (end - start) * (i/steps);
                const px = x + Math.cos(angle) * r;
                const py = y + Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(Math.floor(px/pixelSize)*pixelSize, Math.floor(py/pixelSize)*pixelSize);
                else ctx.lineTo(Math.floor(px/pixelSize)*pixelSize, Math.floor(py/pixelSize)*pixelSize);
            }
        } else if (shapeTheme === 'sketch') {
            const steps = 30;
             for(let i=0; i<=steps; i++) {
                const angle = start + (end - start) * (i/steps);
                const px = x + Math.cos(angle) * r + (Math.random()-0.5)*2;
                const py = y + Math.sin(angle) * r + (Math.random()-0.5)*2;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
        } else {
            ctx.arc(x, y, r, start, end);
        }
        ctx.stroke();
    }

    const drawRect = (x: number, y: number, w: number, h: number) => {
        if (shapeTheme === 'sketch') {
            drawLine(x, y, x + w, y);
            drawLine(x + w, y, x + w, y + h);
            drawLine(x + w, y + h, x, y + h);
            drawLine(x, y + h, x, y);
        } else {
            ctx.strokeRect(x, y, w, h);
        }
    }

    // Outer box
    drawRect(0, 0, w, h);
    // Center line
    drawLine(0, midY, w, midY);
    // Center circle
    drawArc(w / 2, midY, w * 0.15, 0, Math.PI * 2);
    // Penalty areas
    drawRect(w * 0.15, h - h * 0.25, w * 0.7, h * 0.25);
    drawRect(w * 0.15, 0, w * 0.7, h * 0.25);
    // Goal areas
    drawRect(w * 0.3, h - h * 0.1, w * 0.4, h * 0.1);
    drawRect(w * 0.3, 0, w * 0.4, h * 0.1);
    // Penalty arcs
    drawArc(w / 2, h - h * 0.17, w * 0.1, Math.PI * 1.25, Math.PI * 1.75);
    drawArc(w / 2, h * 0.17, w * 0.1, Math.PI * 0.25, Math.PI * 0.75);
    
    ctx.restore();
};

export const drawSoccerBall = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rotation: number, design: AppSettings['ballDesign'], shapeTheme: AppSettings['shapeTheme'], ballHitFlash: number = 0) => {
    // Dynamic Shadow
    const shadowYOffset = 4 + Math.abs(y - (640 / 2)) * 0.02;
    const shadowBlur = 2 + r * 0.2;
    ctx.beginPath();
    ctx.ellipse(x, y + shadowYOffset, r * 1.1, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0,0,0,0.2)`;
    ctx.filter = `blur(${shadowBlur}px)`;
    ctx.fill();
    ctx.filter = 'none';

    if (shapeTheme === 'pixel') {
        const pixelSize = Math.max(1, Math.floor(r / 12));
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);

        const fillPixel = (px: number, py: number, color: string) => {
            ctx.fillStyle = color;
            ctx.fillRect(px * pixelSize - (pixelSize/2), py * pixelSize - (pixelSize/2), pixelSize, pixelSize);
        }

        const radiusInPixels = 11;
        for (let i = -radiusInPixels; i <= radiusInPixels; i++) {
            for (let j = -radiusInPixels; j <= radiusInPixels; j++) {
                const distSq = i * i + j * j;
                if (distSq <= radiusInPixels * radiusInPixels) {
                    let color = '#FFFFFF';
                    if (distSq > (radiusInPixels - 1.5) * (radiusInPixels - 1.5)) {
                        color = '#000000'; // Outer ring
                    } else if (distSq > (radiusInPixels - 3.5) * (radiusInPixels - 3.5)) {
                         color = '#CCCCCC'; // Shading
                    }
                    fillPixel(i, j, color);
                }
            }
        }
        
        ctx.fillStyle = '#000000';
        const drawPatch = (centerX: number, centerY: number, size: number) => {
            for (let i = -size; i <= size; i++) {
                for (let j = -size; j <= size; j++) {
                    if (Math.abs(i) + Math.abs(j) <= size * 1.5) {
                         fillPixel(centerX + i, centerY + j, '#000000');
                    }
                }
            }
        };

        const drawLine = (x0: number, y0: number, x1: number, y1: number) => {
            const dx = Math.abs(x1 - x0);
            const dy = Math.abs(y1 - y0);
            const sx = (x0 < x1) ? 1 : -1;
            const sy = (y0 < y1) ? 1 : -1;
            let err = dx - dy;
            while(true) {
                fillPixel(x0, y0, '#000000');
                if ((x0 === x1) && (y0 === y1)) break;
                const e2 = 2 * err;
                if (e2 > -dy) { err -= dy; x0 += sx; }
                if (e2 < dx) { err += dx; y0 += sy; }
            }
        }

        drawPatch(0, 0, 2);
        drawLine(0, -3, 0, -8);
        drawLine(3, 2, 8, 6);
        drawLine(-3, 2, -8, 6);
        
        ctx.restore();
        return;
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    const gradient = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r * 1.5);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.8, '#f0f0f0');
    gradient.addColorStop(1, '#d0d0d0');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#111111';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = r * 0.05;

    switch(design) {
        case 'classic': {
            const sides = 5;
            const pRadius = r * 0.4;
            ctx.beginPath();
            for (let i = 0; i < sides; i++) {
                const angle = (i / sides) * (2 * Math.PI) - Math.PI / 2;
                const px = pRadius * Math.cos(angle);
                const py = pRadius * Math.sin(angle);
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            break;
        }
        case 'simple': {
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
            ctx.fill();
            break;
        }
        case 'star': {
            ctx.beginPath();
            for (let i = 0; i < 10; i++) {
                const radius = i % 2 === 0 ? r * 0.8 : r * 0.4;
                const angle = (i / 10) * (2 * Math.PI) - Math.PI / 2;
                const px = radius * Math.cos(angle);
                const py = radius * Math.sin(angle);
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            break;
        }
        case 'rings': {
            ctx.lineWidth = r * 0.2;
            ctx.beginPath(); ctx.arc(0, 0, r*0.7, 0, Math.PI * 2); ctx.stroke();
            break;
        }
        case 'checkered': {
             for(let i = 0; i < 8; i++) {
                for(let j = 0; j < 4; j++) {
                    if ((i+j) % 2 === 0) {
                        ctx.beginPath();
                        ctx.arc(0, 0, r, i * Math.PI/4, (i+1) * Math.PI/4);
                        ctx.arc(0, 0, r*0.6, (i+1) * Math.PI/4, i * Math.PI/4, true);
                        ctx.closePath();
                        ctx.fill();
                    }
                }
            }
            break;
        }
        case 'atomic': {
            ctx.lineWidth = r * 0.1;
            ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2); ctx.stroke();
            ctx.save();
            ctx.rotate(Math.PI / 3);
            ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, Math.PI); ctx.stroke();
            ctx.rotate(Math.PI / 3);
            ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, Math.PI); ctx.stroke();
            ctx.restore();
            ctx.beginPath(); ctx.arc(0, 0, r*0.2, 0, Math.PI * 2); ctx.fill();
            break;
        }
        case 'eye': {
            const eyeGradient = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r * 1.2);
            eyeGradient.addColorStop(0, '#FFFFFF');
            eyeGradient.addColorStop(1, '#E0E0E0');
            ctx.fillStyle = eyeGradient;
            ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();

            const irisRadius = r * 0.6;
            const irisGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, irisRadius);
            irisGradient.addColorStop(0, '#4FC3F7');
            irisGradient.addColorStop(1, '#0288D1');
            ctx.fillStyle = irisGradient;
            ctx.beginPath(); ctx.arc(0, 0, irisRadius, 0, Math.PI * 2); ctx.fill();

            const pupilRadius = r * 0.3;
            ctx.fillStyle = 'black';
            ctx.beginPath(); ctx.arc(0, 0, pupilRadius, 0, Math.PI * 2); ctx.fill();
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.beginPath(); ctx.arc(-pupilRadius*0.4, -pupilRadius*0.4, pupilRadius * 0.4, 0, Math.PI * 2); ctx.fill();
            
            ctx.strokeStyle = 'rgba(255, 100, 100, 0.6)';
            ctx.lineWidth = r * 0.05;
            for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                ctx.moveTo(0, 0);
                const angle = i * Math.PI / 2 + rotation * 0.5;
                ctx.quadraticCurveTo(
                    r * 0.6 * Math.cos(angle + 0.3), r * 0.6 * Math.sin(angle + 0.3),
                    r * 0.9 * Math.cos(angle), r * 0.9 * Math.sin(angle)
                );
                ctx.stroke();
            }
            break;
        }
        case 'eight_ball': {
            ctx.fillStyle = 'black';
            ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = 'white';
            ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = 'black';
            ctx.font = `bold ${r * 0.8}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('8', 0, r * 0.05);
            break;
        }
        case 'tennis': {
            ctx.fillStyle = '#DFFF00';
            ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = r * 0.15;
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.8, Math.PI * 0.25, Math.PI * 1.25);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.8, Math.PI * 1.25 + Math.PI, Math.PI * 2.25 + Math.PI);
            ctx.stroke();
            break;
        }
        case 'planet': {
             const planetGradient = ctx.createRadialGradient(r * 0.5, -r * 0.5, r * 0.1, 0, 0, r * 1.8);
             planetGradient.addColorStop(0, '#FFDDBB');
             planetGradient.addColorStop(1, '#D4A276');
             ctx.fillStyle = planetGradient;
             ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();

            ctx.strokeStyle = '#B09574';
            ctx.lineWidth = r * 0.15;
            ctx.beginPath();
            ctx.ellipse(0, 0, r * 1.5, r * 0.4, 0.2, 0, Math.PI * 2);
            ctx.stroke();
            break;
        }
        case 'voltage': {
            ctx.fillStyle = '#1A237E';
            ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();

            ctx.strokeStyle = '#00E5FF';
            ctx.lineWidth = r * 0.1;
            ctx.shadowColor = '#00E5FF';
            ctx.shadowBlur = r * 0.5;

            ctx.beginPath();
            ctx.moveTo(-r * 0.7, 0);
            ctx.lineTo(-r * 0.2, r * 0.3);
            ctx.lineTo(r * 0.3, -r * 0.4);
            ctx.lineTo(r * 0.7, 0);
            ctx.stroke();

            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            break;
        }
        default: { // default
            const sides = 5;
            const pRadius = r * 0.4;
            ctx.beginPath();
            for (let i = 0; i < sides; i++) {
                const angle = (i / sides) * (2 * Math.PI) - Math.PI / 2;
                const px = pRadius * Math.cos(angle);
                const py = pRadius * Math.sin(angle);
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            const oRadius1 = r * 0.95;
            const oRadius2 = r;
            for (let i = 0; i < sides; i++) {
                const angle = (i / sides) * (2 * Math.PI) - Math.PI / 2;
                const angle_offset = (2 * Math.PI / sides) / 2;
                const p1x = pRadius * Math.cos(angle);
                const p1y = pRadius * Math.sin(angle);
                const p2x = oRadius1 * Math.cos(angle + angle_offset);
                const p2y = oRadius1 * Math.sin(angle + angle_offset);
                const p3x = oRadius1 * Math.cos(angle - angle_offset);
                const p3y = oRadius1 * Math.sin(angle - angle_offset);
                ctx.beginPath(); ctx.moveTo(p1x, p1y); ctx.lineTo(p3x, p3y); ctx.lineTo(oRadius2 * Math.cos(angle - angle_offset), oRadius2 * Math.sin(angle - angle_offset)); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(p1x, p1y); ctx.lineTo(p2x, p2y); ctx.lineTo(oRadius2 * Math.cos(angle + angle_offset), oRadius2 * Math.sin(angle + angle_offset)); ctx.stroke();
            }
            break;
        }
    }
    
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
    
    // Hit Flash
    if (ballHitFlash > 0) {
      ctx.beginPath();
      ctx.arc(x, y, r + 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${ballHitFlash * 0.8})`;
      ctx.fill();
    }
};