import { ActionInputStep } from './physics';

/**
 * Unifies Left Mouse Click, Spacebar, and Touch into a single edge-aware action input.
 * - Ignores keyboard auto-repeat (e.repeat)
 * - Ignores clicks/touches originating on interactive UI elements (<button>, [data-ui])
 * - Prevents duplicate mouse/touch execution via Pointer Events tracked by pointerId
 * - Handles multi-device simultaneous input: action starts on 0 -> >=1 active sources,
 *   and ends only when all active sources are released (>=1 -> 0)
 * - Cleans up pressed state on pointercancel, window blur, and visibilitychange
 * - Prevents Spacebar page scroll and touch scroll on the game container
 */
export class UnifiedInputController {
  private activeSources = new Set<string>();
  private pendingPressEdge = false;
  private pendingReleaseEdge = false;
  private suppressUntilReleased = false;
  private onPauseCallback: (() => void) | null = null;
  private onStartKeyCallback: (() => void) | null = null;
  private container: HTMLElement | null = null;
  private attached = false;

  attach(
    container: HTMLElement,
    callbacks: {
      onPauseRequest?: () => void;
      onStartKeyRequest?: () => void;
    } = {}
  ): void {
    this.detach();
    this.container = container;
    this.onPauseCallback = callbacks.onPauseRequest ?? null;
    this.onStartKeyCallback = callbacks.onStartKeyRequest ?? null;
    this.attached = true;

    window.addEventListener('keydown', this.handleKeyDown, { passive: false });
    window.addEventListener('keyup', this.handleKeyUp, { passive: false });
    window.addEventListener('blur', this.handleBlur);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    container.addEventListener('pointerdown', this.handlePointerDown, {
      passive: false,
    });
    window.addEventListener('pointerup', this.handlePointerUp, { passive: true });
    window.addEventListener('pointercancel', this.handlePointerCancel, {
      passive: true,
    });
    container.addEventListener('contextmenu', this.handleContextMenu);
    container.addEventListener('touchmove', this.handleTouchMove, {
      passive: false,
    });
  }

  detach(): void {
    if (!this.attached) return;
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    document.removeEventListener(
      'visibilitychange',
      this.handleVisibilityChange
    );

    if (this.container) {
      this.container.removeEventListener('pointerdown', this.handlePointerDown);
      this.container.removeEventListener('contextmenu', this.handleContextMenu);
      this.container.removeEventListener('touchmove', this.handleTouchMove);
    }
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('pointercancel', this.handlePointerCancel);

    this.clearAll();
    this.container = null;
    this.attached = false;
  }

  clearAll(): void {
    const wasHeld = this.activeSources.size > 0;
    this.activeSources.clear();
    this.pendingPressEdge = false;
    if (wasHeld) {
      this.pendingReleaseEdge = true;
    }
  }

  resetEdgesAndState(): void {
    this.activeSources.clear();
    this.pendingPressEdge = false;
    this.pendingReleaseEdge = false;
    this.suppressUntilReleased = false;
  }

  /**
   * Ensures any input still held during an Intro -> Game transition cannot leak as a first-frame jump.
   * Requires all active keys/pointers to be completely released before accepting a fresh gameplay press.
   */
  latchUntilAllReleased(): void {
    this.pendingPressEdge = false;
    this.pendingReleaseEdge = false;
    this.suppressUntilReleased = this.activeSources.size > 0;
  }

  consumeStepInput(): ActionInputStep {
    if (this.suppressUntilReleased) {
      if (this.activeSources.size === 0) {
        this.suppressUntilReleased = false;
      }
      this.pendingPressEdge = false;
      this.pendingReleaseEdge = false;
      return {
        justPressed: false,
        held: false,
        justReleased: false,
      };
    }

    const step: ActionInputStep = {
      justPressed: this.pendingPressEdge,
      held: this.activeSources.size > 0,
      justReleased: this.pendingReleaseEdge,
    };
    this.pendingPressEdge = false;
    this.pendingReleaseEdge = false;
    return step;
  }

  isHeld(): boolean {
    if (this.suppressUntilReleased) return false;
    return this.activeSources.size > 0;
  }

