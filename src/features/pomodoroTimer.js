import React, { useState, useEffect } from 'react';

const PomodoroTimer = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes
  const [isBreak, setIsBreak] = useState(false);
  const [audio] = useState(new Audio('/path/to/sound.mp3'));

  useEffect(() => {
    let timer;
    if (isRunning) {
      timer = setInterval(() => {
        setTimeLeft(prevTime => {
          if (prevTime <= 1) {
            clearInterval(timer);
            if (isBreak) {
              setIsRunning(false);
              setTimeLeft(25 * 60); // Reset for next Pomodoro
              setIsBreak(false);
            } else {
              setIsBreak(true);
              setTimeLeft(5 * 60); // Break for 5 minutes
            }
            audio.play(); // Play sound when timer reaches zero
            return prevTime;
          }
          return prevTime - 1;
        });
      }, 1000);
    } else {
      clearInterval(timer);
    }

    return () => clearInterval(timer);
  }, [isRunning, isBreak, audio]);

  const handleStartPause = () => {
    setIsRunning(prevState => !prevState);
  };

  const handleReset = () => {
    setIsRunning(false);
    setTimeLeft(25 * 60);
    setIsBreak(false);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="pomodoro-timer">
      <h1>{isBreak ? 'Break Time' : 'Pomodoro Timer'}</h1>
      <div className="time-display">
        <span>{String(minutes).padStart(2, '0')}</span> : <span>{String(seconds).padStart(2, '0')}</span>
      </div>
      <button onClick={handleStartPause}>{isRunning ? 'Pause' : 'Start'}</button>
      <button onClick={handleReset}>Reset</button>
    </div>
  );
};

export default PomodoroTimer;