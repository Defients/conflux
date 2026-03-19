import { SeededRNG } from './seededRNG';

// Simple Perlin-like noise function
function createNoise(rng: SeededRNG) {
    const perm: number[] = [];
    while (perm.length < 256) {
        perm.push(perm.length);
    }
    rng.shuffle(perm);
    const p = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
        p[i] = perm[i & 255];
    }

    const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
    const lerp = (t: number, a: number, b: number) => a + t * (b - a);
    const grad = (hash: number, x: number, y: number) => {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    };

    return (x: number, y: number) => {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        x -= Math.floor(x);
        y -= Math.floor(y);
        const u = fade(x);
        const v = fade(y);
        const a = p[X] + Y;
        const b = p[X + 1] + Y;
        return lerp(v,
            lerp(u, grad(p[a], x, y), grad(p[b], x - 1, y)),
            lerp(u, grad(p[a + 1], x, y - 1), grad(p[b + 1], x - 1, y - 1))
        );
    };
}

export function generateNebula(canvas: HTMLCanvasElement, seed: string): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rng = new SeededRNG(`nebula-${seed}`);
    const noise = createNoise(rng);

    const width = canvas.width = window.innerWidth;
    const height = canvas.height = window.innerHeight;

    ctx.fillStyle = '#0a0f2c';
    ctx.fillRect(0, 0, width, height);
    
    // Create a color palette based on the seed
    const hueBase1 = rng.nextFloat() * 360;
    const hueBase2 = (hueBase1 + rng.nextInt(60, 120)) % 360;
    
    const colors = [
        `hsla(${hueBase1}, 70%, 50%, 0.1)`,
        `hsla(${hueBase2}, 80%, 60%, 0.15)`,
        `hsla(${(hueBase1 + 180) % 360}, 60%, 40%, 0.05)`,
    ];

    const particleCount = 200;
    const particles = [];
    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: rng.nextFloat() * width,
            y: rng.nextFloat() * height,
            vx: 0,
            vy: 0,
            life: rng.nextFloat() * 100,
        });
    }

    const noiseScaleX = rng.nextFloat() * 0.005 + 0.001;
    const noiseScaleY = rng.nextFloat() * 0.005 + 0.001;
    const noiseStrength = rng.nextFloat() * 0.5 + 0.1;
    
    ctx.globalCompositeOperation = 'lighter';
    
    for (let i = 0; i < 50; i++) { // Simulate 50 frames to build up the image
        for (const p of particles) {
            const angle = noise(p.x * noiseScaleX, p.y * noiseScaleY) * Math.PI * 2;
            p.vx += Math.cos(angle) * noiseStrength;
            p.vy += Math.sin(angle) * noiseStrength;
            
            p.x += p.vx;
            p.y += p.vy;

            p.vx *= 0.96;
            p.vy *= 0.96;

            if (p.x < 0 || p.x > width || p.y < 0 || p.y > height || p.life <= 0) {
                p.x = rng.nextFloat() * width;
                p.y = rng.nextFloat() * height;
                p.vx = 0;
                p.vy = 0;
                p.life = 100;
            }
            p.life--;

            ctx.beginPath();
            ctx.arc(p.x, p.y, rng.nextFloat() * 60 + 20, 0, Math.PI * 2);
            ctx.fillStyle = colors[rng.nextInt(0, colors.length)];
            ctx.fill();
        }
    }
}
