import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { db } from '@/lib/db-adapter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, formatDateES } from "@/utils/dateFormatter";
import { Sparkles, TrendingUp, ClipboardList, MessageSquare, Copy, Loader2, RefreshCw, Medal, Upload, X, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from "@/components/ui/date-picker";
import { generateFollowUpEmail } from '@/utils/followUpGenerator';
import "@/app.css";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Pencil, Mail, Phone, Linkedin, Trash2, Plus, CheckCircle2, XCircle } from 'lucide-react';

interface Contact {
  id: string;
  organization: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  gartner_role: string;
  title: string;
  contact_type: string;
  contacted: boolean;
  last_contact_date: string | null;
  interested: boolean;
  webinars_subscribed: boolean;
  notes: string | null;
  webinar_role: string;
  pa_name: string;
  pa_email: string;
  pa_phone: string;
  linkedin_url: string | null;
  tier: string | null;
  csm_name: string | null;
  csm_email: string | null;
  ep_name?: string | null;
  ep_email?: string | null;
  last_email_check?: string | null;
  ai_initiatives?: string | null;
  photo_url?: string | null;
}

interface Meeting {
  id: string;
  opportunity_id: string;
  contact_id: string;
  meeting_type: string;
  meeting_date: string;
  feeling: string;
  notes: string;
  created_at: string;
  opportunity: {
    status: string;
    proposed_solution: string;
  };
}

const FEELING_OPTIONS = [
  { value: 'Excelente', label: 'Excelente', color: 'bg-green-500' },
  { value: 'Bien', label: 'Bien', color: 'bg-blue-500' },
  { value: 'Neutral', label: 'Neutral', color: 'bg-yellow-500' },
  { value: 'Mal', label: 'Mal', color: 'bg-orange-500' },
  { value: 'Muy mal', label: 'Muy mal', color: 'bg-red-500' },
];

const GARTNER_ROLES = ["CIO", "CTO", "CISO", "CDAO", "CAIO", "CInO", "Infrastructure & Operations", "D. Transformación", "Enterprise Architect", "Procurement"];
const TIPO_CLIENTE = ["Cliente","Cliente proxy", "Oportunidad", "Prospect"];
const WEBINARS_ROLES = ["CIO", "CISO", "CDAO", "CAIO", "Infrastructure & Operations", "Talent", "Workplace", "Procurement", "Enterprise Architect"];
const CSM_LIST = [
  { csm_name: "Cristina Lázaro", csm_email: "Cristina.Lazaro@gartner.com" },
  { csm_name: "Ismael Fathy Martínez", csm_email: "Ismael.FathyMartinez@gartner.com" },
  { csm_name: "Matilde Melloni", csm_email: "Matilde.Melloni@gartner.com" },
  { csm_name: "Mengühan Gürer", csm_email: "menguhan.gurer@gartner.com" }];
const EP_LIST = [
  { ep_name: "Martín Piqueras", ep_email: "Martin.Piqueras@gartner.com" },
  { ep_name: "Jose Luis Antón Hernando", ep_email: "JoseLuis.AntonHernando@gartner.com" },
  { ep_name: "Cristina Magdalena", ep_email: "Cristina.Magdalena@gartner.com" },
  { ep_name: "Fabrizio Magnani", ep_email: "Fabrizio.Magnani@gartner.com" },
  { ep_name: "Mercedes Vidal", ep_email: "mercedes.vidallobato@gartner.com" },
  { ep_name: "Francisco Javier de los Santos", ep_email: "francisco.delossantos@gartner.com" },
  { ep_name: "Manuel Torres", ep_email: "manuel.torres2@gartner.com" }];

const generateNotesFile = (meetings: Meeting[], contact: Contact): string => {
  let content = '=== HISTORIAL DE INTERACCIONES ===\n\n';
  content += `Nombre del contacto: ${contact.first_name} ${contact.last_name}\n`;
  content += `Título del contacto: ${contact.title}\n`;
  content += `Organización del contacto: ${contact.organization}\n`;
  content += `Tipo de contacto: ${contact.contact_type}\n`;
  content += `Notas generales del cliente: ${contact.notes}\n`;

  const sortedMeetings = [...meetings].sort((a, b) => 
    new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime()
  );

  sortedMeetings.forEach((meeting, index) => {
    content += `\n${'='.repeat(80)}\n`;
    content += `INTERACCIÓN ${index + 1}\n`;
    content += `${'='.repeat(80)}\n`;
    content += `Tipo: ${meeting.meeting_type}\n`;
    content += `Fecha: ${formatDateTime(meeting.meeting_date)}\n`;
    content += `Sensación: ${meeting.feeling}\n`;
    content += `\nNotas:\n${'-'.repeat(80)}\n`;
    content += `${meeting.notes || 'Sin notas'}\n`;
  });
  
  return content;
};

