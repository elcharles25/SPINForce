import { useState, useEffect } from "react";
import { db } from "@/lib/db-adapter";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Paperclip, Download, Upload } from "lucide-react";
import { TemplateEditor } from "./TemplateEditor";
import { formatDateES } from "@/utils/dateFormatter";

interface Template {
  id: string;
  name: string;
  gartner_role: string;
  email_1_attachments: any;
  email_2_attachments: any;
  email_3_attachments: any;
  email_4_attachments: any;
  email_5_attachments: any;
  created_at: string;
}

export function TemplateList() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importingTemplate, setImportingTemplate] = useState(false);  
  const { toast } = useToast();
  

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const data = await db.getTemplates();
      setTemplates(data || []);
    } catch (error) {
      console.error('Error cargando plantillas:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las plantillas",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta plantilla?")) return;

    try {
      await db.deleteTemplate(id);
      toast({ title: "Éxito", description: "Plantilla eliminada" });
      fetchTemplates();
    } catch (error) {
      console.error('Error eliminando plantilla:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la plantilla",
        variant: "destructive"
      });
    }
  };

  const handleSave = () => {
    setShowEditor(false);
    setEditingTemplate(null);
    fetchTemplates();
  };

const exportTemplateToXML = async (template: Template) => {
  try {
    // Crear estructura XML
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<campaign_template>
  <metadata>
    <name>${escapeXML(template.name)}</name>
    <gartner_role>${escapeXML(template.gartner_role)}</gartner_role>
    <created_at>${template.created_at}</created_at>
  </metadata>
  ${[1, 2, 3, 4, 5].map(i => {
    const subjectKey = `email_${i}_subject` as keyof Template;
    const htmlKey = `email_${i}_html` as keyof Template;
    const attachmentsKey = `email_${i}_attachments` as keyof Template;
    
    return `<email_${i}>
    <subject>${escapeXML(String((template as any)[subjectKey] || ''))}</subject>
    <html><![CDATA[${(template as any)[htmlKey] || ''}]]></html>
    <attachments>${JSON.stringify((template as any)[attachmentsKey] || [])}</attachments>
  </email_${i}>`;
  }).join('\n  ')}
</campaign_template>`;

    // Usar JSZip para crear un archivo ZIP
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    
    // Agregar XML al ZIP
    zip.file(`${template.name.replace(/[^a-z0-9]/gi, '_')}_template.xml`, xmlContent);
    
    // Recopilar todos los adjuntos
    const allAttachments: any[] = [];
    for (let i = 1; i <= 5; i++) {
      const attachments = (template as any)[`email_${i}_attachments`] || [];
      allAttachments.push(...attachments);
    }

    // Descargar y agregar cada adjunto al ZIP (si hay)
    if (allAttachments.length > 0) {
      for (const attachment of allAttachments) {
        try {
          const response = await fetch(attachment.url);
          const blob = await response.blob();
          zip.file(`attachments/${attachment.filename || attachment.name}`, blob);
        } catch (error) {
          console.error(`Error descargando adjunto ${attachment.name}:`, error);
        }
      }
    }
    
    // Generar y descargar el ZIP
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${template.name.replace(/[^a-z0-9]/gi, '_')}_template.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({ 
      title: "Éxito", 
      description: allAttachments.length > 0 
        ? "Plantilla exportada con adjuntos" 
        : "Plantilla exportada correctamente" 
    });
  } catch (error) {
    console.error("Error exportando plantilla:", error);
    toast({
      title: "Error",
      description: "No se pudo exportar la plantilla",
      variant: "destructive"
    });
  }
};

const handleImportClick = () => {
  setShowImportDialog(true);
};

const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (file) {
    setShowImportDialog(false);
    importTemplateFromXML(file);
  }
  event.target.value = "";
};

const importTemplateFromXML = async (file: File) => {
  setImportingTemplate(true);
  
  try {
    let xmlText = "";
    let attachmentsInZip: { [key: string]: Blob } = {};

    // Verificar si es ZIP
    if (file.name.endsWith('.zip')) {
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(file);
      
      // Buscar el archivo XML
      const xmlFile = Object.keys(zip.files).find(name => name.endsWith('.xml'));
      if (!xmlFile) {
        throw new Error("No se encontró archivo XML en el ZIP");
      }
      
      xmlText = await zip.files[xmlFile].async('text');
      
      // Extraer adjuntos del ZIP
      const attachmentFiles = Object.keys(zip.files).filter(name => 
        name.startsWith('attachments/') && !zip.files[name].dir
      );
      
      for (const filename of attachmentFiles) {
        const blob = await zip.files[filename].async('blob');
        attachmentsInZip[filename.replace('attachments/', '')] = blob;
      }
    } else {
      throw new Error("Solo se permiten archivos ZIP");
    }

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");

    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) {
      throw new Error("El archivo XML no es válido");
    }

    let name = xmlDoc.querySelector("metadata > name")?.textContent || "";
    const gartner_role = xmlDoc.querySelector("metadata > gartner_role")?.textContent || "";

    // Verificar duplicados
    const existingTemplates = await db.getTemplates();
    const duplicates = existingTemplates.filter(
      (t: any) =>
        t.gartner_role === gartner_role &&
        t.name.toLowerCase().startsWith(name.toLowerCase())
    );

    if (duplicates.length > 0) {
      const existingNames = duplicates.map((t: any) => t.name);
      let counter = 1;
      let newName = `${name} (${counter})`;

      while (existingNames.includes(newName)) {
        counter++;
        newName = `${name} (${counter})`;
      }

      name = newName;

      toast({
        title: "Nombre modificado",
        description: `Ya existía una plantilla con ese nombre. Se importará como "${name}"`,
        duration: 5000,
      });
    }

    const templateData: any = {
      name,
      gartner_role,
    };

    // Extraer emails y procesar adjuntos
    for (let i = 1; i <= 5; i++) {
      const emailNode = xmlDoc.querySelector(`email_${i}`);
      if (emailNode) {
        templateData[`email_${i}_subject`] = emailNode.querySelector("subject")?.textContent || "";
        templateData[`email_${i}_html`] = emailNode.querySelector("html")?.textContent || "";

        const attachmentsText = emailNode.querySelector("attachments")?.textContent || "[]";
        try {
          const attachmentsData = JSON.parse(attachmentsText);
          
          if (attachmentsData.length > 0) {
            const processedAttachments = [];
            
            for (const attachment of attachmentsData) {
              const filename = attachment.filename || attachment.name;
              
              // Si el adjunto está en el ZIP, subirlo
              if (attachmentsInZip[filename]) {
                const formData = new FormData();
                formData.append('file', attachmentsInZip[filename], filename);
                
                const response = await fetch('http://localhost:3001/api/upload-attachment', {
                  method: 'POST',
                  body: formData
                });
                
                if (response.ok) {
                  const result = await response.json();
                  processedAttachments.push({
                    name: result.name,
                    url: `http://localhost:3001${result.url}`,
                    filename: result.filename,
                    size: result.size
                  });
                }
              } else {
                console.warn(`Adjunto no encontrado en ZIP: ${filename}`);
              }
            }
            
            templateData[`email_${i}_attachments`] = processedAttachments;
          } else {
            templateData[`email_${i}_attachments`] = [];
          }
        } catch {
          templateData[`email_${i}_attachments`] = [];
        }
      }
    }

    await db.createTemplate(templateData);

    toast({ title: "Éxito", description: "Plantilla importada correctamente" });
    fetchTemplates();
  } catch (error) {
    console.error("Error importando plantilla:", error);
    toast({
      title: "Error",
      description: `No se pudo importar la plantilla: ${
        error instanceof Error ? error.message : "Error desconocido"
      }`,
      variant: "destructive",
    });
  } finally {
    setImportingTemplate(false);
  }
};

