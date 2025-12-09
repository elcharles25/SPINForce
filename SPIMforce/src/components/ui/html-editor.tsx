import { useRef, useEffect, useState } from 'react';

interface HtmlEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
}

export function HtmlEditor({ value, onChange, placeholder, minHeight = "300px" }: HtmlEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  
  const [currentFontSize, setCurrentFontSize] = useState<string>('11pt');
  const [currentFontFamily, setCurrentFontFamily] = useState<string>('Aptos');

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const updateToolbar = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    let container = range.commonAncestorContainer;
    
    if (container.nodeType === 3) {
      container = container.parentNode as Node;
    }

    if (container && container instanceof HTMLElement) {
      const computedStyle = window.getComputedStyle(container);
      let fontSize = computedStyle.fontSize;
      
      if (fontSize.endsWith('px')) {
        const pxValue = parseFloat(fontSize);
        const ptValue = Math.round(pxValue * 0.75);
        fontSize = `${ptValue}pt`;
      }
      
      setCurrentFontSize(fontSize);

      let fontFamily = computedStyle.fontFamily;
      fontFamily = fontFamily.replace(/['"]/g, '').split(',')[0].trim();
      setCurrentFontFamily(fontFamily);
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleSelectionChange = () => {
    updateToolbar();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.execCommand('insertHTML', false, '<br><br>');
      if (editorRef.current) {
        onChange(editorRef.current.innerHTML);
      }
    }
  };

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

const convertParagraphsToBr = (html: string): string => {
  let result = html;
  
  result = result.replace(/<p[^>]*>/gi, (match, offset) => offset === 0 ? '<p>' : '<br>');
  result = result.replace(/<\/p>/gi, (match, offset, string) => {
    const firstPClose = string.indexOf('</p>');
    return offset === firstPClose ? '</p>' : '';
  });
  //result = result.replace(/<\/p>/gi, ''); 
  
  result = result.replace(/<div[^>]*>/gi, '<br>');
  result = result.replace(/<\/div>/gi, '');
  
  result = result.replace(/^<br>/i, '');
  result = result.replace(/(<br>\s*){3,}/gi, '<br><br>');
  
  result = result.replace(/^([^<]*(?:<[^b][^>]*>)*)<br>/i, '$1');
  result = result.replace(/&nbsp;/gi, '');
  
  return result;
};

  const cleanOutlookContent = (html: string): string => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const removeAttributes = (element: Element, keepAttributes: string[] = []) => {
      const attributes = Array.from(element.attributes);
      attributes.forEach(attr => {
        if (!keepAttributes.includes(attr.name)) {
          element.removeAttribute(attr.name);
        }
      });
    };

    const processElement = (element: Element): Element | null => {
      const tagName = element.tagName.toLowerCase();
      
      if (tagName.startsWith('o:') || tagName.startsWith('w:') || 
          tagName.startsWith('m:') || tagName.startsWith('v:')) {
        return null;
      }
      
      if (tagName === 'style' || tagName === 'meta' || tagName === 'link' || 
          tagName === 'xml' || tagName === 'head') {
        return null;
      }
      
      if (tagName === 'p' || tagName === 'div') {
        const br = document.createElement('br');
        const fragment = document.createDocumentFragment();
        Array.from(element.childNodes).forEach(child => {
          fragment.appendChild(child.cloneNode(true));
        });
        const wrapper = document.createElement('span');
        wrapper.appendChild(fragment);
        const content = wrapper.innerHTML;
        wrapper.innerHTML = '<br>' + content;
        return wrapper;
      }
      
      if (tagName === 'span' || tagName === 'font') {
        const hasUsefulContent = element.querySelector('img, table, a, br') || 
                                 (element.textContent && element.textContent.trim().length > 0);
        if (!hasUsefulContent && element.childNodes.length === 0) {
          return null;
        }
      }
      
      const allowedTags = ['br', 'strong', 'b', 'em', 'i', 'u', 'a', 'img', 
                          'table', 'tbody', 'thead', 'tr', 'td', 'th', 'ul', 'ol', 'li',
                          'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
      
      if (!allowedTags.includes(tagName)) {
        const fragment = document.createDocumentFragment();
        Array.from(element.childNodes).forEach(child => {
          fragment.appendChild(child.cloneNode(true));
        });
        const wrapper = document.createElement('span');
        wrapper.appendChild(fragment);
        return wrapper;
      }
      
      if (tagName === 'a') {
        removeAttributes(element, ['href', 'target']);
        element.setAttribute('style', 'color: #0000EE; text-decoration: underline;');
      } else if (tagName === 'img') {
        removeAttributes(element, ['src', 'alt', 'width', 'height']);
      } else if (tagName === 'table' || tagName === 'td' || tagName === 'th') {
        removeAttributes(element, []);
        if (tagName === 'table') {
          element.setAttribute('style', 'border-collapse: collapse; font-family: Aptos, sans-serif; font-size: 11pt;');
        } else {
          element.setAttribute('style', 'border: 1px solid #ddd; padding: 8px; font-family: Aptos, sans-serif; font-size: 11pt;');
        }
      } else {
        removeAttributes(element, []);
      }
      
      Array.from(element.childNodes).forEach(child => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const processed = processElement(child as Element);
          if (!processed) {
            child.remove();
          } else if (processed !== child) {
            element.replaceChild(processed, child);
          }
        }
      });
      
      return element;
    };

    const bodyContent = doc.body;
    Array.from(bodyContent.childNodes).forEach(child => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const processed = processElement(child as Element);
        if (!processed) {
          child.remove();
        } else if (processed !== child) {
          bodyContent.replaceChild(processed, child);
        }
      }
    });
    
    let cleanHtml = bodyContent.innerHTML;
    
    cleanHtml = cleanHtml.replace(/<!--\[if[^\]]*\]>[\s\S]*?<!\[endif\]-->/gi, '');
    cleanHtml = cleanHtml.replace(/<!--[\s\S]*?-->/g, '');
    cleanHtml = cleanHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    cleanHtml = cleanHtml.replace(/<o:p>\s*<\/o:p>/gi, '');
    cleanHtml = cleanHtml.replace(/<o:p>/gi, '');
    cleanHtml = cleanHtml.replace(/<\/o:p>/gi, '');
    
    cleanHtml = convertParagraphsToBr(cleanHtml);
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = cleanHtml;
    
    const applyDefaultStyles = (element: Element) => {
      if (element.nodeType === Node.ELEMENT_NODE) {
        const tagName = element.tagName.toLowerCase();
        
        if (tagName === 'span') {
          const currentStyle = element.getAttribute('style') || '';
          if (!currentStyle.includes('font-family')) {
            element.setAttribute('style', 
              `font-family: Aptos, sans-serif; font-size: 11pt; ${currentStyle}`);
          }
        }
        
        Array.from(element.children).forEach(child => applyDefaultStyles(child));
      }
    };
    
    Array.from(tempDiv.children).forEach(child => applyDefaultStyles(child));
    
    return tempDiv.innerHTML;
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    
    if (html) {
      const cleanedHtml = cleanOutlookContent(html);
      document.execCommand('insertHTML', false, cleanedHtml);
    } else if (text) {
      const lines = text.split('\n');
      const htmlText = lines.map((line, index) => {
        if (line.trim() === '') {
          return '<br>';
        }
        const prefix = index > 0 ? '<br>' : '';
        return `${prefix}<span style="font-family: Aptos, sans-serif; font-size: 11pt;">${line}</span>`;
      }).join('');
      document.execCommand('insertHTML', false, htmlText);
    }
    
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const removeNestedStyles = (element: HTMLElement, styleProperty: string) => {
    const children = element.querySelectorAll('*');
    children.forEach(child => {
      if (child instanceof HTMLElement && child.style[styleProperty as any]) {
        child.style.removeProperty(styleProperty);
      }
    });
  };

  const cleanupNestedSpans = (element: HTMLElement) => {
    const spans = element.querySelectorAll('span');
    spans.forEach(span => {
      if (!span.hasAttribute('style') || span.getAttribute('style') === '') {
        while (span.firstChild) {
          span.parentNode?.insertBefore(span.firstChild, span);
        }
        span.parentNode?.removeChild(span);
      }
    });
  };

  const handleFontChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const fontFamily = e.target.value;
    const selection = window.getSelection();
    
    if (!selection || selection.rangeCount === 0) return;
    
    editorRef.current?.focus();
    
    if (selection.isCollapsed) {
      document.execCommand('fontName', false, fontFamily);
    } else {
      const range = selection.getRangeAt(0);
      const span = document.createElement('span');
      span.style.fontFamily = fontFamily;
      span.appendChild(range.extractContents());
      
      removeNestedStyles(span, 'font-family');
      range.insertNode(span);
      cleanupNestedSpans(span);
      
      selection.removeAllRanges();
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      selection.addRange(newRange);
    }
    
    setCurrentFontFamily(fontFamily);
    
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const fontSize = e.target.value;
    const selection = window.getSelection();
    
    if (!selection || selection.rangeCount === 0) return;
    
    editorRef.current?.focus();
    
    if (selection.isCollapsed) {
      document.execCommand('fontSize', false, '7');
      const fontElements = editorRef.current?.querySelectorAll('font[size="7"]');
      fontElements?.forEach((element) => {
        const span = document.createElement('span');
        span.style.fontSize = fontSize;
        span.innerHTML = element.innerHTML;
        element.parentNode?.replaceChild(span, element);
      });
    } else {
      const range = selection.getRangeAt(0);
      const span = document.createElement('span');
      span.style.fontSize = fontSize;
      
      span.appendChild(range.extractContents());
      removeNestedStyles(span, 'font-size');
      range.insertNode(span);
      cleanupNestedSpans(span);
      
      selection.removeAllRanges();
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      selection.addRange(newRange);
    }
    
    setCurrentFontSize(fontSize);
    
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    const selection = window.getSelection();
    
    if (!selection || selection.rangeCount === 0) return;
    
    editorRef.current?.focus();
    
    if (!selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      const span = document.createElement('span');
      span.style.color = color;
      
      span.appendChild(range.extractContents());
      removeNestedStyles(span, 'color');
      range.insertNode(span);
      cleanupNestedSpans(span);
      
      selection.removeAllRanges();
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      selection.addRange(newRange);
    } else {
      document.execCommand('foreColor', false, color);
    }
    
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleCreateLink = () => {
    const url = prompt('URL del enlace:');
    if (url) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
        editorRef.current?.focus();
        document.execCommand('createLink', false, url);
        
        const links = editorRef.current?.querySelectorAll('a[href="' + url + '"]');
        links?.forEach(link => {
          (link as HTMLAnchorElement).style.color = '#0000EE';
          (link as HTMLAnchorElement).style.textDecoration = 'underline';
        });
        
        if (editorRef.current) {
          onChange(editorRef.current.innerHTML);
        }
      }
    }
  };

  const handleList = (type: 'ul' | 'ol') => {
    if (!editorRef.current) return;
    
    editorRef.current.focus();
    
    const command = type === 'ul' ? 'insertUnorderedList' : 'insertOrderedList';
    document.execCommand(command, false);
    
    setTimeout(() => {
      if (editorRef.current) {
        onChange(editorRef.current.innerHTML);
      }
    }, 50);
  };

  const executeCommand = (command: string) => {
    if (!editorRef.current) return;
    
    editorRef.current.focus();
    document.execCommand(command, false);
    
    setTimeout(() => {
      if (editorRef.current) {
        onChange(editorRef.current.innerHTML);
      }
    }, 50);
  };

  return (
    <div className="border rounded-md overflow-hidden">
      <div className="bg-muted p-2 border-b flex gap-1 flex-wrap items-center">
        <select 
          onChange={handleFontChange}
          value={currentFontFamily}
          className="px-2 py-1 rounded text-sm border bg-background hover:bg-accent"
        >
          <option value="Aptos">Aptos (Body)</option>
          <option value="Arial">Arial</option>
          <option value="Calibri">Calibri</option>
          <option value="Georgia">Georgia</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Verdana">Verdana</option>
          <option value="Courier New">Courier New</option>
          <option value="Courier New">Courier New</option>
          <option value="Comic Sans MS">Comic Sans MS</option>
          <option value="Tahoma">Tahoma</option>
        </select>

        <select 
          onChange={handleFontSizeChange}
          value={currentFontSize}
          className="px-2 py-1 rounded text-sm border bg-background hover:bg-accent"
        >
          <option value="8pt">8</option>
          <option value="9pt">9</option>
          <option value="10pt">10</option>
          <option value="11pt">11</option>
          <option value="12pt">12</option>
          <option value="14pt">14</option>
          <option value="16pt">16</option>
          <option value="18pt">18</option>
          <option value="20pt">20</option>
          <option value="22pt">22</option>
          <option value="24pt">24</option>
          <option value="26pt">26</option>
          <option value="28pt">28</option>
          <option value="36pt">36</option>
          <option value="48pt">48</option>
        </select>

        <div className="w-px bg-border mx-1" />
        
        <button type="button" onClick={() => executeCommand('bold')} className="px-2 py-1 hover:bg-background rounded text-sm font-bold">B</button>
        <button type="button" onClick={() => executeCommand('italic')} className="px-2 py-1 hover:bg-background rounded text-sm italic">I</button>
        <button type="button" onClick={() => executeCommand('underline')} className="px-2 py-1 hover:bg-background rounded text-sm underline">U</button>
        
        <div className="w-px bg-border mx-1" />

        <div className="relative">
          <input
            ref={colorInputRef}
            type="color"
            onChange={handleColorChange}
            className="absolute opacity-0 w-0 h-0"
          />
          <button 
            type="button" 
            onClick={() => colorInputRef.current?.click()}
            className="px-2 py-1 hover:bg-background rounded text-sm flex items-center gap-1"
          >
            <span>A</span>
            <div className="w-4 h-1 bg-current"></div>
          </button>
        </div>
        
        <div className="w-px bg-border mx-1" />
        
        <button type="button" onClick={() => handleList('ul')} className="px-2 py-1 hover:bg-background rounded text-sm">• Lista</button>
        <button type="button" onClick={() => handleList('ol')} className="px-2 py-1 hover:bg-background rounded text-sm">1. Lista</button>
        
        <div className="w-px bg-border mx-1" />
        
        <button type="button" onClick={() => executeCommand('justifyLeft')} className="px-2 py-1 hover:bg-background rounded text-sm">←</button>
        <button type="button" onClick={() => executeCommand('justifyCenter')} className="px-2 py-1 hover:bg-background rounded text-sm">↔</button>
        <button type="button" onClick={() => executeCommand('justifyRight')} className="px-2 py-1 hover:bg-background rounded text-sm">→</button>
        
        <div className="w-px bg-border mx-1" />
        
        <button type="button" onClick={handleCreateLink} className="px-2 py-1 hover:bg-background rounded text-sm">🔗 Link</button>
        <button type="button" onClick={() => executeCommand('removeFormat')} className="px-2 py-1 hover:bg-background rounded text-sm">✕ Limpiar</button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        onClick={updateToolbar}
        onKeyUp={updateToolbar}
        className="p-3 focus:outline-none"
        style={{ 
          minHeight,
          fontFamily: 'Aptos, Arial, sans-serif',
          fontSize: '11pt',
          lineHeight: '1.5',
          color: '#000000'
        }}
        data-placeholder={placeholder}
      />
      <style>{`
        [contentEditable=true]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
        [contentEditable=true] ul,
        [contentEditable=true] ol {
          margin: 0 0 0 20px;
          padding: 0 0 0 20px;
        }
        [contentEditable=true] ul {
          list-style-type: disc;
        }
        [contentEditable=true] ol {
          list-style-type: decimal;
        }
        [contentEditable=true] p {
          margin: 0;
          padding: 0;
        }
        [contentEditable=true] a {
          color: #0000EE !important;
          text-decoration: underline !important;
        }
        [contentEditable=true] img {
          max-width: 100%;
          height: auto;
        }
        [contentEditable=true] table {
          border-collapse: collapse;
          margin: 10px 0;
        }
        [contentEditable=true] td,
        [contentEditable=true] th {
          border: 1px solid #ddd;
          padding: 8px;
        }
      `}</style>
    </div>
  );
}