const analyzeWithGemini = async (notesContent: string, promptText: string): Promise<string> => {
  const geminiKey = (window as any).__GEMINI_API_KEY__ || '';
  
  if (!geminiKey) {
    throw new Error('GEMINI_API_KEY no configurada. Por favor, configúrala en Settings.');
  }

  const fullPrompt = `${promptText}

INFORMACIÓN DEL CLIENTE:
${notesContent}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: fullPrompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 20000,
        }
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

    return data.candidates[0].content.parts[0].text;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('La solicitud tardó demasiado tiempo. Intenta de nuevo.');
    }
    throw new Error(`Error analizando con Gemini: ${err instanceof Error ? err.message : String(err)}`);
  }
};

export default function ContactDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const photoDropZoneRef = useRef<HTMLDivElement>(null);

  const [isImportingEmails, setIsImportingEmails] = useState(false);
  const [showOnlyMeetings, setShowOnlyMeetings] = useState(false);
  const [showOnlyEPEmails, setShowOnlyEPEmails] = useState(false);
  const [contact, setContact] = useState<Contact | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [meetingsLoading, setMeeetingsLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isNewMeetingDialogOpen, setIsNewMeetingDialogOpen] = useState(false);
  const [deleteMeetingDialog, setDeleteMeetingDialog] = useState<string | null>(null);
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiInitiativesLoading, setGeminiInitiativesLoading] = useState(false);
  const [geminiDialog, setGeminiDialog] = useState(false);
  const [geminiResult, setGeminiResult] = useState('');
  const [customPromptDialog, setCustomPromptDialog] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [visibleCount, setVisibleCount] = useState(10);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesContent, setNotesContent] = useState('');
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [followUpDialog, setFollowUpDialog] = useState(false);
  const [createdMeetingNotes, setCreatedMeetingNotes] = useState('');
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [showFollowUpLoader, setShowFollowUpLoader] = useState(false);
  const [createdMeetingDate, setCreatedMeetingDate] = useState(''); 

  const [initiatives, setInitiatives] = useState<Array<{
    title: string;
    description: string;
    date: string;
    detail_description: string;
    gartner_value: string;
  }>>([]);

  const [selectedInitiative, setSelectedInitiative] = useState<{
  title: string;
  description: string;
  date: string;
  detail_description: string;
  gartner_value: string;
  } | null>(null);
  const [initiativeDetailDialog, setInitiativeDetailDialog] = useState(false);
  
  const [lastInitiativesUpdate, setLastInitiativesUpdate] = useState<string | null>(null);
  
const [formData, setFormData] = useState({
    organization: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    gartner_role: "",
    title: "",
    contact_type: "",
    contacted: false,
    last_contact_date: "",
    interested: false,
    webinars_subscribed: false,
    notes: "",
    webinar_role: "",
    pa_name: "",
    pa_email: "",
    pa_phone: "",
    linkedin_url: "",
    tier: "",
    csm_name: "",
    csm_email: "",
    ep_name: "",
    ep_email: "",
    
  });
  const [meetingFormData, setMeetingFormData] = useState({
    opportunity_id: "none",
    meeting_type: "",
    meeting_date: "",
    feeling: "",
    notes: "",
      });

    const [valueInitiatives, setValueInitiatives] = useState<Array<{
    title: string;
    objective: string;
    description: string;
    area: string;
    date: string;
    gartner_value: string;
    }>>([]);

    const [valueOpportunities, setValueOpportunities] = useState<Array<{
      opportunity: string;
      opportunity_description: string;
      justification: string;
      future_value: string;
    }>>([]);

    const location = useLocation();
    const fromAccount = location.state?.from === 'account';
    const accountId = location.state?.accountId;
    const [valueAnalysisDialog, setValueAnalysisDialog] = useState(false);
    const [selectedValueInitiative, setSelectedValueInitiative] = useState<any>(null);
    const [valueInitiativeDetailDialog, setValueInitiativeDetailDialog] = useState(false);

    const PROMPT_ANALISIS_VALOR = `En base a la información contenida en el fichero adjunto, que incluye emails y notas de reuniones entre un comercial de Gartner y un cliente, realiza el siguiente análisis:
            1. Iniciativas trabajadas:
              - Enumera y describe las principales iniciativas en las que hemos colaborado con el cliente en los últimos meses.
              - Para cada iniciativa, indica:
                  1. Título: claro y conciso (máx 60 caracteres)
                  2. Objetivo: Objetivo principal (máx 60 caracteres).
                  3. Descripción: Descripción de la iniciativa trabajada (máx 200 caracteres).
                  4. Áreas: Áreas o departamentos involucrados.
                  5. Fechas: Fechas relevantes (inicio, hitos, cierre si aplica).
                  6. Valor: Valor aportado por Gartner, especificando en qué medida se ha contribuido en:
                        - Capacitación a equipos.
                        - Reducción de costes.
                        - Reducción de tiempo de ejecución.
                        - Validación en la toma de decisiones.
                        - Reducción de riesgos.
                        - Soporte a la ejecución.
                  - Incluye ejemplos o evidencias concretas extraídas del fichero.

            2. Iniciativas futuras potenciales:
              - Identifica iniciativas o proyectos que podrían trabajarse en el futuro con el cliente, basándote en la información del fichero.
              - Para cada iniciativa potencial, indica:
                  1. Título oportunidad: Título de la oportunidad detectada.
                  2. Descripción oportunidad: Descripción de la oportunidad detectada (máx 200 caracteres).
                  2. Justificación: Justificación basada en necesidades del cliente.
                  3. Valor futuro: Valor que Gartner podría aportar, usando los mismos criterios mencionados arriba.

            3. Estructura de la respuesta:
              - Presenta la información de forma clara y detallada, utilizando listas ordenadas y viñetas.
              - Si es posible, incluye citas textuales relevantes del fichero para respaldar el análisis.
              - Ordena las inciativas por orden de mención, siendo la primera de la lista la última que haya sido mencionada en el fichero adjunto, en orden descendente. 
              - Devuelve SOLO JSON (sin markdown):
                {
                  "initiatives": [
                    {
                      "title": "Título",
                      "objective": "Objetivo",
                      "description": "Descripción",
                      "area": "Áreas",
                      "date": "Fechas",
                      "gartner_value": "Valor",
                    }
                  ]
                  "opportunities": [
                  {
                      "opportumity": "Título oportunidad",
                      "opportunity_description": "Descripción oportunidad",
                      "justification": "Justificación",
                      "future_value": "Valor futuro"
                  }
                  ]
                }
                Si no hay iniciativas u oportunidades (la que no haya o las dos):
                {
                  "initiatives": []
                  "opportunities": []
                }
`;

const PROMPT_ANALISIS_INICIATIVAS = `Analiza este historial de interacciones de un cliente de Gartner del último año, extrae las grandes iniciativas en las que se ha dado soporte con una descripción detallada de las actividades realizadas y el valor aportado gracias al soporte ofrecido.

    IMPORTANTE: 
    - Solo iniciativas más relevantes, prioritarias y grandes (proyectos, implementaciones, evaluaciones)
    - No iniciativas sobre inscripción a eventos como Symposium o Summit
    - NO emails informativos sin iniciativa específica
    - Máximo 6 iniciativas, si hay menos, las que sean
    - Ordena las inciativas por orden de mención, siendo la primera de la lista la última que haya sido mencionada en el fichero adjunto, en orden descendente. 
    - Las iniciativas deben estar en español

    Para cada iniciativa:
    1. Título: claro y conciso (máx 60 caracteres)
    2. Descripción: resumen alto nivel (máx 150 caracteres)
    3. Fecha: más reciente mencionada (YYYY-MM-DD)
    4. Descripción detallada: descripción detallada de las actividades completadas para la iniciativa (máximo 3000 caracteres)
    5. Valor entregado al cliente: Especificar cómo el soporte dado ha contribuido en la capacitación a los equipos, la reducción de costes, la reducción de tiempo de ejecución, la toma de decisiones, la reducción de riesgos, el soporte a la ejecución.

    Devuelve SOLO JSON (sin markdown):
    {
      "initiatives": [
        {
          "title": "Título",
          "description": "Descripción",
          "date": "2025-01-15",
          "detail_description": "Descripción detallada",
          "gartner_value": "Valor entregado al cliente"
        }
      ]
    }

    Si no hay iniciativas:
    {
      "initiatives": []
    }`;

    useEffect(() => {
      if (id) {
        loadData();
      }
    }, [id]);

    useEffect(() => {
      if (contact && contact.ai_initiatives) {
        try {
          const parsed = JSON.parse(contact.ai_initiatives);
          setInitiatives(parsed.initiatives || []);
          setLastInitiativesUpdate(parsed.lastUpdate || null);
        } catch (error) {
          console.error('Error cargando iniciativas:', error);
        }
      }
    }, [contact]);

    // Configurar paste event para la zona de foto
    useEffect(() => {
      const handlePaste = async (e: ClipboardEvent) => {
        if (!photoDropZoneRef.current || !contact) return;
        
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            e.preventDefault();
            const blob = items[i].getAsFile();
            if (blob) {
              await handlePhotoUpload(blob);
            }
            break;
          }
        }
      };

      if (photoDropZoneRef.current) {
        photoDropZoneRef.current.addEventListener('paste', handlePaste as any);
      }

      return () => {
        if (photoDropZoneRef.current) {
          photoDropZoneRef.current.removeEventListener('paste', handlePaste as any);
        }
      };
    }, [contact]);

const handlePhotoUpload = async (file: File) => {
  if (!contact) return;
  
  setUploadingPhoto(true);
  try {
    // Convertir a base64
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = reader.result as string;
      
      try {
        const response = await fetch(`http://localhost:3001/api/contacts/${contact.id}/photo-base64`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64Data })
        });

        const data = await response.json();

        if (data.success) {
          // Recargar el contacto completo desde la BD para asegurar sincronización
          const updatedContact = await db.getContact(contact.id);
          setContact(updatedContact);
          
          toast({
            title: 'Foto actualizada',
            description: 'La foto del contacto se ha guardado correctamente',
          });
        } else {
          throw new Error(data.error || 'Error desconocido');
        }
      } catch (error) {
        console.error('Error subiendo foto:', error);
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Error al guardar la foto',
          variant: 'destructive',
        });
      } finally {
        setUploadingPhoto(false);
      }
    };
    
    reader.readAsDataURL(file);
  } catch (error) {
    console.error('Error procesando imagen:', error);
    toast({
      title: 'Error',
      description: 'Error al procesar la imagen',
      variant: 'destructive',
    });
    setUploadingPhoto(false);
  }
};

const handleDragOver = (e: React.DragEvent) => {
  e.preventDefault();
  setIsDraggingPhoto(true);
};

const handleDragLeave = (e: React.DragEvent) => {
  e.preventDefault();
  setIsDraggingPhoto(false);
};

const handleDrop = async (e: React.DragEvent) => {
  e.preventDefault();
  setIsDraggingPhoto(false);
  
  const files = e.dataTransfer.files;
  if (files.length > 0 && files[0].type.startsWith('image/')) {
    await handlePhotoUpload(files[0]);
  }
};

