import { State, StateMachine } from '../core/types';

/**
 * StateMachineMinimizer
 * Class that implements automaton state minimization algorithms to reduce 
 * the size and complexity of state machines while preserving their behavior.
 */
export class StateMachineMinimizer {
  /**
   * Minimizes a state machine by identifying and merging equivalent states.
   * Uses Hopcroft's algorithm for DFA minimization.
   * 
   * @param stateMachine - The state machine to minimize
   * @returns A new minimized state machine with equivalent behavior
   */
  public minimize(stateMachine: StateMachine): StateMachine {
    // Phase 1: Build initial equivalence classes
    const equivalenceClasses = this.buildEquivalenceClasses(
      Array.from(stateMachine.states.values())
    );
    
    // Phase 2: Merge equivalent states
    const minimizedMachine = this.mergeEquivalentStates(equivalenceClasses);
    
    // Phase 3: Optimize transitions
    return this.optimizeTransitions(minimizedMachine);
  }

  /**
   * Builds equivalence classes of states based on their distinguishability.
   * Starts with two classes: accepting and non-accepting states.
   * Then refines until no more refinements are possible.
   * 
   * @param states - The states to partition into equivalence classes
   * @returns A map where keys are signatures and values are arrays of equivalent states
   */
  private buildEquivalenceClasses(states: State[]): Map<string, State[]> {
    // Initial partition: accepting and non-accepting states
    const accepting = states.filter(state => state.isAccepting);
    const nonAccepting = states.filter(state => !state.isAccepting);
    
    let partition: State[][] = [];
    if (accepting.length > 0) partition.push(accepting);
    if (nonAccepting.length > 0) partition.push(nonAccepting);
    
    let changed = true;
    
    // Iteratively refine the partition until it stabilizes
    while (changed) {
      changed = false;
      const newPartition: State[][] = [];
      
      for (const block of partition) {
        const splits = this.splitBlock(block, partition);
        
        if (splits.length > 1) {
          newPartition.push(...splits);
          changed = true;
        } else {
          newPartition.push(block);
        }
      }
      
      partition = newPartition;
    }
    
    // Convert partition to Map with state signatures as keys
    const classesBySignature = new Map<string, State[]>();
    
    for (const block of partition) {
      if (block.length > 0) {
        const signature = this.getBlockSignature(block, partition);
        classesBySignature.set(signature, block);
      }
    }
    
    return classesBySignature;
  }

  /**
   * Splits a block of states into smaller blocks if they are distinguishable.
   * Two states are distinguishable if they transition to states in different blocks
   * for at least one input symbol.
   * 
   * @param block - The block of states to potentially split
   * @param partition - The current partition of all states
   * @returns An array of blocks (potentially just the original if no split needed)
   */
  private splitBlock(block: State[], partition: State[][]): State[][] {
    if (block.length <= 1) {
      return [block];
    }
    
    const splitMap = new Map<string, State[]>();
    
    for (const state of block) {
      const signature = this.getStateSignature(state, partition);
      
      if (!splitMap.has(signature)) {
        splitMap.set(signature, []);
      }
      
      splitMap.get(signature)!.push(state);
    }
    
    return Array.from(splitMap.values());
  }

  /**
   * Gets a signature for a state based on its transitions relative to the current partition.
   * 
   * @param state - The state to get a signature for
   * @param partition - The current partition of all states
   * @returns A string signature that identifies the state's transition behavior
   */
  private getStateSignature(state: State, partition: State[][]): string {
    const transitions: string[] = [];
    
    // For each input symbol and target state pair
    for (const [symbol, targetStateId] of state.transitions.entries()) {
      // Find which block in the partition contains the target state
      const targetBlock = partition.findIndex(block => 
        block.some(s => s.id === targetStateId)
      );
      
      transitions.push(`${symbol}:${targetBlock}`);
    }
    
    // Add state metadata to the signature if relevant
    const metadataKeys = Array.from(state.metadata.keys()).sort();
    const metadataSignature = metadataKeys.map(key => 
      `${key}:${state.metadata.get(key)}`
    ).join('|');
    
    return [...transitions.sort(), metadataSignature].join('|');
  }

  /**
   * Gets a signature for a block of states.
   * 
   * @param block - The block of states
   * @param partition - The current partition of all states
   * @returns A string signature for the block
   */
  private getBlockSignature(block: State[], partition: State[][]): string {
    if (block.length === 0) return '';
    
    // Use the first state's signature for the block
    // (all states in the block should have the same signature)
    return this.getStateSignature(block[0], partition);
  }

