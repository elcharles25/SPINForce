import { useState, useEffect } from "react";
import { db } from "@/lib/db-adapter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, X, Paperclip, Trash2 } from "lucide-react";
import { HtmlEditor } from "@/components/ui/html-editor";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface TemplateEditorProps {
  templateId: string | null;
  onSave: () => void;
}

const GARTNER_ROLES = ["CIO", "CISO", "CDAO", "CTO", "I&O", "CInO", "D. Transformación"];

export const TemplateEditor = ({ templateId, onSave }: TemplateEditorProps) => {
  const [formData, setFormData] = useState({
    name: "",
    gartner_role: "",
    email_1_subject: "",
    email_1_html: "",
    email_1_attachments: [] as any[],
    email_2_subject: "",
    email_2_html: "",
    email_2_attachments: [] as any[],
    email_3_subject: "",
    email_3_html: "",
    email_3_attachments: [] as any[],
    email_4_subject: "",
    email_4_html: "",
    email_4_attachments: [] as any[],
    email_5_subject: "",
    email_5_html: "",
    email_5_attachments: [] as any[],
  });

const [uploading, setUploading] = useState(false);
const { toast } = useToast();

  useEffect(() => {
    if (templateId) {
      fetchTemplate();
    }
  }, [templateId]);

  const fetchTemplate = async () => {
  if (!templateId) return;
  
  const data = await await db.getTemplate(templateId);
  if (data) {
    setFormData({
      name: data.name,
      gartner_role: data.gartner_role,
      email_1_subject: data.email_1_subject,
      email_1_html: data.email_1_html,
      email_1_attachments: (data.email_1_attachments as any) || [],
      email_2_subject: data.email_2_subject,
      email_2_html: data.email_2_html,
      email_2_attachments: (data.email_2_attachments as any) || [],
      email_3_subject: data.email_3_subject,
      email_3_html: data.email_3_html,
      email_3_attachments: (data.email_3_attachments as any) || [],
      email_4_subject: data.email_4_subject,
      email_4_html: data.email_4_html,
      email_4_attachments: (data.email_4_attachments as any) || [],
      email_5_subject: data.email_5_subject,
      email_5_html: data.email_5_html,
      email_5_attachments: (data.email_5_attachments as any) || [],
    });
  }
};


const handleFileUpload = async (emailNumber: number, e: React.ChangeEvent<HTMLInputElement>) => {
  const files = e.target.files;
  if (!files) return;

  setUploading(true);
  const uploadedFiles = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    try {
      console.log(`📤 Subiendo ${file.name}...`);
      
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('http://localhost:3001/api/upload-attachment', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Error subiendo archivo');
      }

      const result = await response.json();
      
      console.log(`✅ Archivo subido: ${result.name}`);
      console.log(`   URL: ${result.url}`);
      
      uploadedFiles.push({ 
        name: result.name,
        url: `http://localhost:3001${result.url}`,
        filename: result.filename,
        size: result.size
      });
    } catch (error) {
      console.error(`❌ Error subiendo ${file.name}:`, error);
      toast({ 
        title: "Error", 
        description: `No se pudo subir ${file.name}`, 
        variant: "destructive" 
      });
    }
  }

  const attachmentKey = `email_${emailNumber}_attachments` as keyof typeof formData;
  setFormData({ 
    ...formData, 
    [attachmentKey]: [...(formData[attachmentKey] as any[]), ...uploadedFiles] 
  });
  
  setUploading(false);
  
  if (uploadedFiles.length > 0) {
    toast({ 
      title: "Éxito", 
      description: `${uploadedFiles.length} archivo(s) subido(s)` 
    });
  }
};

const removeAttachment = async (emailNumber: number, index: number) => {
  const attachmentKey = `email_${emailNumber}_attachments` as keyof typeof formData;
  const attachments = formData[attachmentKey] as any[];
  const attachment = attachments[index];
  
  // Intentar eliminar el archivo del servidor (opcional)
  if (attachment.filename) {
    try {
      await fetch(`http://localhost:3001/api/attachment/${attachment.filename}`, {
        method: 'DELETE'
      });
      console.log('🗑️ Archivo eliminado del servidor:', attachment.filename);
    } catch (error) {
      console.warn('⚠️ No se pudo eliminar el archivo del servidor:', error);
    }
  }
  
  const newAttachments = attachments.filter((_, i) => i !== index);
  setFormData({ ...formData, [attachmentKey]: newAttachments });
  
  toast({
    title: "Adjunto eliminado",
    description: `${attachment.name} ha sido eliminado`
  });
};


