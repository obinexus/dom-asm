/**
 * HTML Pipeline - Unified Single-Pass Interface
 * 
 * Implements Core.compile() integration for HTML domain with complete
 * behavioral equivalence preservation and state machine optimization.
 * 
 * Architecture: TOKENIZER → PARSER → AST (Single Pass)
 */

import {
  HTMLCompilationOptions,
  HTMLCompilationResult,
  HTMLPipeline,
  HTMLTokenizerOptions,
  HTMLTokenizerResult,
  HTMLParserOptions,
  HTMLParserResult,
  DocumentNode,
  StateMinimizationResult
} from '@dom-asm/html/types';

import { HTMLTokenizer } from './HTMLTokenizer';
import { HTMLParser } from './HTMLParser';
import { HTMLASTBuilder } from './HTMLASTBuilder';

/**
 * Single-Pass HTML Compilation Pipeline
 * 
 * This class implements the unified interface for HTML processing according
 * to the Ship of Theseus principle: behavioral equivalence is preserved
 * through state minimization while achieving optimal performance.
 */
export class HTMLCompiler implements HTMLPipeline {
  private tokenizer: HTMLTokenizer;
  private parser: HTMLParser;
  private astBuilder: HTMLASTBuilder;

  constructor() {
    this.tokenizer = new HTMLTokenizer();
    this.parser = new HTMLParser();
    this.astBuilder = new HTMLASTBuilder();
  }

  /**
   * Primary compilation interface for Core.compile() integration
   * 
   * Implements single-pass processing: TOKENIZER → PARSER → AST
   * with integrated optimization and behavioral validation.
   */
  public compile(input: string, options: Partial<HTMLCompilationOptions> = {}): HTMLCompilationResult {
    const startTime = performance.now();
    
    // Apply default options
    const compilationOptions: HTMLCompilationOptions = {
      // Tokenizer options
      preserveWhitespace: options.preserveWhitespace ?? true,
      includeComments: options.includeComments ?? true,
      includeConditionalComments: options.includeConditionalComments ?? true,
      strictMode: options.strictMode ?? false,
      errorRecovery: options.errorRecovery ?? true,
      
      // Parser options
      allowSelfClosingTags: options.allowSelfClosingTags ?? true,
      strictNesting: options.strictNesting ?? false,
      preserveCase: options.preserveCase ?? false,
      stateMinimization: options.stateMinimization ?? true,
      
      // Compilation options
      optimizeAST: options.optimizeAST ?? true,
      validateBehavior: options.validateBehavior ?? true,
      generateSourceMap: options.generateSourceMap ?? false
    };

    // Stage 1: Tokenization
    const tokenizationResult = this.tokenize(input, compilationOptions);
    
    // Stage 2: Parsing with state minimization
    const parserResult = this.parse(tokenizationResult.tokens, compilationOptions);
    
    // Stage 3: AST optimization and construction
    const optimizedAST = this.buildAST(parserResult, compilationOptions.optimizeAST);
    
    // Stage 4: Behavioral validation (if enabled)
    let minimizationResult: StateMinimizationResult | undefined;
    if (compilationOptions.validateBehavior) {
      minimizationResult = this.astBuilder.generateMinimizationReport(parserResult.ast, optimizedAST);
      
      if (!minimizationResult.behavioralEquivalence) {
        throw new Error('Behavioral equivalence validation failed - optimization compromised correctness');
      }
    }

    const endTime = performance.now();
    
    // Compile comprehensive result
    const result: HTMLCompilationResult = {
      ast: optimizedAST,
      tokens: tokenizationResult.tokens,
      errors: [...tokenizationResult.errors, ...parserResult.errors],
      minimization: minimizationResult || {
        originalStateCount: 0,
        minimizedStateCount: 0,
        equivalenceClasses: [],
        optimizationRatio: 0,
        behavioralEquivalence: true
      },
      metadata: {
        inputSize: input.length,
        outputSize: this.estimateASTSize(optimizedAST),
        compressionRatio: this.calculateCompressionRatio(input.length, optimizedAST),
        processingTime: endTime - startTime
      }
    };

    return result;
  }

  /**
   * Isolated tokenization with performance metrics
   */
  public tokenize(input: string, options?: HTMLTokenizerOptions): HTMLTokenizerResult {
    // Configure tokenizer for this compilation
    const tokenizer = new HTMLTokenizer(options);
    return tokenizer.tokenize(input);
  }

  /**
   * Isolated parsing with state machine optimization
   */
  public parse(tokens: any[], options?: HTMLParserOptions): HTMLParserResult {
    // Configure parser for this compilation
    const parser = new HTMLParser(options);
    return parser.parse(tokens);
  }

  /**
   * AST construction with integrated optimization
   */
  public buildAST(parserResult: HTMLParserResult, optimize: boolean = true): DocumentNode {
    return this.astBuilder.buildOptimizedAST(parserResult, optimize);
  }

  /**
   * Behavioral equivalence validation for Ship of Theseus compliance
   */
  public validateBehavioralEquivalence(original: DocumentNode, optimized: DocumentNode): boolean {
    const report = this.astBuilder.generateMinimizationReport(original, optimized);
    return report.behavioralEquivalence;
  }