  /**
   * Merges equivalent states to create a minimized state machine.
   * 
   * @param equivalenceClasses - The map of equivalence classes
   * @returns A new state machine with merged states
   */
  private mergeEquivalentStates(equivalenceClasses: Map<string, State[]>): StateMachine {
    const minimizedStates = new Map<string, State>();
    const stateMapping = new Map<string, string>(); // Maps original state IDs to minimized state IDs
    
    // Create a representative state for each equivalence class
    for (const [signature, stateGroup] of equivalenceClasses.entries()) {
      if (stateGroup.length === 0) continue;
      
      const representative = stateGroup[0];
      const minimizedStateId = `min_${representative.id}`;
      
      // Create minimized state with same properties as representative
      const minimizedState: State = {
        id: minimizedStateId,
        transitions: new Map(), // Will be filled in next step
        metadata: new Map(representative.metadata),
        isAccepting: representative.isAccepting
      };
      
      minimizedStates.set(minimizedStateId, minimizedState);
      
      // Map all original states in this class to the minimized state
      for (const state of stateGroup) {
        stateMapping.set(state.id, minimizedStateId);
      }
    }
    
    // Update transitions to point to minimized states
    for (const [minimizedStateId, minimizedState] of minimizedStates) {
      const originalState = equivalenceClasses.get(
        Array.from(equivalenceClasses.keys()).find(signature => 
          equivalenceClasses.get(signature)![0].id === minimizedStateId.substring(4)
        ) || ''
      )?.[0];
      
      if (!originalState) continue;
      
      // Map each transition to the corresponding minimized state
      for (const [symbol, targetStateId] of originalState.transitions) {
        const minimizedTargetId = stateMapping.get(targetStateId);
        if (minimizedTargetId) {
          minimizedState.transitions.set(symbol, minimizedTargetId);
        }
      }
    }
    
    // Find the initial state in the minimized machine
    let initialStateId = '';
    for (const [originalId, minimizedId] of stateMapping.entries()) {
      if (originalId === 'initial') {
        initialStateId = minimizedId;
        break;
      }
    }
    
    // If no explicit initial state, use the first state
    if (!initialStateId && minimizedStates.size > 0) {
      initialStateId = minimizedStates.keys().next().value;
    }
    
    return {
      states: minimizedStates,
      initialState: initialStateId,
      currentState: initialStateId
    };
  }

  /**
   * Optimizes the transitions of the minimized state machine by removing redundant
   * transitions and normalizing transition symbols.
   * 
   * @param minimizedMachine - The state machine to optimize
   * @returns The optimized state machine
   */
  private optimizeTransitions(minimizedMachine: StateMachine): StateMachine {
    const { states } = minimizedMachine;
    
    // Normalize state transitions
    for (const state of states.values()) {
      // Identify and merge redundant transitions
      const transitionsByTarget = new Map<string, string[]>();
      
      for (const [symbol, targetId] of state.transitions.entries()) {
        if (!transitionsByTarget.has(targetId)) {
          transitionsByTarget.set(targetId, []);
        }
        transitionsByTarget.get(targetId)!.push(symbol);
      }
      
      // Clear original transitions
      state.transitions.clear();
      
      // Add optimized transitions
      for (const [targetId, symbols] of transitionsByTarget.entries()) {
        if (symbols.length === 1) {
          // Single symbol transition
          state.transitions.set(symbols[0], targetId);
        } else {
          // Combine multiple symbols using a character class notation when possible
          if (this.canCombineSymbols(symbols)) {
            const combinedSymbol = this.combineSymbols(symbols);
            state.transitions.set(combinedSymbol, targetId);
          } else {
            // Otherwise keep individual transitions
            for (const symbol of symbols) {
              state.transitions.set(symbol, targetId);
            }
          }
        }
      }
    }
    
    return minimizedMachine;
  }

  /**
   * Determines if a set of symbols can be combined into a character class.
   * 
   * @param symbols - The symbols to check
   * @returns Whether the symbols can be combined
   */
  private canCombineSymbols(symbols: string[]): boolean {
    // If all symbols are single characters or already character classes
    return symbols.every(symbol => 
      symbol.length === 1 || 
      (symbol.startsWith('[') && symbol.endsWith(']'))
    );
  }

  /**
   * Combines a set of symbols into a character class.
   * 
   * @param symbols - The symbols to combine
   * @returns A combined character class
   */
  private combineSymbols(symbols: string[]): string {
    // Extract characters from individual symbols and character classes
    const chars = new Set<string>();
    
    for (const symbol of symbols) {
      if (symbol.length === 1) {
        chars.add(symbol);
      } else if (symbol.startsWith('[') && symbol.endsWith(']')) {
        // Extract characters from character class
        const classChars = symbol.slice(1, -1).split('');
        for (const char of classChars) {
          chars.add(char);
        }
      }
    }
    
    return `[${Array.from(chars).sort().join('')}]`;
  }
}