const handleAnalyzeValue = async () => {
  if (meetings.length === 0) {
    toast({
      title: 'Sin información',
      description: 'No hay reuniones registradas para analizar',
      variant: 'destructive',
    });
    return;
  }

  setGeminiLoading(true);
  try {
    console.log('📊 Iniciando análisis de valor...');
    const notesContent = generateNotesFile(meetings, contact);
    console.log(`📊 Archivo generado: ${notesContent.length} caracteres`);

    const result = await analyzeWithGemini(notesContent, PROMPT_ANALISIS_VALOR);

    // Parsear JSON de la respuesta
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No se pudo extraer JSON de la respuesta');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    const extractedInitiatives = parsed.initiatives || [];
    const extractedOpportunities = parsed.opportunities || [];
    
    setValueInitiatives(extractedInitiatives);
    setValueOpportunities(extractedOpportunities);
    setValueAnalysisDialog(true);
    
    toast({
      title: 'Análisis completado',
      description: `${extractedInitiatives.length} iniciativa(s) y ${extractedOpportunities.length} oportunidad(es) encontradas`,
    });
  } catch (error) {
    console.error('Error con Gemini:', error);
    toast({
      title: 'Error',
      description: error instanceof Error ? error.message : 'Error al analizar con Gemini',
      variant: 'destructive',
    });
  } finally {
    setGeminiLoading(false);
  }
};

const handleAnalyzeInitiatives = async () => {
  if (meetings.length === 0) {
    toast({
      title: 'Sin información',
      description: 'No hay reuniones registradas para analizar',
      variant: 'destructive',
    });
    return;
  }

  setGeminiInitiativesLoading(true);
  try {
    console.log('📊 Iniciando análisis de iniciativas...');
    const notesContent = generateNotesFile(meetings, contact);
    console.log(`📊 Archivo generado: ${notesContent.length} caracteres`);

    const result = await analyzeWithGemini(notesContent, PROMPT_ANALISIS_INICIATIVAS);
    console.log('✅ Respuesta recibida de Gemini');
    
    // Parsear JSON de la respuesta
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No se pudo extraer JSON de la respuesta');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    const extractedInitiatives = parsed.initiatives || [];
    
    setInitiatives(extractedInitiatives);
    setLastInitiativesUpdate(new Date().toISOString());
    
    if (contact) {
      const updatedContact = {
        ...contact,
        ai_initiatives: JSON.stringify({
          initiatives: extractedInitiatives,
          lastUpdate: new Date().toISOString()
        })
      };
      await db.updateContact(contact.id, updatedContact);
    }
    
    toast({
      title: 'Análisis completado',
      description: `Se encontraron ${extractedInitiatives.length} iniciativa(s)`,
    });
  } catch (error) {
    console.error('Error analizando iniciativas:', error);
    
    let errorMessage = 'Error al analizar iniciativas';
    if (error instanceof Error) {
      if (error.message.includes('límite') || error.message.includes('quota')) {
        errorMessage = error.message;
      } else {
        errorMessage = error.message;
      }
    }
    
    toast({
      title: 'Error',
      description: errorMessage,
      variant: 'destructive',
    });
  } finally {
    setGeminiInitiativesLoading(false);
  }
};

const handleCustomPrompt = async () => {
  if (!customPrompt.trim()) {
    toast({
      title: 'Prompt requerido',
      description: 'Por favor, escribe un prompt personalizado',
      variant: 'destructive',
    });
    return;
  }

  if (meetings.length === 0) {
    toast({
      title: 'Sin información',
      description: 'No hay reuniones registradas para analizar',
      variant: 'destructive',
    });
    return;
  }

  setGeminiLoading(true);
  setCustomPromptDialog(false);
  
  try {
    const basePrompt = `En base a la información del fichero adjunto, que son emails y notas de reuniones de un comercial de la empresa Gartner con un cliente/prospect, ${customPrompt}`;
    const notesContent = generateNotesFile(meetings, contact);
    const result = await analyzeWithGemini(notesContent, basePrompt);
    setGeminiResult(result);
    setGeminiDialog(true);
  } catch (error) {
    console.error('Error con Gemini:', error);
    toast({
      title: 'Error',
      description: error instanceof Error ? error.message : 'Error al analizar con Gemini',
      variant: 'destructive',
    });
  } finally {
    setGeminiLoading(false);
  }
};

const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(geminiResult);
    toast({
      title: 'Copiado',
      description: 'Análisis copiado al portapapeles',
    });
  } catch (error) {
    toast({
      title: 'Error',
      description: 'No se pudo copiar al portapapeles',
      variant: 'destructive',
    });
  }
};

const loadData = async () => {
    try {
      setLoading(true);
      setMeeetingsLoading(true);
      
      const [contactData, meetingsData, allOpportunities] = await Promise.all([
        db.getContact(id!),
        db.getMeetingsByContact(id!),
        db.getOpportunities(),
      ]);
      
      // Calcular la fecha de la última interacción
      if (meetingsData.length > 0) {
        const sortedMeetings = [...meetingsData].sort((a, b) => 
          new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime()
        );
        const lastMeetingDate = sortedMeetings[0].meeting_date;
        
        // Actualizar last_contact_date si es diferente
        if (contactData.last_contact_date !== lastMeetingDate) {
          await db.updateContact(id!, { 
            ...contactData, 
            last_contact_date: lastMeetingDate 
          });
          contactData.last_contact_date = lastMeetingDate;
        }
      }
      
      setContact(contactData);
      setMeetings(meetingsData);
      
      const contactOpportunities = (allOpportunities || []).filter(
        (opp: any) => opp.contact_id === id
      );
      setOpportunities(contactOpportunities);
      
      setLoading(false);
      
      if (contactData) {
        try {
          const response = await fetch('http://localhost:3002/api/contacts/import-received-emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contactId: contactData.id,
              contactEmail: contactData.email,
              lastEmailCheck: contactData.last_email_check || null
            })
          });

          const data = await response.json();

          if (data.success && data.importedCount > 0) {
            const updatedMeetings = await db.getMeetingsByContact(id!);
            setMeetings(updatedMeetings);
          }
          setMeeetingsLoading(false);

        } catch (error) {
          console.error('Error en importación automática de emails:', error);
        }
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
      setLoading(false);
    }
  };
const handleImportEmails = async () => {
  if (!contact) return;
  
  setIsImportingEmails(true);
  try {
    const response = await fetch('http://localhost:3002/api/contacts/import-received-emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactId: contact.id,
        contactEmail: contact.email,
        lastEmailCheck: null  // ⭐ Forzar importación completa (365 días)
      })
    });

    const data = await response.json();

    if (data.success) {
      const message = data.importedCount > 0 
        ? `${data.importedCount} email(s) importado(s), ${data.skippedCount} omitido(s)`
        : 'No se encontraron emails nuevos';
        
      toast({
        title: "Importación completada",
        description: message,
      });
      loadData();
    } else {
      throw new Error(data.error || 'Error desconocido');
    }
  } catch (error) {
    toast({
      title: "Error",
      description: `Error importando emails: ${error.message}`,
      variant: "destructive",
    });
  } finally {
    setIsImportingEmails(false);
  }
};

