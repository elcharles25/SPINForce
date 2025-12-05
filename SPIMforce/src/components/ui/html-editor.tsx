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

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

const handlePaste = (e: React.ClipboardEvent) => {
  e.preventDefault();
  
  let html = e.clipboardData.getData('text/html');
  
  if (html) {
    // Limpiar estilos de line-height de Outlook
    html = html.replace(/line-height:\s*[^;"}]+;?/gi, '');
    html = html.replace(/mso-line-height-rule:\s*[^;"}]+;?/gi, '');
    
    // Forzar margin y padding a 0
    html = html.replace(/margin:\s*[^;"}]+;?/gi, 'margin: 0;');
    html = html.replace(/padding:\s*[^;"}]+;?/gi, 'padding: 0;');
    
    // Eliminar clases de Outlook (MsoNormal, etc) que tienen sus propios estilos
    html = html.replace(/class=['"]\s*Mso[^'"]*['"]/gi, '');
    html = html.replace(/class=\w+/gi, '');
    
    document.execCommand('insertHTML', false, html);
  } else {
    const text = e.clipboardData.getData('text/plain');
    const lines = text.split('\n').filter(line => line.trim() !== '');
    const htmlText = lines.map(line => 
      `<p style="margin: 0; padding: 0; font-family: Aptos, sans-serif; font-size: 11pt;">${line}</p>`
    ).join('');
    document.execCommand('insertHTML', false, htmlText);
  }
  
  if (editorRef.current) {
    onChange(editorRef.current.innerHTML);
  }
};
  const handleFontChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const fontFamily = e.target.value;
    editorRef.current?.focus();
    document.execCommand('fontName', false, fontFamily);
    
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const fontSize = e.target.value;
    editorRef.current?.focus();
    document.execCommand('fontSize', false, '7');
    
    const fontElements = editorRef.current?.querySelectorAll('font[size="7"]');
    fontElements?.forEach((element) => {
      const span = document.createElement('span');
      span.style.fontSize = fontSize;
      span.innerHTML = element.innerHTML;
      element.parentNode?.replaceChild(span, element);
    });
    
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    editorRef.current?.focus();
    document.execCommand('foreColor', false, color);
    
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
          className="px-2 py-1 rounded text-sm border bg-background hover:bg-accent"
          defaultValue=""
        >
          <option value="" disabled>Fuente</option>
          <option value="Aptos">Aptos (Body)</option>
          <option value="Arial, sans-serif">Arial</option>
          <option value="Calibri, sans-serif">Calibri</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="'Times New Roman', serif">Times New Roman</option>
          <option value="Verdana, sans-serif">Verdana</option>
          <option value="'Courier New', monospace">Courier New</option>
          <option value="'Comic Sans MS', cursive">Comic Sans MS</option>
          <option value="Tahoma, sans-serif">Tahoma</option>
        </select>

        <select 
          onChange={handleFontSizeChange}
          className="px-2 py-1 rounded text-sm border bg-background hover:bg-accent"
          defaultValue=""
        >
          <option value="" disabled>Tamaño</option>
          <option value="2pt">2</option>
          <option value="4pt">4</option>
          <option value="6pt">6</option>
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
        className="p-3 focus:outline-none"
        style={{ minHeight }}
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
          margin-left: 20px;
          padding-left: 20px;
        }
        [contentEditable=true] ul {
          list-style-type: disc;
        }
        [contentEditable=true] ol {
          list-style-type: decimal;
        }
        [contentEditable=true] * {
          line-height: 1.2 !important;
        }    
        [contentEditable=true] a {
        color: #0000EE !important;
        text-decoration: underline !important;
  }
      `}</style>
    </div>
  );
}