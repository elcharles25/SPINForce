  import { useState, useEffect } from 'react';
  import { useNavigate, useParams } from 'react-router-dom';
  import { db } from '@/lib/db-adapter';
  import { Button } from '@/components/ui/button';
  import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
  import { Badge } from '@/components/ui/badge';
  import { formatDateTime } from "@/utils/dateFormatter";
  import { DatePicker } from "@/components/ui/date-picker";
  import { generateFollowUpEmail } from '@/utils/followUpGenerator';
  import { Calendar } from "@/components/ui/calendar";
  import { es } from 'date-fns/locale';
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
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
  } from '@/components/ui/dialog';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import { Textarea } from '@/components/ui/textarea';
  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select';
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
  import { Switch } from '@/components/ui/switch';
  import { ArrowLeft, Plus, Pencil, Trash2, Mail, Phone, Linkedin, Sparkles, TrendingUp, ClipboardList, MessageSquare, Copy, Loader2, ImageIcon, ChevronRight, CalendarIcon } from 'lucide-react';
  import { useToast } from '@/hooks/use-toast';

  interface Opportunity {
    id: string;
    contact_id: string;
    status: string;
    proposed_solution: string;
    offer_presented: boolean;
    created_at: string;
    updated_at: string;
    last_qualification_update: string;
    qualification_initiatives?: Array<{
      priority_title: string;
      priority_challenge: string;
      priority_gartner_value: string;
      priority_cost: string;
      priority_date: string;
      priority_detail_description: string;
      initiatives: Array<{
        initiative_title: string;
        initiative_challenge: string;
        initiative_gartner_value: string;
        initiative_cost: string;
        initiative_date: string;
        initiative_detail_description: string;
        initiative_owner: string;
      }>;
    }>;
    contact: {
      first_name: string;
      last_name: string;
      organization: string;
      title: string;
      email: string;
      phone: string | null;
      linkedin_url: string | null;
      tier: string | null;
      notes: string | null;
      pa_name: string | null;
      pa_email: string | null;
      pa_phone: string | null;
      photo_url: string | null;
    };
  }

  interface Meeting {
    id: string;
    opportunity_id: string;
    contact_id: string;
    meeting_type: string;
    meeting_date: string;
    notes: string;
    feeling: string;
    created_at: string;
    contact?: {
      first_name: string;
      last_name: string;
      organization: string;
    };
  }

  interface MeetingForm {
    contact_id: string;
    meeting_type: string;
    meeting_date: string;
    notes: string;
    feeling: string;
  }

  interface OpportunityForm {
    organization: string;
    contact_id: string;
    status: string;
    solution_type: string;
    solution_mode: string;
    offer_presented: boolean;
  }

  const MEETING_TYPES = [
    { value: 'Qualification', label: 'Qualification' },
    { value: 'Cap. Alignment', label: 'Cap. Alignment' },
    { value: 'IPW', label: 'IPW' },
    { value: 'POC', label: 'POC' },
    { value: 'EP POC', label: 'EP POC' },
    { value: 'Proposal', label: 'Proposal' },
    { value: 'Telefono', label: 'Teléfono' },
  ];

  const FEELING_OPTIONS = [
    { value: 'Excelente', label: 'Excelente', color: 'bg-green-500' },
    { value: 'Bien', label: 'Bien', color: 'bg-blue-500' },
    { value: 'Neutral', label: 'Neutral', color: 'bg-yellow-500' },
    { value: 'Mal', label: 'Mal', color: 'bg-orange-500' },
    { value: 'Muy mal', label: 'Muy mal', color: 'bg-red-500' },
  ];

  const STATUS_COLORS: Record<string, string> = {
    'Abierta': 'bg-gray-100 border-gray-500 text-gray-700',
    'Qualification': 'bg-blue-50 border-blue-500 text-blue-700',
    'Capabilities': 'bg-indigo-100 border-indigo-500 text-indigo-700',
    'Propuesta': 'bg-green-100 border-green-500 text-green-700',
    'Cerrada ganada': 'bg-green-500',
    'Cerrada perdida': 'bg-black',
  };

  const STATUS_LABELS: Record<string, string> = {
    'Abierta': 'Abierta',
    'Qualification': 'Qualification',
    'Capabilities': 'Capabilities',
    'Propuesta': 'Propuesta',
    'Cerrada ganada': 'Cerrada ganada',
    'Cerrada perdida': 'Cerrada perdida',
  };

  const STATUSES = [
    { value: 'Abierta', label: 'Abierta' },
    { value: 'Qualification', label: 'Qualification' },
    { value: 'Capabilities', label: 'Capabilities' },
    { value: 'Propuesta', label: 'Propuesta' },
    { value: 'Cerrada ganada', label: 'Cerrada ganada' },
    { value: 'Cerrada perdida', label: 'Cerrada perdida' },
  ];

  const SOLUTION_TYPES = [
    'ExPv2',
    'G4CISO',
    'G4CDAO',
    'G4AIO',
    'G4EAL',
    'G4I&OL',
    'G4SWEL',
    'GTP',
    'IAS',
  ];

  const SOLUTION_MODES = ['Guided', 'Self-directed'];
  const MEETING_TYPE_ORDER = [
    'Qualification',
    'Capabilities',
    'IPW',
    'POC',
    'EP POC',
    'Proposal'
  ];

  const MEETING_TYPE_MAP: Record<string, string> = {
    'Cap. Alignment': 'Capabilities'
  };

  const PROMPT_CUALIFICACION = `En base a la información contenida en el fichero adjunto, que incluye emails y notas de reuniones realizadas durante un proceso comercial de Gartner con un prospect, realiza el siguiente análisis:

    1. Identificación y priorización de prioridades:
      - Enumera las prioridades principales del prospect, priorizándolas por orden de relevancia.
      - Para cada prioridad, verifica si se ha recopilado la siguiente información:
            1. Título: claro y conciso (máx 60 caracteres)
            2. Reto principal: Reto principal que aborda la iniciativa (máx 150 caracteres)
            3. Valor: Valor que Gartner puede aportar con sus servicios (en base a la información recopilada y al contexto que tengas de los servicios de Gartner)
            4. Coste: Coste que el prospect estima para la iniciativa 
            5. Fecha límite: Fecha límite o deadline para la entrega de la iniciativa
    2. Para cada una de las prioridades, identifica las iniciativas que el contacto haya mencionado que esté ejecutando o que vaya a ejecutar:
        - Enumera las iniciativas del prospect, priorizándolas por orden de relevancia.
        - Para cada iniciativa, verifica si se ha recopilado la siguiente información:
            1. Título: claro y conciso (máx 60 caracteres)
            2. Reto principal: Reto principal que aborda la iniciativa (máx 150 caracteres)
            3. Valor: Valor que Gartner puede aportar con sus servicios (en base a la información recopilada y al contexto que tengas de los servicios de Gartner)
            4. Coste: Coste que el prospect estima para la iniciativa 
            5. Fecha límite: Fecha límite o deadline para la entrega de la iniciativa
            6. Responsable: Responsable asignado de la iniciativa
        - Para cada punto en el que falte información, indicar: No identificada

      2. Estructura de la respuesta:
        Devuelve SOLO JSON (sin markdown):
          {
            "priorities": [
              {
                "priority_title": "Título",
                "priority_challenge": "Reto principal",
                "priority_gartner_value": "Valor",
                "priority_cost": "Coste",
                "priority_date": "Fecha límite",
                "priority_detail_description": "Descripción detallada",
                "initiatives": [
                  {
                    "initiative_title": "Título",
                    "initiative_challenge": "Reto principal",
                    "initiative_gartner_value": "Valor",
                    "initiative_cost": "Coste",
                    "initiative_date": "Fecha límite",
                    "initiative_detail_description": "Descripción detallada",
                    "initiative_owner": "Responsable",
                  }
                ]
              }
            ]
          }
          Si no hay prioridades:
          {
            "priorities": []
          }
          Si no hay iniciativas:
          {
            "initiatives": []
          }`;

  const PROMPT_PRIORIDADES_POTENCIALES = `Eres un experto en identificación de prioridades estratégicas para ejecutivos de tecnología y transformación digital.

  Analiza la siguiente información:
  - Organización: [ORGANIZATION]
  - Objetivos Corporativos de la organización: [CORPORATE_OBJECTIVES]
  - Rol del contacto: [CONTACT_ROLE]

  Basándote en:
  1. Los objetivos corporativos de la organización
  2. El rol específico del contacto
  3. Las tendencias actuales del sector
  4. Las mejores prácticas de Gartner para ese rol

  Identifica las prioridades potenciales que este contacto debería tener para contribuir a los objetivos corporativos de su organización.

  Para cada prioridad potencial, proporciona:
  1. Título: claro y conciso (máx 60 caracteres)
  2. Reto principal: Reto principal que aborda la prioridad (máx 150 caracteres)
  3. Justificación: Por qué esta prioridad es relevante dado el rol del contacto y los objetivos corporativos
  4. Valor Gartner: Cómo Gartner puede ayudar específicamente con esta prioridad
  5. Iniciativas sugeridas: 2-3 iniciativas concretas que el contacto podría ejecutar

  IMPORTANTE: Devuelve SOLO JSON (sin markdown):
  {
    "potential_priorities": [
      {
        "priority_title": "Título",
        "priority_challenge": "Reto principal",
        "justification": "Justificación de por qué es relevante",
        "priority_gartner_value": "Valor que Gartner puede aportar",
        "suggested_initiatives": [
          {
            "initiative_title": "Título iniciativa",
            "initiative_description": "Descripción"
          }
        ]
      }
    ]
  }

  Si no hay suficiente información:
  {
    "potential_priorities": []
  }`;

  export default function OpportunityDetailPage() {
    const { toast } = useToast();
    const navigate = useNavigate();
    const { id } = useParams();

    const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [contacts, setContacts] = useState<any[]>([]);
    const [filteredContacts, setFilteredContacts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [meetingDialog, setMeetingDialog] = useState(false);
    const [opportunityDialog, setOpportunityDialog] = useState(false);
    const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
    const [deleteMeetingDialog, setDeleteMeetingDialog] = useState<string | null>(null);
    const [deleteOpportunityDialog, setDeleteOpportunityDialog] = useState(false);
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [notesContent, setNotesContent] = useState('');
    const [geminiLoading, setGeminiLoading] = useState(false);
    const [geminiDialog, setGeminiDialog] = useState(false);
    const [geminiResult, setGeminiResult] = useState('');
    const [customPromptDialog, setCustomPromptDialog] = useState(false);
    const [customPrompt, setCustomPrompt] = useState('');
    const [meetingTypesCompleted, setMeetingTypesCompleted] = useState<string[]>([]);
    const [qualificationPriorities, setQualificationPriorities] = useState<Array<{
      priority_title: string;
      priority_challenge: string;
      priority_gartner_value: string;
      priority_cost: string;
      priority_date: string;
      priority_detail_description: string;
      initiatives: Array<{
        initiative_title: string;
        initiative_challenge: string;
        initiative_gartner_value: string;
        initiative_cost: string;
        initiative_date: string;
        initiative_detail_description: string;
        initiative_owner: string;
      }>;
    }>>([]);
    const [qualificationLoading, setQualificationLoading] = useState(false);
    const [calendarDate, setCalendarDate] = useState<Date>(new Date());
    const [lastQualificationUpdate, setLastQualificationUpdate] = useState<string | null>(null);
    const [selectedPriority, setSelectedPriority] = useState<any>(null);
    const [priorityDetailDialog, setPriorityDetailDialog] = useState(false);
    const [followUpDialog, setFollowUpDialog] = useState(false);
    const [createdMeetingNotes, setCreatedMeetingNotes] = useState('');
    const [followUpLoading, setFollowUpLoading] = useState(false);
    const [showFollowUpLoader, setShowFollowUpLoader] = useState(false);
    const [createdMeetingDate, setCreatedMeetingDate] = useState(''); 
    const [potentialPrioritiesLoading, setPotentialPrioritiesLoading] = useState(false);
    const [potentialPriorities, setPotentialPriorities] = useState<Array<{
      priority_title: string;
      priority_challenge: string;
      justification: string;
      priority_gartner_value: string;
      suggested_initiatives: Array<{
        initiative_title: string;
        initiative_description: string;
      }>;
    }>>([]);
    const [potentialPriorityDialog, setPotentialPriorityDialog] = useState(false);
    const [selectedPotentialPriority, setSelectedPotentialPriority] = useState<any>(null);
    const [potentialPriorityDetailDialog, setPotentialPriorityDetailDialog] = useState(false);

    const [meetingForm, setMeetingForm] = useState<MeetingForm>({
      contact_id: '',
      meeting_type: '',
      meeting_date: '',
      feeling: '',
      notes: '',
    });

    const [opportunityForm, setOpportunityForm] = useState<OpportunityForm>({
      organization: '',
      contact_id: '',
      status: 'Abierta',
      solution_type: '',
      solution_mode: '',
      offer_presented: false,
    });

    const generateNotesFile = (meetings: Meeting[]): string => {
      let content = '=== HISTORIAL COMPLETO DE INTERACCIONES ===\n\n';
      content += `Total de interacciones: ${meetings.length}\n`;
      content += `Rango de fechas: ${meetings.length > 0 ? formatDateTime(meetings[meetings.length - 1].meeting_date) : 'N/A'} - ${meetings.length > 0 ? formatDateTime(meetings[0].meeting_date) : 'N/A'}\n\n`;

      const sortedMeetings = [...meetings].sort((a, b) =>
        new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime()
      );

      sortedMeetings.forEach((meeting, index) => {
        content += `\n${'='.repeat(80)}\n`;
        content += `INTERACCIÓN ${index + 1} DE ${sortedMeetings.length}\n`;
        content += `${'='.repeat(80)}\n`;
        content += `Tipo: ${meeting.meeting_type}\n`;
        content += `Fecha: ${formatDateTime(meeting.meeting_date)}\n`;
        content += `Sensación: ${meeting.feeling}\n`;
        content += `\nContenido:\n${'-'.repeat(80)}\n`;
        content += `${meeting.notes || 'Sin notas'}\n`;
      });

      content += `\n${'='.repeat(80)}\n`;
      content += `FIN DEL HISTORIAL\n`;
      content += `${'='.repeat(80)}\n`;

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

    useEffect(() => {
      if (id) {
        loadData();
      }
    }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [oppData, meetingsData, contactsData] = await Promise.all([
        db.getOpportunity(id!),
        db.getMeetingsByOpportunity(id!),
        db.getContacts(),
      ]);

      if (oppData && oppData.contact_id) {
        const fullContact = await db.getContact(oppData.contact_id);
        oppData.contact = fullContact;
      }

      setOpportunity(oppData);
      setMeetings(meetingsData);
      setContacts(contactsData);
      
      if (oppData?.qualification_initiatives) {
        setQualificationPriorities(oppData.qualification_initiatives);
        setLastQualificationUpdate(oppData.last_qualification_update);
      }

      const filteredMeetings = meetingsData.filter(
        (meeting: Meeting) => 
          meeting.meeting_type !== 'Email' && 
          meeting.meeting_type !== 'Teléfono'
      );
      
      const uniqueTypes = [...new Set(filteredMeetings.map((m: Meeting) => m.meeting_type))];
      const mappedTypes = uniqueTypes.map(type => MEETING_TYPE_MAP[type as string] || type);
      setMeetingTypesCompleted(mappedTypes as string[]);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzePotentialPriorities = async () => {
    if (!opportunity?.contact_id) {
      toast({
        title: 'Sin información',
        description: 'No se pudo obtener la información del contacto',
        variant: 'destructive',
      });
      return;
    }

    setPotentialPrioritiesLoading(true);
    try {
      console.log('📊 Iniciando análisis de prioridades potenciales...');

      // Obtener objetivos corporativos de la cuenta
      const accountsData = await db.getAccounts();
      const account = accountsData.find((acc: any) => acc.name === opportunity.contact.organization);
      
      let corporateObjectives = 'No se han identificado objetivos corporativos específicos para esta organización.';
      
      if (account?.corporative_objectives) {
        try {
          const parsed = JSON.parse(account.corporative_objectives);
          if (parsed.objectives && parsed.objectives.length > 0) {
            corporateObjectives = parsed.objectives.map((obj: any) => 
              `- ${obj.title}: ${obj.description}`
            ).join('\n');
          }
        } catch (error) {
          console.error('Error parseando objetivos corporativos:', error);
        }
      }

      const prompt = PROMPT_PRIORIDADES_POTENCIALES
        .replace('[ORGANIZATION]', opportunity.contact.organization)
        .replace('[CORPORATE_OBJECTIVES]', corporateObjectives)
        .replace('[CONTACT_ROLE]', opportunity.contact.title);

      const result = await analyzeWithGemini('', prompt);

      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No se pudo extraer JSON de la respuesta');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const extractedPriorities = parsed.potential_priorities || [];

      setPotentialPriorities(extractedPriorities);
      setPotentialPriorityDialog(true);

      toast({
        title: 'Análisis completado',
        description: `Se identificaron ${extractedPriorities.length} prioridad(es) potencial(es)`,
      });
    } catch (error) {
      console.error('Error analizando prioridades potenciales:', error);

      let errorMessage = 'Error al analizar prioridades potenciales';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setPotentialPrioritiesLoading(false);
    }
  };

    const handleAnalyzeQualification = async () => {
      if (meetings.length === 0) {
        toast({
          title: 'Sin información',
          description: 'No hay reuniones registradas para analizar',
          variant: 'destructive',
        });
        return;
      }

      setQualificationLoading(true);
      try {
        console.log('📊 Iniciando análisis de cualificación...');

        const notesContent = generateNotesFile(meetings);
        console.log(`📄 Archivo generado: ${notesContent.length} caracteres, ${meetings.length} interacciones`);

        const result = await analyzeWithGemini(notesContent, PROMPT_CUALIFICACION);

        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No se pudo extraer JSON de la respuesta');
        }

        const parsed = JSON.parse(jsonMatch[0]);
        const extractedPriorities = parsed.priorities || [];

        setQualificationPriorities(extractedPriorities);
        setLastQualificationUpdate(new Date().toISOString());

        try {
          await db.updateOpportunity(id!, {
            contact_id: opportunity!.contact_id,
            status: opportunity!.status,
            proposed_solution: opportunity!.proposed_solution,
            offer_presented: opportunity!.offer_presented,
            qualification_initiatives: extractedPriorities,
            last_qualification_update: new Date().toISOString()
          });
          console.log('💾 Prioridades guardadas en base de datos');
        } catch (dbError) {
          console.error('Error guardando en BD:', dbError);
        }

        const totalInitiatives = extractedPriorities.reduce((sum: number, priority: any) => 
          sum + (priority.initiatives?.length || 0), 0
        );

        toast({
          title: 'Análisis completado',
          description: `Se encontraron ${extractedPriorities.length} prioridad(es) con ${totalInitiatives} iniciativa(s)`,
        });
      } catch (error) {
        console.error('Error analizando cualificación:', error);

        let errorMessage = 'Error al analizar cualificación';
        if (error instanceof Error) {
          errorMessage = error.message;
        }

        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      } finally {
        setQualificationLoading(false);
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
        console.log('📊 Iniciando análisis personalizado...');

        const basePrompt = `En base a la información del fichero adjunto, que son emails y notas de reuniones de un comercial de la empresa Gartner con un cliente/prospect, ${customPrompt}`;

        const notesContent = generateNotesFile(meetings);
        console.log(`📄 Archivo generado: ${notesContent.length} caracteres, ${meetings.length} interacciones`);

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

  const handleGenerateFollowUp = async () => {
    if (!createdMeetingNotes || !opportunity) {
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
        opportunity.contact.first_name,
        opportunity.contact.email,
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

    const openEditDialog = () => {
      if (!opportunity) return;

      const proposedSolution = opportunity.proposed_solution || '';
      const parts = proposedSolution.split(' - ');
      const solution_type = parts[0] || '';
      const solution_mode = parts[1] || '';

      setOpportunityForm({
        organization: opportunity.contact.organization,
        contact_id: opportunity.contact_id,
        status: opportunity.status,
        solution_type: solution_type,
        solution_mode: solution_mode,
        offer_presented: opportunity.offer_presented,
      });

      const filtered = contacts.filter(c => c.organization === opportunity.contact.organization);
      setFilteredContacts(filtered);

      setOpportunityDialog(true);
    };

    const handleOrganizationChange = (organization: string) => {
      setOpportunityForm({ ...opportunityForm, organization, contact_id: '' });
      const filtered = contacts.filter(c => c.organization === organization);
      setFilteredContacts(filtered);
    };

    const handleSaveOpportunity = async () => {
      if (!opportunityForm.contact_id) {
        toast({
          title: 'Campo requerido',
          description: 'Debes seleccionar un contacto',
          variant: 'destructive',
        });
        return;
      }

      if (!opportunityForm.solution_type || !opportunityForm.solution_mode) {
        toast({
          title: 'Campos requeridos',
          description: 'Debes seleccionar el tipo y modo de solución',
          variant: 'destructive',
        });
        return;
      }

      const proposed_solution = `${opportunityForm.solution_type} - ${opportunityForm.solution_mode}`;

      const payload = {
        contact_id: opportunityForm.contact_id,
        status: opportunityForm.status,
        proposed_solution: proposed_solution,
        offer_presented: opportunityForm.offer_presented,
      };

      try {
        await db.updateOpportunity(id!, payload);
        toast({
          title: 'Éxito',
          description: 'Oportunidad actualizada correctamente',
        });
        setOpportunityDialog(false);
        await loadData();
      } catch (error) {
        console.error('Error guardando oportunidad:', error);
        toast({
          title: 'Error',
          description: 'Error al guardar la oportunidad',
          variant: 'destructive',
        });
      }
    };

    const handleDeleteOpportunity = async () => {
      if (!opportunity) return;

      try {
        await db.deleteOpportunity(opportunity.id);

        try {
          const contact = await db.getContact(opportunity.contact_id);
          const updatedContact = {
            ...contact,
            contact_type: 'Prospect'
          };
          await db.updateContact(opportunity.contact_id, updatedContact);
        } catch (contactError) {
          console.error('Error actualizando tipo de contacto:', contactError);
        }

        toast({
          title: 'Éxito',
          description: 'Oportunidad eliminada y contacto actualizado a Prospect',
        });

        navigate('/opportunities');
      } catch (error) {
        console.error('Error eliminando oportunidad:', error);
        toast({
          title: 'Error',
          description: 'No se pudo eliminar la oportunidad',
          variant: 'destructive',
        });
      }
    };

  const handleOpenMeetingDialog = (meeting?: Meeting) => {
    if (meeting) {
      setEditingMeeting(meeting);
      const dateStr = meeting.meeting_date.split(' ')[0].split('/').reverse().join('-');
      setMeetingForm({
        contact_id: meeting.contact_id || '',
        meeting_type: meeting.meeting_type,
        meeting_date: dateStr,
        notes: meeting.notes || '',
        feeling: meeting.feeling || '',
      });
    } else {
      setEditingMeeting(null);
      if (!opportunity?.contact_id) {
        toast({
          title: 'Error',
          description: 'No se pudo obtener el contacto de la oportunidad',
          variant: 'destructive',
        });
        return;
      }
      setMeetingForm({
        contact_id: opportunity.contact_id,
        meeting_type: '',
        meeting_date: '',
        notes: '',
        feeling: '',
      });
    }
    setMeetingDialog(true);
  };

  const handleSaveMeeting = async () => {
    if (!meetingForm.meeting_type || !meetingForm.meeting_date || !meetingForm.contact_id) {
      alert('Tipo, fecha y contacto son requeridos');
      return;
    }

    try {
      // Determinar si la reunión es futura
      const meetingDate = new Date(meetingForm.meeting_date);
      meetingDate.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isFuture = meetingDate > today;

      const meetingData = {
        opportunity_id: id!,
        contact_id: meetingForm.contact_id,
        meeting_type: meetingForm.meeting_type,
        meeting_date: meetingForm.meeting_date,
        notes: meetingForm.notes,
        feeling: isFuture ? null : meetingForm.feeling,  // null si es futura
      };

      if (editingMeeting) {
        await db.updateMeeting(editingMeeting.id, meetingData);
        await loadData();
        setMeetingDialog(false);
      } else {
        await db.createMeeting(meetingData);
        await loadData();
        setMeetingDialog(false);
        
        // Solo preguntar por follow-up si la reunión es pasada o de hoy Y tiene notas
        if (!isFuture && meetingForm.notes && meetingForm.notes.trim()) {
          setCreatedMeetingNotes(meetingForm.notes);
          setCreatedMeetingDate(meetingForm.meeting_date);
          setFollowUpDialog(true);
        }
      }
    } catch (error) {
      console.error('Error guardando reunión:', error);
      alert('Error al guardar la reunión');
    }
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

    const getFeelingColor = (feeling: string) => {
      const option = FEELING_OPTIONS.find(f => f.value === feeling);
      return option?.color || '';
    };

    const getFeelingLabel = (feeling: string) => {
      const option = FEELING_OPTIONS.find(f => f.value === feeling);
      return option?.label || feeling;
    };
    const getMeetingDates = (): Date[] => {
    return meetings.map(meeting => {
      const dateStr = meeting.meeting_date.split(' ')[0];
      if (dateStr.includes('/')) {
        const [day, month, year] = dateStr.split('/');
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else {
        return new Date(dateStr);
      }
    });
  };

  const getPastMeetingDates = (): Date[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return getMeetingDates().filter(date => date <= today);
  };

  const getFutureMeetingDates = (): Date[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return getMeetingDates().filter(date => date > today);
  };

  const getMeetingsForDate = (date: Date): Meeting[] => {
    return meetings.filter(meeting => {
      const meetingDate = new Date(meeting.meeting_date);
      // Comparar solo año, mes y día (sin horas)
      return (
        meetingDate.getFullYear() === date.getFullYear() &&
        meetingDate.getMonth() === date.getMonth() &&
        meetingDate.getDate() === date.getDate()
      );
    });
  };

  const handleDateClick = (date: Date | undefined) => {
    if (!date) return;
    
    const meetingsOnDate = getMeetingsForDate(date);
    
    if (meetingsOnDate.length > 0) {
      toast({
        title: 'Reuniones en esta fecha',
        description: `${meetingsOnDate.length} reunión(es) registrada(s)`,
      });
    } else {
      if (!opportunity?.contact_id) {
        toast({
          title: 'Error',
          description: 'No se pudo obtener el contacto de la oportunidad',
          variant: 'destructive',
        });
        return;
      }
      
      // Formatear fecha correctamente sin cambio de zona horaria
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      // ⭐ ESTABLECER TODOS LOS CAMPOS EXPLÍCITAMENTE
      setMeetingForm({
        contact_id: opportunity.contact_id,  // ⭐ Explícitamente desde opportunity
        meeting_type: '',
        meeting_date: dateStr,
        notes: '',
        feeling: '',
      });
      setEditingMeeting(null);
      setMeetingDialog(true);
    }
  };
    if (loading) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="text-lg">Cargando...</div>
        </div>
      );
    }

    if (!opportunity) {
      return (
        <div className="container mx-auto py-8 px-4">
          <p>Oportunidad no encontrada</p>
        </div>
      );
    }

    const hasPriorities = (qualificationPriorities?.length ?? 0) > 0;

    //const foundGartnerValue = initiative.initiative_gartner_value ?? '';
    //const isNoIdentificado = /^\s*no identificad[oa]\.?\s*$/i.test(foundGartnerValue);


    return (
      <div className="container mx-auto py-6 px-4">
        <Button
          variant="ghost"
          onClick={() => navigate('/opportunities')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a Oportunidades
        </Button>
        {/* HEADER CON FOTO Y DATOS DEL CONTACTO */}
        <div className="flex gap-6 mb-1">
          {/* FOTO DEL CONTACTO */}
          <div className="h-20 aspect-[6/7] overflow-hidden">
            <Card className="shadow-sm rounded-2xl h-full">
              <CardContent className="p-0 h-full">
                <div
                  className={
                    `relative w-full h-full overflow-hidden 
                    ${opportunity.contact.photo_url 
                        ? 'rounded-2xl'
                        : `rounded-2xl border-2 border-dashed 
                          transition-colors hover:border-indigo-400 hover:bg-indigo-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500`
                    }`
                  }
                >
                  {opportunity.contact.photo_url ? (
                    <>
                      <img
                        src={`http://localhost:3001${opportunity.contact.photo_url}?t=${Date.now()}`}
                        alt={`${opportunity.contact.first_name} ${opportunity.contact.last_name}`}
                        className="absolute inset-0 w-full h-full object-cover"
                        key={opportunity.contact.photo_url}
                      />
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                          <ImageIcon className="h-3 w-3" />
                          <p className="text-xs text-center px-1">
                            Pega o arrastra una imagen
                          </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        <div className="flex-1"> 
            <div className="flex justify-between items-start mb-1">
              <div className="flex items-center gap-10">
                <h1 className="text-3xl font-bold text-slate-800">
                  Oportunidad: {opportunity.contact.first_name} {opportunity.contact.last_name}
                </h1>
                {opportunity.contact.tier && (
                  <span
                    className={`w-20 h-10 rounded-full flex items-center text-white justify-center text-lg font-bold shadow-md ${opportunity.contact.tier === "1" ? "tier-1" :
                      opportunity.contact.tier === "2" ? "tier-2" :
                        "tier-3"
                      }`}
                  >
                    Tier {opportunity.contact.tier}
                  </span>
                )}
              </div>
              <Button
                variant="outline"
                className="rounded-full shadow-sm hover:shadow-md transition-shadow hover:bg-indigo-100"
                onClick={openEditDialog}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Button>
            </div>

            <p className="text-xl text-slate-600 mb-6">
              {opportunity.contact.title} - {opportunity.contact.organization}
            </p>
          </div>
      </div>
      
      <div>
        <div className="flex items-center justify-center mb-6">
          {MEETING_TYPE_ORDER.map((type, index) => {
            const isCompleted = meetingTypesCompleted.includes(type);
            const isFirst = index === 0;
            
            return (
              <div
                key={type}
                className={`relative text-white text-[8px] font-medium px-1.5 py-0.5 flex items-center justify-center w-full ${
                  isCompleted ? 'bg-indigo-300' : 'bg-gray-400'
                } ${isFirst ? '' : '-ml-2'}`}
                style={{
                  clipPath: isFirst 
                    ? 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)'
                    : 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%)',
                  height: '40px',
                  padding: '0 10px',
                  zIndex: MEETING_TYPE_ORDER.length - index
                }}
              >
                <span className="whitespace-nowrap font-semibold text-[15px]">{type}</span>
              </div>
            );
          })}
        </div>
      </div>

        <div className="grid grid-cols-12 gap-6 mb-6">
          <Card className="border-gray-200 shadow-sm rounded-2xl col-span-4">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">   
                <CardTitle className="text-lg font-semibold text-slate-800">Información de Contacto</CardTitle>
                <Badge
                  className="text-xs text-slate-500 px-3 py-1 rounded-full font-medium shadow-sm border-slate-400 bg-slate-50 hover:bg-slate-300 hover:text-slate-600 hover:border-slate-600 cursor-pointer"  
                  onClick={() => {navigate(`/contacts/${opportunity.contact_id}`);
                  }}
                >
                  Ver Contacto
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Nombre:</span>{' '}
                {opportunity.contact.first_name} {opportunity.contact.last_name}
              </div>
              <div>
                <span className="font-medium">Organización:</span>{' '}
                {opportunity.contact.organization}
              </div>
              <div>
                <span className="font-medium">Rol:</span>{' '}
                {opportunity.contact.title}
              </div>

              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-600" />
                <a href={`mailto:${opportunity.contact.email}`} className="text-blue-600 hover:underline truncate">
                  {opportunity.contact.email}
                </a>
              </div>
              {opportunity.contact.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-blue-600" />
                  <a href={`tel:${opportunity.contact.phone}`} className="text-blue-600 hover:underline">
                    {opportunity.contact.phone}
                  </a>
                </div>
              )}
              {opportunity.contact.linkedin_url && (
                <div className="flex items-center gap-2">
                <a  
                    href={opportunity.contact.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-blue-600 hover:text-blue-800 gap-2"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                    Ver perfil LinkedIn
                  </a>
                </div>
              )}

              {(opportunity.contact.pa_name || opportunity.contact.pa_email || opportunity.contact.pa_phone) && (
                <div className="pt-3 mt-3 border-t border-gray-200">
                  <p className="font-semibold text-slate-700 mb-1">Personal Assistant</p>
                  {opportunity.contact.pa_name && (
                    <p className="text-slate-600 mb-1">{opportunity.contact.pa_name}</p>
                  )}
                  {opportunity.contact.pa_email && (
                    <a 
                      href={`mailto:${opportunity.contact.pa_email}`}
                      className="text-blue-600 hover:underline flex items-center gap-2"
                    >
                      <Mail className="h-4 w-4" />
                      {opportunity.contact.pa_email}
                    </a>
                  )}
                  {opportunity.contact.pa_phone && (
                    <a 
                      href={`tel:${opportunity.contact.pa_phone}`}
                      className="text-blue-600 hover:underline flex items-center gap-2"
                    >
                      <Phone className="h-4 w-4" />
                      {opportunity.contact.pa_phone}
                    </a>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="col-span-5 bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200 shadow-sm rounded-2xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold text-slate-800">Notas sobre el cliente</CardTitle>
                {!opportunity.contact.notes && !isEditingNotes ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setNotesContent('');
                      setIsEditingNotes(true);
                    }}
                    className="bg-white hover:bg-amber-100 border-amber-300 rounded-full hover:text-slate-800"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Añadir notas
                  </Button>
                ) : !isEditingNotes ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setNotesContent(opportunity.contact.notes || '');
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
                      className="hover:bg-amber-200/50 hover:text-slate-800"
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          const contact = await db.getContact(opportunity.contact_id);
                          const updatedContact = {
                            ...contact,
                            notes: notesContent.trim() || null
                          };
                          await db.updateContact(opportunity.contact_id, updatedContact);

                          setOpportunity({
                            ...opportunity,
                            contact: {
                              ...opportunity.contact,
                              notes: notesContent.trim() || null
                            }
                          });

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
                opportunity.contact.notes ? (
                  <div className="text-sm text-slate-700 leading-relaxed max-h-[180px] overflow-y-auto">
                    {opportunity.contact.notes}
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

          <Card className="col-span-3 border-gray-200 shadow-sm rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-slate-800">Información de Oportunidad</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="font-medium">Estado:</span>{' '}
                <Badge className={STATUS_COLORS[opportunity.status] || 'bg-gray-500'}>
                  {STATUS_LABELS[opportunity.status] || opportunity.status}
                </Badge>
              </div>
              <div>
                <span className="font-medium">Oferta Presentada:</span>{' '}
                <Badge variant={opportunity.offer_presented ? 'default' : 'secondary'}>
                  {opportunity.offer_presented ? 'Sí' : 'No'}
                </Badge>
              </div>
              <div>
                <span className="font-medium">Interacciones:</span> {meetings.length}
              </div>

              {opportunity.proposed_solution && (
                <div className="pt-3 mt-3 border-t border-gray-200">
                  <p className="font-semibold text-slate-700 mb-2">Solución Propuesta:</p>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">
                    {opportunity.proposed_solution}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6 bg-gradient-to-br from-indigo-50/20 to-indigo-100/50 border-indigo-200 shadow-sm rounded-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800">
              <Sparkles className="h-5 w-5 text-indigo-500" />
              Análisis con IA (Gemini)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6">
              <div className="flex flex-col h-full gap-3">
                <h3 className="text-base font-semibold text-slate-700 mb-3">Prompts para Account Executive</h3>
                <Button
                  onClick={handleAnalyzePotentialPriorities}
                  disabled={geminiLoading || qualificationLoading || potentialPrioritiesLoading || meetings.length > 0}
                  className="w-full h-full flex flex-col items-center justify-center bg-white hover:bg-indigo-50 text-slate-700 border border-indigo-200 shadow-sm"
                  variant="outline"
                >
                  {potentialPrioritiesLoading ? (
                    <Loader2 className="h-5 w-5 mb-1 animate-spin text-indigo-500" />
                  ) : (
                    <MessageSquare className="h-5 w-5 mb-[-5px] text-indigo-500" />
                  )}
                  <div className="text-center">
                    <p className="text-sm">Identificar potenciales prioridades</p>
                    <p className="text-xs italic text-slate-500">(análisis preliminar en base a Objetivos Corporativos y al rol)</p>
                  </div>
                </Button>
                <Button
                  onClick={() => setCustomPromptDialog(true)}
                  disabled={geminiLoading || qualificationLoading || meetings.length === 0}
                  className="w-full h-full flex flex-col items-center justify-center bg-white hover:bg-indigo-50 text-slate-700 border border-indigo-200 shadow-sm"
                  variant="outline"
                >
                  {geminiLoading ? (
                    <Loader2 className="h-5 w-5 mb-1 animate-spin text-indigo-500" />
                  ) : (
                    <MessageSquare className="h-5 w-5 mb-[-5px] text-indigo-500" />
                  )}
                  <span className="text-sm text-center">Pregunta cualquier cosa sobre la oportunidad</span>
                </Button>

                {meetings.length === 0 && (
                  <p className="text-xs text-slate-500 mt-2">
                    Necesitas tener reuniones registradas para usar el análisis con IA
                  </p>
                )}
              </div>

              <div className="border-l border-indigo-200 pl-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold text-slate-700">
                    Prioridades del Prospect (PACT)
                  </h3>

                  <div className="flex items-center gap-2">
                    {lastQualificationUpdate && hasPriorities && (
                      <p className="text-xs italic text-slate-500">
                        Última actualización: {new Date(lastQualificationUpdate).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </p>
                    )}
                    {hasPriorities && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleAnalyzeQualification}
                        disabled={qualificationLoading || meetings.length === 0}
                        className="hover:bg-indigo-100"
                      >
                        {qualificationLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                  {qualificationPriorities.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-sm text-slate-500 mb-2">
                        No hay prioridades analizadas
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleAnalyzeQualification}
                        disabled={qualificationLoading || meetings.length === 0}
                        className="bg-white hover:bg-indigo-50 border-indigo-200 h-14"
                      >
                        {qualificationLoading ? (
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="mr-2 h-3 w-3 text-indigo-500" />
                        )}
                        <div className="text-center">
                          <p className="text-sm">Cualificar Prioridades del prospect (PACT)</p>
                          <p className="text-xs italic text-slate-500">(en base a las reuniones mantenidas)</p>
                      </div>
                      </Button>
                    </div>
                  ) : (
                    qualificationPriorities.map((priority, index) => (
                      <div
                        key={index}
                        className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer"
                        onClick={() => {
                          setSelectedPriority(priority);
                          setPriorityDetailDialog(true);
                        }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="text-sm font-medium text-slate-800 line-clamp-2 flex-1">
                            {priority.priority_title}
                          </h4>
                          <div className="flex items-center gap-2 shrink-0">
                            {priority.priority_date && (
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  priority.priority_date === "Fecha límite no identificada" 
                                    ? "border-red-500 text-red-700 dark:text-red-400" 
                                    : ""
                                }`}
                              >
                                {priority.priority_date}
                              </Badge>
                            )}
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          </div>
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-2 mb-2">
                          {priority.priority_challenge}
                        </p>
                        {priority.initiatives && priority.initiatives.length > 0 && (
                          <div className="flex items-center gap-1 text-xs text-indigo-600">
                            <ClipboardList className="h-3 w-3" />
                            <span>{priority.initiatives.length} iniciativa(s)</span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6 border-gray-200 shadow-sm rounded-2xl">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg font-semibold text-slate-800">Interacciones ({meetings.length})</CardTitle>
              <Button
                className="rounded-full shadow-sm hover:shadow-md transition-shadow bg-indigo-500 hover:bg-indigo-600"
                onClick={() => handleOpenMeetingDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Reunión
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
              {/* Tabla de reuniones */}
              <div>
                {meetings.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    No hay reuniones registradas
                  </p>
                ) : (
                  <div className="bg-card rounded-lg shadow overflow-hidden overflow-x-auto">
                    <Table className="w-full table-fixed">
                      <colgroup>
                        <col className="w-[100px]" />
                        <col className="w-[120px]" />
                        <col className="w-[120px]" />
                        <col className="w-[600px]" />
                      </colgroup>
                      <TableHeader>
                        <TableRow className="bg-muted hover:bg-muted/50">
                          <TableHead className="text-center">Fecha</TableHead>
                          <TableHead className="text-center">Tipo</TableHead>
                          <TableHead className="text-center">Feeling</TableHead>
                          <TableHead className="text-center">Notas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {meetings.map((meeting) => {
                          const contact = contacts.find(c => c.id === meeting.contact_id);
                          return (
                            <TableRow
                              key={meeting.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => navigate(`/meetings/${meeting.id}`, {
                                state: { from: 'opportunity', opportunityId: opportunity.id }
                              })}
                            >
                              <TableCell className="text-center">{formatDateTime(meeting.meeting_date)}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className="text-sm">{meeting.meeting_type}</Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex text-center justify-center gap-2">
                                  <div className={`w-4 h-4 rounded-full ${getFeelingColor(meeting.feeling)}`} />
                                  <span className="text-sm text-center">{getFeelingLabel(meeting.feeling)}</span>
                                </div>
                              </TableCell>
                              <TableCell className="max-w-md truncate">
                                {meeting.notes || 'Sin notas'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
              {/* Calendario */}
              <div className="flex flex-col items-center justify-start">
                <div className="border rounded-lg p-4 bg-white">
                  <Calendar
                    mode="single"
                    selected={undefined}
                    onSelect={(date) => date && setCalendarDate(date)}
                    onDayClick={handleDateClick}
                    locale={es}
                    initialFocus
                    captionLayout="dropdown-buttons"
                    fromYear={2020}  
                    toYear={2040}    
                    classNames={{
                      caption: "flex justify-center pt-1 relative items-center",
                      caption_dropdowns: "flex items-center gap-0",
                      // Estas 3 claves dependen de react-day-picker v9:
                      dropdown: "bg-transparent px-1 py-0 text-sm text-foreground",
                      dropdown_month: "bg-transparent px-1 py-0 text-sm text-foreground",
                      dropdown_year: "bg-transparent px-2 py-0 text-sm text-foreground",
              }}
                    modifiers={{
                      pastMeeting: getPastMeetingDates(),
                      futureMeeting: getFutureMeetingDates(),
                    }}
                    modifiersClassNames={{
                      pastMeeting: 'bg-indigo-200 text-indigo-900 font-bold hover:bg-indigo-300',
                      futureMeeting: 'bg-green-200 text-green-900 font-bold hover:bg-green-300',
                    }}
                  />
                </div>
                
                <div className="mt-4 flex flex-col gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-indigo-200 border border-indigo-500"></div>
                    <span>Reuniones pasadas</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-green-200 border border-green-500"></div>
                    <span>Reuniones futuras</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Haz clic en un día vacío para agendar una reunión
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Dialog open={opportunityDialog} onOpenChange={setOpportunityDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Oportunidad</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Organización *</Label>
                <Select
                  value={opportunityForm.organization}
                  onValueChange={handleOrganizationChange}
                  disabled={contacts.length === 0}
                >
                  <SelectTrigger className={!opportunityForm.organization ? "border-red-500" : ""}>
                    <SelectValue
                      placeholder={
                        contacts.length === 0
                          ? 'No hay organizaciones disponibles'
                          : 'Selecciona una organización'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {[...new Set(contacts.map(c => c.organization))].sort().map((org) => (
                      <SelectItem key={org} value={org}>
                        {org}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Contacto *</Label>
                <Select
                  value={opportunityForm.contact_id}
                  onValueChange={(value) => setOpportunityForm({ ...opportunityForm, contact_id: value })}
                  disabled={!opportunityForm.organization || filteredContacts.length === 0}
                >
                  <SelectTrigger className={!opportunityForm.contact_id ? "border-red-500" : ""}>
                    <SelectValue
                      placeholder={
                        !opportunityForm.organization
                          ? 'Primero selecciona una organización'
                          : filteredContacts.length === 0
                            ? 'No hay contactos disponibles'
                            : 'Selecciona un contacto'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredContacts
                      .sort((a, b) =>
                        `${a.first_name} ${a.last_name}`.localeCompare(
                          `${b.first_name} ${b.last_name}`
                        )
                      )
                      .map((contact) => (
                        <SelectItem key={contact.id} value={contact.id}>
                          {contact.first_name} {contact.last_name} ({contact.title})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Estado *</Label>
                <Select
                  value={opportunityForm.status}
                  onValueChange={(value) => setOpportunityForm({ ...opportunityForm, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Solución Propuesta *</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Select
                      value={opportunityForm.solution_type}
                      onValueChange={(value) => setOpportunityForm({ ...opportunityForm, solution_type: value })}
                    >
                      <SelectTrigger className={!opportunityForm.solution_type ? "border-red-500" : ""}>
                        <SelectValue placeholder="Tipo de solución" />
                      </SelectTrigger>
                      <SelectContent>
                        {SOLUTION_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Select
                      value={opportunityForm.solution_mode}
                      onValueChange={(value) => setOpportunityForm({ ...opportunityForm, solution_mode: value })}
                    >
                      <SelectTrigger className={!opportunityForm.solution_mode ? "border-red-500" : ""}>
                        <SelectValue placeholder="Modo" />
                      </SelectTrigger>
                      <SelectContent>
                        {SOLUTION_MODES.map((mode) => (
                          <SelectItem key={mode} value={mode}>
                            {mode}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={opportunityForm.offer_presented}
                  onCheckedChange={(checked) => setOpportunityForm({ ...opportunityForm, offer_presented: checked })}
                />
                <Label>Oferta presentada</Label>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="destructive"
                onClick={() => setDeleteOpportunityDialog(true)}
                className="mr-auto rounded-full"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="rounded-full"
                  onClick={() => setOpportunityDialog(false)}>
                  Cancelar
                </Button>
                <Button 
                  className="rounded-full shadow-sm hover:shadow-md transition-shadow bg-indigo-500 hover:bg-indigo-600"
                  onClick={handleSaveOpportunity}>
                  Actualizar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={deleteOpportunityDialog}
          onOpenChange={setDeleteOpportunityDialog}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar oportunidad?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. El contacto volverá a ser Prospect.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteOpportunity}>
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={meetingDialog} onOpenChange={setMeetingDialog}>
          <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingMeeting ? 'Editar Reunión' : 'Nueva Reunión'}
              </DialogTitle>
            </DialogHeader>
            {/* ⭐ Agregar esto para debug - puedes quitarlo después */}
            {!editingMeeting && (
              <div className="text-xs text-slate-500 mb-2">
                Contacto: {meetingForm.contact_id || '⚠️ NO ESTABLECIDO'}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="meeting_type">Tipo de Reunión *</Label>
                <Select
                  value={meetingForm.meeting_type}
                  onValueChange={(value) => setMeetingForm({ ...meetingForm, meeting_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {MEETING_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="meeting_date">Fecha *</Label>
                <DatePicker
                  value={meetingForm.meeting_date}
                  onChange={(date) => setMeetingForm({ ...meetingForm, meeting_date: date })}
                />
              </div>

              {/* Solo mostrar sensación si la fecha es pasada o de hoy */}
              {(() => {
                if (!meetingForm.meeting_date) return null;
                const meetingDate = new Date(meetingForm.meeting_date);
                meetingDate.setHours(0, 0, 0, 0);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                if (meetingDate > today) return null;
                
                return (
                  <div>
                    <Label htmlFor="feeling">Sensación de la Reunión</Label>
                    <Select
                      value={meetingForm.feeling}
                      onValueChange={(value) => setMeetingForm({ ...meetingForm, feeling: value })}
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
                );
              })()}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                value={meetingForm.notes}
                onChange={(e) =>
                  setMeetingForm({ ...meetingForm, notes: e.target.value })
                }
                rows={30}
                placeholder="Notas de la reunión..."
              />
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                className="rounded-full"
                onClick={() => setMeetingDialog(false)}>
                Cancelar
              </Button>
              <Button 
                className="rounded-full shadow-sm hover:shadow-md transition-shadow bg-indigo-500 hover:bg-indigo-600"
                onClick={handleSaveMeeting}>
                {editingMeeting ? 'Actualizar' : 'Crear'}
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
              <DialogTitle>Prompt personalizado</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Tu pregunta personalizada:</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  El prompt comenzará con: "En base a la información de las interacciones, que son emails y notas de reuniones de un comercial de Gartner..."
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

        <Dialog open={priorityDetailDialog} onOpenChange={setPriorityDetailDialog}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-slate-800">
                Prioridad: {selectedPriority?.priority_title}
              </DialogTitle>
            </DialogHeader>

            {selectedPriority && (
              <div className="space-y-3">
                {selectedPriority.priority_detail_description && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-blue-600" />
                      Descripción detallada de la Prioridad
                    </h3>
                    <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                      {selectedPriority.priority_detail_description}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h3 className="text-xs font-semibold text-slate-700 mb-1">Reto principal</h3>
                    <p className="text-sm text-slate-700">
                      {selectedPriority.priority_challenge || 'No especificado'}
                    </p>
                  </div>
                    <div
                      className={`bg-blue-50 p-4 rounded-lg border border-blue-200 ${
                        /^\s*no identificad[oa]\.?\s*$/i.test(selectedPriority.priority_cost ?? '')
                          ? 'border-red-500'
                          : 'border-slate-200 bg-white'
                      }`}
                      >
                    <h3 className="text-xs font-semibold text-slate-700 mb-1">Coste estimado</h3>
                    <p className="text-sm text-slate-700">
                      {selectedPriority.priority_cost || 'No especificado'}
                    </p>
                  </div>
                  <div
                      className={`bg-blue-50 p-4 rounded-lg border border-blue-200 ${
                        /^\s*no identificad[oa]\.?\s*$/i.test(selectedPriority.priority_date ?? '')
                          ? 'border-red-500'
                          : 'border-slate-200 bg-white'
                      }`}
                      >
                    <h3 className="text-xs font-semibold text-slate-700 mb-1">Fecha límite</h3>
                    <p className="text-sm text-slate-700">
                      {selectedPriority.priority_date || 'No especificada'}
                    </p>
                  </div>
                </div>

                {selectedPriority.priority_gartner_value && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-purple-600" />
                      Valor que Gartner puede aportar
                    </h3>
                    <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                      {selectedPriority.priority_gartner_value}
                    </div>
                  </div>
                )}

                {selectedPriority.initiatives && selectedPriority.initiatives.length > 0 && (
                  <div className="border-t border-slate-200 pt-4">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                      <ClipboardList className="h-5 w-5 text-indigo-600" />
                      Iniciativas ({selectedPriority.initiatives.length})
                    </h3>
                    <div className="space-y-4">
                      {selectedPriority.initiatives.map((initiative: any, index: number) => (
                        <div key={index} className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                          <h4 className="text-base font-semibold text-slate-800 mb-3">
                            {initiative.initiative_title}
                          </h4>

                          {initiative.initiative_detail_description && (
                            <div className="mb-3 bg-white p-3 rounded border border-slate-200">
                              <p className="text-xs font-semibold text-slate-600 mb-1">Descripción</p>
                              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                                {initiative.initiative_detail_description}
                              </p>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-3 mb-3">
                              <div
                                  className={`bg-white p-2 rounded border ${
                                    /^\s*no identificad[oa]\.?\s*$/i.test(initiative?.initiative_challenge ?? '')
                                    ? 'border-red-500'
                                    : 'border-slate-200 bg-white'
                                  }`}
                                >
                              <p className="text-xs font-semibold text-slate-600 mb-1">Reto</p>
                              <p className="text-sm text-slate-700">
                                {initiative.initiative_challenge || 'No especificado'}
                              </p>
                            </div>
                            <div
                                className={`p-2 rounded border ${
                                  /^\s*no identificad[oa]\.?\s*$/i.test(initiative?.initiative_owner ?? '')
                                    ? 'border-red-500 bg-white'
                                    : 'border-slate-200 bg-white'
                                }`}
                                >
                              <p className="text-xs font-semibold text-slate-600 mb-1">Responsable</p>
                              <p className="text-sm text-slate-700">
                                {initiative.initiative_owner || 'No especificado'}
                              </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div
                                className={`p-2 rounded border ${
                                  /^\s*no identificad[oa]\.?\s*$/i.test(initiative?.initiative_cost ?? '')
                                    ? 'border-red-500 bg-white'
                                    : 'border-slate-200 bg-white'
                                }`}
                                >
                              <p className="text-xs font-semibold text-slate-600 mb-1">Coste</p>
                              <p className="text-sm text-slate-700">
                                {initiative.initiative_cost || 'No especificado'}
                              </p>
                            </div>
                              <div
                                className={`p-2 rounded border ${
                                  /^\s*no identificad[oa]\.?\s*$/i.test(initiative?.initiative_date ?? '')
                                    ? 'border-red-500 bg-white'
                                    : 'border-slate-200 bg-white'
                                }`}
                                >
                              <p className="text-xs font-semibold text-slate-600 mb-1">Fecha Límite</p>
                              <p className="text-sm text-slate-700">
                                {initiative.initiative_date || 'No especificada'}
                              </p>
                            </div>
                          </div>

                          {initiative.initiative_gartner_value && (
                            <div
                                className={`p-3 rounded border mt-3 ${
                                  /^\s*no identificad[oa]\.?\s*$/i.test(initiative.initiative_gartner_value ?? '')
                                    ? 'border-red-500 bg-white'
                                    : 'border-slate-200 bg-white'
                                }`}
                                >
                              <p className="text-xs font-semibold text-slate-700 mb-1">Valor Gartner</p>
                              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                                {initiative.initiative_gartner_value}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  let content = `PRIORIDAD: ${selectedPriority?.priority_title}\n\n`;
                  
                  if (selectedPriority?.priority_detail_description) {
                    content += `DESCRIPCIÓN:\n${selectedPriority.priority_detail_description}\n\n`;
                  }
                  
                  content += `RETO PRINCIPAL: ${selectedPriority?.priority_challenge || 'No especificado'}\n`;
                  content += `COSTE ESTIMADO: ${selectedPriority?.priority_cost || 'No especificado'}\n`;
                  content += `FECHA LÍMITE: ${selectedPriority?.priority_date || 'No especificada'}\n\n`;
                  
                  if (selectedPriority?.priority_gartner_value) {
                    content += `VALOR GARTNER:\n${selectedPriority.priority_gartner_value}\n\n`;
                  }

                  if (selectedPriority?.initiatives && selectedPriority.initiatives.length > 0) {
                    content += `\n${'='.repeat(60)}\nINICIATIVAS (${selectedPriority.initiatives.length})\n${'='.repeat(60)}\n\n`;
                    
                    selectedPriority.initiatives.forEach((initiative: any, index: number) => {
                      content += `INICIATIVA ${index + 1}: ${initiative.initiative_title}\n`;
                      if (initiative.initiative_detail_description) {
                        content += `Descripción: ${initiative.initiative_detail_description}\n`;
                      }
                      content += `Reto: ${initiative.initiative_challenge || 'No especificado'}\n`;
                      content += `Responsable: ${initiative.initiative_owner || 'No especificado'}\n`;
                      content += `Coste: ${initiative.initiative_cost || 'No especificado'}\n`;
                      content += `Fecha: ${initiative.initiative_date || 'No especificada'}\n`;
                      if (initiative.initiative_gartner_value) {
                        content += `Valor Gartner: ${initiative.initiative_gartner_value}\n`;
                      }
                      content += '\n';
                    });
                  }

                  navigator.clipboard.writeText(content.trim());
                  toast({
                    title: 'Copiado',
                    description: 'Prioridad e iniciativas copiadas al portapapeles',
                  });
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar Todo
              </Button>
              <Button onClick={() => setPriorityDetailDialog(false)}>
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
        <Dialog open={potentialPriorityDialog} onOpenChange={setPotentialPriorityDialog}>
    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-indigo-500" />
          Prioridades Potenciales Identificadas
        </DialogTitle>
      </DialogHeader>
      
      {potentialPriorities.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-slate-500">
            No se identificaron prioridades potenciales
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {potentialPriorities.map((priority, index) => (
            <div
              key={index}
              className="bg-white p-4 rounded-lg border border-indigo-100 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer"
              onClick={() => {
                setSelectedPotentialPriority(priority);
                setPotentialPriorityDetailDialog(true);
              }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h4 className="text-base font-semibold text-slate-800">
                  {priority.priority_title}
                </h4>
                <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
              </div>
              <p className="text-sm text-slate-600 mb-2">
                {priority.priority_challenge}
              </p>
              <p className="text-xs text-slate-500 italic">
                {priority.justification}
              </p>
            </div>
          ))}
        </div>
      )}
      
      <DialogFooter>
        <Button onClick={() => setPotentialPriorityDialog(false)}>
          Cerrar
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <Dialog open={potentialPriorityDetailDialog} onOpenChange={setPotentialPriorityDetailDialog}>
    <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="text-xl font-bold text-slate-800">
          {selectedPotentialPriority?.priority_title}
        </DialogTitle>
      </DialogHeader>

      {selectedPotentialPriority && (
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Reto Principal</h3>
            <p className="text-sm text-slate-700">
              {selectedPotentialPriority.priority_challenge}
            </p>
          </div>

          <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Justificación</h3>
            <p className="text-sm text-slate-700 leading-relaxed">
              {selectedPotentialPriority.justification}
            </p>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-600" />
              Valor que Gartner Puede Aportar
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {selectedPotentialPriority.priority_gartner_value}
            </p>
          </div>

          {selectedPotentialPriority.suggested_initiatives && selectedPotentialPriority.suggested_initiatives.length > 0 && (
            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-indigo-600" />
                Iniciativas Sugeridas ({selectedPotentialPriority.suggested_initiatives.length})
              </h3>
              <div className="space-y-3">
                {selectedPotentialPriority.suggested_initiatives.map((initiative: any, index: number) => (
                  <div key={index} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <h4 className="text-sm font-semibold text-slate-800 mb-1">
                      {initiative.initiative_title}
                    </h4>
                    <p className="text-sm text-slate-600">
                      {initiative.initiative_description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => {
            let content = `PRIORIDAD POTENCIAL: ${selectedPotentialPriority?.priority_title}\n\n`;
            content += `RETO PRINCIPAL:\n${selectedPotentialPriority?.priority_challenge}\n\n`;
            content += `JUSTIFICACIÓN:\n${selectedPotentialPriority?.justification}\n\n`;
            content += `VALOR GARTNER:\n${selectedPotentialPriority?.priority_gartner_value}\n\n`;
            
            if (selectedPotentialPriority?.suggested_initiatives && selectedPotentialPriority.suggested_initiatives.length > 0) {
              content += `INICIATIVAS SUGERIDAS:\n`;
              selectedPotentialPriority.suggested_initiatives.forEach((init: any, idx: number) => {
                content += `\n${idx + 1}. ${init.initiative_title}\n`;
                content += `   ${init.initiative_description}\n`;
              });
            }

            navigator.clipboard.writeText(content.trim());
            toast({
              title: 'Copiado',
              description: 'Prioridad potencial copiada al portapapeles',
            });
          }}
        >
          <Copy className="mr-2 h-4 w-4" />
          Copiar
        </Button>
        <Button onClick={() => setPotentialPriorityDetailDialog(false)}>
          Cerrar
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
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