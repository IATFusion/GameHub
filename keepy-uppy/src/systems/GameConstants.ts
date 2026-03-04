/**
 * GameConstants — All tunable game parameters in one place.
 *
 * Organized by system for easy balancing. Every magic number in the game
 * traces back here. This is the "designer's control panel."
 */

export const GAME = {
  /** Canvas / world */
  WORLD: {
    GROUND_Y_RATIO: 0.88, // Ground line as ratio of screen height
    BALL_START_Y_RATIO: 0.3, // Ball spawn height ratio
    FOOT_Y_RATIO: 0.78, // Default foot vertical position ratio (legacy)
    FOOT_SEPARATION: 120, // Min px between feet at start
  },

  /** Match rules / field */
  MATCH: {
    HALF_GAP: 10, // Min gap from center line for each player
    GOAL_DEPTH: 26, // How far inside the edge counts as "in the goal"
    GOAL_HEIGHT: 160, // Opening height from ground upward
    RESET_DELAY_MS: 650, // Delay after a goal before reset
  },

  /** Player bodies (the two people) */
  PLAYER: {
    WIDTH: 56,
    HEIGHT: 96,
    Y_RATIO: 0.82,
    MAX_SPEED: 720,
    ACCELERATION: 3200,
    DECELERATION: 2600,
    GRAVITY: 2600,
    JUMP_VELOCITY: -980,
    KICK_COOLDOWN_MS: 140,
    KICK_RANGE: 88,
    KICK_POWER: 560,
    KICK_LIFT: -760,
    HIT_UPWARD_BOOST: -920,
    HIT_SIDE_BOOST: 260,
  },

  /** Ball physics */
  BALL: {
    RADIUS: 22,
    GRAVITY: 900, // px/s² — tuned for responsive juggling arcs
    MAX_VELOCITY_Y: 1400,
    MAX_VELOCITY_X: 950,
    BOUNCE_VELOCITY_PERFECT: -1200, // Negative = upward
    BOUNCE_VELOCITY_GOOD: -1050,
    BOUNCE_VELOCITY_BAD: -850,
    SPIN_FACTOR: 0.15, // How much horizontal offset affects spin
    SPIN_DECAY: 0.97, // Spin decays each frame
    AIR_RESISTANCE: 0.998, // Horizontal damping
    SQUASH_AMOUNT: 0.3, // Max squash deformation
    SQUASH_RECOVERY: 0.12, // How fast squash recovers (0-1 per frame)
  },

  /** Foot controls */
  FOOT: {
    WIDTH: 64,
    HEIGHT: 16,
    MAX_SPEED: 600, // px/s
    ACCELERATION: 2800, // px/s²
    DECELERATION: 2200, // px/s² (friction when no input)
    BOUNCE_ZONE_PERFECT: 12, // px from center = perfect hit
    BOUNCE_ZONE_GOOD: 30, // px from center = good hit
    KICK_ANIMATION_DURATION: 120, // ms
    VERTICAL_KICK_OFFSET: -8, // Foot jumps up slightly on kick
  },

  /** Combo system */
  COMBO: {
    MULTIPLIER_STEP: 0.5, // Each combo level adds this to multiplier
    MAX_MULTIPLIER: 10,
    ALTERNATION_REQUIRED: true, // Must alternate feet for combo
    DECAY_TIME: 3000, // ms before combo starts decaying (unused in strict mode)
    PERFECT_BONUS: 2, // Extra combo points for perfect hits
  },

  /** Flow state meter */
  FLOW: {
    MAX: 100,
    GAIN_PERFECT: 20,
    GAIN_GOOD: 8,
    GAIN_BAD: 2,
    DECAY_RATE: 5, // Per second when not hitting
    SLOW_MOTION_SCALE: 0.4, // Time scale during flow state
    SLOW_MOTION_DURATION: 3000, // ms
    ACTIVATION_THRESHOLD: 100, // Flow must be full to activate
  },

  /** Scoring */
  SCORE: {
    BASE_POINTS: 10,
    PERFECT_BONUS: 25,
    GOOD_BONUS: 10,
  },

  /** Dynamic difficulty */
  DIFFICULTY: {
    GRAVITY_INCREASE_PER_SCORE: 0.5, // Extra gravity per point scored
    MAX_GRAVITY_MULTIPLIER: 1.8,
    SPIN_VARIANCE_INCREASE: 0.002, // Per point scored
    MAX_SPIN_VARIANCE: 0.15,
    BOUNCE_RANDOMNESS_INCREASE: 0.001,
    MAX_BOUNCE_RANDOMNESS: 0.1,
  },

  /** Visual effects */
  VFX: {
    SCREENSHAKE_PERFECT: { intensity: 4, duration: 150 },
    SCREENSHAKE_GOOD: { intensity: 2, duration: 80 },
    PARTICLE_COUNT_PERFECT: 24,
    PARTICLE_COUNT_GOOD: 12,
    PARTICLE_COUNT_BAD: 6,
    TRAIL_LENGTH: 8,
    TRAIL_ALPHA_DECAY: 0.12,
    SLOW_MO_DURATION: 200, // ms of time dilation on perfect hit
    SLOW_MO_SCALE: 0.3,
    CHROMATIC_ABERRATION_DURATION: 200,
    GLOW_PULSE_DURATION: 300,
    CAMERA_FOLLOW_LERP: 0.05,
    SHADOW_OFFSET_Y: 40,
    SHADOW_SCALE_FACTOR: 0.7,
  },

  /** Audio */
  AUDIO: {
    BOUNCE_PITCH_MIN: 0.8,
    BOUNCE_PITCH_MAX: 1.4,
    COMBO_PITCH_STEP: 0.05, // Pitch increases per combo
    MAX_PITCH: 2.0,
  },

  /** Colors — neon sports aesthetic */
  COLORS: {
    BACKGROUND_TOP: 0x0a0e27,
    BACKGROUND_BOTTOM: 0x1a1040,
    BALL: 0xffffff,
    BALL_GLOW: 0x00ffaa,
    BALL_GLOW_PERFECT: 0xffdd00,
    FOOT_LEFT: 0x00ddff,
    FOOT_RIGHT: 0xff4488,
    GROUND: 0x1a2a4a,
    GROUND_LINE: 0x2a4a8a,
    PARTICLE_COLORS: [0x00ffaa, 0x00ddff, 0xff4488, 0xffdd00, 0xffffff],
    COMBO_TEXT: 0xffdd00,
    PERFECT_TEXT: 0x00ffaa,
    GOOD_TEXT: 0x00ddff,
    BAD_TEXT: 0xff6666,
    NEON_BLUE: 0x00ddff,
    NEON_PINK: 0xff4488,
    NEON_GREEN: 0x00ffaa,
    NEON_YELLOW: 0xffdd00,
  },
} as const;
