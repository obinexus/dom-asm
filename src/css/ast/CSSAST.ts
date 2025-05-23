import { CSSNode } from './CSSNode';
import { CSSToken, TokenType } from '../tokenization/CSSToken';
import { CSSTokenType } from '../tokenization/CSSTokenType';

/**
 * CSS AST metadata
 */
export interface CSSASTMetadata {
  optimizationMetrics?: {
    originalNodeCount: number;
    minimizedNodeCount: number;
    optimizationRatio: number;
  };
  [key: string]: any;
}

/**
 * CSS Abstract Syntax Tree
 * Represents a complete CSS document structure
 */
export class CSSAST {
  /**
   * The root node of the AST
   */
  public readonly root: CSSNode;
  
  /**
   * Metadata for the AST
   */
  public metadata: CSSASTMetadata;
  
  /**
   * Creates a new CSS AST
   * 
   * @param root - The root node
   * @param metadata - AST metadata
   */
  constructor(root: CSSNode, metadata: CSSASTMetadata = {}) {
    this.root = root;
    this.metadata = metadata;
  }
  
  /**
   * Builds an AST from a list of tokens
   * 
   * @param tokens - The tokens to parse
   * @returns A new CSS AST
   */
  public static fromTokens(tokens: CSSToken[]): CSSAST {
    const root = new CSSNode('stylesheet');
    let currentRule: CSSNode | null = null;
    let currentDeclaration: CSSNode | null = null;
    
    for (const token of tokens) {
      switch (token.type) {
        case CSSTokenType.Selector:
        case CSSTokenType.AtKeyword:
          if (currentRule === null) {
            currentRule = new CSSNode('rule');
            root.addChild(currentRule);
          }
          currentRule.addChild(new CSSNode('selector', token.value.toString()));
          break;
          
        case CSSTokenType.StartBlock:
          if (currentRule === null) {
            throw new Error('Unexpected block start');
          }
          break;
          
        case CSSTokenType.Property:
          currentDeclaration = new CSSNode('declaration');
          currentDeclaration.addChild(new CSSNode('property', token.value.toString()));
          if (currentRule) {
            currentRule.addChild(currentDeclaration);
          }
          break;
          
        case CSSTokenType.Colon:
          if (!currentDeclaration) {
            throw new Error('Unexpected colon');
          }
          break;
          
        case CSSTokenType.Value:
        case CSSTokenType.Number:
        case CSSTokenType.Color:
        case CSSTokenType.String:
          if (currentDeclaration) {
            currentDeclaration.addChild(new CSSNode('value', token.value.toString()));
          }
          break;
          
        case CSSTokenType.Unit:
          if (currentDeclaration && currentDeclaration.children.length > 0) {
            const lastChild = currentDeclaration.children[currentDeclaration.children.length - 1];
            if (lastChild.type === 'value') {
              // Append unit to the last value
              const valueWithUnit = new CSSNode(
                'value', 
                lastChild.value + token.value.toString()
              );
              // Replace last child
              currentDeclaration.children[currentDeclaration.children.length - 1] = valueWithUnit;
              valueWithUnit.parent = currentDeclaration;
            }
          }
          break;
          
        case CSSTokenType.Semicolon:
          currentDeclaration = null;
          break;
          
        case CSSTokenType.EndBlock:
          currentRule = null;
          currentDeclaration = null;
          break;
      }
    }
    
    return new CSSAST(root);
  }
  
  /**
   * Creates a deep clone of the AST
   * 
   * @returns A cloned AST
   */
  public clone(): CSSAST {
    return new CSSAST(
      this.root.clone(),
      { ...this.metadata }
    );
  }
  
  /**
   * Gets a string representation of the AST
   * 
   * @returns A string representation
   */
  public toString(): string {
    let result = 'CSS AST:\n';
    result += this.root.toString();
    
    if (this.metadata.optimizationMetrics) {
      const metrics = this.metadata.optimizationMetrics;
      result += '\nOptimization Metrics:\n';
      result += `  Original nodes: ${metrics.originalNodeCount}\n`;
      result += `  Minimized nodes: ${metrics.minimizedNodeCount}\n`;
      result += `  Optimization ratio: ${metrics.optimizationRatio}\n`;
    }
    
    return result;
  }
  
  /**
   * Computes the size of the AST
   * 
   * @returns The number of nodes in the AST
   */
  public getSize(): number {
    return this.countNodes(this.root);
  }
  
  /**
   * Recursively counts nodes in the AST
   * 
   * @param node - The starting node
   * @returns The number of nodes
   */
  private countNodes(node: CSSNode): number {
    let count = 1; // Count the node itself
    
    for (const child of node.children) {
      count += this.countNodes(child);
    }
    
    return count;
  }
  
  /**
   * Finds all nodes of a specific type
   * 
   * @param type - The type to search for
   * @returns An array of matching nodes
   */
  public findNodesByType(type: string): CSSNode[] {
    return this.root.findAllByType(type);
  }
  
  /**
   * Finds nodes by value
   * 
   * @param value - The value to search for
   * @returns An array of matching nodes
   */
  public findNodesByValue(value: string): CSSNode[] {
    const result: CSSNode[] = [];
    
    const traverse = (node: CSSNode) => {
      if (node.value === value) {
        result.push(node);
      }
      
      for (const child of node.children) {
        traverse(child);
      }
    };
    
    traverse(this.root);
    return result;
  }
  
  /**
   * Performs a depth-first traversal of the AST
   * 
   * @param callback - Function to call for each node
   */
  public traverse(callback: (node: CSSNode) => void): void {
    const visit = (node: CSSNode) => {
      callback(node);
      
      for (const child of node.children) {
        visit(child);
      }
    };
    
    visit(this.root);
  }
}