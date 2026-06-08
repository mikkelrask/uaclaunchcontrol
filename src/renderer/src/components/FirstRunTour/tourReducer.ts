/**
 * State machine for the first-run guided tour.
 *
 * States: IDLE → WELCOME → STEP_1 → … → STEP_5 → COMPLETED
 * Any step can transition to IDLE (dismiss).
 */

import { useReducer, useCallback } from 'react'

export type TourState =
  | 'IDLE' // tour not active
  | 'WELCOME' // step 0 (full-screen intro)
  | 'STEP_1' // settings / paths
  | 'STEP_2' // settings / source ports
  | 'STEP_3' // install navigation
  | 'STEP_4' // protocol creation
  | 'STEP_5' // launch
  | 'COMPLETED' // done

export type TourAction =
  | { type: 'START' }
  | { type: 'NEXT' }
  | { type: 'PREV' }
  | { type: 'GO'; step: number }
  | { type: 'SKIP' }
  | { type: 'FINISH' }
  | { type: 'RESET' }

const STEP_MAP: TourState[] = ['WELCOME', 'STEP_1', 'STEP_2', 'STEP_3', 'STEP_4', 'STEP_5']

function stateToIndex(state: TourState): number {
  return STEP_MAP.indexOf(state)
}

function indexToState(idx: number): TourState {
  if (idx < 0) return 'IDLE'
  if (idx >= STEP_MAP.length) return 'COMPLETED'
  return STEP_MAP[idx]
}

export function tourReducer(state: TourState, action: TourAction): TourState {
  switch (action.type) {
    case 'START':
      return 'WELCOME'

    case 'NEXT': {
      // If the user is on a step that has sub-steps (like settings), we
      // advance linearly. Sub-step granularity is handled inside TourStep.
      const idx = stateToIndex(state)
      return indexToState(idx + 1)
    }

    case 'PREV': {
      const idx = stateToIndex(state)
      return indexToState(idx - 1)
    }

    case 'GO':
      return indexToState(action.step)

    case 'SKIP':
      return 'COMPLETED'

    case 'FINISH':
      return 'COMPLETED'

    case 'RESET':
      return 'WELCOME'

    default:
      return state
  }
}

export interface TourMachineAPI {
  state: TourState
  stepIndex: number
  currentStep: number
  totalSteps: number
  isActive: boolean
  start: () => void
  next: () => void
  prev: () => void
  go: (s: number) => void
  skip: () => void
  finish: () => void
  reset: () => void
}

/**
 * Hook wrapping the tour reducer + derived helpers.
 */
export function useTourMachine(): TourMachineAPI {
  const [state, dispatch] = useReducer(tourReducer, 'IDLE')

  const stepIndex = stateToIndex(state)
  const totalSteps = STEP_MAP.length
  const isActive = state !== 'IDLE' && state !== 'COMPLETED'
  const currentStep = isActive ? stepIndex : -1

  const start = useCallback(() => dispatch({ type: 'START' }), [])
  const next = useCallback(() => dispatch({ type: 'NEXT' }), [])
  const prev = useCallback(() => dispatch({ type: 'PREV' }), [])
  const go = useCallback((s: number) => dispatch({ type: 'GO', step: s }), [])
  const skip = useCallback(() => dispatch({ type: 'SKIP' }), [])
  const finish = useCallback(() => dispatch({ type: 'FINISH' }), [])
  const reset = useCallback(() => dispatch({ type: 'RESET' }), [])

  return {
    state,
    stepIndex,
    currentStep,
    totalSteps,
    isActive,
    start,
    next,
    prev,
    go,
    skip,
    finish,
    reset
  }
}
