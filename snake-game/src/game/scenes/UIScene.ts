// ─── UIScene ────────────────────────────────────────────────────────────────
// Phaser overlay scene for in-game HUD elements rendered in canvas
// (Score, combo text, etc. — most UI handled by React)

export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    // This scene runs on top of GameScene
    // Most UI is handled by React; this scene is available for
    // canvas-rendered overlays if needed (e.g., in-game text effects)

    // Subtle vignette / corner darkening for cinematic feel
    this.createVignette();
  }

  private createVignette(): void {
    const g = this.add.graphics();
    g.setDepth(200);

    const w = this.scale.width;
    const h = this.scale.height;

    // Corner overlays — subtle darkening for depth
    g.fillStyle(0x000000, 0.15);
    g.fillTriangle(0, 0, 80, 0, 0, 80);
    g.fillTriangle(w, 0, w - 80, 0, w, 80);
    g.fillTriangle(0, h, 80, h, 0, h - 80);
    g.fillTriangle(w, h, w - 80, h, w, h - 80);
  }
}
