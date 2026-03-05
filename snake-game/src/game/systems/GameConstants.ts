// ─── Game Constants ─────────────────────────────────────────────────────────
// Central configuration for NEBULA SLITHER — Sci-Fi Arcade Snake

// Grid dimensions
export const GRID_WIDTH = 48;
export const GRID_HEIGHT = 27;
export const CELL_SIZE = 20;
export const GAME_WIDTH = GRID_WIDTH * CELL_SIZE;   // 960
export const GAME_HEIGHT = GRID_HEIGHT * CELL_SIZE;  // 540

// Movement timing (ms)
export const PLAYER_MOVE_INTERVAL = 105;
export const CPU_BASE_MOVE_INTERVAL = 135;
export const CPU_MIN_MOVE_INTERVAL = 75;

// Snake defaults
export const INITIAL_SNAKE_LENGTH = 4;
export const INPUT_BUFFER_SIZE = 3;

// Food
export const MAX_FOOD_ON_SCREEN = 4;
export const FOOD_SPAWN_DELAY = 800;
export const BONUS_FOOD_CHANCE = 0.18;
export const SUPER_FOOD_CHANCE = 0.05;
export const BONUS_FOOD_LIFETIME = 6000;
export const SUPER_FOOD_LIFETIME = 4000;

// Difficulty
export const DIFFICULTY_TICK_INTERVAL = 10000; // every 10s
export const CPU_SPEED_DECREASE_PER_TICK = 5;  // ms faster per tick

// Death / effects
export const DEATH_SLOW_MO_DURATION = 800;
export const DEATH_SLOW_MO_SCALE = 0.25;
export const CAMERA_SHAKE_INTENSITY = 0.008;
export const CAMERA_SHAKE_DURATION = 200;

// ─── Direction ──────────────────────────────────────────────────────────────

export enum Direction {
  UP    = 'UP',
  DOWN  = 'DOWN',
  LEFT  = 'LEFT',
  RIGHT = 'RIGHT',
}

export const DIR_VECTORS: Record<Direction, { x: number; y: number }> = {
  [Direction.UP]:    { x:  0, y: -1 },
  [Direction.DOWN]:  { x:  0, y:  1 },
  [Direction.LEFT]:  { x: -1, y:  0 },
  [Direction.RIGHT]: { x:  1, y:  0 },
};

export const OPPOSITE_DIR: Record<Direction, Direction> = {
  [Direction.UP]:    Direction.DOWN,
  [Direction.DOWN]:  Direction.UP,
  [Direction.LEFT]:  Direction.RIGHT,
  [Direction.RIGHT]: Direction.LEFT,
};

export const ALL_DIRECTIONS = [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT];

// ─── Food Types ─────────────────────────────────────────────────────────────

export enum FoodType {
  NORMAL = 'NORMAL',
  BONUS  = 'BONUS',
  SUPER  = 'SUPER',
}

export const FOOD_SCORES: Record<FoodType, number> = {
  [FoodType.NORMAL]: 10,
  [FoodType.BONUS]:  25,
  [FoodType.SUPER]:  50,
};

export const FOOD_GROWTH: Record<FoodType, number> = {
  [FoodType.NORMAL]: 1,
  [FoodType.BONUS]:  2,
  [FoodType.SUPER]:  4,
};

// ─── Colors (hex numbers for Phaser) ── Neon Sci-Fi Arcade Theme ───────────

export const COLORS = {
  // Background & grid — deep space
  BG:           0x05050f,
  BG_GRADIENT:  0x080820,
  GRID_LINE:    0x0e1a30,
  GRID_DOT:     0x162844,

  // Player snake — neon teal/cyan
  PLAYER_HEAD:  0x2ef2c3,
  PLAYER_BODY:  0x1ad4a8,
  PLAYER_TAIL:  0x10a080,
  PLAYER_GLOW:  0x49ffbd,
  PLAYER_EYE:   0xb0ffe0,

  // CPU snake — hot magenta/pink
  CPU_HEAD:     0xff2a6d,
  CPU_BODY:     0xd41860,
  CPU_TAIL:     0x8a1040,
  CPU_GLOW:     0xff4488,
  CPU_EYE:      0xff88aa,

  // Food — energy orbs
  FOOD_NORMAL:  0x29e0ff,  // cyan orb
  FOOD_BONUS:   0xb34dff,  // plasma shard
  FOOD_SUPER:   0xffa621,  // solar core
  FOOD_GLOW_NORMAL: 0x5eeaff,
  FOOD_GLOW_BONUS:  0xc880ff,
  FOOD_GLOW_SUPER:  0xffbe55,

  // Nebula ambient tints
  NEBULA_1:     0x12002e,
  NEBULA_2:     0x001830,
  NEBULA_3:     0x0a1e04,

  // UI
  TEXT_PRIMARY: 0xe0ecff,
  TEXT_ACCENT:  0x2ef2c3,
  TEXT_DANGER:  0xff2a6d,
  UI_BG:        0x050510,
} as const;

// CSS color strings for React UI
export const CSS_COLORS = {
  BG:           '#05050f',
  PLAYER:       '#2ef2c3',
  CPU:          '#ff2a6d',
  FOOD_NORMAL:  '#29e0ff',
  FOOD_BONUS:   '#b34dff',
  FOOD_SUPER:   '#ffa621',
  TEXT:         '#e0ecff',
  TEXT_DIM:     '#3a5888',
  ACCENT:       '#2ef2c3',
  ACCENT2:      '#29e0ff',
  DANGER:       '#ff2a6d',
  PANEL_BG:     'rgba(6, 8, 24, 0.85)',
  PANEL_BORDER: 'rgba(46, 242, 195, 0.2)',
  NEON_GLOW:    '#12c6ff',
} as const;