  private pressSource(sourceId: string): void {
    if (this.suppressUntilReleased && this.activeSources.size === 0) {
      this.suppressUntilReleased = false;
    }
    const wasEmpty = this.activeSources.size === 0;
    this.activeSources.add(sourceId);
    if (!this.suppressUntilReleased && wasEmpty && this.activeSources.size > 0) {
      this.pendingPressEdge = true;
    }
  }

  private releaseSource(sourceId: string): void {
    if (!this.activeSources.has(sourceId)) return;
    this.activeSources.delete(sourceId);
    if (this.activeSources.size === 0) {
      if (this.suppressUntilReleased) {
        this.suppressUntilReleased = false;
        this.pendingPressEdge = false;
        this.pendingReleaseEdge = false;
        return;
      }
      this.pendingReleaseEdge = true;
    }
  }

  private isUiInteractiveTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest(
        'button, a, input, select, textarea, [role="dialog"], [data-ui-interactive="true"]'
      )
    );
  }

  private isStoryOrModalSceneActive(): boolean {
    if (typeof document === 'undefined') return false;
    const gm = document.body.dataset.gamemode;
    return gm === 'INTRO' || gm === 'ENDING' || gm === 'RESULT' || gm === 'GAMEOVER';
  }

  private isTextInputTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    // Never intercept typing inside text inputs (e.g. nickname modal)
    if (this.isTextInputTarget(e.target)) {
      return;
    }

    if (e.code === 'Space') {
      // During Intro / Ending / Result / GameOver or when any dialog modal is open, do not accept gameplay jump/wire inputs
      if (
        this.isStoryOrModalSceneActive() ||
        (typeof document !== 'undefined' && Boolean(document.querySelector('[role="dialog"]')))
      ) {
        e.preventDefault();
        return;
      }

      e.preventDefault(); // Prevent page scroll on Spacebar
      if (e.repeat) return; // Ignore keyboard auto-repeat

      // If on title screen (without dialog open), Space/Enter opens start flow cleanly
      if (
        document.body.dataset.gamemode === 'READY' &&
        !document.querySelector('[role="dialog"]')
      ) {
        this.onStartKeyCallback?.();
        return;
      }

      if (this.isUiInteractiveTarget(e.target)) {
        if (e.target instanceof HTMLElement) {
          e.target.blur();
        }
      }

      this.pressSource('key:Space');
      return;
    }

    if (e.code === 'Enter' && !e.repeat) {
      if (
        document.body.dataset.gamemode === 'READY' &&
        !document.querySelector('[role="dialog"]')
      ) {
        e.preventDefault();
        this.onStartKeyCallback?.();
      }
      return;
    }

    if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) {
      const gm = typeof document !== 'undefined' ? document.body.dataset.gamemode : '';
      if (gm === 'RUNNING' || gm === 'TUTORIAL' || gm === 'PAUSED') {
        this.onPauseCallback?.();
      }
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    if (this.isTextInputTarget(e.target)) {
      return;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      this.releaseSource('key:Space');
    }
  };

  private handlePointerDown = (e: PointerEvent): void => {
    if (this.isUiInteractiveTarget(e.target) || this.isStoryOrModalSceneActive()) {
      return; // Never trigger jump when pressing UI buttons, Intro, Ending, or modals
    }
    // Only primary mouse button (0) or touch/pen contact
    if (e.pointerType === 'mouse' && e.button !== 0) {
      return;
    }
    if (e.cancelable) {
      e.preventDefault();
    }
    this.pressSource(`ptr:${e.pointerId}`);
  };

  private handlePointerUp = (e: PointerEvent): void => {
    this.releaseSource(`ptr:${e.pointerId}`);
  };

  private handlePointerCancel = (e: PointerEvent): void => {
    this.releaseSource(`ptr:${e.pointerId}`);
  };

  private handleBlur = (): void => {
    this.clearAll();
  };

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.clearAll();
    }
  };

  private handleContextMenu = (e: Event): void => {
    if (!this.isUiInteractiveTarget(e.target)) {
      e.preventDefault();
    }
  };

  private handleTouchMove = (e: TouchEvent): void => {
    if (!this.isUiInteractiveTarget(e.target) && e.cancelable) {
      e.preventDefault();
    }
  };
}