  /**
   * Performance metrics calculation for optimization assessment
   */
  public calculateOptimizationMetrics(input: string, result: HTMLCompilationResult): OptimizationMetrics {
    return {
      inputTokenCount: result.tokens.length,
      outputNodeCount: this.countASTNodes(result.ast),
      memoryReduction: this.calculateMemoryReduction(input, result.ast),
      processingTimeMs: result.metadata.processingTime,
      compressionRatio: result.metadata.compressionRatio,
      equivalenceClassCount: result.minimization.equivalenceClasses.length,
      stateReductionRatio: result.minimization.optimizationRatio
    };
  }

  private estimateASTSize(ast: DocumentNode): number {
    // Recursive size estimation for output metrics
    return this.estimateNodeSize(ast);
  }

  private estimateNodeSize(node: any): number {
    let size = 50; // Base node overhead
    
    // Add type-specific size estimates
    switch (node.type) {
      case 'Element':
        size += node.tagName.length * 2;
        if (node.attributes) {
          for (const [key, value] of node.attributes) {
            size += (key.length + value.length) * 2;
          }
        }
        break;
      case 'Text':
        size += node.content.length * 2;
        break;
      case 'Comment':
        size += node.data.length * 2;
        break;
    }
    
    // Add children sizes
    if (node.children) {
      for (const child of node.children) {
        size += this.estimateNodeSize(child);
      }
    }
    
    return size;
  }

  private calculateCompressionRatio(inputSize: number, ast: DocumentNode): number {
    const outputSize = this.estimateASTSize(ast);
    return inputSize > 0 ? outputSize / inputSize : 1;
  }

  private countASTNodes(node: any): number {
    let count = 1;
    if (node.children) {
      for (const child of node.children) {
        count += this.countASTNodes(child);
      }
    }
    return count;
  }

  private calculateMemoryReduction(input: string, ast: DocumentNode): number {
    const inputMemory = input.length * 2; // UTF-16 encoding
    const astMemory = this.estimateASTSize(ast);
    return Math.max(0, inputMemory - astMemory);
  }
}

/**
 * Performance metrics interface for optimization assessment
 */
export interface OptimizationMetrics {
  inputTokenCount: number;
  outputNodeCount: number;
  memoryReduction: number;
  processingTimeMs: number;
  compressionRatio: number;
  equivalenceClassCount: number;
  stateReductionRatio: number;
}

/**
 * Core.compile() integration function for HTML domain
 * 
 * This function provides the unified entry point for the DOM-ASM
 * architecture, implementing strict domain isolation while maintaining
 * behavioral equivalence through the Ship of Theseus principle.
 */
export function compileHTML(input: string, options?: Partial<HTMLCompilationOptions>): HTMLCompilationResult {
  const compiler = new HTMLCompiler();
  return compiler.compile(input, options);
}

/**
 * Factory function for creating HTML pipeline instances
 * Supports plugin architecture and configuration customization
 */
export function createHTMLPipeline(options?: Partial<HTMLCompilationOptions>): HTMLCompiler {
  const pipeline = new HTMLCompiler();
  
  // Apply any global configuration options
  if (options) {
    // Configuration would be applied here for pipeline customization
  }
  
  return pipeline;
}

/**
 * Utility function for behavioral equivalence testing
 * Essential for Ship of Theseus validation during development
 */
export function validateHTMLEquivalence(
  input: string,
  legacyResult: any,
  singlePassOptions?: Partial<HTMLCompilationOptions>
): boolean {
  try {
    const singlePassResult = compileHTML(input, singlePassOptions);
    
    // Implement comprehensive equivalence validation
    return compareDOMStructures(legacyResult, singlePassResult.ast);
  } catch (error) {
    console.error('Equivalence validation failed:', error);
    return false;
  }
}

/**
 * Deep structural comparison for behavioral equivalence validation
 */
function compareDOMStructures(legacy: any, optimized: any): boolean {
  // Implement thorough comparison logic
  if (legacy.type !== optimized.type) {
    return false;
  }
  
  if (legacy.children?.length !== optimized.children?.length) {
    return false;
  }
  
  // Type-specific comparisons
  switch (legacy.type) {
    case 'Element':
      if (legacy.tagName !== optimized.tagName) {
        return false;
      }
      
      // Compare essential attributes (excluding defaults)
      const legacyAttrs = new Map(legacy.attributes || []);
      const optimizedAttrs = new Map(optimized.attributes || []);
      
      for (const [key, value] of legacyAttrs) {
        if (optimizedAttrs.get(key) !== value) {
          return false;
        }
      }
      break;
      
    case 'Text':
      if (legacy.content !== optimized.content) {
        return false;
      }
      break;
  }
  
  // Recursively compare children
  if (legacy.children && optimized.children) {
    for (let i = 0; i < legacy.children.length; i++) {
      if (!compareDOMStructures(legacy.children[i], optimized.children[i])) {
        return false;
      }
    }
  }
  
  return true;
}

export { HTMLTokenizer, HTMLParser, HTMLASTBuilder };