import { useState, useEffect } from "react";
import { db } from "@/lib/db-adapter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Settings, Send, Trash2, FileText, X, Loader2, Sparkles, Calendar, Clock, User, Mail, CheckSquare, Square, Paperclip } from "lucide-react";
import { WebinarEmailEditor } from "@/components/webinars/WebinarEmailEditor";
import { useOutlookDraftBatch } from "@/hooks/useOutlookDraft";
import { formatDateES } from "@/utils/dateFormatter";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { replaceTemplateVariables, formatAttachments, getMonthName } from "@/utils/emailTemplates";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface WebinarDistribution {
  id: string;
  month: string;
  file_url: string;
  file_name: string;
  email_subject: string;
  email_html: string;
  sent: boolean;
  sent_at: string | null;
  created_at: string;
}

interface WebinarInfo {
  title: string;
  date: string;
  time: string;
  analyst: string;
  reason: string;
}

interface UploadedPdf {
  name: string;
  url: string;
  filename: string;
  size: number;
}

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  contact_type: string;
  email: string;
  organization: string;
  gartner_role: string;
  title: string;
}

interface AttachedFile {
  name: string;
  url: string;
  size: number;
}

const GARTNER_ROLES = [
  'CIO',
  'CISO',
  'CDAO',
  'Talent',
  'Workplace',
  'Procurement',
  'Enterprise Architect',
  'CAIO',
  'Infrastructure & Operations'
];

