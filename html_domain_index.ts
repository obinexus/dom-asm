/**
 * HTML Domain Entry Point
 * 
 * Provides unified interface for HTML pipeline integration with Core.compile()
 * Implements strict domain isolation while maintaining behavioral equivalence
 * through Ship of Theseus principle validation.
 */

// Core pipeline exports
export {
  HTMLTokenizer,
  HTMLParser,
  HTMLASTBuilder,
  HTMLCompiler,
  compileHTML,
  createHTMLPipeline,
  validateHTMLEquivalence,
  OptimizationMetrics
} from './pipeline';

// Type system exports
export type {
  HTMLToken,
  HTMLTokenType,
  HTMLASTNode,
  HTMLNodeType,
  DocumentNode,
  ElementNode,
  TextNode,
  CommentNode,
  DoctypeNode,
  CDATANode,
  HTMLTokenizerOptions,
  HTMLTokenizerResult,
  HTMLParserOptions,
  HTMLParserResult,
  HTMLCompilationOptions,
  HTMLCompilationResult,
  HTMLPipeline,
  BehavioralSignature,
  EquivalenceClass,
  StateMinimizationResult,
  Position,
  HTMLParsingError
} from './types';

// Utility exports
export { BehavioralEquivalenceValidator } from './utils/validation';
export { HTMLOptimizationProfiler } from './utils/profiler';

/**
 * Primary interface for Core.compile() integration
 * 
 * This function serves as the main entry point for HTML compilation
 * within the DOM-ASM single-pass architecture.
 */
export function compile(input: string, options?: Partial<HTMLCompilationOptions>): HTMLCompilationResult {
  return compileHTML(input, options);
}

/**
 * Legacy compatibility layer for existing implementations
 * 
 * Provides backward compatibility while encouraging migration
 * to the unified single-pass architecture.
 */
export namespace Legacy {
  /**
   * @deprecated Use compileHTML() for single-pass architecture
   */
  export function parseHTML(input: string): DocumentNode {
    const result = compileHTML(input, { optimizeAST: false });
    return result.ast;
  }
  
  /**
   * @deprecated Use HTMLTokenizer directly for tokenization
   */
  export function tokenizeHTML(input: string): HTMLToken[] {
    const tokenizer = new HTMLTokenizer();
    const result = tokenizer.tokenize(input);
    return result.tokens;
  }
}

/**
 * Development utilities for behavioral validation
 */
export namespace DevUtils {
  /**
   * Compare multi-pass vs single-pass results for equivalence validation
   */
  export function validateMigration(
    input: string,
    legacyParser: (input: string) => any,
    options?: Partial<HTMLCompilationOptions>
  ): ValidationResult {
    const legacyResult = legacyParser(input);
    const singlePassResult = compileHTML(input, options);
    
    return {
      isEquivalent: validateHTMLEquivalence(input, legacyResult, options),
      performanceGain: calculatePerformanceGain(legacyResult, singlePassResult),
      memoryReduction: calculateMemoryReduction(legacyResult, singlePassResult),
      optimizationMetrics: {
        equivalenceClassCount: singlePassResult.minimization.equivalenceClasses.length,
        stateReductionRatio: singlePassResult.minimization.optimizationRatio,
        processingTime: singlePassResult.metadata.processingTime
      }
    };
  }
  
  /**
   * Generate comprehensive performance report for optimization assessment
   */
  export function generatePerformanceReport(
    testInputs: string[],
    options?: Partial<HTMLCompilationOptions>
  ): PerformanceReport {
    const results: CompilationMetrics[] = [];
    
    for (const input of testInputs) {
      const startTime = performance.now();
      const result = compileHTML(input, options);
      const endTime = performance.now();
      
      results.push({
        inputSize: input.length,
        outputSize: result.metadata.outputSize,
        processingTime: endTime - startTime,
        nodeCount: countNodes(result.ast),
        optimizationRatio: result.minimization.optimizationRatio,
        errorCount: result.errors.length
      });
    }
    
    return {
      totalInputs: testInputs.length,
      averageProcessingTime: results.reduce((sum, r) => sum + r.processingTime, 0) / results.length,
      averageOptimizationRatio: results.reduce((sum, r) => sum + r.optimizationRatio, 0) / results.length,
      memoryEfficiency: calculateAverageMemoryEfficiency(results),
      results
    };
  }
}

// Internal utility imports
import { HTMLTokenizer, HTMLParser, HTMLASTBuilder, compileHTML } from './pipeline';

// Type definitions for development utilities
interface ValidationResult {
  isEquivalent: boolean;
  performanceGain: number;
  memoryReduction: number;
  optimizationMetrics: {
    equivalenceClassCount: number;
    stateReductionRatio: number;
    processingTime: number;
  };
}

interface CompilationMetrics {
  inputSize: number;
  outputSize: number;
  processingTime: number;
  nodeCount: number;
  optimizationRatio: number;
  errorCount: number;
}

interface PerformanceReport {
  totalInputs: number;
  averageProcessingTime: number;
  averageOptimizationRatio: number;
  memoryEfficiency: number;
  results: CompilationMetrics[];
}

// Utility function implementations
function calculatePerformanceGain(legacy: any, optimized: HTMLCompilationResult): number {
  // Estimate performance improvement based on processing time and node count
  const legacyNodeCount = countNodes(legacy);
  const optimizedNodeCount = countNodes(optimized.ast);
  
  return legacyNodeCount > 0 ? (legacyNodeCount - optimizedNodeCount) / legacyNodeCount : 0;
}

function calculateMemoryReduction(legacy: any, optimized: HTMLCompilationResult): number {
  // Estimate memory reduction based on structure optimization
  const legacySize = estimateObjectSize(legacy);
  const optimizedSize = optimized.metadata.outputSize;
  
  return legacySize > 0 ? (legacySize - optimizedSize) / legacySize : 0;
}

function countNodes(node: any): number {
  let count = 1;
  if (node.children) {
    for (const child of node.children) {
      count += countNodes(child);
    }
  }
  return count;
}

function estimateObjectSize(obj: any): number {
  // Rough object size estimation for comparison purposes
  return JSON.stringify(obj).length * 2; // UTF-16 encoding approximation
}

function calculateAverageMemoryEfficiency(results: CompilationMetrics[]): number {
  const efficiencies = results.map(r => 
    r.inputSize > 0 ? (r.inputSize - r.outputSize) / r.inputSize : 0
  );
  
  return efficiencies.reduce((sum, eff) => sum + eff, 0) / efficiencies.length;
}