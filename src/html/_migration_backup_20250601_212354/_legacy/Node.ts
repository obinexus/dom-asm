import { Node } from '../core/types';

/**
 * Core HTML node property types
 */
export interface HTMLVNodeProps {
  [key: string]: any;
  className?: string;
  style?: { [key: string]: string | number };
  value?: string;
  name?: string;
  textContent?: string;
  attributes?: { [key: string]: string };
}

/**
 * State management for virtual nodes
 */
export interface HTMLVNodeState {
  id: number;
  transitions: Map<string, HTMLVNodeState>;
  isMinimized: boolean;
  equivalenceClass: number | null;
}

/**
 * Metadata for node analysis and optimization
 */
export interface HTMLNodeMetadata {
  equivalenceClass: number;
  stateSignature: string;
  isMinimized: boolean;
  metrics: {
    commentCount: number;
    textCount: number;
    nodeCount: number;
  };
}

/**
 * Core HTML node structure
 */
export interface HTMLNode {
  type: string;
  name?: string;
  value?: string;
  attributes?: Map<string, string>;
  children: HTMLNode[];
  metadata: HTMLNodeMetadata;
}

/**
 * Base class for virtual DOM nodes
 */
export abstract class VNodeBase {
  /**
   * Creates a clone of this node
   */
  abstract clone(): VNodeBase;

  /**
   * Checks if another node is equal to this one
   * 
   * @param other - The node to compare with
   */
  abstract equals(other: VNodeBase): boolean;
}

/**
 * A virtual DOM node for HTML elements
 */
export class HTMLVNode extends VNodeBase {
  private static nodeCounter = 0;

  public readonly type: string;
  public readonly props: HTMLVNodeProps;
  public readonly children: HTMLVNode[];
  public readonly key?: string | number;
  public state: HTMLVNodeState;

  /**
   * Creates a new HTML virtual node
   * 
   * @param type - The node type
   * @param props - Node properties
   * @param children - Child nodes
   * @param key - Optional key for efficient diffing
   */
  constructor(
    type: string,
    props: HTMLVNodeProps = {},
    children: HTMLVNode[] = [],
    key?: string | number
  ) {
    super();
    this.type = type;
    this.props = Object.freeze({ ...props });
    this.children = Object.freeze([...children]) as HTMLVNode[];
    this.key = key;
    
    this.state = {
      id: HTMLVNode.nodeCounter++,
      transitions: new Map(),
      isMinimized: false,
      equivalenceClass: null
    };
  }

  /**
   * Creates a text node
   * 
   * @param content - The text content
   */
  public static createText(content: string): HTMLVNode {
    return new HTMLVNode('#text', { textContent: content });
  }

  /**
   * Creates an element node
   * 
   * @param type - The element type
   * @param props - Element properties
   * @param children - Child elements or strings
   */
  public static createElement(
    type: string,
    props: HTMLVNodeProps = {},
    ...children: (HTMLVNode | string | HTMLVNode[])[]
  ): HTMLVNode {
    const processedChildren = children.reduce<HTMLVNode[]>((acc, child) => {
      if (Array.isArray(child)) {
        acc.push(...child.map(c => 
          typeof c === 'string' ? HTMLVNode.createText(c) : c
        ));
      } else {
        acc.push(typeof child === 'string' ? HTMLVNode.createText(child) : child);
      }
      return acc;
    }, []);
    
    return new HTMLVNode(type, props, processedChildren);
  }

  /**
   * Clones this node with optional new props and children
   * 
   * @param props - New props to apply
   * @param children - New children
   */
  public clone(
    props: Partial<HTMLVNodeProps> = {},
    children: HTMLVNode[] = this.children
  ): HTMLVNode {
    return new HTMLVNode(
      this.type,
      { ...this.props, ...props },
      children,
      this.key
    );
  }

  /**
   * Checks if another node equals this one
   * 
   * @param other - The node to compare with
   */
  public equals(other: VNodeBase): boolean {
    if (!(other instanceof HTMLVNode)) return false;
    
    return (
      this.type === other.type &&
      this.key === other.key &&
      this.compareProps(other.props) &&
      this.compareChildren(other.children)
    );
  }

  /**
   * Compares props with another node's props
   * 
   * @param otherProps - The props to compare with
   */
  private compareProps(otherProps: HTMLVNodeProps): boolean {
    const thisKeys = Object.keys(this.props);
    const otherKeys = Object.keys(otherProps);
    
    if (thisKeys.length !== otherKeys.length) return false;
    
    return thisKeys.every(key =>
      this.props[key] === otherProps[key]
    );
  }

