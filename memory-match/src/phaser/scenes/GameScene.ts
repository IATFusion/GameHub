import Phaser from 'phaser'

import {
  GameEvents,
  readRegistryBoolean,
  readRegistryNumber,
  RegistryKeys,
} from '../config'

/**
 * GameScene
 *
 * Core gameplay logic goes here.
 * For new games: this is the main file you'll copy/modify.
 */
export class GameScene extends Phaser.Scene {
  public static readonly Key = 'GameScene'

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
  private walls!: Phaser.Physics.Arcade.StaticGroup
  private coin!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
  private countdownEvent?: Phaser.Time.TimerEvent

  public constructor() {
    super(GameScene.Key)
  }

  public create(): void {
    this.setupWorld()
    this.setupPlayer()
    this.setupCoin()
    this.setupInput()
    this.setupCountdownTimer()

    // Resize handling (mobile responsive)
    this.scale.on('resize', this.handleResize, this)

    // Clean up listeners/timers when the scene is restarted or stopped.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize, this)
      this.countdownEvent?.destroy()
      this.countdownEvent = undefined
    })
  }

  public update(): void {
    if (readRegistryBoolean(this, RegistryKeys.IsGameOver, false)) return

    const speed = 240
    let velocityX = 0
    let velocityY = 0

    if (this.cursors.left?.isDown) velocityX -= speed
    if (this.cursors.right?.isDown) velocityX += speed
    if (this.cursors.up?.isDown) velocityY -= speed
    if (this.cursors.down?.isDown) velocityY += speed

    // Normalize diagonal movement
    if (velocityX !== 0 && velocityY !== 0) {
      const inv = 1 / Math.sqrt(2)
      velocityX *= inv
      velocityY *= inv
    }

    this.player.setVelocity(velocityX, velocityY)
  }

  private setupWorld(): void {
    const { width, height } = this.scale

    this.physics.world.setBounds(0, 0, width, height)
    this.cameras.main.setBackgroundColor(0x0b0f14)

    // Example collision objects (static)
    this.walls = this.physics.add.staticGroup()

    const floor = this.walls
      .create(width / 2, height - 40, 'wall')
      .setDisplaySize(width - 80, 20)
      .refreshBody()
    floor.setOrigin(0.5, 0.5)

    // A couple obstacles
    this.walls
      .create(width * 0.3, height * 0.55, 'wall')
      .setDisplaySize(140, 20)
      .refreshBody()

    this.walls
      .create(width * 0.7, height * 0.35, 'wall')
      .setDisplaySize(140, 20)
      .refreshBody()
  }

  private setupPlayer(): void {
    const { width, height } = this.scale

    this.player = this.physics.add
      .sprite(width / 2, height / 2, 'player')
      .setCollideWorldBounds(true)

    // Collide with the static walls/platforms
    this.physics.add.collider(this.player, this.walls)
  }

  private setupCoin(): void {
    this.coin = this.physics.add.sprite(0, 0, 'coin')
    this.spawnCoin()

    // Score increment example via overlap
    this.physics.add.overlap(this.player, this.coin, () => {
      this.coin.disableBody(true, true)

      const current = readRegistryNumber(this, RegistryKeys.Score, 0)
      const next = current + 1
      this.registry.set(RegistryKeys.Score, next)
      this.game.events.emit(GameEvents.ScoreChanged, next)

      // Respawn after a short delay
      this.time.delayedCall(250, () => {
        this.spawnCoin()
      })
    })
  }

  private setupInput(): void {
    // Keyboard input (desktop). On mobile, you can add touch controls here.
    const keyboard = this.input.keyboard
    if (!keyboard) throw new Error('Keyboard input is not available')
    this.cursors = keyboard.createCursorKeys()
  }

  private setupCountdownTimer(): void {
    // Ensure timer is reset if someone directly restarts this scene
    const defaultSeconds = readRegistryNumber(this, RegistryKeys.DefaultRoundSeconds, 60)
    this.registry.set(RegistryKeys.TimeLeftSeconds, defaultSeconds)
    this.game.events.emit(GameEvents.TimeChanged, defaultSeconds)

    this.countdownEvent?.destroy()
    this.countdownEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (readRegistryBoolean(this, RegistryKeys.IsGameOver, false)) return

        const current = readRegistryNumber(this, RegistryKeys.TimeLeftSeconds, defaultSeconds)
        const next = Math.max(0, current - 1)
        this.registry.set(RegistryKeys.TimeLeftSeconds, next)
        this.game.events.emit(GameEvents.TimeChanged, next)

        if (next <= 0) {
          this.endGame()
        }
      },
    })
  }

  private endGame(): void {
    if (readRegistryBoolean(this, RegistryKeys.IsGameOver, false)) return

    this.registry.set(RegistryKeys.IsGameOver, true)
    this.player.setVelocity(0, 0)
    this.game.events.emit(GameEvents.GameOver)

    // Pause the scene: timer/events stop; UI remains active.
    this.scene.pause()
  }

  private spawnCoin(): void {
    const padding = 36
    const { width, height } = this.scale
    const x = Phaser.Math.Between(padding, Math.max(padding, Math.floor(width - padding)))
    const y = Phaser.Math.Between(padding + 40, Math.max(padding, Math.floor(height - padding - 40)))

    this.coin.enableBody(true, x, y, true, true)
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    const width = Math.max(1, Math.floor(gameSize.width))
    const height = Math.max(1, Math.floor(gameSize.height))

    this.physics.world.setBounds(0, 0, width, height)

    // Keep player safely within bounds after a resize.
    this.player.x = Phaser.Math.Clamp(this.player.x, 0, width)
    this.player.y = Phaser.Math.Clamp(this.player.y, 0, height)
  }
}