const handleDelete = async () => {
  if (!templateId) return;
    try {
      await db.deleteTemplate(templateId);
      toast({ 
        title: "Éxito", 
        description: "Plantilla eliminada correctamente" 
      });
      onSave(); // Esto cerrará el diálogo y actualizará la lista
    } catch (error) {
      console.error("Error eliminando plantilla:", error);
      toast({ 
        title: "Error", 
        description: "No se pudo eliminar la plantilla", 
        variant: "destructive" 
      });
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.gartner_role) {
      toast({ 
        title: "Error", 
        description: "Nombre y rol son requeridos", 
        variant: "destructive" 
      });
      return;
    }

    try {
      // Validar duplicados
      const allTemplates = await db.getTemplates();
      const existingTemplate = allTemplates.find(
        (t: any) => 
          t.name === formData.name && 
          t.gartner_role === formData.gartner_role &&
          t.id !== templateId // Excluir el template actual al editar
      );

      if (existingTemplate) {
        toast({ 
          title: "Plantilla duplicada", 
          description: `Ya existe una plantilla con el nombre '${formData.name}' para el rol '${formData.gartner_role}'. Por favor usa otro nombre o elige otro rol.`,
          variant: "destructive" 
        });
        return;
      }

      const payload = {
        name: formData.name,
        gartner_role: formData.gartner_role,
        email_1_subject: formData.email_1_subject,
        email_1_html: formData.email_1_html,
        email_1_attachments: formData.email_1_attachments,
        email_2_subject: formData.email_2_subject,
        email_2_html: formData.email_2_html,
        email_2_attachments: formData.email_2_attachments,
        email_3_subject: formData.email_3_subject,
        email_3_html: formData.email_3_html,
        email_3_attachments: formData.email_3_attachments,
        email_4_subject: formData.email_4_subject,
        email_4_html: formData.email_4_html,
        email_4_attachments: formData.email_4_attachments,
        email_5_subject: formData.email_5_subject,
        email_5_html: formData.email_5_html,
        email_5_attachments: formData.email_5_attachments,
      };

      if (templateId) {
        await db.updateTemplate(templateId, payload);
        toast({ 
          title: "Éxito", 
          description: "Plantilla actualizada" 
        });
      } else {
        await db.createTemplate(payload);
        toast({ 
          title: "Éxito", 
          description: "Plantilla creada" 
        });
      }
      
      onSave();
    } catch (error) {
      console.error("Error guardando plantilla:", error);
      toast({ 
        title: "Error", 
        description: templateId ? "No se pudo actualizar la plantilla" : "No se pudo crear la plantilla", 
        variant: "destructive" 
      });
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Nombre de la Plantilla</Label>
          <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="role">Rol Gartner</Label>
          <Select value={formData.gartner_role} onValueChange={(value) => setFormData({ ...formData, gartner_role: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un rol" />
            </SelectTrigger>
            <SelectContent>
              {GARTNER_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

   {[1, 2, 3, 4, 5].map((num) => (
  <div key={num} className="border bg-slate-50 p-4 rounded-lg space-y-2">
    <h3 className="font-semibold">Email {num}</h3>
    <div>
      <Label htmlFor={`email_${num}_subject`}>Asunto</Label>
      <Input
        id={`email_${num}_subject`}
        value={formData[`email_${num}_subject` as keyof typeof formData] as string}
        onChange={(e) => setFormData({ ...formData, [`email_${num}_subject`]: e.target.value })}
      />
      <p className="text-sm text-muted-foreground mt-1">
            Variables disponibles: {"{{nombre}}"}, {"{{ano}}"}, {"{{anosiguiente}}"}, {"{{compania}}"}
      </p>
    </div>
    <div>
      <Label htmlFor={`email_${num}_html`}>Cuerpo</Label>
      <HtmlEditor
        value={formData[`email_${num}_html` as keyof typeof formData] as string}
        onChange={(html) => setFormData({ ...formData, [`email_${num}_html`]: html })}
        placeholder={`Escribe el contenido del email ${num}...`}
        minHeight="300px"
      />
      <p className="text-sm text-muted-foreground mt-1">
            Variables disponibles: {"{{nombre}}"}, {"{{nombreAE}}"}, {"{{ano}}"}, {"{{anosiguiente}}"}, {"{{compania}}"}
      </p>
      <p className="text-sm text-muted-foreground mt-1">
      No es necesario añadir firma. Se añade automáticamente la firma definida en el aparatado de configuración.
      </p>
    </div>
    
    <div>
      <Label htmlFor={`email_${num}_attachments`}>Archivos Adjuntos Email {num}</Label>
      <Input
        id={`email_${num}_attachments`}
        type="file"
        multiple
        onChange={(e) => handleFileUpload(num, e)}
        disabled={uploading}
        className="cursor-pointer"
      />
      {(formData[`email_${num}_attachments` as keyof typeof formData] as any[])?.length > 0 && (
        <div className="mt-2 space-y-1">
          {(formData[`email_${num}_attachments` as keyof typeof formData] as any[]).map((file: any, index: number) => (
            <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
              <span className="flex items-center text-sm">
                <Paperclip className="h-3 w-3 mr-2" />
                {file.name}
              </span>
              <Button size="sm" variant="ghost" onClick={() => removeAttachment(num, index)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
))}

<div className="flex justify-between gap-2">
  {/* Botón eliminar a la izquierda - solo visible al editar */}
  {templateId && (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" type="button">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción no se puede deshacer. La plantilla "{formData.name}" será eliminada permanentemente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )}
  
  {/* Botón guardar a la derecha */}
  <Button 
    className="rounded-full shadow-sm hover:shadow-md transition-shadow bg-indigo-500 hover:bg-indigo-600"
    onClick={handleSave}>
    <Save className="mr-2 h-4 w-4" />
    Guardar Plantilla
  </Button>
</div>
    </div>
  );
};