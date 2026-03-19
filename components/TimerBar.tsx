
import React, { useEffect, useRef } from 'react';

interface TimerBarProps {
  duration: number;
  totalDuration: number;
  isPaused?: boolean;
}

export const TimerBar: React.FC<TimerBarProps> = ({ duration, totalDuration, isPaused }) => {
  const barRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number | null>(null);
  const pausedTimeRef = useRef<number | null>(null);
  const totalPausedDurationRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    // Wait until it's unpaused to start the timer, or track pause duration
    if (isPaused) {
        if (pausedTimeRef.current === null) {
            pausedTimeRef.current = performance.now();
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        return;
    } else {
        if (pausedTimeRef.current !== null) {
            totalPausedDurationRef.current += performance.now() - pausedTimeRef.current;
            pausedTimeRef.current = null;
        }
    }

    if (startTimeRef.current === null) {
        startTimeRef.current = performance.now();
    }
    
    const frame = () => {
      if (isPaused) return; // double check

      const now = performance.now();
      const elapsed = (now - startTimeRef.current! - totalPausedDurationRef.current) / 1000;
      const remaining = Math.max(0, duration - elapsed);

      // Update DOM directly for performance
      if (barRef.current) {
        const percent = (remaining / totalDuration) * 100;
        barRef.current.style.width = `${percent}%`;
        
        // Visual state classes
        if (remaining <= 3) {
            barRef.current.classList.remove('bg-galaxy-cyan');
            barRef.current.classList.add('bg-solar-orange');
        } else {
            barRef.current.classList.add('bg-galaxy-cyan');
            barRef.current.classList.remove('bg-solar-orange');
        }
      }

      if (textRef.current) {
         textRef.current.textContent = remaining.toFixed(1);
         if (remaining <= 3) {
             textRef.current.classList.add('text-solar-orange', 'animate-pulse');
             textRef.current.classList.remove('text-white');
         } else {
             textRef.current.classList.add('text-white');
             textRef.current.classList.remove('text-solar-orange', 'animate-pulse');
         }
      }

      if (remaining > 0) {
        animationFrameRef.current = requestAnimationFrame(frame);
      }
    };

    animationFrameRef.current = requestAnimationFrame(frame);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [duration, totalDuration, isPaused]);

  return (
    <div className="flex-grow flex flex-col justify-center min-w-[60px]" role="timer" aria-label={`${duration.toFixed(0)} seconds remaining`}>
        <div className="flex justify-end mb-0.5 sm:mb-1">
             <div className="text-right">
                <div ref={textRef} className="text-xl sm:text-3xl font-black font-mono leading-none text-white">
                    {duration.toFixed(1)}
                </div>
                <div className="text-[9px] sm:text-[10px] uppercase text-gray-500 tracking-widest hidden sm:block">Seconds</div>
            </div>
        </div>
        
        <div className="relative w-full h-1 bg-gray-800 rounded-full overflow-hidden">
            <div 
                ref={barRef}
                className="h-full bg-galaxy-cyan"
                style={{ width: '100%' }}
            ></div>
        </div>
    </div>
  );
};
