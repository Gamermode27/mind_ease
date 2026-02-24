
import React, { useState, useEffect } from 'react';
import { Exercise } from '../types';

interface ExerciseTimerProps {
  exercise: Exercise;
  onComplete: () => void;
}

export const ExerciseTimer: React.FC<ExerciseTimerProps> = ({ exercise, onComplete }) => {
  const [timeLeft, setTimeLeft] = useState(exercise.durationSec);
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    let interval: any;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
        
        const stepCount = exercise.steps.length;
        const stepDuration = exercise.durationSec / stepCount;
        const newStep = Math.floor((exercise.durationSec - timeLeft) / stepDuration);
        if (newStep < stepCount) {
          setCurrentStep(newStep);
        }
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, exercise]);

  const progress = ((exercise.durationSec - timeLeft) / exercise.durationSec) * 100;

  return (
    <div className="flex flex-col items-center justify-center p-8 glass-light rounded-[3rem] text-slate-800 shadow-2xl border-white">
      <div className="text-blue-600 text-6xl mb-6 animate-float">
        <i className={`fa-solid ${exercise.icon}`}></i>
      </div>
      <h2 className="text-3xl font-black text-slate-800 mb-1">{exercise.title}</h2>
      <p className="text-blue-500 text-[10px] font-black uppercase tracking-widest mb-8">{exercise.type}</p>

      {/* Progress Circle Visual */}
      <div className="relative w-56 h-56 mb-10 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="112"
            cy="112"
            r="104"
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            className="text-slate-100"
          />
          <circle
            cx="112"
            cy="112"
            r="104"
            stroke="currentColor"
            strokeWidth="10"
            fill="transparent"
            strokeDasharray={653.45}
            strokeDashoffset={653.45 - (653.45 * progress) / 100}
            strokeLinecap="round"
            className="text-blue-600 transition-all duration-1000 ease-linear drop-shadow-lg"
          />
        </svg>
        <span className="absolute text-5xl font-black text-slate-800 tracking-tighter">
          {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
        </span>
      </div>

      <div className="w-full max-w-sm space-y-3 mb-10">
        {exercise.steps.map((step, idx) => (
          <div 
            key={idx} 
            className="p-4 rounded-2xl transition-all duration-500 flex items-center gap-4 border-2 bg-white text-slate-700 border-slate-200"
          >
            <span className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm border-2 bg-slate-100 text-slate-700 border-slate-200">
              {idx + 1}
            </span>
            <span className="text-sm">{step}</span>
          </div>
        ))}
      </div>

      <div className="w-full">
        {!isActive ? (
          <button 
            onClick={() => timeLeft === 0 ? onComplete() : setIsActive(true)}
            className="w-full py-5 bg-blue-600 text-white rounded-[1.5rem] font-bold text-xl shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all"
          >
            {timeLeft === exercise.durationSec ? 'Begin Practice' : timeLeft === 0 ? 'Finish Session' : 'Resume'}
          </button>
        ) : (
          <button 
            onClick={() => setIsActive(false)}
            className="w-full py-5 border-2 border-slate-200 text-slate-500 rounded-[1.5rem] font-bold hover:bg-slate-50 transition-all"
          >
            Pause
          </button>
        )}
      </div>
    </div>
  );
};