const handleCSMChange = (selectedName: string) => {
  const selectedCSM = CSM_LIST.find(csm => csm.csm_name === selectedName);
  if (selectedCSM) {
    setFormData(prev => ({
      ...prev,
      csm_name: selectedCSM.csm_name,
      csm_email: selectedCSM.csm_email,
    }));
  }
};

  const handleEPChange = (selectedName: string) => {
    const selectedEP = EP_LIST.find(ep => ep.ep_name === selectedName);
    if (selectedEP) {
      setFormData(prev => ({
        ...prev,
        ep_name: selectedEP.ep_name,
        ep_email: selectedEP.ep_email,
      }));
    }
  };

  const getFeelingColor = (feeling: string) => {
    const option = FEELING_OPTIONS.find(f => f.value === feeling);
    return option?.color || '';
  };

  const getFeelingLabel = (feeling: string) => {
    const option = FEELING_OPTIONS.find(f => f.value === feeling);
    return option?.label || feeling;
  };

  const openEditDialog = () => {
    if (!contact) return;
    
    setFormData({
      organization: contact.organization,
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email,
      phone: contact.phone ?? "",
      gartner_role: contact.gartner_role,
      title: contact.title,
      contact_type: contact.contact_type,
      contacted: contact.contacted,
      last_contact_date: contact.last_contact_date ?? "",
      interested: contact.interested,
      webinars_subscribed: contact.webinars_subscribed,
      notes: contact.notes ?? "",
      webinar_role: contact.webinar_role ?? "",
      pa_name: contact.pa_name ?? "",
      pa_email: contact.pa_email ?? "",
      pa_phone: contact.pa_phone ?? "",
      linkedin_url: contact.linkedin_url ?? "",
      tier: contact.tier || "",
      csm_name: contact.csm_name || "",
      csm_email: contact.csm_email || "",
      ep_name: contact.ep_name || "",
      ep_email: contact.ep_email || "",
    });
    setIsEditDialogOpen(true);
  };

    const handleDeleteMeeting = async (meetingId: string) => {
      try {
        await db.deleteMeeting(meetingId);
        setMeetings(prev => prev.filter(m => m.id !== meetingId));
        setDeleteMeetingDialog(null);
      } catch (error) {
        console.error('Error eliminando reunión:', error);
      }
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.gartner_role) {
      toast({
        title: "Campo obligatorio",
        description: "Por favor selecciona un rol de campañas.",
        variant: "destructive",
      });
      return;
    }
    if (!formData.contact_type) {
      toast({
        title: "Campo obligatorio",
        description: "Por favor selecciona un tipo de contacto.",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      organization: formData.organization,
      first_name: formData.first_name,
      last_name: formData.last_name,
      email: formData.email,
      phone: formData.phone || null,
      gartner_role: formData.gartner_role,
      title: formData.title,
      contact_type: formData.contact_type,
      contacted: formData.contacted,
      last_contact_date: formData.last_contact_date || null,
      interested: formData.interested,
      webinars_subscribed: formData.webinars_subscribed,
      notes: formData.notes || null,
      webinar_role: formData.webinar_role,
      pa_name: formData.pa_name,
      pa_email: formData.pa_email,
      pa_phone: formData.pa_phone,
      linkedin_url: formData.linkedin_url,
      tier: formData.tier || null,
      csm_name: formData.csm_name || "",
      csm_email: formData.csm_email || "",
      ep_name: formData.ep_name || "",
      ep_email: formData.ep_email || "",
    };

    try {
      await db.updateContact(id!, payload);
      toast({ title: "Éxito", description: "Contacto actualizado correctamente" });
      setIsEditDialogOpen(false);
      loadData();
    } catch (error) {
      toast({
        title: "Error",
        description: `Error al actualizar el contacto: ${error instanceof Error ? error.message : "Desconocido"}`,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!confirm("¿Estás seguro de eliminar este contacto?")) return;

    try {
      await db.deleteContact(id!);
      toast({ title: "Éxito", description: "Contacto eliminado" });
      navigate('/crm');
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar el contacto", variant: "destructive" });
    }
  };

const handleCreateMeeting = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!meetingFormData.meeting_type) {
    toast({
      title: "Campo obligatorio",
      description: "Por favor selecciona un tipo de reunión.",
      variant: "destructive",
    });
    return;
  }
  if (!meetingFormData.meeting_date) {
    toast({
      title: "Campo obligatorio",
      description: "Por favor selecciona una fecha.",
      variant: "destructive",
    });
    return;
  }

  // Determinar si la reunión es futura
  const meetingDate = new Date(meetingFormData.meeting_date);
  meetingDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isFuture = meetingDate > today;

  const payload = {
    opportunity_id: (meetingFormData.opportunity_id === "none" || !meetingFormData.opportunity_id) 
      ? "Sin oportunidad" 
      : meetingFormData.opportunity_id,
    contact_id: id!,
    meeting_type: meetingFormData.meeting_type,
    meeting_date: meetingFormData.meeting_date,
    feeling: isFuture ? null : meetingFormData.feeling,  // null si es futura
    notes: meetingFormData.notes || null,
  };

  try {
    await db.createMeeting(payload);
    toast({ title: "Éxito", description: "Reunión creada correctamente" });
    setIsNewMeetingDialogOpen(false);
    
    const notesForFollowUp = meetingFormData.notes;
    const dateForFollowUp = meetingFormData.meeting_date;
    
    setMeetingFormData({
      opportunity_id: "none",
      meeting_type: "",
      meeting_date: "",
      feeling: "",
      notes: "",
    });
    
    loadData();
    
    // Solo preguntar por follow-up si la reunión es pasada o de hoy Y tiene notas
    if (!isFuture && notesForFollowUp && notesForFollowUp.trim()) {
      setCreatedMeetingNotes(notesForFollowUp);
      setCreatedMeetingDate(dateForFollowUp);
      setFollowUpDialog(true);
    }
  } catch (error) {
    toast({
      title: "Error",
      description: `Error al crear la reunión: ${error instanceof Error ? error.message : "Desconocido"}`,
      variant: "destructive",
    });
  }
};
const handleGenerateFollowUp = async () => {
  if (!createdMeetingNotes || !contact) {
    toast({
      title: 'Sin información',
      description: 'No hay notas de reunión disponibles',
      variant: 'destructive',
    });
    return;
  }

  setFollowUpDialog(false);
  setFollowUpLoading(true);
  setShowFollowUpLoader(true);
  
  try {
    await generateFollowUpEmail(
      createdMeetingNotes,
      contact.first_name,
      contact.email,
      createdMeetingDate  // ← PASAR LA FECHA GUARDADA
    );

    toast({
      title: 'Email generado',
      description: 'Se ha abierto Outlook con el email de follow-up',
    });
  } catch (error) {
    console.error('Error generando follow-up:', error);
    toast({
      title: 'Error',
      description: error instanceof Error ? error.message : 'Error al generar follow-up',
      variant: 'destructive',
    });
  } finally {
    setFollowUpLoading(false);
    setShowFollowUpLoader(false);
    setCreatedMeetingNotes('');
    setCreatedMeetingDate('');  // ← LIMPIAR LA FECHA TAMBIÉN
  }
};

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Cargando...</div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="container mx-auto py-8 px-4">
        <p>Contacto no encontrado</p>
      </div>
    );
  }

const filteredMeetings = meetings.filter(meeting => {
  const isReunion = !meeting.notes?.startsWith("[Email cliente]") &&
                    !meeting.notes?.startsWith("[Email CSM]") &&
                    !meeting.notes?.startsWith("[Email EP]");

  const isEmailEP = meeting.notes?.startsWith("[Email EP]") || meeting.notes?.startsWith("[Email CSM]");
  
  if (showOnlyMeetings && showOnlyEPEmails) {
    return isReunion && isEmailEP;
  }

  if (showOnlyMeetings) return isReunion;
  if (showOnlyEPEmails) return isEmailEP;

  return true;
});

const hasReuniones = meetings.some(meeting =>
  !meeting.notes?.startsWith("[Email cliente]") &&
  !meeting.notes?.startsWith("[Email CSM]") &&
  !meeting.notes?.startsWith("[Email EP]")
);

const hasEmails = meetings.some(meeting =>
  meeting.notes?.startsWith("[Email CSM]") ||
  meeting.notes?.startsWith("[Email EP]")
);

