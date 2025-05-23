import { HTMLParser } from './html/HTMLParser';
import { HTMLAstOptimizer } from './html/HTMLAstOptimizer';
import { DiffPatchEngine } from './html/DiffPatchEngine';
import { HTMLVNode } from './html/HTMLVNode';
import { Node, AST, OptimizationOptions } from './core/types';

/**
 * DomASM Main API
 * 
 * Provides a unified interface to the DOM ASM functionality,
 * including parsing, optimization, diffing, patching, and rendering.
 */
export class DomASM {
  private parser: HTMLParser;
  private optimizer: HTMLAstOptimizer;
  private diffPatcher: DiffPatchEngine;
  
  /**
   * Creates a new DomASM instance
   */
  constructor() {
    this.parser = new HTMLParser();
    this.optimizer = new HTMLAstOptimizer();
    this.diffPatcher = new DiffPatchEngine();
  }
  
  /**
   * Parses an HTML string into an AST
   * 
   * @param input - The HTML string to parse
   * @returns The parsed AST
   */
  public parse(input: string): AST {
    return this.parser.parse(input);
  }
  
  /**
   * Optimizes an AST
   * 
   * @param ast - The AST to optimize
   * @param options - Optimization options
   * @returns The optimized AST
   */
  public optimize(ast: AST, options?: OptimizationOptions): AST {
    return this.optimizer.optimize(ast);
  }
  
  /**
   * Computes differences between two ASTs
   * 
   * @param oldAst - The original AST
   * @param newAst - The new AST
   * @returns The differences
   */
  public diff(oldAst: AST, newAst: AST): any[] {
    return this.diffPatcher.diff(oldAst, newAst);
  }
  
  /**
   * Applies patches to an AST
   * 
   * @param ast - The AST to patch
   * @param patches - The patches to apply
   * @returns The patched AST
   */
  public patch(ast: AST, patches: any[]): Node {
    return this.diffPatcher.patch(ast.root, this.diffPatcher.generatePatches(patches));
  }
  
  /**
   * Renders an AST to a DOM element
   * 
   * @param ast - The AST to render
   * @returns The DOM node
   */
  public render(ast: AST): Node {
    return this.convertToVNode(ast.root).toDOM();
  }
  
  /**
   * Converts an AST node to a VNode
   * 
   * @param node - The AST node to convert
   * @returns The VNode
   */
  private convertToVNode(node: Node): HTMLVNode {
    if (node.type === 'Text') {
      return HTMLVNode.createText(node.value || '');
    }
    
    // Convert attributes
    const props: any = {};
    if (node.attributes) {
      node.attributes.forEach((value, key) => {
        props[key] = value;
      });
    }
    
    // Convert children recursively
    const children = (node.children || []).map(child => this.convertToVNode(child));
    
    return new HTMLVNode(node.name || node.type, props, children);
  }
  
  /**
   * Performs the complete pipeline: parse, optimize, and render
   * 
   * @param input - The HTML string to process
   * @returns The processed DOM node
   */
  public process(input: string): Node {
    const ast = this.parse(input);
    const optimizedAst = this.optimize(ast);
    return this.render(optimizedAst);
  }
  
  /**
   * Updates an existing DOM node with new HTML
   * 
   * @param domNode - The DOM node to update
   * @param newHTML - The new HTML
   * @returns The updated DOM node
   */
  public updateDOM(domNode: Node, newHTML: string): Node {
    // Create VNode from existing DOM
    const oldVNode = HTMLVNode.fromDOM(domNode);
    
    // Parse and optimize new HTML
    const ast = this.parse(newHTML);
    const optimizedAst = this.optimize(ast);
    
    // Convert to VNode
    const newVNode = this.convertToVNode(optimizedAst.root);
    
    // Compute differences
    const diffs = this.diffVNodes(oldVNode, newVNode);
    
    // Generate and apply patches
    const patches = this.generateVNodePatches(diffs);
    return this.applyVNodePatches(domNode, patches);
  }
  
  /**
   * Computes differences between two VNodes
   * 
   * @param oldNode - The original VNode
   * @param newNode - The new VNode
   * @returns The differences
   */
  private diffVNodes(oldNode: HTMLVNode, newNode: HTMLVNode): any[] {
    // Create temporary AST structures
    const oldAst = { root: this.convertToASTNode(oldNode), metadata: {} };
    const newAst = { root: this.convertToASTNode(newNode), metadata: {} };
    
    return this.diffPatcher.diff(oldAst, newAst);
  }
  
  /**
   * Converts a VNode to an AST node
   * 
   * @param vnode - The VNode to convert
   * @returns The AST node
   */
  private convertToASTNode(vnode: HTMLVNode): Node {
    const node: Node = {
      type: vnode.type === '#text' ? 'Text' : 'Element',
      children: []
    };
    
    if (vnode.type !== '#text') {
      node.name = vnode.type;
    }
    
    if (vnode.type === '#text') {
      node.value = vnode.props.textContent || '';
    } else {
      // Convert props to attributes
      const attributes = new Map<string, string>();
      Object.entries(vnode.props).forEach(([key, value]) => {
        if (key !== 'children' && key !== 'textContent') {
          attributes.set(key, String(value));
        }
      });
      node.attributes = attributes;
    }
    
    // Convert children recursively
    node.children = vnode.children.map(child => this.convertToASTNode(child));
    
    return node;
  }
  
  /**
   * Generates patches for VNodes
   * 
   * @param diffs - The differences
   * @returns The patches
   */
  private generateVNodePatches(diffs: any[]): any[] {
    return this.diffPatcher.generatePatches(diffs);
  }
  
  /**
   * Applies patches to a DOM node
   * 
   * @param domNode - The DOM node to patch
   * @param patches - The patches to apply
   * @returns The patched DOM node
   */
  private applyVNodePatches(domNode: Node, patches: any[]): Node {
    // Create a temporary AST node from the DOM node
    const astNode = this.convertToASTNode(HTMLVNode.fromDOM(domNode));
    
    // Apply patches
    const patchedNode = this.diffPatcher.patch(astNode, patches);
    
    // Convert back to VNode and then to DOM
    return this.convertToVNode(patchedNode).toDOM();
  }
}

// Export convenience functions
export function parse(html: string): AST {
  return new DomASM().parse(html);
}

export function render(ast: AST): Node {
  return new DomASM().render(ast);
}

export function process(html: string): Node {
  return new DomASM().process(html);
}

export function optimize(ast: AST, options?: OptimizationOptions): AST {
  return new DomASM().optimize(ast, options);
}

export function diff(oldAst: AST, newAst: AST): any[] {
  return new DomASM().diff(oldAst, newAst);
}

export function patch(ast: AST, patches: any[]): Node {
  return new DomASM().patch(ast, patches);
}

export function updateDOM(domNode: Node, newHTML: string): Node {
  return new DomASM().updateDOM(domNode, newHTML);
}