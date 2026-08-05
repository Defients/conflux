import React, { useState, useEffect, useMemo, useRef } from 'react';
import { EventProps } from '../types';
import { SeededRNG } from '../services/seededRNG';

// A simple question bank. In a real app, this would come from a larger source.
const QUESTION_BANK = [
    { q: "Which of these is NOT a primary color?", a: ["Red", "Blue", "Green", "Yellow"], correct: 2 },
    { q: "What is the capital of Japan?", a: ["Beijing", "Seoul", "Tokyo", "Bangkok"], correct: 2 },
    { q: "How many sides does a hexagon have?", a: ["5", "6", "7", "8"], correct: 1 },
    { q: "What is 8 x 7?", a: ["48", "54", "56", "64"], correct: 2 },
    { q: "Which planet is known as the Red Planet?", a: ["Mars", "Venus", "Jupiter", "Saturn"], correct: 0 },
    { q: "What is the largest mammal?", a: ["Elephant", "Blue Whale", "Giraffe", "Great White Shark"], correct: 1 },
    { q: "In which year did the Titanic sink?", a: ["1905", "1912", "1918", "1923"], correct: 1 },
    { q: "What is the chemical symbol for Gold?", a: ["Ag", "Au", "Pb", "Fe"], correct: 1 },
];

type Question = typeof QUESTION_BANK[0];

export const QuickQuiz: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred , isPaused }) => {
    const questions = useMemo(() => {
        const rng = new SeededRNG(`quiz-${settings.seed}-${tile.tileIndex}`);
        return rng.shuffle([...QUESTION_BANK]).slice(0, 3);
    }, [settings.seed, tile.tileIndex]);

    const [questionIndex, setQuestionIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
    const [timeLeft, setTimeLeft] = useState(4); // 4 seconds per question
    
    const resultsRef = useRef({ correctCount: 0, totalTimeMs: 0 });
    const questionStartTime = useRef(performance.now());
    const isDoneRef = useRef(false);
    const isAdvancingRef = useRef(false);

    useEffect(() => {
        isAdvancingRef.current = false;
    }, [questionIndex]);

    const currentQuestion = questions[questionIndex];

    const advanceQuestion = () => {
        if (isDoneRef.current || isAdvancingRef.current) return;
        isAdvancingRef.current = true;
        
        if (questionIndex >= questions.length - 1) {
            // End of quiz
            isDoneRef.current = true;
            onComplete({ primaryMetric: resultsRef.current.correctCount, secondaryMetric: resultsRef.current.totalTimeMs });
        } else {
            setQuestionIndex(q => q + 1);
            setSelectedAnswer(null);
            setFeedback(null);
            setTimeLeft(4);
            questionStartTime.current = performance.now();
        }
    };
    
    useEffect(() => {
        if (isPaused) return;
        const timer = setInterval(() => {
            setTimeLeft(t => {
                if (t <= 1) {
                    // Time's up, count as incorrect
                    resultsRef.current.totalTimeMs += 4000;
                    advanceQuestion();
                    return 0;
                }
                return t - 1;
            });
        }, 1000);
        
        return () => clearInterval(timer);
    }, [isPaused, questionIndex]);

    const handleAnswerClick = (index: number) => {
        if (selectedAnswer !== null) return;

        resultsRef.current.totalTimeMs += performance.now() - questionStartTime.current;
        setSelectedAnswer(index);

        if (index === currentQuestion.correct) {
            resultsRef.current.correctCount++;
            setFeedback('correct');
        } else {
            setFeedback('incorrect');
        }

        setTimeout(advanceQuestion, 800); // Short delay to show feedback
    };

    const getButtonClass = (index: number) => {
        if (selectedAnswer === null) {
            return 'bg-star-purple hover:bg-nebula-pink';
        }
        if (index === currentQuestion.correct) {
            return 'bg-hyper-green';
        }
        if (index === selectedAnswer) {
            return 'bg-nebula-pink';
        }
        return 'bg-star-purple opacity-50';
    };

    if (!currentQuestion) {
        return null;
    }

    return (
        <div className={`w-full h-full flex flex-col items-center justify-center p-8 bg-cosmic-blue/50 select-none ${isBlurred ? 'filter blur-md' : ''}`}>
            <div className="w-full max-w-2xl text-center">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg text-galaxy-cyan">Question {questionIndex + 1} of 3</h3>
                    <div className="text-2xl font-bold text-solar-orange">{timeLeft}s</div>
                </div>
                
                <div className="glass-panel p-6 mb-6 min-h-[100px] flex items-center justify-center">
                    <p className="text-2xl font-semibold">{currentQuestion.q}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    {currentQuestion.a.map((answer, i) => (
                        <button
                            key={i}
                            onClick={() => handleAnswerClick(i)}
                            disabled={selectedAnswer !== null}
                            className={`p-4 text-xl font-bold rounded-lg transition-colors duration-200 ${getButtonClass(i)}`}
                        >
                            {answer}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