const Webinars = () => {
  const [distributions, setDistributions] = useState<WebinarDistribution[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showEmailEditor, setShowEmailEditor] = useState(false);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [creatingDrafts, setCreatingDrafts] = useState(false);
  const [uploadedPdf, setUploadedPdf] = useState<UploadedPdf | null>(null);
  const { toast } = useToast();
  const { mutate: createDraftsBatch, isPending: isCreatingDrafts } = useOutlookDraftBatch();
  const [webinarsByRole, setWebinarsByRole] = useState<Record<string, WebinarInfo[]>>({});
  const [analyzingDistId, setAnalyzingDistId] = useState<string | null>(null);
  const [completedAnalysisDistIds, setCompletedAnalysisDistIds] = useState<Set<string>>(new Set());
  const [showWebinarsDialog, setShowWebinarsDialog] = useState(false);
  const [currentDistributionId, setCurrentDistributionId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Estados para emails masivos
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [massEmailContactSearch, setMassEmailContactSearch] = useState("");
  const [selectedContactTypes, setSelectedContactTypes] = useState<Set<string>>(new Set());
  const CONTACT_TYPES = ['Cliente', 'Oportunidad', 'Prospect'];

  useEffect(() => {
    fetchDistributions();
    fetchContacts();
  }, []);

  useEffect(() => {
    if (selectedRole) {
      let filtered = contacts.filter(c => c.gartner_role === selectedRole);
      
      // Filtrar por tipo de contacto
      if (selectedContactTypes.size > 0) {
        filtered = filtered.filter(c => selectedContactTypes.has(c.contact_type));
      }
      
      // Filtrar por búsqueda
      if (massEmailContactSearch.trim()) {
        const searchTerm = massEmailContactSearch.toLowerCase().trim();
        filtered = filtered.filter(c => {
          const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
          const organization = c.organization.toLowerCase();
          return fullName.includes(searchTerm) || organization.includes(searchTerm);
        });
      }
      
      setFilteredContacts(filtered);
      setSelectedContactIds(new Set());
    } else {
      setFilteredContacts([]);
      setSelectedContactIds(new Set());
    }
  }, [selectedRole, contacts, selectedContactTypes, massEmailContactSearch]);

  const toggleContactType = (type: string) => {
    setSelectedContactTypes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        // Si ya está seleccionado, lo deseleccionamos
        newSet.delete(type);
      } else {
        // Si no está seleccionado, limpiamos todo y seleccionamos solo este
        newSet.clear();
        newSet.add(type);
      }
      return newSet;
    });
  };

  const fetchContacts = async () => {
    try {
      const data = await db.getContacts();
      setContacts(data || []);
    } catch (error) {
      console.error("Error cargando contactos:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los contactos",
        variant: "destructive"
      });
    }
  };

  const fetchDistributions = async () => {
    try {
      const data = await db.getDistributions();
      console.log('📋 Distribuciones cargadas:', data);
      setDistributions(data || []);
    } catch (error) {
      console.error("Error cargando distribuciones:", error);
      toast({ 
        title: "Error", 
        description: "No se pudieron cargar las distribuciones", 
        variant: "destructive" 
      });
    }
  };

  const handleRoleChange = (role: string) => {
    setSelectedRole(role);
    setMassEmailContactSearch(""); // Solo limpiar búsqueda al cambiar de rol
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast({
        title: "Error",
        description: "Solo se permiten archivos PDF",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);

    try {
      console.log(`📤 Subiendo ${file.name}...`);
      
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('http://localhost:3001/api/upload-webinar', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Error subiendo archivo');
      }

      const result = await response.json();
      
      console.log(`✅ Archivo subido: ${result.name}`);
      
      setUploadedPdf({
        name: result.name,
        url: result.url,
        filename: result.filename,
        size: result.size
      });
      
      toast({ 
        title: "Éxito", 
        description: `PDF "${result.name}" subido correctamente` 
      });

      e.target.value = '';
      
    } catch (error) {
      console.error(`❌ Error subiendo archivo:`, error);
      toast({ 
        title: "Error", 
        description: `No se pudo subir el archivo`, 
        variant: "destructive" 
      });
    } finally {
      setUploading(false);
    }
  };

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);

    try {
      console.log(`📎 Subiendo adjunto ${file.name}...`);
      
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('http://localhost:3001/api/upload-webinar', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Error subiendo archivo');
      }

      const result = await response.json();
      
      const newFile: AttachedFile = {
        name: result.name,
        url: result.url,
        size: result.size
      };

      setAttachedFiles(prev => [...prev, newFile]);
      
      toast({ 
        title: "Éxito", 
        description: `Archivo "${result.name}" adjuntado correctamente` 
      });

      e.target.value = '';
      
    } catch (error) {
      console.error(`❌ Error subiendo adjunto:`, error);
      toast({ 
        title: "Error", 
        description: `No se pudo subir el archivo`, 
        variant: "destructive" 
      });
    } finally {
      setUploadingFile(false);
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
    toast({
      title: "Archivo eliminado",
      description: "El adjunto ha sido eliminado"
    });
  };

  const handleRemovePdf = () => {
    setUploadedPdf(null);
    toast({
      title: "PDF eliminado",
      description: "Puedes subir otro archivo"
    });
  };

  const toggleContactSelection = (contactId: string) => {
    setSelectedContactIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contactId)) {
        newSet.delete(contactId);
      } else {
        newSet.add(contactId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedContactIds.size === filteredContacts.length) {
      setSelectedContactIds(new Set());
    } else {
      setSelectedContactIds(new Set(filteredContacts.map(c => c.id)));
    }
  };

  const extractTextFromPdf = async (pdfUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const pdfjsScript = document.createElement('script');
      pdfjsScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      
      pdfjsScript.onload = async () => {
        try {
          const pdfjsLib = (window as any)['pdfjs-dist/build/pdf'] || (window as any).pdfjsLib;
          
          if (!pdfjsLib) {
            throw new Error('PDF.js no cargó correctamente');
          }
          
          pdfjsLib.GlobalWorkerOptions.workerSrc = 
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

          const fullUrl = pdfUrl.startsWith('http') 
            ? pdfUrl 
            : `http://localhost:3001${pdfUrl}`;

          console.log('📄 Extrayendo texto de:', fullUrl);

          const pdf = await pdfjsLib.getDocument(fullUrl).promise;
          let fullText = '';

          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            fullText += pageText + '\n';
          }

          console.log(`✅ Texto extraído: ${fullText.length} caracteres`);
          resolve(fullText);
        } catch (err) {
          reject(new Error(`Error extrayendo PDF: ${err instanceof Error ? err.message : String(err)}`));
        }
      };
      
      pdfjsScript.onerror = () => {
        reject(new Error('No se pudo cargar PDF.js desde CDN'));
      };
      
      document.head.appendChild(pdfjsScript);
    });
  };

  const analyzeWithGemini = async (pdfText: string): Promise<Record<string, WebinarInfo[]>> => {
    const geminiKey = (window as any).__GEMINI_API_KEY__ || '';
    
    if (!geminiKey) {
      throw new Error('GEMINI_API_KEY no configurada');
    }

    const prompt = `Analiza este contenido de webinars e identifica para cada rol los temas/webinars más relevantes que sean en inglés o español.

Roles a considerar: CIO, CISO, CDAO, Talent, Workplace, Procurement, Enterprise Architect, CAIO, Infrastructure & Operations

Para cada rol:
1. Identifica sus principales prioridades y desafíos
2. Selecciona los 2 webinars/temas más relevantes
3. Explica por qué son relevantes

Contenido del PDF (primeros 8000 caracteres):
${pdfText.substring(0, 8000)}

Devuelve SOLO un JSON válido (sin markdown, sin comillas adicionales) con esta estructura exacta:
{
  "CIO": [
    { "title": "Título del webinar 1", "date": "2025-01-15", "time": "14:00", "analyst": "Nombre Analista" },
    { "title": "Título del webinar 2", "date": "2025-01-22", "time": "15:30", "analyst": "Nombre Analista" }
  ],
  "CISO": [
    { "title": "Título del webinar 1", "date": "2025-01-15", "time": "14:00", "analyst": "Nombre Analista" },
    { "title": "Título del webinar 2", "date": "2025-01-22", "time": "15:30", "analyst": "Nombre Analista" }
  ]
}`;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error Gemini API: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
        throw new Error('Respuesta inesperada de Gemini');
      }

      const responseText = data.candidates[0].content.parts[0].text;
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('No se pudo extraer JSON de la respuesta de Gemini');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (err) {
      throw new Error(`Error analizando con Gemini: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const performAnalysis = async (pdfUrl: string): Promise<Record<string, WebinarInfo[]>> => {
    const pdfText = await extractTextFromPdf(pdfUrl);
    
    if (!pdfText || typeof pdfText !== 'string' || pdfText.length < 100) {
      throw new Error('El PDF parece estar vacío o no contiene texto suficiente');
    }

    const analysisData = await analyzeWithGemini(pdfText);
    return analysisData;
  };

  const handleSaveDistribution = async () => {
    if (!uploadedPdf) {
      toast({ 
        title: "Error", 
        description: "Primero debes subir un PDF", 
        variant: "destructive" 
      });
      return;
    }

    if (!month) {
      toast({ 
        title: "Error", 
        description: "Selecciona un mes", 
        variant: "destructive" 
      });
      return;
    }

    setUploading(true);
    setIsAnalyzing(true);

    try {
      console.log('💾 Guardando distribución...');
      console.log('   Mes:', month);
      console.log('   PDF:', uploadedPdf);

      const settings = await db.getSetting('webinar_email_template');
      const emailTemplate = settings?.value || { subject: '', html: '' };
      
      const newDistribution = {
        month,
        file_name: uploadedPdf.name,
        file_url: `http://localhost:3001${uploadedPdf.url}`,
        email_subject: emailTemplate.subject || '',
        email_html: emailTemplate.html || '',
        sent: false,
        sent_at: null,
      };

      console.log('📦 Distribución a crear:', newDistribution);

      const createdDist = await db.createDistribution(newDistribution);
      const distributionId = createdDist.id;

      toast({ 
        title: "Éxito", 
        description: "Distribución guardada. Iniciando análisis con IA..." 
      });

      console.log('🤖 Iniciando análisis automático...');
      const analysisData = await performAnalysis(`http://localhost:3001${uploadedPdf.url}`);
      
      setWebinarsByRole(analysisData);
      setCurrentDistributionId(distributionId);
      console.log('✅ Análisis completado:', analysisData);
      
      setCompletedAnalysisDistIds(prev => new Set(prev).add(distributionId));
      
      toast({
        title: "Análisis completado",
        description: "Webinars identificados correctamente",
      });

      setUploadedPdf(null);
      await fetchDistributions();
      
      setShowWebinarsDialog(true);
      
    } catch (error) {
      console.error("Error en el proceso:", error);
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Error en el proceso", 
        variant: "destructive" 
      });
    } finally {
      setUploading(false);
      setIsAnalyzing(false);
    }
  };

