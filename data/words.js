// ============================================================
// data/words.js — Word bank for the game
// Add more words to any category as you like!
// ============================================================

const words = {
  animals: [
    "elephant", "penguin", "dolphin", "tiger", "giraffe",
    "crocodile", "kangaroo", "cheetah", "gorilla", "flamingo",
    "octopus", "peacock", "wolverine", "platypus", "chameleon"
  ],
  food: [
    "pizza", "sushi", "burger", "pasta", "chocolate",
    "watermelon", "popcorn", "cheesecake", "taco", "ramen",
    "croissant", "mango", "pancake", "curry", "doughnut"
  ],
  places: [
    "beach", "library", "volcano", "hospital", "spaceship",
    "lighthouse", "jungle", "castle", "subway", "stadium",
    "desert", "igloo", "waterfall", "cave", "skyscraper"
  ],
  objects: [
    "umbrella", "telescope", "compass", "lantern", "microscope",
    "hourglass", "binoculars", "hammock", "skateboard", "accordion",
    "chandelier", "periscope", "magnifying glass", "boomerang", "kaleidoscope"
  ],
  nature: [
    "rainbow", "tornado", "glacier", "thunderstorm", "eclipse",
    "aurora", "volcano", "avalanche", "tsunami", "meteor",
    "canyon", "coral reef", "blizzard", "quicksand", "geyser"
  ],
  sports: [
    "surfing", "archery", "fencing", "wrestling", "gymnastics",
    "polo", "bobsled", "curling", "skydiving", "rock climbing",
    "rowing", "javelin", "triathlon", "snorkeling", "parkour"
  ]
};

// Flatten all words into one array
const allWords = Object.values(words).flat();

/**
 * Returns a random word from the full word bank
 */
function getRandomWord() {
  return allWords[Math.floor(Math.random() * allWords.length)];
}

module.exports = { words, allWords, getRandomWord };
