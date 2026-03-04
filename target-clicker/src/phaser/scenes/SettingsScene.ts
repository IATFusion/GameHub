import Phaser from 'phaser'

import { applySettings, Settings } from '../settings'

const FONT  = 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif'
const GREEN = '#c8ff00'
const DIM   = '#4a5a20'
const DARK  = '#0d150d'

// settings.png is 1024 × 1536  →  ratio height/width = 1.5 (same as leaderboard.png)
const IMG_RATIO = 1.5

interface SettingRow {
  key:      keyof typeof Settings
  label:    string
  labelTxt: Phaser.GameObjects.Text   // assigned in create()
  btn:      Phaser.GameObjects.Text   // assigned in create()
}

export class SettingsScene extends Phaser.Scene {
  public static readonly Key = 'SettingsScene'

  private panelImg!: Phaser.GameObjects.Image
  private dimBg!:    Phaser.GameObjects.Rectangle
  private backBtn!:  Phaser.GameObjects.Text

  private rows: SettingRow[] = [
    { key: 'volumeEnabled',    label: 'VOLUME',       labelTxt: null!, btn: null! },
    { key: 'sfxEnabled',       label: 'SFX',          labelTxt: null!, btn: null! },
    { key: 'vibrationEnabled', label: 'VIBRATION',    labelTxt: null!, btn: null! },
    { key: 'shakeEnabled',     label: 'SCREEN SHAKE', labelTxt: null!, btn: null! },
  ]

  public constructor() { super(SettingsScene.Key) }

  /* ================================================================
   * Lifecycle
   * ============================================================= */

  public create(): void {
    const { width, height } = this.scale

    if (this.scene.isActive('GameScene')) this.scene.pause('GameScene')

    // Full-screen dim — intercepts clicks that miss the panel
    this.dimBg = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.72)
      .setDepth(0)
      .setInteractive()

    // Stone panel image (SETTINGS header baked in)
    this.panelImg = this.add.image(0, 0, 'settings_bg')
      .setOrigin(0.5).setDepth(1)

    // Create label + toggle button for each row
    for (const row of this.rows) {
      row.labelTxt = this.add.text(0, 0, row.label, {
        fontFamily: FONT,
        fontSize:   '14px',
        color:      GREEN,
        fontStyle:  'bold',
        stroke:     '#0b1a00',
        strokeThickness: 2,
      }).setDepth(2).setOrigin(0, 0.5)
        .setShadow(0, 0, '#2aff7b', 6, true, true)

      row.btn = this.add.text(0, 0, '', {
        fontFamily: FONT,
        fontSize:   '13px',
        fontStyle:  'bold',
        padding:    { x: 14, y: 7 },
      }).setDepth(2).setOrigin(0.5, 0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerover',  () => row.btn.setAlpha(0.8))
        .on('pointerout',   () => row.btn.setAlpha(1))
        .on('pointerdown',  () => this.toggle(row))
      this.syncBtn(row)
    }

    // Back button — below the panel
    this.backBtn = this.add.text(0, 0, 'BACK', {
      fontFamily:  FONT,
      fontSize:    '17px',
      fontStyle:   'bold',
      color:       DARK,
      backgroundColor: GREEN,
      padding:     { x: 36, y: 11 },
      stroke:      '#0b1a00',
      strokeThickness: 2,
    }).setDepth(2).setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover',  () => this.backBtn.setAlpha(0.8))
      .on('pointerout',   () => this.backBtn.setAlpha(1))
      .on('pointerdown',  () => this.close())

    this.layout()
    this.scale.on('resize', this.layout, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.layout, this)
    })
  }

  /* ================================================================
   * Layout  (mirrors UIScene.layoutOverlay approach)
   * ============================================================= */

  private layout(): void {
    const { width, height } = this.scale
    const cx = width / 2

    this.dimBg.setPosition(cx, height / 2).setSize(width, height)

    const margin = 18

    // Panel fills available height (no space reserved below — back btn is inside)
    const maxPanelH = height - margin * 2
    const panelWByH = maxPanelH / IMG_RATIO
    const panelW    = Math.min(width * 0.85, panelWByH, 380)
    const panelH    = panelW * IMG_RATIO
    const panelTop  = margin
    const panelLeft = cx - panelW / 2

    this.panelImg
      .setPosition(cx, panelTop + panelH / 2)
      .setDisplaySize(panelW, panelH)

    // ── Exact fractions derived from image measurements (1024×1536) ──
    // Usable stone area: 670×755 px at (175, 364)
    // → left 17.09%, top 23.70%, right 82.52%, bottom 72.85%
    const padH = panelH * 0.03   // vertical inset padding (~3% of panel height)
    const padW = panelW * 0.04   // horizontal inset padding (~4% of panel width)
    const usableTop  = panelTop  + panelH * 0.2370 + padH
    const usableBot  = panelTop  + panelH * 0.7285 - padH
    const labelX     = panelLeft + panelW * 0.1709 + padW
    const toggleX    = panelLeft + panelW * 0.7130 - padW

    // 4 rows + back button share the usable height (80 / 20 split)
    const rowsBot    = usableTop + (usableBot - usableTop) * 0.78
    const rowSpacing = (rowsBot - usableTop) / this.rows.length

    // Font scales with panel
    const labelFs = Math.max(11, Math.round(panelH * 0.028))
    const btnFs   = Math.max(10, Math.round(panelH * 0.024))

    this.rows.forEach((row, i) => {
      const rowY = usableTop + rowSpacing * i + rowSpacing / 2
      row.labelTxt
        .setPosition(labelX, rowY)
        .setFontSize(`${labelFs}px`)
      row.btn
        .setPosition(toggleX, rowY)
        .setFontSize(`${btnFs}px`)
    })

    // Back button centred in the bottom 22% of the usable area
    const backY = rowsBot + (usableBot - rowsBot) / 2
    this.backBtn.setPosition(cx, backY).setOrigin(0.5, 0.5)
  }

  /* ================================================================
   * Toggle logic
   * ============================================================= */

  private toggle(row: SettingRow): void {
    const newVal = !Settings[row.key]
    applySettings({ [row.key]: newVal })

    // Immediately apply volume change to live GameScene
    if (row.key === 'volumeEnabled') {
      const gs = this.scene.get('GameScene') as unknown as {
        setVolumeEnabled?: (on: boolean) => void
      }
      gs.setVolumeEnabled?.(newVal)
    }

    this.syncBtn(row)
  }

  private syncBtn(row: SettingRow): void {
    const on = Settings[row.key] as boolean
    row.btn
      .setText(on ? '● ON' : '○ OFF')
      .setColor(on ? GREEN : DIM)
      .setBackgroundColor(on ? '#1a3300' : '#1a1a1a')
      .setShadow(0, 0, on ? '#2aff7b' : 'transparent', on ? 8 : 0, true, true)
  }

  /* ================================================================
   * Close
   * ============================================================= */

  private close(): void {
    if (this.scene.isPaused('GameScene')) this.scene.resume('GameScene')
    this.scene.stop()
  }
}