  /**
   * Compares children with another node's children
   * 
   * @param otherChildren - The children to compare with
   */
  private compareChildren(otherChildren: HTMLVNode[]): boolean {
    if (this.children.length !== otherChildren.length) return false;
    
    return this.children.every((child, index) =>
      child.equals(otherChildren[index])
    );
  }

  /**
   * Generates a state signature for this node
   */
  public getStateSignature(): string {
    const components = [
      this.type,
      this.key?.toString() || '',
      Object.keys(this.props).sort().join(','),
      this.children.map(child => child.state.id).join(',')
    ];
    
    return components.join('|');
  }

  /**
   * Sets a DOM attribute
   * 
   * @param element - The element to set the attribute on
   * @param key - The attribute key
   * @param value - The attribute value
   */
  private setDOMAttribute(element: HTMLElement, key: string, value: any): void {
    if (value === null || value === undefined) {
      element.removeAttribute(key);
      return;
    }

    if (key === 'style' && typeof value === 'object') {
      Object.assign(element.style, value);
      return;
    }

    if (key.startsWith('on') && typeof value === 'function') {
      const eventName = key.slice(2).toLowerCase();
      element.addEventListener(eventName, value);
      return;
    }

    if (key === 'className') {
      element.className = value;
      return;
    }

    if (typeof value === 'boolean') {
      if (value) {
        element.setAttribute(key, '');
      } else {
        element.removeAttribute(key);
      }
      if (key in element) {
        (element as any)[key] = value;
      }
      return;
    }

    element.setAttribute(key, value.toString());
    if (key in element) {
      (element as any)[key] = value;
    }
  }

  /**
   * Converts this virtual node to a DOM node
   */
  public toDOM(): Node {
    if (this.type === '#text') {
      return document.createTextNode(this.props.textContent || '');
    }

    const element = document.createElement(this.type);
    
    Object.entries(this.props).forEach(([key, value]) => {
      this.setDOMAttribute(element, key, value);
    });

    this.children.forEach(child => {
      element.appendChild(child.toDOM());
    });

    return element;
  }

  /**
   * Minimizes this node's state by computing equivalence
   */
  public minimizeState(): void {
    const signature = this.getStateSignature();
    const staticNodeMap = HTMLVNode.getStaticNodeMap();
    
    if (!staticNodeMap.has(signature)) {
      staticNodeMap.set(
        signature, 
        staticNodeMap.size
      );
    }

    this.state.equivalenceClass = staticNodeMap.get(signature)!;
    this.state.isMinimized = true;
    
    // Recursively minimize children
    this.children.forEach(child => {
      if (!child.state.isMinimized) {
        child.minimizeState();
      }
    });
  }
  
  /**
   * Gets the static node map for signature tracking
   * This map is used to track equivalence classes across all nodes
   */
  private static getStaticNodeMap(): Map<string, number> {
    if (!globalThis.__htmlVNodeSignatureMap) {
      globalThis.__htmlVNodeSignatureMap = new Map<string, number>();
    }
    return globalThis.__htmlVNodeSignatureMap;
  }
  
  /**
   * Creates an HTMLVNode from an HTML string
   * 
   * @param html - The HTML string to parse
   */
  public static fromHTML(html: string): HTMLVNode {
    // This is a simplified implementation that should be replaced with proper parsing
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    
    const el = template.content.firstChild;
    if (!el) {
      return HTMLVNode.createText('');
    }
    
    return HTMLVNode.fromDOM(el as Element);
  }
  
  /**
   * Creates an HTMLVNode from a DOM element
   * 
   * @param element - The DOM element to convert
   */
  public static fromDOM(element: Node): HTMLVNode {
    // Handle text nodes
    if (element.nodeType === Node.TEXT_NODE) {
      return HTMLVNode.createText(element.textContent || '');
    }
    
    // Handle element nodes
    if (element.nodeType === Node.ELEMENT_NODE) {
      const el = element as Element;
      const props: HTMLVNodeProps = {};
      
      // Process attributes
      Array.from(el.attributes).forEach(attr => {
        if (attr.name === 'class') {
          props.className = attr.value;
        } else if (attr.name === 'style') {
          // Parse inline styles
          const styleObj: Record<string, string> = {};
          attr.value.split(';').forEach(rule => {
            const [key, value] = rule.split(':').map(s => s.trim());
            if (key && value) {
              styleObj[key] = value;
            }
          });
          props.style = styleObj;
        } else {
          props[attr.name] = attr.value;
        }
      });
      
      // Process children
      const children = Array.from(el.childNodes).map(child => 
        HTMLVNode.fromDOM(child)
      );
      
      return new HTMLVNode(el.nodeName.toLowerCase(), props, children);
    }
    
    // Fallback for other node types
    return HTMLVNode.createText('');
  }
  
