
import { Exercise } from './types';

export const EXERCISES: Exercise[] = [
  {
    id: "breath-4-6",
    title: "4-6-8 Calm Breath",
    steps: ["Inhale for 4 seconds", "Hold for 4 seconds", "Exhale for 8 seconds", "Repeat 4 times"],
    durationSec: 80,
    type: "breathing",
    icon: "fa-wind"
  },
  {
    id: "ground-5-4-3-2-1",
    title: "5-4-3-2-1 Grounding",
    steps: ["Name 5 things you see", "Name 4 things you can touch", "Name 3 things you hear", "Name 2 things you smell", "Name 1 thing you taste"],
    durationSec: 150,
    type: "grounding",
    icon: "fa-earth-americas"
  },
  {
    id: "stretch-reset",
    title: "Quick Release Stretch",
    steps: ["Roll your shoulders back 5 times", "Reach for the sky", "Touch your toes slowly", "Shake out your hands and feet"],
    durationSec: 120,
    type: "stretch",
    icon: "fa-person-walking"
  },
  {
    id: "body-scan",
    title: "Mindful Body Scan",
    steps: ["Close your eyes", "Unclench your jaw", "Drop your shoulders", "Notice your feet on the ground", "Take 3 deep breaths"],
    durationSec: 180,
    type: "grounding",
    icon: "fa-eye"
  },
  {
    id: "kindness-check",
    title: "Self-Kindness Reflection",
    steps: ["Place a hand on your heart", "Think of one thing you're proud of", "Say 'I am doing my best' out loud", "Name one friend you appreciate"],
    durationSec: 120,
    type: "reflection",
    icon: "fa-heart"
  }
];

export const CRISIS_KEYWORDS = [
  "suicidal", "suicide", "self-harm", "kill myself", "end my life", "end it", 
  "overdose", "cut myself", "hurt myself", "want to die"
];