const handleShowMore = () => {
  setVisibleCount(filteredMeetings.length);
};

  return (
    <div className="container mx-auto py-6 px-4">
      <Button
        variant="ghost"
        onClick={() => navigate(fromAccount ? `/accounts/${accountId}` : '/crm')}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {fromAccount ? 'Volver a la cuenta' : 'Volver a Contactos'}
      </Button>

      {/* HEADER CON FOTO Y DATOS DEL CONTACTO */}
      <div className="flex gap-6 mb-1">
        {/* FOTO DEL CONTACTO */}
        <div className="h-20 aspect-[6/7] overflow-hidden">
          <Card className="shadow-sm rounded-2xl h-full">
            <CardContent className="p-0 h-full">
              <div
                ref={photoDropZoneRef}
                tabIndex={0}
                className={
                  `relative w-full h-full overflow-hidden 
                  ${contact.photo_url 
                      ? 'rounded-2xl'
                      : `rounded-2xl border-2 border-dashed 
                        ${isDraggingPhoto ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 bg-gray-50'}
                        transition-colors cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500`
                  }`
                }
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {contact.photo_url ? (
                  <>
                    <img
                      src={`http://localhost:3001${contact.photo_url}?t=${Date.now()}`}
                      alt={`${contact.first_name} ${contact.last_name}`}
                      className="absolute inset-0 w-full h-full object-cover"
                      key={contact.photo_url}
                    />
                    <button
                      type="button"
                      disabled={meetingsLoading}
                      className="absolute inset-0 w-full h-full"
                      onClick={() => {}}
                      aria-label="Actualizar foto"
                    />
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                    {uploadingPhoto ? (
                      <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                    ) : (
                      <>
                        <ImageIcon className="h-3 w-3" />
                        <p className="text-xs text-center px-1">
                          Pega o arrastra una imagen
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* INFORMACIÓN PRINCIPAL DEL CONTACTO */}
        <div className="flex-1">
          <div className="flex justify-between items-start mb-1">
            <div className="flex items-center gap-10">
              <h1 className="text-3xl font-bold text-slate-800">
                {contact.first_name} {contact.last_name}
              </h1>
              {contact.tier && (
                <span 
                  className={`w-20 h-10 rounded-full flex items-center text-white justify-center text-lg font-bold shadow-md ${
                      contact.tier === "1" ? "tier-1" :
                      contact.tier === "2" ? "tier-2" :
                      "tier-3"
                  }`}
                >
                 Tier {contact.tier}
                </span>
              )}
            </div>
            <Button 
                variant="outline"
                disabled={meetingsLoading}
                onClick={openEditDialog}
                className="rounded-full px-6 shadow-sm hover:shadow-md transition-shadow">
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Button>
          </div>

          <p className="text-xl text-slate-600 mb-6">
            {contact.title} - {contact.organization}
          </p>
        </div>
      </div>
      {/* SECCIÓN SUPERIOR CONDENSADA */}
      <div className="grid grid-cols-12 gap-6 mb-6">
        
        {/* INFORMACIÓN DE CONTACTO - 4 columnas */}
        <Card className="border-gray-200 shadow-sm rounded-2xl col-span-4">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-slate-800">Información de Contacto</CardTitle>
              <Badge
                className={`text-xs px-3 py-1 rounded-full font-medium shadow-sm ${
                  contact.contact_type === "Cliente" || contact.contact_type === "Cliente proxy"
                    ? "bg-green-500 hover:bg-green-600"
                    : contact.contact_type === "Oportunidad"
                    ? "bg-blue-500 hover:bg-blue-600 cursor-pointer"
                    : contact.contact_type === "Prospect"
                    ? "bg-amber-500 hover:bg-amber-600"
                    : "bg-slate-500 hover:bg-slate-600"
                }`}
                onClick={() => {
                  if (contact.contact_type === "Oportunidad" && opportunities.length > 0) {
                    navigate(`/opportunities/${opportunities[0].id}`);
                  }
                }}
              >
                {contact.contact_type}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-600" />
              <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline truncate">
                {contact.email}
              </a>
            </div>
            {contact.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-blue-600" />
                <a href={`tel:${contact.phone}`} className="text-blue-600 hover:underline">
                  {contact.phone}
                </a>
              </div>
            )}
            {contact.linkedin_url && (
              <div className="flex items-center gap-2">
                <a
                  href={contact.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-blue-600 hover:text-blue-800 gap-2"
                >
                  <svg 
                    className="h-5 w-5" 
                    fill="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  Ver perfil LinkedIn
                </a>
              </div>
            )}    
            {(contact.pa_name || contact.pa_email || contact.pa_phone) && (
              <div className="pt-3 mt-3 border-t border-gray-200">
                <p className="font-semibold text-slate-700 mb-1">Personal Assistant</p>

                {contact.pa_name && (
                  <p className="text-slate-600 mb-1">{contact.pa_name}</p>
                )}

                {contact.pa_email && (
                  <a
                    href={`mailto:${contact.pa_email}`}
                    className="text-blue-600 hover:underline flex items-center gap-2"
                  >
                    <Mail className="h-4 w-4" />
                    {contact.pa_email}
                  </a>
                )}

                {contact.pa_phone && (
                  <a
                    href={`tel:${contact.pa_phone}`}
                    className="text-blue-600 hover:underline flex items-center gap-2"
                  >
                    <Phone className="h-4 w-4" />
                    {contact.pa_phone}
                  </a>
                )}
              </div>
            )}
          </CardContent>
        </Card>

      {/* NOTAS DEL CLIENTE - 3 columnas */}
      <Card className={`${contact.notes || isEditingNotes ? 'col-span-5' : 'col-span-5'} bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200 shadow-sm rounded-2xl`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-slate-800">Notas sobre el cliente</CardTitle>
            {!contact.notes && !isEditingNotes ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setNotesContent('');
                  setIsEditingNotes(true);
                }}
                className="bg-white rounded-full hover:bg-amber-100 border-amber-300" rounded-full
              >
                <Plus className="mr-2 h-4 w-4" />
                Añadir notas
              </Button>
            ) : !isEditingNotes ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setNotesContent(contact.notes || '');
                  setIsEditingNotes(true);
                }}
                className="hover:bg-amber-200/50"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsEditingNotes(false);
                    setNotesContent('');
                  }}
                  className="hover:bg-amber-200/50"
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={async () => {
                    try {
                      const updatedContact = {
                        ...contact,
                        notes: notesContent.trim() || null
                      };
                      await db.updateContact(contact.id, updatedContact);
                      setContact(updatedContact);
                      setIsEditingNotes(false);
                      toast({
                        title: 'Notas actualizadas',
                        description: 'Las notas se guardaron correctamente',
                      });
                    } catch (error) {
                      toast({
                        title: 'Error',
                        description: 'No se pudieron guardar las notas',
                        variant: 'destructive',
                      });
                    }
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  Guardar
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!isEditingNotes ? (
            contact.notes ? (
              <div className="text-sm text-slate-700 leading-relaxed max-h-[180px] overflow-y-auto">
                {contact.notes}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-500 text-sm">
                No hay notas sobre este cliente
              </div>
            )
          ) : (
            <Textarea
              value={notesContent}
              onChange={(e) => setNotesContent(e.target.value)}
              placeholder="Escribe notas sobre el cliente..."
              rows={6}
              className="text-sm bg-white border-amber-300 focus:border-amber-500 focus:ring-amber-500"
              autoFocus
            />
          )}
        </CardContent>
      </Card>

        {/* INFORMACIÓN DE VENTAS - 3 columnas */}
        <Card className="col-span-3 border-gray-200 shadow-sm rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-slate-800">Información de Ventas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">¿Ha sido contactado?:</span>
              {contact.contacted ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-400" />
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Interesado en Gartner:</span>
              {contact.interested ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-400" />
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Suscrito a los Webinars:</span>
              {contact.webinars_subscribed ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-400" />
              )}
            </div>
              <div className="pt-2 mt-2 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <p className="text-slate-600 text-xs">Rol Campañas:</p>
                  <Badge variant="outline" className="text-xs bg-white">
                    {contact.gartner_role}
                  </Badge>
                </div>
              </div>

              <div className="mt-2">
                <div className="flex items-center justify-between">
                  <p className="text-slate-600 text-xs">Rol Webinars:</p>
                  <Badge variant="outline" className="text-xs bg-white">
                    {contact.webinar_role?.trim() ? contact.webinar_role : "-"}
                  </Badge>
                </div>
              </div>
          </CardContent>
        </Card>
      </div>

      {/* ANÁLISIS CON IA */}
      <Card className="mb-6 bg-gradient-to-br from-indigo-50/20 to-indigo-100/50 border-indigo-200 shadow-sm rounded-2xl">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800">
            <Sparkles className="h-5 w-5 text-indigo-500" />
            Análisis con IA (Gemini)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6">
            {/* Prompts para AE */}
            <div className="flex flex-col h-full gap-3">
              <h3 className="text-base font-semibold text-slate-700 mb-3">Prompts para AE</h3>
                <Button
                  onClick={handleAnalyzeValue}
                  disabled={geminiLoading || geminiInitiativesLoading || meetings.length === 0}
                  className="w-full h-full flex flex-col items-center justify-center bg-white hover:bg-indigo-50 text-slate-700 border border-indigo-200 shadow-sm"
                  variant="outline"
                >
                  {geminiLoading ? (
                    <Loader2 className="h-5 w-5 mb-1 animate-spin text-indigo-500" />
                  ) : (
                    <TrendingUp className="h-5 w-5 mb-1 text-indigo-500" />
                  )}
                  <span className="text-sm text-center">Análisis Iniciativas y de Valor</span>
                </Button>
              
              <Button 
                onClick={() => setCustomPromptDialog(true)}
                disabled={geminiLoading || geminiInitiativesLoading || meetings.length === 0}
                className="w-full h-full flex flex-col items-center justify-center bg-white hover:bg-indigo-50 text-slate-700 border border-indigo-200 shadow-sm"
                variant="outline"
              >
                {geminiLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <MessageSquare className="mr-2 h-4 w-4 text-indigo-500" />
                )}
                Prompt personalizado
              </Button>
              
              {meetings.length === 0 && (
                <p className="text-xs text-slate-500 mt-2">
                  Necesitas tener reuniones registradas para usar el análisis con IA
                </p>
              )}
            </div>

            {/* Iniciativas */}
            <div className="border-l border-indigo-200 pl-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-slate-700">
                  Iniciativas de {contact.first_name} del último año
                </h3>

                <div className="flex items-center gap-2">
                  {lastInitiativesUpdate && (
                    <p className="text-xs italic text-slate-500">
                      Última actualización: {formatDateES(lastInitiativesUpdate)}
                    </p>
                  )}
                  {lastInitiativesUpdate && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleAnalyzeInitiatives}
                    disabled={geminiLoading || geminiInitiativesLoading || meetings.length === 0}
                    className="hover:bg-indigo-100"
                  >
                    {geminiInitiativesLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                  )}
                </div>
              </div>
              
            <div className="space-y-1 max-h-[400px] overflow-y-auto pr-2">
              {initiatives.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-slate-500 mb-2">
                    No hay iniciativas analizadas
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAnalyzeInitiatives}
                    disabled={geminiLoading || geminiInitiativesLoading || meetings.length === 0}
                    className="bg-white hover:bg-indigo-50 border-indigo-200"
                  >
                    {geminiInitiativesLoading ? (
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-3 w-3 text-indigo-500" />
                    )}
                    Analizar Iniciativas
                  </Button>
                </div>
              ) : (
                initiatives.map((initiative, index) => (
                  <div 
                    key={index} 
                    className="bg-white p-2 rounded-lg border border-indigo-100 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer"
                    onClick={() => {
                      setSelectedInitiative(initiative);
                      setInitiativeDetailDialog(true);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-medium text-slate-800 line-clamp-2">
                        {initiative.title}
                        <span className="font-normal text-slate-500 ml-2">
                          [{new Date(initiative.date).toLocaleDateString('es-ES', { 
                            month: 'short', 
                            year: 'numeric' 
                          })}]
                        </span>
                      </h4>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2 mt-1">
                      {initiative.description}
                    </p>
                  </div>
                ))
              )}
            </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* INTERACCIONES */}
      <Card className="bg-white border-slate-200 shadow-sm rounded-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-slate-800">Interacciones ({meetings.length})</CardTitle>

            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={handleImportEmails}
                disabled={isImportingEmails}
                className="rounded-full shadow-sm hover:shadow-md transition-shadow"
              >
                {isImportingEmails ? (
                  <>Importando...</>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Importar Emails
                  </>
                )}
              </Button>
              <Button 
                size="sm" 
                onClick={() => setIsNewMeetingDialogOpen(true)}
                className="rounded-full shadow-sm hover:shadow-md transition-shadow bg-indigo-500 hover:bg-indigo-600">
                <Plus className="mr-2 h-4 w-4" />
                Nueva Reunión
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
           <div className="mb-3 flex justify-between items-center">
            <div className="flex gap-2">
          {hasReuniones && (
            <button
              className={`px-3 py-1 filter-chip ${
                showOnlyMeetings 
                  ? "filter-chip-active" 
                  : "filter-chip-inactive" 
              }`}
              onClick={() => setShowOnlyMeetings(prev => !prev)}
            >
              Reuniones
            </button>
          )}
          {hasEmails && (
            <button
              className={`px-3 py-1 filter-chip ${
                showOnlyEPEmails 
                  ? "filter-chip-active" 
                  : "filter-chip-inactive"
              }`}
              onClick={() => setShowOnlyEPEmails(prev => !prev)}
            >
              Emails EP y CSM
            </button>
          )}
          </div>
          {filteredMeetings.length > visibleCount && (
          <div className="flex justify-between mt-1 py-1">
            <span
              onClick={handleShowMore}
              className="italic text-sm text-indigo-600 cursor-pointer hover:underline"
            >
              Mostrar todas las interacciones...
            </span>
          </div>
        )}
        </div>
          {meetings.length === 0 ? (
            <p className="text-center py-8 text-slate-500">
              No hay interacciones registradas con este contacto
            </p>
          ) : (
          <div className="bg-card rounded-lg shadow overflow-hidden overflow-x-auto">
            <Table className="w-full table-fixed">
              <colgroup>
                <col className="w-[80px]" />
                <col className="w-[120px]" />
                <col className="w-[120px]" />
                <col className="w-[100px]" />
                <col className="w-[550px]" />
                <col className="w-[50px]" />
              </colgroup>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted/50"> 
                  <TableHead className="text-center">Fecha</TableHead>
                  <TableHead className="text-center">Tipo</TableHead>
                  <TableHead className="text-center">Categoría</TableHead>
                  <TableHead className="text-center">Feeling</TableHead>
                  <TableHead className="text-center">Notas</TableHead>
                  <TableHead className="text-center"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="[&>*]:py-1">
                {filteredMeetings.slice(0, visibleCount).map((meeting) => (
              <TableRow 
                key={meeting.id} 
                className="hover:bg-slate-50"
              >
                <TableCell 
                  className="text-center py-1 text-sm cursor-pointer"
                  onClick={() => navigate(`/meetings/${meeting.id}`, { 
                    state: { from: 'contact', contactId: id } 
                  })}
                >
                  {formatDateTime(meeting.meeting_date)}
                </TableCell>
                <TableCell 
                  className="text-center py-1 cursor-pointer"
                  onClick={() => navigate(`/meetings/${meeting.id}`, { 
                    state: { from: 'contact', contactId: id } 
                  })}
                >
                  <Badge
                    variant="outline"
                    className={`text-xs px-2 rounded-full border ${
                      meeting.meeting_type === "Email"
                        ? ""
                        : meeting.meeting_type === "Otros" ? "bg-slate-100 text-slate-700 border-slate-300"
                        : meeting.meeting_type === "Delivery" ? "bg-blue-50 text-blue-700 border-blue-300"
                        : "bg-green-50 text-green-700 border-green-300"
                    }`}
                  >
                    {meeting.meeting_type}
                  </Badge>
                </TableCell>
                <TableCell 
                  className="text-center cursor-pointer"
                  onClick={() => navigate(`/meetings/${meeting.id}`, { 
                    state: { from: 'contact', contactId: id } 
                  })}
                >
                  <Badge
                    variant="outline"
                    className="text-xs py-1 rounded-full"
                  >
                    {meeting.notes?.startsWith("[Email cliente]") ? "Email cliente"
                      : meeting.notes?.startsWith("[Email CSM]") ? "Email CSM"
                      : meeting.notes?.startsWith("[Email EP]") ? "Email EP"
                      : "Reunión"}
                  </Badge>
                </TableCell>
                <TableCell 
                  className="text-center py-1 cursor-pointer"
                  onClick={() => navigate(`/meetings/${meeting.id}`, { 
                    state: { from: 'contact', contactId: id } 
                  })}
                >
                  <div className="flex items-center justify-center gap-2 py-1">
                    <div className={`w-3 h-3 rounded-full ${getFeelingColor(meeting.feeling)}`} />
                    <span className="sm-sm">{getFeelingLabel(meeting.feeling)}</span>
                  </div>
                </TableCell>
                <TableCell 
                  className="max-w-md truncate py-1 text-sm cursor-pointer"
                  onClick={() => navigate(`/meetings/${meeting.id}`, { 
                    state: { from: 'contact', contactId: id } 
                  })}
                >
                  {meeting.notes || 'Sin notas'}
                </TableCell>
                <TableCell className="text-center py-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteMeetingDialog(meeting.id);
                    }}
                    className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>  
          )}
        </CardContent>
      </Card>

      {/* DIÁLOGOS */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Contacto</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="organization">Organización *</Label>
                <Input
                  id="organization"
                  value={formData.organization}
                  onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="first_name">Nombre *</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="last_name">Apellidos *</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Tier</Label>
                <Select 
                  value={formData.tier} 
                  onValueChange={(value) => setFormData({ ...formData, tier: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Tier 1</SelectItem>
                    <SelectItem value="2">Tier 2</SelectItem>
                    <SelectItem value="3">Tier 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="gartner_role">Rol tipo de campañas *</Label>
                <Select value={formData.gartner_role} onValueChange={(value) => setFormData({ ...formData, gartner_role: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar rol" />
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
              <div>
                <Label htmlFor="title">Rol en su organización *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="contact_type">Tipo de contacto *</Label>
                <Select value={formData.contact_type} onValueChange={(value) => setFormData({ ...formData, contact_type: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPO_CLIENTE.map((contact_type) => (
                      <SelectItem key={contact_type} value={contact_type}>
                        {contact_type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            
              <div>
                <Label htmlFor="pa_name">Nombre PA</Label>
                <Input
                  id="pa_name"
                  value={formData.pa_name}
                  onChange={(e) => setFormData({ ...formData, pa_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="pa_email">Email PA</Label>
                <Input
                  id="pa_email"
                  value={formData.pa_email}
                  onChange={(e) => setFormData({ ...formData, pa_email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="pa_phone">Teléfono PA</Label>
                <Input
                  id="pa_phone"
                  value={formData.pa_phone}
                  onChange={(e) => setFormData({ ...formData, pa_phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="linkedin_url">LinkedIn URL</Label>
                <Input
                  id="linkedin_url"
                  type="url"
                  value={formData.linkedin_url}
                  onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="csm_name">Nombre CSM</Label>
                <Select 
                  disabled={contact.contact_type !== 'Cliente' && contact.contact_type !== 'Cliente proxy'}
                  value={formData.csm_name} 
                  onValueChange={handleCSMChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar CSM" />
                  </SelectTrigger>
                  <SelectContent>
                    {CSM_LIST.map((csm) => (
                      <SelectItem key={csm.csm_name} value={csm.csm_name}>
                        {csm.csm_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="ep_name">Nombre EP</Label>
                <Select 
                  disabled={contact.contact_type !== 'Cliente' && contact.contact_type !== 'Cliente proxy'}
                  value={formData.ep_name} 
                  onValueChange={handleEPChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar EP" />
                  </SelectTrigger>
                  <SelectContent>
                    {EP_LIST.map((ep) => (
                      <SelectItem key={ep.ep_name} value={ep.ep_name}>
                        {ep.ep_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="contacted"
                  checked={formData.contacted}
                  onCheckedChange={(checked) => setFormData({ ...formData, contacted: checked as boolean })}
                />
                <Label htmlFor="contacted">Contactado</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="interested"
                  checked={formData.interested}
                  onCheckedChange={(checked) => setFormData({ ...formData, interested: checked as boolean })}
                />
                <Label htmlFor="interested">Interesado en Gartner</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="webinars_subscribed"
                  checked={formData.webinars_subscribed}
                  onCheckedChange={(checked) => setFormData({ ...formData, webinars_subscribed: checked as boolean })}
                />
                <Label htmlFor="webinars_subscribed">Enviar Webinars</Label>
              </div>
            </div>
            <div>
              <Label htmlFor="webinar_role">Rol para webinars</Label>
              <Select 
                value={formData.webinar_role}
                onValueChange={(value) => setFormData({ ...formData, webinar_role: value })}
                disabled={!formData.webinars_subscribed}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {WEBINARS_ROLES.map((webinar_role) => (
                    <SelectItem key={webinar_role} value={webinar_role}>
                      {webinar_role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                className="mr-auto rounded-full"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button type="button" 
                className="rounded-full"
                variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                className="rounded-full shadow-sm hover:shadow-md transition-shadow bg-indigo-500 hover:bg-indigo-600"
                type="submit">Actualizar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isNewMeetingDialogOpen} onOpenChange={setIsNewMeetingDialogOpen}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Reunión</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateMeeting} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="meeting_type">Tipo de Reunión *</Label>
                <Select 
                  value={meetingFormData.meeting_type} 
                  onValueChange={(value) => setMeetingFormData({ ...meetingFormData, meeting_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                  <SelectItem value="SKO">SKO</SelectItem>
                  <SelectItem value="QBR 90">QBR 90</SelectItem>
                  <SelectItem value="QBR MIDYEAR">QBR MIDYEAR</SelectItem>
                  <SelectItem value="QBR AA90">QBR AA90</SelectItem>
                  <SelectItem value="Email">Email</SelectItem>
                  <SelectItem value="Delivery">Delivery</SelectItem>
                  <SelectItem value="Otros">Otros</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="meeting_date">Fecha *</Label>
                <DatePicker
                  value={meetingFormData.meeting_date}
                  onChange={(date) => setMeetingFormData({ ...meetingFormData, meeting_date: date })}
                />
              </div>

              <div>
                <Label htmlFor="feeling">Sensación de la Reunión</Label>
                <Select 
                  value={meetingFormData.feeling} 
                  onValueChange={(value) => setMeetingFormData({ ...meetingFormData, feeling: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FEELING_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${option.color}`} />
                          {option.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="opportunity_id">Oportunidad (opcional)</Label>
                <Select 
                  value={meetingFormData.opportunity_id} 
                  onValueChange={(value) => setMeetingFormData({ ...meetingFormData, opportunity_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin oportunidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin oportunidad</SelectItem>
                    {opportunities.map((opp) => (
                      <SelectItem key={opp.id} value={opp.id}>
                        {opp.proposed_solution} - {opp.status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="meeting_notes">Notas / Minutas de la Reunión</Label>
              <Textarea
                id="meeting_notes"
                value={meetingFormData.notes}
                onChange={(e) => setMeetingFormData({ ...meetingFormData, notes: e.target.value })}
                rows={30}
                placeholder="Detalles de la reunión, minutas, acuerdos alcanzados, próximos pasos..."
                className="font-mono text-sm"
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button 
                className="rounded-full"
                type="button" variant="outline" onClick={() => setIsNewMeetingDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                className="rounded-full shadow-sm hover:shadow-md transition-shadow bg-indigo-500 hover:bg-indigo-600"
                type="submit">Crear Reunión</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      
      <Dialog open={geminiDialog} onOpenChange={setGeminiDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Análisis con IA
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[60vh]">
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg">
                {geminiResult}
              </pre>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={copyToClipboard}>
              <Copy className="mr-2 h-4 w-4" />
              Copiar
            </Button>
            <Button onClick={() => setGeminiDialog(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={customPromptDialog} onOpenChange={setCustomPromptDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Promtp personalizado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tu pregunta personalizada:</Label>
              <p className="text-sm text-muted-foreground mb-2">
                El prompt comenzará con: "En base a la información de las interacciones del contacto, que son emails y notas de reuniones de un comercial con un cliente/prospect..."
              </p>
              <Textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Escribe aquí tu pregunta personalizada..."
                rows={8}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomPromptDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCustomPrompt} disabled={!customPrompt.trim()}>
              Analizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    <AlertDialog
        open={!!deleteMeetingDialog}
        onOpenChange={() => setDeleteMeetingDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar reunión?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMeetingDialog && handleDeleteMeeting(deleteMeetingDialog)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Dialog de detalle de iniciativa */}
    <Dialog open={initiativeDetailDialog} onOpenChange={setInitiativeDetailDialog}>
      <DialogContent className="max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-800">
            {selectedInitiative?.title}
          </DialogTitle>
        </DialogHeader>
        
        {selectedInitiative && (
          <div className="space-y-6">
            {/* Fecha y Descripción corta */}
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <Medal className="h-5 w-5 text-indigo-600" />
                    Información General
                  </h3>
                  <Badge variant="outline" className="bg-white">
                    {new Date(selectedInitiative.date).toLocaleDateString('es-ES', { 
                      day: 'numeric',
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </Badge>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {selectedInitiative.description}
                </p>
              </div>
            </div>

            {/* Descripción detallada */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-blue-600" />
                Descripción Detallada
              </h3>
              <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                {selectedInitiative.detail_description}
              </div>
            </div>

            {/* Valor entregado */}
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Valor Entregado al Cliente
              </h3>
              <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                {selectedInitiative.gartner_value}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => {
              const content = `
          INICIATIVA: ${selectedInitiative?.title}

          FECHA: ${new Date(selectedInitiative?.date || '').toLocaleDateString('es-ES', { 
            day: 'numeric',
            month: 'long', 
            year: 'numeric' 
          })}

          DESCRIPCIÓN:
          ${selectedInitiative?.description}

          DESCRIPCIÓN DETALLADA:
          ${selectedInitiative?.detail_description}

          VALOR ENTREGADO AL CLIENTE:
          ${selectedInitiative?.gartner_value}
                    `.trim();
                    
                    navigator.clipboard.writeText(content);
                    toast({
                      title: 'Copiado',
                      description: 'Iniciativa copiada al portapapeles',
                    });
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar
                </Button>
                <Button onClick={() => setInitiativeDetailDialog(false)}>
                  Cerrar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {/* Dialog de análisis de valor con iniciativas y oportunidades */}
<Dialog open={valueAnalysisDialog} onOpenChange={setValueAnalysisDialog}>
  <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
        <TrendingUp className="h-6 w-6 text-indigo-600" />
        Análisis de Iniciativas y Valor
      </DialogTitle>
    </DialogHeader>
    
    <div className="space-y-6">
      {/* Iniciativas Trabajadas */}
      <div>
        <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <Medal className="h-5 w-5 text-green-600" />
          Iniciativas Trabajadas ({valueInitiatives.length})
        </h3>
        
        {valueInitiatives.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">
            No se encontraron iniciativas trabajadas
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {valueInitiatives.map((initiative, index) => (
              <div
                key={index}
                className="bg-gradient-to-r from-green-50 to-green-100/50 p-4 rounded-lg border border-green-200 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  setSelectedValueInitiative(initiative);
                  setValueInitiativeDetailDialog(true);
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-slate-800 text-base">
                    {initiative.title}
                  </h4>
                  {initiative.date && (
                    <Badge variant="outline" className="bg-white shrink-0 ml-2">
                      {initiative.date}
                    </Badge>
                  )}
                </div>
                
                {initiative.objective && (
                  <p className="text-sm text-slate-700 mb-2">
                    <span className="font-medium">Objetivo:</span> {initiative.objective}
                  </p>
                )}
                
                <p className="text-sm text-slate-600 line-clamp-2">
                  {initiative.description}
                </p>
                
                {initiative.area && (
                  <p className="text-xs text-slate-500 mt-2">
                    <span className="font-medium">Áreas:</span> {initiative.area}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Oportunidades Futuras */}
      <div>
        <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          Oportunidades Futuras Potenciales ({valueOpportunities.length})
        </h3>
        
        {valueOpportunities.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">
            No se encontraron oportunidades futuras
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {valueOpportunities.map((opp, index) => (
              <div
                key={index}
                className="bg-gradient-to-r from-purple-50 to-purple-100/50 p-4 rounded-lg border border-purple-200"
              >
                <h4 className="font-semibold text-slate-800 text-base mb-2">
                  {opp.opportunity}
                </h4>
                
                <p className="text-sm text-slate-700 mb-2">
                  {opp.opportunity_description}
                </p>
                
                <div className="space-y-2 mt-3">
                  <div className="bg-white/60 p-2 rounded">
                    <p className="text-xs font-medium text-slate-600 mb-1">Justificación:</p>
                    <p className="text-sm text-slate-700">{opp.justification}</p>
                  </div>
                  
                  <div className="bg-white/60 p-2 rounded">
                    <p className="text-xs font-medium text-slate-600 mb-1">Valor Futuro:</p>
                    <p className="text-sm text-slate-700">{opp.future_value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>

    <DialogFooter>
      <Button 
        variant="outline" 
        onClick={() => {
          const content = `
=== ANÁLISIS DE INICIATIVAS Y VALOR ===

INICIATIVAS TRABAJADAS (${valueInitiatives.length}):
${valueInitiatives.map((init, idx) => `
${idx + 1}. ${init.title}
   Objetivo: ${init.objective}
   Descripción: ${init.description}
   Áreas: ${init.area}
   Fecha: ${init.date}
   Valor Aportado: ${init.gartner_value}
`).join('\n')}

OPORTUNIDADES FUTURAS (${valueOpportunities.length}):
${valueOpportunities.map((opp, idx) => `
${idx + 1}. ${opp.opportunity}
   Descripción: ${opp.opportunity_description}
   Justificación: ${opp.justification}
   Valor Futuro: ${opp.future_value}
`).join('\n')}
          `.trim();
          
          navigator.clipboard.writeText(content);
          toast({
            title: 'Copiado',
            description: 'Análisis completo copiado al portapapeles',
          });
        }}
      >
        <Copy className="mr-2 h-4 w-4" />
        Copiar Todo
      </Button>
      <Button onClick={() => setValueAnalysisDialog(false)}>
        Cerrar
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

  {/* Dialog de detalle de iniciativa de valor */}
  <Dialog open={valueInitiativeDetailDialog} onOpenChange={setValueInitiativeDetailDialog}>
    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="text-xl font-bold text-slate-800">
          {selectedValueInitiative?.title}
        </DialogTitle>
      </DialogHeader>
      
      {selectedValueInitiative && (
        <div className="space-y-4">
          {/* Información General */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200">
              <h3 className="text-xs font-semibold text-slate-700 mb-1">Objetivo</h3>
              <p className="text-sm text-slate-700">
                {selectedValueInitiative.objective || 'No especificado'}
              </p>
            </div>
            
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <h3 className="text-xs font-semibold text-slate-700 mb-1">Fecha</h3>
              <p className="text-sm text-slate-700">
                {selectedValueInitiative.date || 'No especificada'}
              </p>
            </div>
          </div>

          {/* Áreas */}
          {selectedValueInitiative.area && (
            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
              <h3 className="text-xs font-semibold text-slate-700 mb-1">Áreas Involucradas</h3>
              <p className="text-sm text-slate-700">
                {selectedValueInitiative.area}
              </p>
            </div>
          )}

          {/* Descripción */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-blue-600" />
              Descripción de la Iniciativa
            </h3>
            <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {selectedValueInitiative.description}
            </div>
          </div>

          {/* Valor Aportado */}
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              Valor Aportado por Gartner
            </h3>
            <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto">
              {selectedValueInitiative.gartner_value}
            </div>
          </div>
        </div>
      )}

      <DialogFooter>
        <Button 
          variant="outline" 
          onClick={() => {
            const content = `
  INICIATIVA: ${selectedValueInitiative?.title}

  OBJETIVO: ${selectedValueInitiative?.objective || 'No especificado'}

  FECHA: ${selectedValueInitiative?.date || 'No especificada'}

  ÁREAS: ${selectedValueInitiative?.area || 'No especificadas'}

  DESCRIPCIÓN:
  ${selectedValueInitiative?.description}

  VALOR APORTADO POR GARTNER:
  ${selectedValueInitiative?.gartner_value}
            `.trim();
            
            navigator.clipboard.writeText(content);
            toast({
              title: 'Copiado',
              description: 'Iniciativa copiada al portapapeles',
            });
          }}
        >
          <Copy className="mr-2 h-4 w-4" />
          Copiar
        </Button>
        <Button onClick={() => setValueInitiativeDetailDialog(false)}>
          Cerrar
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  <AlertDialog open={followUpDialog} onOpenChange={setFollowUpDialog}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>¿Generar email de follow-up?</AlertDialogTitle>
      <AlertDialogDescription>
        La reunión se ha creado correctamente. ¿Deseas generar automáticamente un email de follow-up basado en las notas de la reunión?
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel onClick={() => setCreatedMeetingNotes('')}>
        No, gracias
      </AlertDialogCancel>
      <AlertDialogAction onClick={handleGenerateFollowUp} disabled={followUpLoading}>
        {followUpLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generando...
          </>
        ) : (
          'Sí, generar email'
        )}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>

{showFollowUpLoader && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-8 shadow-xl flex flex-col items-center gap-4">
      <Loader2 className="h-12 w-12 animate-spin text-indigo-500" />
      <p className="text-lg font-semibold text-slate-800">
        Generando email de follow-up
      </p>
      <p className="text-sm text-slate-600">
        Por favor espera mientras se analiza la reunión...
      </p>
    </div>
  </div>
)}
    </div>
  );
}