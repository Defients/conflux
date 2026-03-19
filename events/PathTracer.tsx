import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { EventProps } from '../types';
import { SeededRNG } from '../services/seededRNG';

type Point = { x: number; y: number };

const generatePath = (rng: SeededRNG, difficulty: number, width: number, height: number): Point[] => {
    const points: Point[] = [];
    const numPoints = 5 + difficulty * 2;
    points.push({ x: width * 0.1, y: height * 0.5 });

    for (let i = 1; i < numPoints; i++) {
        const prev = points[i - 1];
        const x = prev.x + (width * 0.8) / (numPoints - 1);
        const yOffset = (rng.nextFloat() - 0.5) * (height * 0.8);
        const y = height * 0.5 + yOffset;
        points.push({ x: Math.round(x), y: Math.round(y) });
    }
    return points;
};

const toSvgPath = (points: Point[]): string => {
    if (points.length === 0) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        d += ` Q ${p1.x} ${p1.y}, ${midX} ${midY}`;
    }
    d += ` T ${points[points.length - 1].x} ${points[points.length - 1].y}`;
    return d;
};


export const PathTracer: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred , isPaused }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const pathRef = useRef<SVGPathElement>(null);
    const [progress, setProgress] = useState(0);
    const progressRef = useRef(0);
    const [status, setStatus] = useState<'playing' | 'failed' | 'success'>('playing');
    const isDoneRef = useRef(false);

    const pathWidth = 40 - tile.difficulty * 8; // 32, 24, 16

    const { pathData, totalLength } = useMemo(() => {
        const rng = new SeededRNG(`pathtracer-${settings.seed}-${tile.tileIndex}`);
        const points = generatePath(rng, tile.difficulty, 800, 400);
        const data = toSvgPath(points);
        
        // Temporarily render path to measure its length
        const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        tempPath.setAttribute('d', data);
        const length = tempPath.getTotalLength();

        return { pathData: data, totalLength: length };
    }, [settings.seed, tile.tileIndex, tile.difficulty]);
    
    const finishEvent = useCallback(() => {
        if (isDoneRef.current) return;
        isDoneRef.current = true;
        onComplete({ primaryMetric: (progressRef.current / totalLength) * 100 });
    }, [onComplete, totalLength]);

    useEffect(() => {
        if (isPaused) return;
        const duration = event.durationSec(tile.difficulty, settings.accessibility) * 1000;
        const timer = setTimeout(() => {
            if (!isDoneRef.current) {
                setStatus('failed');
                finishEvent();
            }
        }, duration);
        return () => clearTimeout(timer);
    }, [event, tile.difficulty, settings.accessibility, finishEvent, isPaused]);

    useEffect(() => {
        const svg = svgRef.current;
        const path = pathRef.current;
        if (!svg || !path) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (isDoneRef.current) return;

            const pt = svg.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());

            if (path.isPointInStroke(svgP)) {
                const pointOnPath = path.getPointAtLength(progressRef.current);
                const dist = Math.sqrt((svgP.x - pointOnPath.x)**2 + (svgP.y - pointOnPath.y)**2);

                // Only advance progress if mouse is near the "head" of the progress line
                if (dist < 100) { 
                    let bestDist = Infinity;
                    let bestProgress = progressRef.current;
                    // Search forward to find the closest point on the path
                    for(let i = 0; i < 150; i += 2) {
                        const checkProgress = progressRef.current + i;
                        if(checkProgress > totalLength) break;
                        const p = path.getPointAtLength(checkProgress);
                        const d = Math.sqrt((svgP.x - p.x)**2 + (svgP.y - p.y)**2);
                        if(d < bestDist) {
                            bestDist = d;
                            bestProgress = checkProgress;
                        }
                    }
                    progressRef.current = bestProgress;
                    setProgress(bestProgress);

                    if (bestProgress / totalLength > 0.99) {
                        setStatus('success');
                        finishEvent();
                    }
                }
            } else {
                setStatus('failed');
                finishEvent();
            }
        };

        svg.addEventListener('mousemove', handleMouseMove);
        return () => svg.removeEventListener('mousemove', handleMouseMove);
    }, [totalLength, finishEvent]);

    const getStatusMessage = () => {
        switch(status) {
            case 'playing': return 'Trace the path!';
            case 'failed': return 'Off the path!';
            case 'success': return 'Path Complete!';
        }
    }

    return (
        <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-cosmic-blue/50 select-none overflow-hidden ${isBlurred ? 'filter blur-md' : ''}`}>
            <h3 className="text-2xl font-bold text-galaxy-cyan mb-4">{getStatusMessage()}</h3>
            <div className="w-full h-full max-w-4xl max-h-[400px] bg-gray-900/50 rounded-lg cursor-crosshair">
                <svg ref={svgRef} viewBox="0 0 800 400" className="w-full h-full">
                    {/* Background Path */}
                    <path
                        d={pathData}
                        fill="none"
                        stroke="#4a3f9d"
                        strokeWidth={pathWidth}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    {/* Progress Path */}
                    <path
                        ref={pathRef}
                        d={pathData}
                        fill="none"
                        stroke="#00dffc"
                        strokeWidth={pathWidth - 4}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray={totalLength}
                        strokeDashoffset={totalLength - progress}
                    />
                    {/* Start and End nodes */}
                    <circle cx={pathRef.current?.getPointAtLength(0).x} cy={pathRef.current?.getPointAtLength(0).y} r={pathWidth/2 + 5} fill="#4dffaf" />
                    <circle cx={pathRef.current?.getPointAtLength(totalLength).x} cy={pathRef.current?.getPointAtLength(totalLength).y} r={pathWidth/2 + 5} fill="#d64f8a" />
                </svg>
            </div>
             <div className="mt-4 w-full max-w-4xl">
                <div className="w-full bg-star-purple h-2 rounded-full">
                    <div className="bg-hyper-green h-2 rounded-full" style={{ width: `${(progress / totalLength) * 100}%` }}></div>
                </div>
            </div>
        </div>
    );
};
