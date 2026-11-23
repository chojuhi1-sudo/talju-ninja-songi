import Phaser from 'phaser';
import { SoundManager } from './audio';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { GameScene } from './GameScene';
import { UnifiedInputController } from './input';
import { HudSnapshot, StageId } from './types';

/**
 * Manages the single Phaser.Game instance, input bindings, audio unlock, and visibility auto-pause
 * so restarts or component re-mounts never create duplicate canvases, timers, BGM loops, or listeners.
 */
export class GameController {
  private game: Phaser.Game | null = null;
  private scene: GameScene | null = null;
  private inputCtrl = new UnifiedInputController();
  private soundMgr = new SoundManager();
  private visibilityHandler: (() => void) | null = null;
  private gestureUnlockHandler: (() => void) | null = null;

  mount(
    canvasParent: HTMLElement,
    interactionRoot: HTMLElement,
    onHudUpdate: (snapshot: HudSnapshot) => void,
    options?: {
      autoStart?: boolean;
      isDevMode?: boolean;
      onStartKeyRequest?: () => void;
    }
  ): void {
    this.destroy();

    // Recreate clean SoundManager if previously destroyed
    this.soundMgr = new SoundManager();

    // Ensure parent has no leftover canvases
    canvasParent.innerHTML = '';

    const gameScene = new GameScene(
      this.inputCtrl,
      this.soundMgr,
      onHudUpdate
    );
    gameScene.setDevSession(Boolean(options?.isDevMode));
    this.scene = gameScene;

    this.inputCtrl.attach(interactionRoot, {
      onPauseRequest: () => {
        this.scene?.togglePause();
      },
      onStartKeyRequest: () => {
        this.soundMgr.unlock();
        if (options?.onStartKeyRequest) {
          options.onStartKeyRequest();
        } else {
          this.openIntro();
        }
      },
    });

    // Synchronous user-gesture audio unlock on any interaction inside the game shell
    this.gestureUnlockHandler = () => {
      this.soundMgr.unlock();
    };
    window.addEventListener('pointerdown', this.gestureUnlockHandler, {
      passive: true,
    });
    window.addEventListener('keydown', this.gestureUnlockHandler, {
      passive: true,
    });

    // Auto-pause game & BGM when browser tab becomes hidden, and resume story BGM on return
    this.visibilityHandler = () => {
      this.scene?.handleTabVisibilityChange(document.hidden);
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: canvasParent,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      backgroundColor: '#060d24',
      banner: false,
      audio: { noAudio: true }, // Dedicated Web Audio SoundManager handles BGM & SFX
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
      },
      scene: [gameScene],
    });

    if (options?.autoStart) {
      this.game.events.once(Phaser.Core.Events.READY, () => {
        setTimeout(() => {
          this.startMainGame();
        }, 50);
      });
    }
  }

  openIntro(): void {
    this.soundMgr.unlock();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.soundMgr.playUiClick();
    this.scene?.enterIntroState();
  }

  introNext(): void {
    this.soundMgr.unlock();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.scene?.advanceIntro();
  }

  introPrev(): void {
    this.soundMgr.unlock();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.scene?.rewindIntro();
  }

  introSkip(): void {
    this.soundMgr.unlock();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.scene?.skipIntroAndStart();
  }

  startMainGame(startStage?: StageId): void {
    this.soundMgr.unlock();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.scene?.startRun({ tutorial: false, startStage });
  }

  startTutorial(): void {
    this.soundMgr.unlock();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.scene?.startRun({ tutorial: true });
  }

  pause(): void {
    this.scene?.pauseGame();
  }

  resume(): void {
    this.soundMgr.unlock();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.scene?.resumeGame();
  }

  returnToTitle(): void {
    this.soundMgr.unlock();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.soundMgr.playUiClick();
    this.scene?.enterReadyState();
  }

  endingNext(): void {
    this.soundMgr.unlock();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.scene?.advanceEndingStory();
  }

  replayEnding(): void {
    this.soundMgr.unlock();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.scene?.replayEnding();
  }

  previewEndingDev(forceBonus = false): void {
    this.soundMgr.unlock();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.scene?.previewEndingFromDev(forceBonus);
  }

  toggleDebugDev(): void {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.scene?.toggleDebug();
  }

  toggleBgmMute(): boolean {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const nextMuted = this.soundMgr.toggleBgmMuted();
    this.scene?.refreshHud();
    return nextMuted;
  }

  toggleSfxMute(): boolean {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const nextMuted = this.soundMgr.toggleSfxMuted();
    this.scene?.refreshHud();
    return nextMuted;
  }

  playClickSound(): void {
    this.soundMgr.unlock();
    this.soundMgr.playUiClick();
  }

  destroy(): void {
    this.inputCtrl.detach();
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.gestureUnlockHandler) {
      window.removeEventListener('pointerdown', this.gestureUnlockHandler);
      window.removeEventListener('keydown', this.gestureUnlockHandler);
      this.gestureUnlockHandler = null;
    }
    this.soundMgr.destroy();
    if (this.game) {
      this.game.destroy(true);
      this.game = null;
    }
    this.scene = null;
  }
}