const handleCreateDraftsFromDialog = async () => {
  if (!currentDistributionId || Object.keys(webinarsByRole).length === 0) {
    toast({ title: "Error", description: "No hay datos de webinars disponibles", variant: "destructive" });
    return;
  }

  setCreatingDrafts(true);

  try {
    // ✅ Una sola llamada para obtener todos los datos necesarios
    const [allContacts, currentDistribution, emailSignature, emailTemplate] = await Promise.all([
      db.getContacts(),
      db.getDistribution(currentDistributionId),
      db.getSetting('email_signature'),
      db.getSetting('webinar_email_template')
    ]);

    const contactsWithWebinars = allContacts.filter((c: any) => 
      Boolean(c.webinars_subscribed) && c.webinar_role?.trim()
    );

    if (contactsWithWebinars.length === 0) {
      toast({ title: "Sin contactos", description: "No hay contactos suscritos a webinars", variant: "destructive" });
      setCreatingDrafts(false);
      return;
    }

    const signature = emailSignature?.value?.signature || '';
    const template = emailTemplate?.value || {};
    
    // ✅ Calcular el mes una sola vez
    const [ano, mes] = currentDistribution.month.split('-');
    const mesNombre = getMonthName(parseInt(mes));

    // ✅ Construir emails de forma más eficiente
    const draftsToCreate = contactsWithWebinars.map((contact: any) => {
      const role = contact.webinar_role || contact.gartner_role;
      const webinars = webinarsByRole[role] || [];
      const [webinar1, webinar2] = webinars;

      // ✅ Un solo objeto con todas las variables
      const variables = {
        Nombre: contact.first_name,
        nombre: contact.first_name,
        Organización: contact.organization,
        mes: mesNombre,
        anio: ano,
        Fecha1: webinar1?.date || '',
        Hora1: webinar1?.time || '',
        Webinar1: webinar1?.title || '',
        Analista1: webinar1?.analyst || '',
        Fecha2: webinar2?.date || '',
        Hora2: webinar2?.time || '',
        Webinar2: webinar2?.title || '',
        Analista2: webinar2?.analyst || ''
      };

      return {
          to: contact.email,
          subject: replaceTemplateVariables(template.subject || `Webinars Gartner ${mesNombre} ${ano}`, variables),
          body: replaceTemplateVariables(template.html || '', variables) + signature,
          attachments: [{
            filename: currentDistribution.file_name,
            content: currentDistribution.file_url.startsWith('http')   // ✅ url → content
              ? currentDistribution.file_url 
              : `http://localhost:3001${currentDistribution.file_url}`
          }]
      };
    });

    createDraftsBatch({ emails: draftsToCreate }, {
      onSuccess: async () => {
        await db.updateDistribution(currentDistributionId, { 
          ...currentDistribution,
          sent: true, 
          sent_at: new Date().toISOString() 
        });
        
        await fetchDistributions();
        
        toast({ title: "Éxito", description: `${draftsToCreate.length} borradores creados en Outlook` });
        
        setShowWebinarsDialog(false);
        setWebinarsByRole({});
        setCurrentDistributionId(null);
        setCreatingDrafts(false);
      },
      onError: () => {
        toast({ title: "Error", description: "No se pudieron crear los borradores", variant: "destructive" });
        setCreatingDrafts(false);
      }
    });

  } catch (error) {
    console.error("Error creando drafts:", error);
    toast({ title: "Error", description: "Error al preparar los borradores", variant: "destructive" });
    setCreatingDrafts(false);
  }
};