// Función auxiliar para escapar caracteres especiales en XML
const escapeXML = (str: string) => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

  return (
     <div className="bg-card rounded-lg shadow p-6">
    <div className="flex flex-row items-center justify-between mb-4">
      <h2 className="text-2xl font-semibold">Plantillas de Campaña</h2>
      <div className="flex gap-2">
        <Button 
          className="rounded-full shadow-sm hover:shadow-md transition-shadow bg-indigo-500 hover:bg-indigo-600"
          onClick={() => { setEditingTemplate(null); setShowEditor(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva plantilla
        </Button>
        
        {/* Botón Importar XML */}
        <Button 
          variant="outline" 
          className="rounded-full shadow-sm hover:shadow-md transition-shadow hover:bg-indigo-100"
          onClick={handleImportClick}>
          <Upload className="h-4 w-4 mr-2" />
          Importar plantilla
        </Button>

      </div>
    </div>
    <div className="bg-card rounded-lg shadow overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted/50">
              <TableHead className="text-center">Rol campaña</TableHead>
              <TableHead className="text-center">Nombre</TableHead>
              <TableHead className="text-center">Adjuntos</TableHead>
              <TableHead className="text-center">Fecha Creación</TableHead>
              <TableHead className="text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="text-center">
            {templates.map((template) => (
              <TableRow key={template.id}>
                <TableCell className="p-1">{template.gartner_role}</TableCell>
                <TableCell className="p-1 font-medium">{template.name}</TableCell>
                <TableCell className="p-1">
                    {[1, 2, 3, 4, 5].map(i => {
                      const attachments = (template as any)[`email_${i}_attachments`];
                      return attachments?.length > 0 ? (
                        <div key={i} className="text-xs mb-1">
                          <span className="font-semibold">Email {i}:</span>
                          <span className="flex items-center text-muted-foreground justify-center">
                            <Paperclip className="h-3 w-3 mr-1" />
                            {attachments.length} archivo(s)
                          </span>
                        </div>
                      ) : null;
                    })}
                  </TableCell>
                <TableCell className="p-1">{formatDateES(template.created_at)}</TableCell> 
                <TableCell className="p-1">
                  <div className="flex gap-2 justify-center">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingTemplate(template.id);
                        setShowEditor(true);
                      }}
                      title="Editar plantilla"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => exportTemplateToXML(template)}
                      title="Exportar a XML"
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
        <Dialog open={showEditor} onOpenChange={setShowEditor}>
          <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? "Editar Plantilla" : "Nueva Plantilla"}</DialogTitle>
            </DialogHeader>
            <TemplateEditor templateId={editingTemplate} onSave={handleSave} />
          </DialogContent>
        </Dialog>
        {/* Dialog de importación */}
  <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Importar Plantilla de Campaña</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <p className="text-sm text-muted-foreground">
          Selecciona el archivo ZIP que contiene la plantilla de campaña que deseas importar.
        </p>
        <Input
          type="file"
          accept=".zip"
          onChange={handleFileSelected}
          disabled={importingTemplate}
          className="cursor-pointer"
        />
      </div>
      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => setShowImportDialog(false)}
          disabled={importingTemplate}
        >
          Cancelar
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
    </div>
  );
}
