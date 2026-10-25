import { describe, expect, it } from 'vitest';
import { Animator, STEP_MS } from './animator';

describe('Animator', () => {
  const move = (late = false) => ({ type: 'move' as const, id: 1, fromX: 0, fromY: 0, toX: 1, toY: 0, late });

  it('slides an actor between cells with a walk frame, then settles', () => {
    const anim = new Animator();
    anim.consume([move()], 1000, 1);
    const mid = anim.pose(1, 1, 0, 1000 + STEP_MS / 2);
    expect(mid.x).toBeGreaterThan(0);
    expect(mid.x).toBeLessThan(1);
    expect(mid.frame).not.toBe(0);
    expect(anim.pose(1, 1, 0, 1000 + STEP_MS + 1)).toMatchObject({ x: 1, y: 0, frame: 0 });
  });

  it('holds late (monster) moves at the start until their turn comes', () => {
    const anim = new Animator();
    anim.consume([move(true)], 1000, 99);
    expect(anim.pose(1, 1, 0, 1010).x).toBe(0);
  });

  it('snaps positions under reduced motion but still shows damage', () => {
    const anim = new Animator();
    anim.reducedMotion = true;
    anim.consume([move(), { type: 'hit', id: 1, x: 1, y: 0, damage: 3, late: false }], 1000, 99);
    expect(anim.pose(1, 1, 0, 1001).x).toBe(1);
    expect(anim.floats.map((f) => f.text)).toEqual(['-3']);
  });

  it('alternates walk frames on consecutive steps', () => {
    const anim = new Animator();
    anim.consume([move()], 0, 1);
    const first = anim.pose(1, 1, 0, STEP_MS / 2).frame;
    anim.consume([{ ...move(), fromX: 1, toX: 2 }], STEP_MS * 2, 1);
    const second = anim.pose(1, 2, 0, STEP_MS * 2 + STEP_MS / 2).frame;
    expect(first).not.toBe(second);
  });
});