const handleSendMassEmails = async () => {
  if (selectedContactIds.size === 0 || !emailSubject.trim() || !emailBody.trim()) {
    toast({ title: "Error", description: "Completa todos los campos requeridos", variant: "destructive" });
    return;
  }

  setSendingEmails(true);

  try {
    // ✅ Una sola llamada
    const emailSignature = await db.getSetting('email_signature');
    const signature = emailSignature?.value?.signature || '';
    const selectedContacts = filteredContacts.filter(c => selectedContactIds.has(c.id));

    const draftsToCreate = selectedContacts.map((contact) => {
      const variables = {
        Nombre: contact.first_name,
        nombre: contact.first_name,
        Apellido: contact.last_name,
        Organization: contact.organization,
        Organización: contact.organization,
        Titulo: contact.title,
        Título: contact.title
      };

      return {
        to: contact.email,
        subject: replaceTemplateVariables(emailSubject, variables),
        body: replaceTemplateVariables(emailBody, variables) + signature,
        attachments: attachedFiles.length > 0 
          ? attachedFiles.map(file => ({
              filename: file.name,
              content: file.url.startsWith('http') ? file.url : `http://localhost:3001${file.url}`
            }))
          : undefined
          };
    });

    createDraftsBatch({ emails: draftsToCreate }, {
      onSuccess: () => {
        toast({ title: "Éxito", description: `${draftsToCreate.length} borradores creados` });
        setSelectedRole('');
        setSelectedContactIds(new Set());
        setEmailSubject('');
        setEmailBody('');
        setAttachedFiles([]);
      },
      onError: () => {
        toast({ title: "Error", description: "No se pudieron crear los borradores", variant: "destructive" });
      }
    });

  } catch (error) {
    console.error("Error:", error);
    toast({ title: "Error", description: "Error al preparar los emails", variant: "destructive" });
  } finally {
    setSendingEmails(false);
  }
};

  const handleDelete = async (id: string, fileUrl: string) => {
    if (!confirm("¿Eliminar esta distribución?")) return;

    try {
      await db.deleteDistribution(id);

      toast({ 
        title: "Éxito", 
        description: "Distribución eliminada" 
      });
      
      fetchDistributions();
      
    } catch (error) {
      console.error("Error eliminando distribución:", error);
      toast({ 
        title: "Error", 
        description: "No se pudo eliminar", 
        variant: "destructive" 
      });
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">Webinars y Emails masivos</h1>
        </div>

        <Tabs defaultValue="distributions" className="w-full">
          <TabsList className="inline-flex gap-2">
            <TabsTrigger value="distributions">Distribuciones de Webinars</TabsTrigger>
            <TabsTrigger value="mass-email">Emails masivos</TabsTrigger>
          </TabsList>

          <TabsContent value="distributions" className="space-y-6 py-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-indigo-500" />
                  Enviar nuevo Webinar
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                            <div className="flex items-center justify-end mb-4">
              <Button 
                variant="outline" 
                className="rounded-full shadow-sm hover:shadow-md transition-shadow hover:bg-indigo-100"
                onClick={() => setShowEmailEditor(true)}>
                <Settings className="h-4 w-4 mr-2" />
                Editar email de Webinars
              </Button>
            </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="month">Mes</Label>
                    <Input 
                      id="month" 
                      type="month" 
                      value={month} 
                      onChange={(e) => setMonth(e.target.value)} 
                    />
                  </div>
                  
                  
                  <div>
                    <Label htmlFor="pdf-upload">Calendario PDF</Label>
                    <Input
                      id="pdf-upload"
                      type="file"
                      accept=".pdf"
                      onChange={handleFileUpload}
                      disabled={uploading || !!uploadedPdf}
                      className="cursor-pointer"
                    />
                  </div>
                </div>

                {uploadedPdf && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="flex items-center text-sm">
                        <FileText className="h-4 w-4 mr-2" />
                        {uploadedPdf.name}
                        <span className="text-xs text-muted-foreground ml-2">
                          ({(uploadedPdf.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </span>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={handleRemovePdf}
                        disabled={uploading}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
                <div className="flex justify-end">
                  <Button 
                    onClick={handleSaveDistribution} 
                    disabled={uploading || !uploadedPdf || !month || isAnalyzing} 
                    className="rounded-full shadow-sm hover:shadow-md transition-shadow bg-indigo-500 hover:bg-indigo-600"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Analizando...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Analizar y enviar Webinars
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Distribuciones de Webinars enviadas</CardTitle>
              </CardHeader>
              <CardContent>
                {distributions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Aquí se mostrarán las distribuciones de webinars que hayas enviado
                </p>   
                ) : (
                  <div className="bg-card rounded-lg shadow overflow-hidden overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted hover:bg-muted/50">
                          <TableHead className="text-center">Mes</TableHead>
                          <TableHead className="text-center">Archivo</TableHead>
                          <TableHead className="text-center">Estado</TableHead>
                          <TableHead className="text-center">Fecha Envío</TableHead>
                          <TableHead className="text-center">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {distributions.map((dist) => (
                          <TableRow key={dist.id} className="text-sm leading-tight text-center align-middle">
                            <TableCell className="p-4">{dist.month}</TableCell>
                            <TableCell className="p-4">
                              <a href={dist.file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                {dist.file_name}
                              </a>
                            </TableCell>
                            <TableCell className="p-4">
                              <span className={`leading-tight rounded text-xs ${dist.sent ? "px-10 py-2.5 bg-green-500/20" : "px-9 py-2.5 bg-yellow-500/20"}`}>
                                {dist.sent ? "Enviado" : "Pendiente"}
                              </span>
                            </TableCell>
                            <TableCell className="p-4">{formatDateES(dist.sent_at)}</TableCell>
                            <TableCell className="p-4">
                              <div className="flex justify-center gap-3">
                                <Button 
                                  size="sm" 
                                  variant="destructive" 
                                  className="h-8 px-2 py-0" 
                                  onClick={() => handleDelete(dist.id, dist.file_url)}
                                  disabled={dist.sent}
                                  title={
                                    dist.sent
                                      ? "No se puede eliminar - webinar enviado"
                                      : "Eliminar distribución"
                                  }
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mass-email" className="space-y-6 py-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-indigo-500" />
                  Enviar email masivo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="gartner-role">Seleccionar Rol de Gartner</Label>
                  <Select value={selectedRole} onValueChange={handleRoleChange}>
                    <SelectTrigger id="gartner-role">
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

                {selectedRole && (
                  <>
                    {/* CHIPS DE FILTRO POR TIPO */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Label className="text-sm">Filtrar por tipo:</Label>
                      {CONTACT_TYPES.map((type) => (
                        <button
                          key={type}
                          className={`filter-chip ${
                            selectedContactTypes.has(type)
                              ? "filter-chip-active"
                              : "filter-chip-inactive"
                          }`}
                          onClick={() => toggleContactType(type)}
                        >
                          {type}
                        </button>
                      ))}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <Label>Seleccionar Contactos ({selectedContactIds.size} de {filteredContacts.length})</Label>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={toggleSelectAll}
                          disabled={filteredContacts.length === 0}
                        >
                          {selectedContactIds.size === filteredContacts.length ? (
                            <>
                              <Square className="h-4 w-4 mr-2" />
                              Deseleccionar Todos
                            </>
                          ) : (
                            <>
                              <CheckSquare className="h-4 w-4 mr-2" />
                              Seleccionar Todos
                            </>
                          )}
                        </Button>
                      </div>

                      {/* BARRA DE BÚSQUEDA */}
                      {filteredContacts.length > 0 && (
                        <div className="mb-3">
                          <Input
                            type="text"
                            placeholder="Buscar por nombre u organización..."
                            value={massEmailContactSearch}
                            onChange={(e) => setMassEmailContactSearch(e.target.value)}
                            className="w-full"
                          />
                        </div>
                      )}

                      {filteredContacts.length === 0 ? (
                        <p className="text-center text-muted-foreground py-4 text-sm">
                          {massEmailContactSearch.trim() 
                            ? `No se encontraron contactos que coincidan con "${massEmailContactSearch}"`
                            : "No hay contactos con el rol y tipo seleccionados"}
                        </p>
                      ) : (
                        <div className="border rounded-lg max-h-64 overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted">
                                <TableHead className="w-12"></TableHead>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Organización</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredContacts.map((contact) => (
                                <TableRow key={contact.id}>
                                  <TableCell className="text-center">
                                    <Checkbox
                                      checked={selectedContactIds.has(contact.id)}
                                      onCheckedChange={() => toggleContactSelection(contact.id)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    {contact.first_name} {contact.last_name}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="text-xs">
                                      {contact.contact_type}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>{contact.email}</TableCell>
                                  <TableCell>{contact.organization}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="email-subject">Asunto del Email</Label>
                      <Input
                        id="email-subject"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        placeholder="Asunto del email..."
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Variables disponibles: {`{{Nombre}}, {{Apellido}}, {{Organización}}, {{Título}}`}
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="email-body">Cuerpo del Email (HTML)</Label>
                      <Textarea
                        id="email-body"
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                        placeholder="Escribe el cuerpo del email en HTML..."
                        rows={12}
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Variables disponibles: {`{{Nombre}}, {{Apellido}}, {{Organización}}, {{Título}}`}
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="attachments">Archivos Adjuntos</Label>
                      <div className="space-y-2">
                        <Input
                          id="attachments"
                          type="file"
                          onChange={handleAttachmentUpload}
                          disabled={uploadingFile}
                          className="cursor-pointer"
                        />
                        
                        {attachedFiles.length > 0 && (
                          <div className="space-y-2 mt-2">
                            {attachedFiles.map((file, index) => (
                              <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                                <span className="flex items-center text-sm">
                                  <Paperclip className="h-4 w-4 mr-2" />
                                  {file.name}
                                  <span className="text-xs text-muted-foreground ml-2">
                                    ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                  </span>
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRemoveAttachment(index)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        onClick={handleSendMassEmails}
                        disabled={
                          selectedContactIds.size === 0 ||
                          !emailSubject.trim() ||
                          !emailBody.trim() ||
                          sendingEmails ||
                          isCreatingDrafts
                        }
                        className="rounded-full shadow-sm hover:shadow-md transition-shadow bg-indigo-500 hover:bg-indigo-600"
                      >
                        {sendingEmails || isCreatingDrafts ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Creando borradores...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Crear Borradores en Outlook ({selectedContactIds.size})
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={showEmailEditor} onOpenChange={setShowEmailEditor}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Configurar Plantilla de Email</DialogTitle>
            </DialogHeader>
            <WebinarEmailEditor />
          </DialogContent>
        </Dialog>

        <Dialog open={showWebinarsDialog} onOpenChange={setShowWebinarsDialog}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Sparkles className="h-6 w-6 text-indigo-500" />
                Webinars Identificados por IA
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              {Object.entries(webinarsByRole).map(([role, webinars]) => (
                <Card key={role} className="border-indigo-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Badge variant="outline" className="text-indigo-700 border-indigo-300">
                        {role}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        ({webinars.length} webinar{webinars.length !== 1 ? 's' : ''})
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {webinars.map((webinar, index) => (
                        <div 
                          key={index} 
                          className="bg-slate-50 p-4 rounded-lg border border-slate-200 hover:border-indigo-300 transition-colors"
                        >
                          <h4 className="font-semibold text-slate-800 mb-2">
                            {webinar.title}
                          </h4>
                          <div className="grid grid-cols-3 gap-3 text-sm">
                            <div className="flex items-center gap-2 text-slate-600">
                              <Calendar className="h-4 w-4 text-indigo-500" />
                              <span>{webinar.date}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-600">
                              <Clock className="h-4 w-4 text-indigo-500" />
                              <span>{webinar.time}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-600">
                              <User className="h-4 w-4 text-indigo-500" />
                              <span>{webinar.analyst}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}

              {Object.keys(webinarsByRole).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No se identificaron webinars
                </div>
              )}
            </div>

            <DialogFooter className="mt-6">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowWebinarsDialog(false);
                  setWebinarsByRole({});
                  setCurrentDistributionId(null);
                }}
                disabled={creatingDrafts || isCreatingDrafts}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleCreateDraftsFromDialog}
                disabled={creatingDrafts || isCreatingDrafts || Object.keys(webinarsByRole).length === 0}
                className="bg-indigo-500 hover:bg-indigo-600"
              >
                {creatingDrafts || isCreatingDrafts ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creando borradores...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Crear Borradores en Outlook
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Webinars;