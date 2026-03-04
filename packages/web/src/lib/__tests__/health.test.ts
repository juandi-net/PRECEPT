import { describe, test, expect } from 'bun:test'
import { getInitiativeHealth } from '../health'

describe('getInitiativeHealth', () => {
  test('returns green when all tasks progressing normally', () => {
    const tasks = [
      { state: 'ACCEPTED' }, { state: 'IN_PROGRESS' }, { state: 'PLANNED' }
    ]
    expect(getInitiativeHealth(tasks)).toBe('green')
  })

  test('returns yellow when any task in POLISH', () => {
    const tasks = [
      { state: 'ACCEPTED' }, { state: 'POLISH' }
    ]
    expect(getInitiativeHealth(tasks)).toBe('yellow')
  })

  test('returns yellow when any task in REVISION', () => {
    const tasks = [
      { state: 'ACCEPTED' }, { state: 'REVISION' }
    ]
    expect(getInitiativeHealth(tasks)).toBe('yellow')
  })

  test('returns red when any task ESCALATED', () => {
    const tasks = [
      { state: 'ACCEPTED' }, { state: 'ESCALATED' }
    ]
    expect(getInitiativeHealth(tasks)).toBe('red')
  })

  test('returns red when any task FAILED', () => {
    const tasks = [
      { state: 'ACCEPTED' }, { state: 'FAILED' }
    ]
    expect(getInitiativeHealth(tasks)).toBe('red')
  })

  test('returns red when initiative is paused', () => {
    expect(getInitiativeHealth([], 'paused')).toBe('red')
  })

  test('returns red when initiative is abandoned', () => {
    expect(getInitiativeHealth([], 'abandoned')).toBe('red')
  })

  test('returns green when no tasks', () => {
    expect(getInitiativeHealth([])).toBe('green')
  })

  test('red takes precedence over yellow', () => {
    const tasks = [
      { state: 'POLISH' }, { state: 'ESCALATED' }
    ]
    expect(getInitiativeHealth(tasks)).toBe('red')
  })
})