  /**
   * Flattens nested arrays of nodes into a single array
   * 
   * @param children - The children to flatten
   */
  public static flatten(children: (HTMLVNode | string | HTMLVNode[] | null | undefined)[]): HTMLVNode[] {
    return children.reduce<HTMLVNode[]>((acc, child) => {
      if (child === null || child === undefined) {
        return acc;
      }
      
      if (Array.isArray(child)) {
        acc.push(...HTMLVNode.flatten(child));
      } else if (typeof child === 'string') {
        acc.push(HTMLVNode.createText(child));
      } else {
        acc.push(child);
      }
      
      return acc;
    }, []);
  }
  
  /**
   * Performs a depth-first traversal of the virtual DOM tree
   * 
   * @param callback - The callback to run for each node
   */
  public traverse(callback: (node: HTMLVNode) => void): void {
    callback(this);
    this.children.forEach(child => child.traverse(callback));
  }
  
  /**
   * Updates this node's props and returns a new node
   * 
   * @param props - The new props to apply
   */
  public updateProps(props: Partial<HTMLVNodeProps>): HTMLVNode {
    return new HTMLVNode(
      this.type,
      { ...this.props, ...props },
      this.children,
      this.key
    );
  }
  
  /**
   * Updates this node's children and returns a new node
   * 
   * @param newChildren - The new children to use
   */
  public updateChildren(newChildren: HTMLVNode[]): HTMLVNode {
    return new HTMLVNode(
      this.type,
      this.props,
      newChildren,
      this.key
    );
  }
  
  /**
   * Creates an optimized HTML string from this virtual DOM tree
   */
  public toHTML(): string {
    if (this.type === '#text') {
      return this.props.textContent || '';
    }
    
    const attributeString = Object.entries(this.props)
      .filter(([key, value]) => 
        key !== 'children' && 
        key !== 'textContent' && 
        value !== null && 
        value !== undefined
      )
      .map(([key, value]) => {
        if (key === 'className') {
          return `class="${value}"`;
        }
        if (key === 'style' && typeof value === 'object') {
          const styleString = Object.entries(value)
            .map(([k, v]) => `${k}: ${v}`)
            .join('; ');
          return `style="${styleString}"`;
        }
        if (typeof value === 'boolean') {
          return value ? key : '';
        }
        return `${key}="${String(value).replace(/"/g, '&quot;')}"`;
      })
      .filter(Boolean)
      .join(' ');
    
    const openTag = attributeString.length > 0 
      ? `<${this.type} ${attributeString}>` 
      : `<${this.type}>`;
    
    // Handle self-closing tags
    const selfClosingTags = [
      'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
      'link', 'meta', 'param', 'source', 'track', 'wbr'
    ];
    
    if (selfClosingTags.includes(this.type) && this.children.length === 0) {
      return openTag.replace(/>$/, ' />');
    }
    
    const childrenHTML = this.children.map(child => child.toHTML()).join('');
    return `${openTag}${childrenHTML}</${this.type}>`;
  }
  
  /**
   * Checks if this node matches a selector
   * This is a simplified implementation that only supports tag and class selectors
   * 
   * @param selector - The selector to match against
   */
  public matches(selector: string): boolean {
    // Match tag name
    if (selector === this.type) {
      return true;
    }
    
    // Match class name
    if (selector.startsWith('.') && this.props.className) {
      const classes = this.props.className.split(' ');
      return classes.includes(selector.substring(1));
    }
    
    // Match ID
    if (selector.startsWith('#') && this.props.id) {
      return this.props.id === selector.substring(1);
    }
    
    return false;
  }
  
  /**
   * Finds the first node that matches a selector
   * 
   * @param selector - The selector to match against
   */
  public querySelector(selector: string): HTMLVNode | null {
    if (this.matches(selector)) {
      return this;
    }
    
    for (const child of this.children) {
      const match = child.querySelector(selector);
      if (match) {
        return match;
      }
    }
    
    return null;
  }
  
  /**
   * Finds all nodes that match a selector
   * 
   * @param selector - The selector to match against
   */
  public querySelectorAll(selector: string): HTMLVNode[] {
    const results: HTMLVNode[] = [];
    
    if (this.matches(selector)) {
      results.push(this);
    }
    
    for (const child of this.children) {
      results.push(...child.querySelectorAll(selector));
    }
    
    return results;
  }
}