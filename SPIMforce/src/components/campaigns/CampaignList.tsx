import { useState, useEffect } from "react";
import { db } from "@/lib/db-adapter";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAutoCampaignSender } from '@/hooks/useAutoCampaignSender'; 
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { formatDateES } from "@/utils/dateFormatter";
import { Plus, Trash2, Send, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import "@/app.css";

interface Campaign {
  id: string;
  contact_id: string;
  template_id: string | null;
  start_campaign: boolean;
  email_1_date: string | null;
  email_2_date: string | null;
  email_3_date: string | null;
  email_4_date: string | null;
  email_5_date: string | null;
  status: string;
  emails_sent: number;
  has_replied: boolean;
  last_reply_date: string | null;
  response_text: string | null;
  email_incorrect?: boolean;
  contacts: {
    first_name: string;
    last_name: string;
    email: string;
    organization: string;
    gartner_role: string;
    title: string;
  };
  campaign_templates?: {
    name: string;
  };
}

export const CampaignList = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [recentCampaigns, setRecentCampaigns] = useState<Campaign[]>([]);
  const [oldCampaigns, setOldCampaigns] = useState<Campaign[]>([]);
  const [showOldCampaigns, setShowOldCampaigns] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkingReplies, setCheckingReplies] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [filteredContacts, setFilteredContacts] = useState<any[]>([]);
  const [isSending, setIsSending] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [isCreating, setIsCreating] = useState(false);
  const [bulkContactSearch, setBulkContactSearch] = useState("");
  const [bulkContactTypeFilter, setBulkContactTypeFilter] = useState<string[]>([]);
  
  const [repliedContact, setRepliedContact] = useState<{
    name: string;
    email: string;
    replyDate: string;
    responseText?: string; 
  } | null>(null);

  const [selectedResponse, setSelectedResponse] = useState<{
    name: string;
    email: string;
    organization: string;
    replyDate: string;
    responseText: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    organization: "",
    contact_id: "",
    template_id: "",
    start_campaign: false,
    email_1_date: "",
    email_2_date: "",
    email_3_date: "",
    email_4_date: "",
    email_5_date: "",
  });

  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [bulkFormData, setBulkFormData] = useState({
    gartner_role: "",
    template_id: "",
    selected_contacts: [] as string[],
    start_campaign: false,
    email_1_date: "",
    email_2_date: "",
    email_3_date: "",
    email_4_date: "",
    email_5_date: "",
  });
  const [bulkFilteredTemplates, setBulkFilteredTemplates] = useState<any[]>([]);
  const [bulkFilteredContacts, setBulkFilteredContacts] = useState<any[]>([]);

  const [lastAction, setLastAction] = useState<string>('');
  const [lastActionTime, setLastActionTime] = useState<number>(0);

  const { toast } = useToast();
  const ALLOWED_CONTACT_TYPES = ['Prospect', 'Oportunidad', 'Cliente', 'Cliente proxy'];

  const { isSending: isAutoSending } = useAutoCampaignSender(60 * 60 * 1000); // Cada hora
  
  const renderTextWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline break-all"
          >
            {part}
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const getLastEmailDate = (campaign: Campaign): Date | null => {
    if (campaign.emails_sent === 0) return null;
    
    const emailsSent = Math.min(campaign.emails_sent, 5);
    const dateField = `email_${emailsSent}_date` as keyof Campaign;
    const lastSentDate = campaign[dateField];
    
    return lastSentDate ? new Date(lastSentDate as string) : null;
  };

  const filterCampaignsByAge = (allCampaigns: Campaign[]) => {
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    const recent: Campaign[] = [];
    const old: Campaign[] = [];

    allCampaigns.forEach(campaign => {
      const lastEmailDate = getLastEmailDate(campaign);
      
      if (!lastEmailDate) {
        recent.push(campaign);
      } else if (lastEmailDate >= twoMonthsAgo) {
        recent.push(campaign);
      } else {
        old.push(campaign);
      }
    });

    setRecentCampaigns(recent);
    setOldCampaigns(old);
  };

  const toggleBulkContactTypeFilter = (type: string) => {
    setBulkContactTypeFilter(prev => {
      if (prev.includes(type)) {
        return prev.filter(t => t !== type);
      } else {
        return [...prev, type];
      }
    });
  };

  useEffect(() => {
    initData();
  }, []);

// ===== useEffect: Verificación de respuestas (cada hora) =====
useEffect(() => {
  if (campaigns.length > 0 && !loading && !isSending) {
    const lastCheck = localStorage.getItem('last_email_check');
    const now = new Date().getTime();
    const oneHour = 1 * 60 * 60 * 1000;

    if (!lastCheck || (now - parseInt(lastCheck)) > oneHour) {
      console.log('📧 INICIANDO VERIFICACIÓN DE RESPUESTAS (Automática cada 3 horas)');
      checkAllReplies();
      localStorage.setItem('last_email_check', now.toString());
    } else {
      const hoursLeft = Math.ceil((oneHour - (now - parseInt(lastCheck))) / (1000 * 60 * 60));
      console.log(`⏰ Próxima verificación automática de respuestas en ${hoursLeft} horas`);
    }
  }
}, [campaigns.length, loading]);

  useEffect(() => {
    if (campaigns.length > 0 && !loading) {
      const lastFollowUpCheck = localStorage.getItem('last_followup_check');
      const now = new Date().getTime();
      const oneDay = 24 * 60 * 60 * 1000;

      if (!lastFollowUpCheck || (now - parseInt(lastFollowUpCheck)) > oneDay) {
        console.log('🔄 VERIFICANDO CAMPAÑAS PARA FOLLOW-UP (60 días)');
        createFollowUpCampaigns();
        localStorage.setItem('last_followup_check', now.toString());
      } else {
        const hoursLeft = Math.ceil((oneDay - (now - parseInt(lastFollowUpCheck))) / (1000 * 60 * 60));
        console.log(`⏰ Próxima verificación de follow-up en ${hoursLeft} horas`);
      }
    }
  }, [campaigns.length, loading]);

  useEffect(() => {
    const handleCampaignsUpdated = () => {
      console.log('📢 Evento campaignsUpdated recibido, recargando campañas...');
      fetchCampaigns();
    };

    window.addEventListener('campaignsUpdated', handleCampaignsUpdated);

    return () => {
      window.removeEventListener('campaignsUpdated', handleCampaignsUpdated);
    };
  }, []);

  const createFollowUpCampaigns = async () => {
    try {
      console.log('🔍 Buscando campañas completadas sin respuesta hace más de 60 días...');
      
      const completedCampaigns = campaigns.filter(campaign => {
        if (campaign.has_replied || campaign.email_incorrect || campaign.emails_sent < 5) {
          return false;
        }

        if (!campaign.email_5_date) {
          return false;
        }

        const email5Date = new Date(campaign.email_5_date);
        const today = new Date();
        const daysDifference = Math.floor((today.getTime() - email5Date.getTime()) / (1000 * 60 * 60 * 24));

        return daysDifference >= 60;
      });

      console.log(`📊 Encontradas ${completedCampaigns.length} campañas que cumplen los criterios`);

      if (completedCampaigns.length === 0) {
        return;
      }

      const allCampaignsData = await db.getCampaigns();
      let createdCount = 0;

      for (const campaign of completedCampaigns) {
        const existingFollowUp = allCampaignsData.find(c => 
          c.contact_id === campaign.contact_id &&
          c.template_id === null &&
          !c.start_campaign &&
          c.id !== campaign.id
        );

        if (existingFollowUp) {
          console.log(`⏭️ Ya existe campaña follow-up para ${campaign.contacts.first_name} ${campaign.contacts.last_name}`);
          continue;
        }

        const todayDate = new Date().toISOString().split('T')[0];
        
        const newCampaignData = {
          contact_id: campaign.contact_id,
          template_id: null,
          start_campaign: false,
          email_1_date: todayDate,
          email_2_date: null,
          email_3_date: null,
          email_4_date: null,
          email_5_date: null,
          status: "pending",
        };

        await db.createCampaign(newCampaignData);
        createdCount++;
        
        console.log(`✅ Campaña follow-up creada para ${campaign.contacts.first_name} ${campaign.contacts.last_name}`);
      }

      if (createdCount > 0) {
        toast({
          title: "Campañas de seguimiento creadas",
          description: `Se crearon ${createdCount} campaña${createdCount > 1 ? 's' : ''} de seguimiento automática${createdCount > 1 ? 's' : ''} (60 días)`,
        });
        
        await fetchCampaigns();
      }

    } catch (error) {
      console.error('❌ Error creando campañas de follow-up:', error);
      toast({
        title: "Error",
        description: "No se pudieron crear las campañas de seguimiento",
        variant: "destructive"
      });
    }
  };

  const getCampaignStatus = (campaign: Campaign): { 
    status: string; 
    variant: "default" | "secondary" | "destructive" | "outline" 
    } => {

    if (campaign.email_incorrect) {
      return { status: "Email incorrecto", variant: "destructive" };
    }
    if (campaign.has_replied) {
      return { status: "Respondido", variant: "default" };
    }
    
    if (campaign.emails_sent >= 5) {
      return { status: "Completada sin respuesta", variant: "secondary" };
    }
    
    function parseDateSafe(str) {
      if (typeof str !== "string") return null;
      const s = str.trim();

      const isoLike = /^\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+\-]\d{2}:\d{2})?)?$/;
      if (isoLike.test(s)) {
        const d = new Date(s);
        return Number.isNaN(d.getTime()) ? null : d;
      }

      let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (m) {
        const [_, dd, mm, yyyy] = m.map(Number);
        const d = new Date(yyyy, mm - 1, dd);
        return Number.isNaN(d.getTime()) ? null : d;
      }

      m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
      if (m) {
        const [_, dd, mm, yyyy] = m.map(Number);
        const d = new Date(yyyy, mm - 1, dd);
        return Number.isNaN(d.getTime()) ? null : d;
      }

      return null;
    }

    function normalizeToStartOfDay(d) {
      const n = new Date(d);
      n.setHours(0, 0, 0, 0);
      return n;
    }

    if (campaign.start_campaign && campaign.email_1_date) {
      const parsed = parseDateSafe(campaign.email_1_date);

      if (parsed) {
        const hoy = normalizeToStartOfDay(new Date());
        const fechaEmail1 = normalizeToStartOfDay(parsed);

        if (fechaEmail1 > hoy) {
          return { status: "Pendiente", variant: "outline" };
        }
      }
      return { status: "En curso", variant: "outline" };
    }
    
    return { status: "No activa", variant: "outline" };
  };

  const formatDateTime = (dateString: string | null | undefined): string => {
    if (!dateString) return '-';
    
    try {
      if (/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}$/.test(dateString)) {
        return dateString;
      }
      
      const date = new Date(dateString);
      
      if (isNaN(date.getTime())) {
        return dateString;
      }
      
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch (e) {
      return dateString;
    }
  };

  const openEditDialog = (campaign: Campaign) => {
    console.log('Campaign dates (raw):', {
      email_1_date: campaign.email_1_date,
      email_2_date: campaign.email_2_date,
      email_3_date: campaign.email_3_date,
      email_4_date: campaign.email_4_date,
      email_5_date: campaign.email_5_date,
    });

    setEditingCampaign(campaign);
    setFormData({
      organization: campaign.contacts.organization,
      contact_id: campaign.contact_id,
      template_id: campaign.template_id || "",
      start_campaign: campaign.start_campaign,
      email_1_date: campaign.email_1_date ? new Date(campaign.email_1_date).toLocaleDateString('en-CA') : "",
      email_2_date: campaign.email_2_date ? new Date(campaign.email_2_date).toLocaleDateString('en-CA') : "",
      email_3_date: campaign.email_3_date ? new Date(campaign.email_3_date).toLocaleDateString('en-CA') : "",
      email_4_date: campaign.email_4_date ? new Date(campaign.email_4_date).toLocaleDateString('en-CA') : "",
      email_5_date: campaign.email_5_date ? new Date(campaign.email_5_date).toLocaleDateString('en-CA') : "",
    });

    console.log('FormData dates (normalized):', {
      email_1_date: campaign.email_1_date ? new Date(campaign.email_1_date).toLocaleDateString('en-CA') : "",
      email_2_date: campaign.email_2_date ? new Date(campaign.email_2_date).toLocaleDateString('en-CA') : "",
      email_3_date: campaign.email_3_date ? new Date(campaign.email_3_date).toLocaleDateString('en-CA') : "",
      email_4_date: campaign.email_4_date ? new Date(campaign.email_4_date).toLocaleDateString('en-CA') : "",
      email_5_date: campaign.email_5_date ? new Date(campaign.email_5_date).toLocaleDateString('en-CA') : "",
    });

    const filtered = contacts.filter(c => 
      c.organization === campaign.contacts.organization &&
      ALLOWED_CONTACT_TYPES.includes(c.contact_type)
    );
    setFilteredContacts(filtered);
    
    const available = templates.filter(t => t.gartner_role === campaign.contacts.gartner_role);
    setFilteredTemplates(available);
    
    setIsDialogOpen(true);
  };

  const recalculateDatesFrom = (emailNumber: number, startDate: string) => {
    const dates: any = { ...formData };

    const baseDate = new Date(startDate);
    
    baseDate.setHours(0, 0, 0, 0);

    for (let i = emailNumber; i <= 5; i++) {
      if (i === emailNumber) {
        dates[`email_${i}_date`] = startDate;
      } else if (dates[`email_${i-1}_date`]) {
        const previousDate = new Date(dates[`email_${i-1}_date`]);
        previousDate.setHours(0, 0, 0, 0);
        previousDate.setDate(previousDate.getDate() + 3);
        
        const year = previousDate.getFullYear();
        const month = String(previousDate.getMonth() + 1).padStart(2, '0');
        const day = String(previousDate.getDate()).padStart(2, '0');
        dates[`email_${i}_date`] = `${year}-${month}-${day}`;
      }
    }

    setFormData(dates);
  };

  const handleDateChange = (emailNumber: number, newDate: string) => {
    if (!newDate) {
      setFormData({ ...formData, [`email_${emailNumber}_date`]: newDate });
      return;
    }
    
    recalculateDatesFrom(emailNumber, newDate);
  };

  const checkAllReplies = async () => {
    setCheckingReplies(true);
    try {
      console.log('🔍 Paso 1: Obteniendo emails (caché + delta del inbox)...');

      const response = await fetch('http://localhost:3002/api/outlook/emails-with-cache?days=30');
      
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data = await response.json();
      const allEmails = data.emails || [];
      
      console.log(`✅ Paso 1 completado: ${allEmails.length} emails obtenidos (caché + inbox reciente)`);

      if (allEmails.length === 0) {
        toast({
          title: "Info",
          description: "No se encontraron emails",
        });
        return;
      }

      console.log('\n📋 TODOS LOS ASUNTOS DE EMAILS:');
      allEmails.forEach((email, i) => {
        if (email.Subject) {
          const subject = email.Subject.toLowerCase();
          const isError = subject.includes('undeliverable') ||
                         subject.includes('delivery status notification') ||
                         subject.includes('mail delivery failed') ||
                         subject.includes('returned mail') ||
                         subject.includes('delivery failure');
          
          if (isError) {
            console.log(`  ⚠️ ${i + 1}. [ERROR EMAIL] ${email.Subject}`);
          }
        }
      });

      console.log('\n🔍 Paso 2: Procesando campañas y buscando matches...');

      let repliedCount = 0;
      let processedCount = 0;
      let incorrectEmailCount = 0;

      for (const campaign of campaigns) {
        const contactEmail = campaign.contacts.email.toLowerCase().trim();
        console.log(`\n▶️ Verificando: ${campaign.contacts.first_name} ${campaign.contacts.last_name}`);
        console.log(`   Email contacto: ${contactEmail}`);

        console.log(`   🔍 Buscando emails de error...`);
        
        const errorEmails = allEmails.filter((email) => {
          if (!email || !email.Subject) return false;
          
          const subject = email.Subject.toLowerCase();
          
          return (
            subject.includes('undeliverable') ||
            subject.includes('delivery status notification') ||
            subject.includes('mail delivery failed') ||
            subject.includes('returned mail') ||
            subject.includes('delivery failure') ||
            subject.includes('mail delivery subsystem') ||
            subject.includes('failure notice')
          );
        });

        console.log(`   📧 Emails de error encontrados: ${errorEmails.length}`);

        let emailIncorrect = false;
        
        if (errorEmails.length > 0) {
          console.log(`   ⚠️ Analizando ${errorEmails.length} email(s) de error para buscar: ${contactEmail}`);
          
          for (const errorEmail of errorEmails) {
            console.log(`\n   📄 Analizando email de error:`);
            console.log(`      Asunto: ${errorEmail.Subject}`);
            console.log(`      Fecha: ${errorEmail.ReceivedTime}`);
            
            const body = (errorEmail.Body || '').toLowerCase();
            
            console.log(`      Longitud del cuerpo: ${body.length} caracteres`);
            console.log(`      Primeros 200 caracteres del cuerpo: ${body.substring(0, 200)}`);
            
            const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
            const foundEmails = body.match(emailRegex) || [];
            
            console.log(`      Emails encontrados en el cuerpo: ${foundEmails.length}`);
            foundEmails.forEach((email, idx) => {
              console.log(`        ${idx + 1}. ${email.toLowerCase()}`);
            });
            
            const cleanedFoundEmails = foundEmails.map(e => e.toLowerCase().trim());
            const isContactEmailInError = cleanedFoundEmails.includes(contactEmail);
            
            console.log(`      ¿Email del contacto (${contactEmail}) está en el error? ${isContactEmailInError}`);
            
            if (isContactEmailInError) {
              console.log(`   ❌❌❌ EMAIL INCORRECTO DETECTADO: ${contactEmail} ❌❌❌`);
              emailIncorrect = true;
              incorrectEmailCount++;
              break;
            }
          }
        } else {
          console.log(`   ✅ No hay emails de error para este contacto`);
        }

        const replies = allEmails.filter((email) => {
          if (!email || !email.SenderEmail) return false;

          const senderEmail = (email.SenderEmail || '').toLowerCase().trim();
          const subject = (email.Subject || '').toLowerCase();
          
          if (subject.includes('undeliverable') || 
              subject.includes('delivery status notification') ||
              subject.includes('mail delivery failed') ||
              subject.includes('returned mail') ||
              subject.includes('delivery failure')) {
            return false;
          }
          
          if (senderEmail === 'unknown@domain.com' || senderEmail.length < 5) return false;

          const contactUsername = contactEmail.split('@')[0];
          const senderUsername = senderEmail.split('@')[0];
          const contactDomain = contactEmail.split('@')[1] || '';
          const senderDomain = senderEmail.split('@')[1] || '';

          const isMatch = (
            senderEmail === contactEmail ||
            (contactUsername.length > 3 && senderUsername.includes(contactUsername)) ||
            (senderUsername.length > 3 && contactUsername.includes(senderUsername)) ||
            (contactDomain === senderDomain && 
             contactUsername.length > 3 && 
             senderUsername.includes(contactUsername))
          );

          if (isMatch) {
            console.log(`   ✅ Match encontrado: ${senderEmail} - ${email.Subject}`);
          }

          return isMatch;
        });

        const hasReplied = replies.length > 0;
        let lastReplyDate = null;
        let responseText = null;

        if (hasReplied) {
          const sortedReplies = replies.sort((a, b) => 
            new Date(a.ReceivedTime).getTime() - new Date(b.ReceivedTime).getTime()
          );

          const firstReply = sortedReplies[0];
          lastReplyDate = firstReply.ReceivedTime;
          if (firstReply.Body) {
            responseText = firstReply.Body
              .substring(0, 500)
              .trim();
            
            console.log(`   📝 Texto de respuesta capturado (${responseText.length} caracteres)`);
          }

          repliedCount++;
          console.log(`   📨 ${replies.length} respuesta(s) encontrada(s)`);
          console.log(`   📅 Última respuesta: ${lastReplyDate}`);
        } else {
          console.log(`   ⭕ Sin respuestas`);
        }

        console.log(`   💾 Actualizando en base de datos...`);
        console.log(`   🔍 email_incorrect = ${emailIncorrect}`);
        
        const updateData: any = {
          has_replied: hasReplied,
          last_reply_date: lastReplyDate,
          response_text: responseText,
          email_incorrect: emailIncorrect
        };
        
        console.log(`   📦 updateData completo:`, JSON.stringify(updateData, null, 2));
        
        if (hasReplied || emailIncorrect) {
          updateData.start_campaign = false;
          
          if (emailIncorrect) {
            console.log(`   🛑 Desactivando campaña porque el email es incorrecto`);
            toast({
              title: "Email incorrecto detectado",
              description: `El email de ${campaign.contacts.first_name} ${campaign.contacts.last_name} (${contactEmail}) no es válido`,
              variant: "destructive"
            });
          } else {
            console.log(`   🛑 Desactivando campaña porque el contacto respondió`);
          }
          
          if (hasReplied && !campaign.has_replied) {
            setRepliedContact({
              name: `${campaign.contacts.first_name} ${campaign.contacts.last_name}`,
              email: campaign.contacts.email,
              replyDate: lastReplyDate || new Date().toISOString(),
              responseText: responseText || undefined
            });
          }
        }
        
        try {
          await db.updateCampaign(campaign.id, updateData);
          console.log(`   ✅ Campaña actualizada correctamente`);
        } catch (updateError) {
          console.error(`   ❌ Error actualizando campaña:`, updateError);
          toast({
            title: "Error",
            description: "No se pudo actualizar la campaña",
            variant: "destructive"
          });
        }
      }

      console.log(`\n✅ Paso 2 completado!`);
      console.log(`📊 Resumen final:`);
      console.log(`   Total campañas: ${campaigns.length}`);
      console.log(`   Procesadas: ${processedCount}`);
      console.log(`   Con respuestas: ${repliedCount}`);
      console.log(`   Emails incorrectos: ${incorrectEmailCount}`);
      console.log(`   Sin respuestas: ${processedCount - repliedCount - incorrectEmailCount}`);

      console.log('\n🔄 Paso 3: Recargando campañas...');
      await fetchCampaigns();
      console.log('✅ Campañas recargadas\n');

    } catch (error) {
      console.error('💥 Error en verificación de respuestas:', error);
      toast({
        title: "Error",
        description: `No se pudo verificar las respuestas: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        variant: "destructive"
      });
    } finally {
      setCheckingReplies(false);
    }
  };

  const initData = async () => {
    await fetchCampaigns();
    await fetchContacts();
    await fetchTemplates();
    setLoading(false);
  };

const fetchCampaigns = async () => {
  const data = await db.getCampaigns();
  
  const normalizedData = data.map(campaign => ({
    ...campaign,
    email_1_date: campaign.email_1_date ? new Date(campaign.email_1_date).toLocaleDateString('en-CA') : null,
    email_2_date: campaign.email_2_date ? new Date(campaign.email_2_date).toLocaleDateString('en-CA') : null,
    email_3_date: campaign.email_3_date ? new Date(campaign.email_3_date).toLocaleDateString('en-CA') : null,
    email_4_date: campaign.email_4_date ? new Date(campaign.email_4_date).toLocaleDateString('en-CA') : null,
    email_5_date: campaign.email_5_date ? new Date(campaign.email_5_date).toLocaleDateString('en-CA') : null,
  }));

  const filteredCampaigns = (normalizedData || [])
    .filter(campaign => 
      ALLOWED_CONTACT_TYPES.includes(campaign.contacts?.contact_type)
    )
    .sort((a, b) => {
      // Campañas sin fecha van al final
      if (!a.email_1_date && !b.email_1_date) return 0;
      if (!a.email_1_date) return 1;
      if (!b.email_1_date) return -1;
      
      // Ordenar por fecha ascendente (más antigua primero)
      return new Date(a.email_1_date).getTime() - new Date(b.email_1_date).getTime();
    });
  
  setCampaigns(filteredCampaigns as Campaign[]);
  filterCampaignsByAge(filteredCampaigns as Campaign[]);
};

  const fetchContacts = async () => {
    try {
      const data = await db.getContacts();
      const filteredData = data.filter(contact =>
        ALLOWED_CONTACT_TYPES.includes(contact.contact_type)
      );
      const normalized = filteredData.map((row: any) => ({
        ...row,
        webinar_role: row.webinar_role ?? '',
      }));
      setContacts(normalized);
      console.log(`✅ ${normalized.length} contactos filtrados obtenidos`);
    } catch (error) {
      console.error('Error cargando contactos:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los contactos',
        variant: 'destructive',
      });
      setContacts([]);
    }
  };

  const fetchTemplates = async () => {
    try {
      const data  = await db.getTemplates();
      console.log('Plantillas cargadas:', data);
      setTemplates(data || []);
    } catch (error) {
      console.error('Error cargando plantillas:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las plantillas',
        variant: 'destructive',
      });
      setTemplates([]);
    }
  };

  const calculateDates = (startDate: string) => {
    const dates = [startDate];
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    for (let i = 1; i < 5; i++) {
      const nextDate = new Date(start);
      nextDate.setDate(start.getDate() + i * 3);
      
      const year = nextDate.getFullYear();
      const month = String(nextDate.getMonth() + 1).padStart(2, '0');
      const day = String(nextDate.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
    }
    return dates;
  };

  const handleOrganizationChange = (organization: string) => {
    setFormData({ ...formData, organization, contact_id: "", template_id: "" });
    const filtered = contacts
      .filter(
        (c) =>
          c.organization === organization &&
          ALLOWED_CONTACT_TYPES.includes(c.contact_type)
      )
      .sort((a, b) =>
        `${a.first_name} ${a.last_name}`.localeCompare(
          `${b.first_name} ${b.last_name}`
        )
      );
    setFilteredContacts(filtered);
    setFilteredTemplates([]);
  };

  const handleContactChange = (contactId: string) => {
    setFormData({ ...formData, contact_id: contactId, template_id: "" });
    const contact = contacts.find((c) => c.id === contactId);
    if (contact) {
      if (!ALLOWED_CONTACT_TYPES.includes(contact.contact_type)) {
        toast({
          title: "Contacto no permitido",
          description:
            "Solo se pueden crear campañas para contactos de tipo Prospect u Oportunidad",
          variant: "destructive",
        });
        setFormData({ ...formData, contact_id: "", template_id: "" });
        setFilteredTemplates([]);
        return;
      }
      const available = templates
        .filter((t) => t.gartner_role === contact.gartner_role)
        .sort((a, b) => a.name.localeCompare(b.name));
      setFilteredTemplates(available);
    } else {
      setFilteredTemplates([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedContact = contacts.find((c) => c.id === formData.contact_id);
    if (!selectedContact || !ALLOWED_CONTACT_TYPES.includes(selectedContact.contact_type)) {
      toast({
        title: "Error de validación",
        description:
          "Solo se pueden crear campañas para contactos de tipo Prospect u Oportunidad",
        variant: "destructive",
      });
      return;
    }
    if (!formData.template_id) {
      toast({
        title: "Error de validación",
        description: "Por favor selecciona una plantilla",
        variant: "destructive",
      });
      return;
    }
    if (!formData.email_1_date) {
      toast({
        title: "Error de validación",
        description: "Por favor selecciona al menos la fecha del primer email",
        variant: "destructive",
      });
      return;
    }

    let dates = {
      email_1_date: formData.email_1_date,
      email_2_date: formData.email_2_date,
      email_3_date: formData.email_3_date,
      email_4_date: formData.email_4_date,
      email_5_date: formData.email_5_date,
    };

    if (!editingCampaign) {
      const calculatedDates = calculateDates(formData.email_1_date);
      dates = {
        email_1_date: calculatedDates[0],
        email_2_date: calculatedDates[1],
        email_3_date: calculatedDates[2],
        email_4_date: calculatedDates[3],
        email_5_date: calculatedDates[4],
      };
    }

    const payload = {
      contact_id: formData.contact_id,
      template_id: formData.template_id || null,
      start_campaign: formData.start_campaign,
      ...dates,
      status: formData.start_campaign ? "active" : "pending",
    };

    setIsCreating(true);
    try {
      if (editingCampaign) {
        await db.updateCampaign(editingCampaign.id, payload);
        toast({ title: "Éxito", description: "Campaña actualizada" });
      } else {
        const newCampaign = await db.createCampaign(payload);
        toast({ title: "Éxito", description: "Campaña creada" });
        
        const today = new Date().toLocaleDateString('en-CA');
        if (formData.start_campaign && formData.email_1_date === today) {
          console.log('🚀 Enviando primer email inmediatamente al crear la campaña');
          
          if (newCampaign && newCampaign.id) {
            await sendEmail(newCampaign as Campaign, 1);
          }
        }
      }
      setIsDialogOpen(false);
      initData();
      resetForm();
    } catch (error: any) {
      console.error("Error guardando campaña:", error);
      toast({
        title: "Error",
        description: error.message || "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const resetForm = () => {
    setFormData({
      organization: "",
      contact_id: "",
      template_id: "",
      start_campaign: false,
      email_1_date: "",
      email_2_date: "",
      email_3_date: "",
      email_4_date: "",
      email_5_date: "",
    });
    setFilteredContacts([]);
    setFilteredTemplates([]);
    setEditingCampaign(null);
  };

  const getNextEmailNumber = (campaign: Campaign): number | null => {
    if (!campaign.email_1_date) return 1;
    if (!campaign.email_2_date) return 2;
    if (!campaign.email_3_date) return 3;
    if (!campaign.email_4_date) return 4;
    if (!campaign.email_5_date) return 5;
    return null;
  };

const sendEmail = async (campaign: Campaign, emailNumber: number) => {
  try {
    if (campaign.emails_sent >= emailNumber) {
      toast({ title: "Info", description: `Email ${emailNumber} ya fue enviado`, variant: "default" });
      return;
    }

    const amSetting = await db.getSetting("account_manager");
    const accountManagerName = amSetting?.value?.name || '';

    const signatureSetting = await db.getSetting("email_signature");
    let signature = '';
    if (signatureSetting?.value) {
      const value = signatureSetting.value;
      signature = value?.signature || "";
      signature = signature.trim();
      if (signature.startsWith('"') && signature.endsWith('"')) {
        signature = signature.slice(1, -1);
      }
      signature = signature.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\\//g, '/');
    }

    const template = await db.getTemplate(campaign.template_id);

    if (!template) {
      console.error('Template no encontrado. ID:', campaign.template_id);
      throw new Error('Template not found');
    }

    const currentYear = new Date().getFullYear().toString();
    const nextYear = (new Date().getFullYear() + 1).toString();

    // ⭐ PRIMERO: Hacer todas las sustituciones de variables en subject y body
    let subject = template[`email_${emailNumber}_subject`];
    subject = subject.replace(/{{Nombre}}/g, campaign.contacts.first_name || '');
    subject = subject.replace(/{{nombre}}/g, campaign.contacts.first_name || '');
    subject = subject.replace(/{{ano}}/g, currentYear);
    subject = subject.replace(/{{año}}/g, currentYear);
    subject = subject.replace(/{{añoSiguiente}}/g, nextYear);
    subject = subject.replace(/{{anoSiguiente}}/g, nextYear);
    subject = subject.replace(/{{anosiguiente}}/g, nextYear);
    subject = subject.replace(/{{añosiguiente}}/g, nextYear);
    subject = subject.replace(/{{compania}}/g, campaign.contacts.organization || '');

    let body = template[`email_${emailNumber}_html`];
    body = body.replace(/{{Nombre}}/g, campaign.contacts.first_name || '');
    body = body.replace(/{{nombre}}/g, campaign.contacts.first_name || '');
    body = body.replace(/{{nombreAE}}/g, accountManagerName);
    body = body.replace(/{{compania}}/g, campaign.contacts.organization || '');
    body = body.replace(/{{ano}}/g, currentYear);
    body = body.replace(/{{año}}/g, currentYear);
    body = body.replace(/{{añoSiguiente}}/g, nextYear);
    body = body.replace(/{{anoSiguiente}}/g, nextYear);
    body = body.replace(/{{anosiguiente}}/g, nextYear);
    body = body.replace(/{{añosiguiente}}/g, nextYear);
    
    if (signature) {
      body = body + signature;
    }

    // ⭐ SEGUNDO: Buscar el último email enviado con el subject YA PROCESADO
    console.log('🔍 Buscando email anterior con subject:', subject);
    
    const previousEmailResponse = await fetch('http://localhost:3002/api/outlook/find-last-sent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactEmail: campaign.contacts.email,
        subject: subject,  // ← Ahora subject ya tiene las variables sustituidas
        daysBack: 60
      })
    });

    const previousEmailData = await previousEmailResponse.json();
    const replyToEmail = previousEmailData.emailInfo || null;

    if (replyToEmail) {
      console.log('✅ Email anterior encontrado, se hará REPLY');
      console.log('   EntryID:', replyToEmail.EntryID);
    } else {
      console.log('ℹ️ No se encontró email anterior, se creará email NUEVO');
    }

    const attachmentsFromTemplate = template[`email_${emailNumber}_attachments`] || [];
    console.log('📎 Attachments del template:', attachmentsFromTemplate);
    
    const processedAttachments = [];
    
    for (const attachment of attachmentsFromTemplate) {
      try {
        if (attachment.url) {
          console.log(`📥 Descargando adjunto: ${attachment.name} desde ${attachment.url}`);
          
          const response = await fetch(attachment.url);
          if (!response.ok) {
            throw new Error(`Error descargando archivo: ${response.status}`);
          }
          
          const blob = await response.blob();
          
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onload = () => {
              const result = reader.result as string;
              const base64Data = result.split(',')[1];
              resolve(base64Data);
            };
            reader.onerror = reject;
          });
          
          processedAttachments.push({
            filename: attachment.name,
            content: base64
          });
          
          console.log(`✅ Archivo convertido a base64: ${attachment.name}, tamaño: ${base64.length}`);
        }
      } catch (error) {
        console.error(`❌ Error procesando adjunto ${attachment.name}:`, error);
        toast({ 
          title: "Advertencia", 
          description: `No se pudo adjuntar ${attachment.name}`,
          variant: "destructive" 
        });
      }
    }

    console.log('📎 Adjuntos procesados:', processedAttachments.length);
    console.log('📧 Enviando email con:');
    console.log('   To:', campaign.contacts.email);
    console.log('   Subject:', subject);

    await fetch('http://localhost:3002/api/draft-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        to: campaign.contacts.email,
        contactEmail: campaign.contacts.email,
        subject,
        body,
        attachments: processedAttachments,
        replyToEmail: replyToEmail
      }),
    });

    await db.updateCampaign(campaign.id, { emails_sent: emailNumber });
    console.log(`✅ Campaña ${campaign.id} actualizada: emails_sent = ${emailNumber}`);

    toast({ title: "Éxito", description: `Email ${emailNumber} enviado` });
    await fetchCampaigns();
  } catch (error) {
    console.error('❌ Error completo:', error);
    toast({ title: "Error", description: String(error), variant: "destructive" });
  }
};

  const handleDelete = async (id: string) => {
    try {
      await db.deleteCampaign(id);
      toast({ title: "Éxito", description: "Campaña eliminada" });
      initData();
    } catch (error) {
      console.error('Error eliminando campaña:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la campaña",
        variant: "destructive"
      });
    }
  };

  const handleBulkRoleChange = (role: string) => {
    setBulkFormData({ 
      ...bulkFormData, 
      gartner_role: role,
      template_id: "",
      selected_contacts: []
    });
    
    const availableTemplates = templates.filter(t => t.gartner_role === role);
    setBulkFilteredTemplates(availableTemplates);
    
    const availableContacts = contacts.filter(c => 
      c.gartner_role === role &&
      ALLOWED_CONTACT_TYPES.includes(c.contact_type)
    );
    setBulkFilteredContacts(availableContacts);
    setBulkContactSearch("");
    setBulkContactTypeFilter([]);
  };

  const toggleContactSelection = (contactId: string) => {
    setBulkFormData(prev => ({
      ...prev,
      selected_contacts: prev.selected_contacts.includes(contactId)
        ? prev.selected_contacts.filter(id => id !== contactId)
        : [...prev.selected_contacts, contactId]
    }));
  };

  const selectAllContacts = () => {
    const searchTerm = bulkContactSearch.toLowerCase().trim();
    let contactsToSelect = bulkFilteredContacts;

    if (bulkContactTypeFilter.length > 0) {
      contactsToSelect = contactsToSelect.filter(contact => {
        if (bulkContactTypeFilter.includes('Cliente')) {
          return contact.contact_type === 'Cliente' || contact.contact_type === 'Cliente proxy';
        }
        return bulkContactTypeFilter.includes(contact.contact_type);
      });
    }

    if (searchTerm) {
      contactsToSelect = contactsToSelect.filter((contact) => {
        const fullName = `${contact.first_name} ${contact.last_name}`.toLowerCase();
        const organization = contact.organization.toLowerCase();
        return fullName.includes(searchTerm) || organization.includes(searchTerm);
      });
    }

    setBulkFormData(prev => ({
      ...prev,
      selected_contacts: contactsToSelect.map(c => c.id)
    }));
  };

  const deselectAllContacts = () => {
    setBulkFormData(prev => ({
      ...prev,
      selected_contacts: []
    }));
  };

  const handleBulkDateChange = (emailNumber: number, newDate: string) => {
    if (!newDate) {
      setBulkFormData({ ...bulkFormData, [`email_${emailNumber}_date`]: newDate });
      return;
    }
    
    const dates: any = { ...bulkFormData };
    for (let i = emailNumber; i <= 5; i++) {
      if (i === emailNumber) {
        dates[`email_${i}_date`] = newDate;
      } else {
        const previousDate = new Date(dates[`email_${i-1}_date`]);
        if (dates[`email_${i-1}_date`]) {
          previousDate.setDate(previousDate.getDate() + 3);
          dates[`email_${i}_date`] = previousDate.toISOString().split("T")[0];
        }
      }
    }
    setBulkFormData(dates);
  };

const handleBulkSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  if (!bulkFormData.gartner_role || !bulkFormData.template_id || bulkFormData.selected_contacts.length === 0) {
    toast({
      title: "Error",
      description: "Por favor completa todos los campos y selecciona al menos un contacto",
      variant: "destructive",
    });
    return;
  }

  setIsCreating(true);
  try {
    const campaignsToCreate = bulkFormData.selected_contacts.map(contactId => ({
      contact_id: contactId,
      template_id: bulkFormData.template_id,
      start_campaign: bulkFormData.start_campaign,
      email_1_date: bulkFormData.email_1_date || null,
      email_2_date: bulkFormData.email_2_date || null,
      email_3_date: bulkFormData.email_3_date || null,
      email_4_date: bulkFormData.email_4_date || null,
      email_5_date: bulkFormData.email_5_date || null,
      status: bulkFormData.start_campaign ? "activa" : "pendiente",
    }));

    const createdCampaigns: Campaign[] = [];
    for (const campaign of campaignsToCreate) {
      const newCampaign = await db.createCampaign(campaign);
      createdCampaigns.push(newCampaign);
    }

    const today = new Date().toLocaleDateString('en-CA');
    if (bulkFormData.start_campaign && bulkFormData.email_1_date === today) {
      console.log(`🚀 Enviando primer email a ${createdCampaigns.length} campañas creadas hoy`);
      
      for (const campaign of createdCampaigns) {
        if (campaign && campaign.id) {
          try {
            await sendEmail(campaign as Campaign, 1);
          } catch (emailError) {
            console.error(`Error enviando email para campaña ${campaign.id}:`, emailError);
          }
        }
      }
    }

    await fetchCampaigns();

    toast({
      title: "Éxito",
      description: `${campaignsToCreate.length} campañas creadas correctamente`,
    });
    
    setIsBulkDialogOpen(false);
    resetBulkForm();

  } catch (error) {
    console.error("Error creando campañas:", error);
    toast({
      title: "Error",
      description: "No se pudieron crear las campañas",
      variant: "destructive",
    });
  } finally {
    setIsCreating(false);
  }
};

  const resetBulkForm = () => {
    setBulkFormData({
      gartner_role: "",
      template_id: "",
      selected_contacts: [],
      start_campaign: false,
      email_1_date: "",
      email_2_date: "",
      email_3_date: "",
      email_4_date: "",
      email_5_date: "",
    });
    setBulkFilteredTemplates([]);
    setBulkFilteredContacts([]);
    setBulkContactSearch("");
    setBulkContactTypeFilter([]);
  };

  const renderCampaignTable = (campaignsToRender: Campaign[], showHeader: boolean = true) => (
    <div className="bg-card rounded-lg shadow overflow-hidden overflow-x-auto">
      <Table className="w-full table-fixed">
        <colgroup>
          <col className="w-[100px]" />
          <col className="w-[160px]" />
          <col className="w-[100px]" />
          <col className="w-[100px]" />
          <col className="w-[100px]" />
          <col className="w-[240px]" />
        </colgroup>
        {showHeader && (
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted/50">
              <TableHead className="text-center">Organización</TableHead>
              <TableHead className="text-center">Nombre</TableHead>
              <TableHead className="text-center">Cargo</TableHead>
              <TableHead className="text-center">Rol Campaña</TableHead>
              <TableHead className="text-center">Estado</TableHead>
              <TableHead className="text-center">Progreso</TableHead>
            </TableRow>
          </TableHeader>
        )}
        <TableBody>
          {campaignsToRender.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="p-8 text-center text-muted-foreground">
                No hay campañas en esta sección
              </TableCell>
            </TableRow>
          ) : (
            campaignsToRender.map((campaign) => {
              const getNextEmail = (): { number: number; date: string } | null => {
                for (let i = campaign.emails_sent + 1; i <= 5; i++) {
                  const dateField = `email_${i}_date` as keyof Campaign;
                  const emailDate = campaign[dateField];
                  if (emailDate && typeof emailDate === 'string') {
                    return { number: i, date: emailDate };
                  }
                }
                return null;
              };
              
              const nextEmail = getNextEmail();
              const progress = (campaign.emails_sent / 5) * 100;
              
              return (
                <TableRow key={campaign.id} 
                          className={`cursor-pointer hover:bg-muted/50 text-sm text-center align-middle`}
                          onClick={() => navigate(`/campaigns/${campaign.id}`)}>
                  <TableCell className="p-1">{campaign.contacts.organization}</TableCell>
                  <TableCell>
                    <div className="flex flex-col items-center">
                      <span className="font-medium">{campaign.contacts.first_name} {campaign.contacts.last_name}</span>
                      <span className="text-xs text-muted-foreground">{campaign.contacts.email}</span>
                    </div>
                  </TableCell>
                  <TableCell className="p-1 text-xs">{campaign.contacts.title}</TableCell>
                  <TableCell className="p-1">
                    <div className="flex flex-col items-center">
                      <span className="font-medium">{campaign.contacts.gartner_role}</span>
                      <span className="text-muted-foreground">{campaign.campaign_templates.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="p-1">
                    {(() => {
                      const campaignStatus = getCampaignStatus(campaign);
                      return (
                        <div className="flex flex-col items-center gap-1">
                          {campaign.has_replied && campaign.response_text ? (
                            <Badge 
                              variant={campaignStatus.variant}
                              className="bg-green-500 hover:bg-green-600 text-white cursor-pointer transition-all"
                              onClick={() => {
                                setSelectedResponse({
                                  name: `${campaign.contacts.first_name} ${campaign.contacts.last_name}`,
                                  email: campaign.contacts.email,
                                  organization: campaign.contacts.organization,
                                  replyDate: campaign.last_reply_date || '',
                                  responseText: campaign.response_text || ''
                                });
                              }}
                            >
                              {campaignStatus.status}
                            </Badge>
                          ) : (
                            <Badge 
                              variant={campaignStatus.variant}
                              className={
                                campaignStatus.status === "Email incorrecto"
                                  ? "bg-red-500 hover:bg-red-600 text-white"
                                  : campaignStatus.status === "Respondido" 
                                  ? "bg-green-500 hover:bg-green-600 text-white" 
                                  : campaignStatus.status === "En curso"
                                  ? "bg-indigo-300 hover:bg-gray-600 text-white"
                                  : campaignStatus.status === "Completada sin respuesta"
                                  ? "bg-orange-500 hover:bg-orange-600 text-white"
                                  : campaignStatus.status === "No activa"
                                  ? "bg-slate-300 hover:bg-slate-600 text-slate"
                                  : ""
                              }
                            >
                              {campaignStatus.status}
                            </Badge>
                          )}
                          
                          {campaign.has_replied && campaign.last_reply_date && (
                            <span className="text-xs text-muted-foreground">
                              {formatDateTime(campaign.last_reply_date)}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </TableCell>
                  
                  <TableCell className="p-4">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            campaign.email_incorrect 
                              ? "bg-red-500" 
                              : campaign.has_replied 
                              ? "bg-green-500" 
                              : progress === 100 
                              ? "bg-orange-500" 
                              : "bg-indigo-500"
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between w-full text-xs">
                        <span className="font-medium text-muted-foreground">
                          {campaign.emails_sent}/5 enviados
                        </span>
                        
                        {nextEmail && !campaign.has_replied && !campaign.email_incorrect && campaign.emails_sent < 5 && (
                          <span className="text-indigo-500">
                            Siguiente email: {formatDateES(String(nextEmail.date))}
                          </span>
                        )}
                        
                        {campaign.emails_sent >= 5 && !campaign.has_replied && !campaign.email_incorrect && (
                          <span className="text-orange-600 font-medium">
                            ✓ Completa
                          </span>
                        )}
                        
                        {campaign.has_replied && (
                          <span className="text-green-600 font-medium">
                            ✓ Respondido
                          </span>
                        )}
                        
                        {campaign.email_incorrect && (
                          <span className="text-red-600 font-medium">
                            ✗ Email incorrecto
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );

  if (loading) return <div className="p-6">Cargando...</div>;

  return (
    <div className="bg-card rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold">Campañas</h2>
        <div className="flex gap-2 items-center">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="rounded-full shadow-sm hover:shadow-md transition-shadow bg-indigo-500 hover:bg-indigo-600"
                onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />Nueva Campaña Individual
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingCampaign ? "Editar Campaña" : "Nueva Campaña Individual"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Organización</Label>
                  <Select value={formData.organization} onValueChange={handleOrganizationChange} disabled={contacts.length === 0}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          contacts.length === 0
                            ? "No hay organizaciones disponibles"
                            : "Seleccionar organización"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {[...new Set(contacts.map(c => c.organization))].sort().map((org) => (
                        <SelectItem key={org} value={org}>{org}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Contacto</Label>
                  <Select 
                    value={formData.contact_id} 
                    onValueChange={handleContactChange}
                    disabled={!formData.organization || filteredContacts.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          !formData.organization
                            ? "Primero selecciona una organización"
                            : filteredContacts.length === 0
                            ? "No hay contactos disponibles"
                            : "Seleccionar contacto"
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
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.first_name} {c.last_name} ({c.title})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Plantilla</Label>
                  <Select 
                    value={formData.template_id} 
                    onValueChange={(v) => setFormData({ ...formData, template_id: v })}
                    disabled={!formData.contact_id || filteredTemplates.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={
                        !formData.organization 
                          ? "Primero selecciona una organización" 
                          : !formData.contact_id 
                          ? "Primero selecciona un contacto" 
                          : filteredTemplates.length === 0
                          ? "No hay plantillas disponibles"
                          : "Seleccionar"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredTemplates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="border-t pt-4">
                  <Label className="text-base font-semibold">Fechas de Envío</Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Al cambiar una fecha, las siguientes se recalcularán automáticamente (+3 días)
                  </p>

                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <Label>Fecha Email 1</Label>
                        <DatePicker
                          value={formData.email_1_date}
                          onChange={(date) => handleDateChange(1, date)}
                        />
                      </div>
                      <div className="flex-1">
                        <Label>Fecha Email 2</Label>
                        <DatePicker
                          value={formData.email_2_date}
                          onChange={(date) => handleDateChange(2, date)}
                        />
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex-1">
                        <Label>Fecha Email 3</Label>
                        <DatePicker
                          value={formData.email_3_date}
                          onChange={(date) => handleDateChange(3, date)}
                        />
                      </div>
                      <div className="flex-1">
                        <Label>Fecha Email 4</Label>
                        <DatePicker
                          value={formData.email_4_date}
                          onChange={(date) => handleDateChange(4, date)}
                        />
                      </div>
                    </div>

                    <div className="w-1/2">
                      <Label>Fecha Email 5</Label>
                      <DatePicker
                        value={formData.email_5_date}
                        onChange={(date) => handleDateChange(5, date)}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox checked={formData.start_campaign} onCheckedChange={(v) => setFormData({ ...formData, start_campaign: v as boolean })} />
                  <Label>Iniciar automáticamente la campaña</Label>
                </div>
                <div className="flex justify-between items-center">
                  {editingCampaign && (
                    <Button 
                      type="button" 
                      variant="destructive" 
                      onClick={() => {
                        handleDelete(editingCampaign.id);
                        setIsDialogOpen(false);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  {!editingCampaign && <div></div>}
                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="rounded-full"
                      onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                    <Button 
                      type="submit" 
                      disabled={isCreating}
                      className="rounded-full shadow-sm hover:shadow-md transition-shadow bg-indigo-500 hover:bg-indigo-600">
                      {isCreating 
                        ? "Creando campaña..." 
                        : editingCampaign 
                        ? "Actualizar" 
                        : "Crear"}
                    </Button>
                  </div>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          
          <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline"
                className="rounded-full shadow-sm hover:shadow-md transition-shadow hover:bg-indigo-100"
                onClick={resetBulkForm}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Campaña Masiva
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Crear Campaña Masiva</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleBulkSubmit} className="space-y-4">
                <div>
                  <Label>Rol de Campaña</Label>
                  <Select value={bulkFormData.gartner_role} onValueChange={handleBulkRoleChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar rol" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(new Set(templates.map(t => t.gartner_role))).map((role) => (
                        <SelectItem key={role} value={role}>{role}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Plantilla</Label>
                  <Select 
                    value={bulkFormData.template_id} 
                    onValueChange={(v) => setBulkFormData({ ...bulkFormData, template_id: v })}
                    disabled={!bulkFormData.gartner_role}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar plantilla" />
                    </SelectTrigger>
                    <SelectContent>
                      {bulkFilteredTemplates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label>Contactos ({bulkFormData.selected_contacts.length} seleccionados)</Label>
                    <div className="flex gap-2">
                      <Button 
                        type="button" 
                        size="sm" 
                        variant="outline"
                        onClick={selectAllContacts}
                        disabled={!bulkFormData.gartner_role}
                      >
                        Seleccionar todos
                      </Button>
                      <Button 
                        type="button" 
                        size="sm" 
                        variant="outline"
                        onClick={deselectAllContacts}
                        disabled={bulkFormData.selected_contacts.length === 0}
                      >
                        Deseleccionar todos
                      </Button>
                    </div>
                  </div>
                  {bulkFormData.gartner_role && bulkFilteredContacts.length > 0 && (
                    <div className="mb-3">
                      <Input
                        type="text"
                        placeholder="Buscar por nombre u organización..."
                        value={bulkContactSearch}
                        onChange={(e) => setBulkContactSearch(e.target.value)}
                        className="w-full"
                      />
                    </div>
                  )}

                  {bulkFormData.gartner_role && bulkFilteredContacts.length > 0 && (
                    <div className="flex gap-2 mb-3">
                      <button
                        type="button"
                        className={`filter-chip ${
                          bulkContactTypeFilter.includes('Cliente') 
                            ? "filter-chip-active"
                            : "filter-chip-inactive"
                        }`}
                        onClick={() => toggleBulkContactTypeFilter('Cliente')}
                      >
                        Clientes
                      </button>
                      <button
                        type="button"
                        className={`filter-chip ${
                          bulkContactTypeFilter.includes('Prospect') 
                            ? "filter-chip-active"
                            : "filter-chip-inactive"
                        }`}
                        onClick={() => toggleBulkContactTypeFilter('Prospect')}
                      >
                        Prospects
                      </button>
                      <button
                        type="button"
                        className={`filter-chip ${
                          bulkContactTypeFilter.includes('Oportunidad') 
                            ? "filter-chip-active"
                            : "filter-chip-inactive"
                        }`}
                        onClick={() => toggleBulkContactTypeFilter('Oportunidad')}
                      >
                        Oportunidades
                      </button>
                    </div>
                  )}
    
                  <div className="border rounded-md p-4 max-h-60 overflow-y-auto space-y-2">
                    {!bulkFormData.gartner_role ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Selecciona un rol para ver los contactos disponibles
                      </p>
                    ) : bulkFilteredContacts.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No hay contactos disponibles para este rol
                      </p>
                    ) : (
                      (() => {
                        const searchTerm = bulkContactSearch.toLowerCase().trim();
                        let filteredBySearch = bulkFilteredContacts;

                        if (bulkContactTypeFilter.length > 0) {
                          filteredBySearch = filteredBySearch.filter(contact => {
                            if (bulkContactTypeFilter.includes('Cliente')) {
                              if (contact.contact_type === 'Cliente' || contact.contact_type === 'Cliente proxy') {
                                return true;
                              }
                            }
                            return bulkContactTypeFilter.includes(contact.contact_type);
                          });
                        }

                        if (searchTerm) {
                          filteredBySearch = filteredBySearch.filter((contact) => {
                            const fullName = `${contact.first_name} ${contact.last_name}`.toLowerCase();
                            const organization = contact.organization.toLowerCase();
                            return fullName.includes(searchTerm) || organization.includes(searchTerm);
                          });
                        }

                        if (filteredBySearch.length === 0) {
                          return (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              No se encontraron contactos con los filtros aplicados
                            </p>
                          );
                        }

                        return filteredBySearch.map((contact) => (
                          <div key={contact.id} className="flex items-center space-x-2">
                            <Checkbox
                              checked={bulkFormData.selected_contacts.includes(contact.id)}
                              onCheckedChange={() => toggleContactSelection(contact.id)}
                            />
                            <label className="text-sm cursor-pointer flex-1" onClick={() => toggleContactSelection(contact.id)}>
                              {contact.organization} - {contact.first_name} {contact.last_name} ({contact.title}) [{contact.contact_type}] [Tier {contact.tier}]
                            </label>
                          </div>
                        ));
                      })()
                    )}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <Label className="text-base font-semibold">Fechas de Envío</Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Al cambiar una fecha, las siguientes se recalcularán automáticamente (+3 días)
                  </p>

                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <Label>Fecha Email 1</Label>
                        <DatePicker
                          value={bulkFormData.email_1_date}
                          onChange={(date) => handleBulkDateChange(1, date)}
                        />
                      </div>
                      <div className="flex-1">
                        <Label>Fecha Email 2</Label>
                        <DatePicker
                          value={bulkFormData.email_2_date}
                          onChange={(date) => handleBulkDateChange(2, date)}
                        />
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex-1">
                        <Label>Fecha Email 3</Label>
                        <DatePicker
                          value={bulkFormData.email_3_date}
                          onChange={(date) => handleBulkDateChange(3, date)}
                        />
                      </div>
                      <div className="flex-1">
                        <Label>Fecha Email 4</Label>
                        <DatePicker
                          value={bulkFormData.email_4_date}
                          onChange={(date) => handleBulkDateChange(4, date)}
                        />
                      </div>
                    </div>

                    <div className="w-1/2">
                      <Label>Fecha Email 5</Label>
                      <DatePicker
                        value={bulkFormData.email_5_date}
                        onChange={(date) => handleBulkDateChange(5, date)}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={bulkFormData.start_campaign}
                    onCheckedChange={(v) => setBulkFormData({ ...bulkFormData, start_campaign: v as boolean })}
                  />
                  <Label>Iniciar automáticamente las campañas</Label>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="rounded-full"
                    onClick={() => setIsBulkDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    type="submit"
                    disabled={isCreating}
                    className="rounded-full shadow-sm hover:shadow-md transition-shadow bg-indigo-500 hover:bg-indigo-600">
                    {isCreating 
                      ? "Creando campañas..." 
                      : `Crear ${bulkFormData.selected_contacts.length} Campaña${bulkFormData.selected_contacts.length !== 1 ? 's' : ''}`}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="mb-4 p-3 bg-muted/50 rounded-lg border border-border">
        <div className="flex justify-between items-center">
          <div className="flex-1">
            <p className="text-sm font-medium">Verificación de respuestas de campañas</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {(() => {
                const lastCheck = localStorage.getItem('last_email_check');
                if (!lastCheck) return 'No se ha verificado aún';
                
                const checkDate = new Date(parseInt(lastCheck));
                const now = new Date();
                const diffMinutes = Math.floor((now.getTime() - checkDate.getTime()) / (1000 * 60));
                
                const timeString = checkDate.toLocaleTimeString('es-ES', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                });
                
                if (diffMinutes < 1) return `Última verificación: hace menos de 1 minuto (${timeString})`;
                if (diffMinutes < 60) return `Última verificación: hace ${diffMinutes} minuto${diffMinutes > 1 ? 's' : ''} (${timeString})`;
                
                const diffHours = Math.floor(diffMinutes / 60);
                if (diffHours < 24) return `Última verificación: hace ${diffHours} hora${diffHours > 1 ? 's' : ''} (${timeString})`;
                
                const diffDays = Math.floor(diffHours / 24);
                const dateString = checkDate.toLocaleDateString('es-ES', { 
                  day: '2-digit', 
                  month: '2-digit' 
                });
                return `Última verificación: hace ${diffDays} día${diffDays > 1 ? 's' : ''} (${dateString} ${timeString})`;
              })()}
            </p>
          </div>
          <Button 
            variant="secondary"
            size="sm"
            onClick={() => {
              checkAllReplies();
              localStorage.setItem('last_email_check', Date.now().toString());
            }}
            disabled={checkingReplies}
          >
            {checkingReplies ? 'Verificando...' : 'Verificar ahora'}
          </Button>
        </div>
      </div>

      {renderCampaignTable(recentCampaigns)}

      {oldCampaigns.length > 0 && (
        <div className="mt-6">
          <Button
            variant="outline"
            className="w-full mb-4"
            onClick={() => setShowOldCampaigns(!showOldCampaigns)}
          >
            {showOldCampaigns ? (
              <>
                <ChevronUp className="mr-2 h-4 w-4" />
                Ocultar campañas antiguas ({oldCampaigns.length})
              </>
            ) : (
              <>
                <ChevronDown className="mr-2 h-4 w-4" />
                Ver campañas antiguas ({oldCampaigns.length})
              </>
            )}
          </Button>

          {showOldCampaigns && (
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold mb-3 text-muted-foreground">
                Campañas antiguas (último email hace más de 2 meses)
              </h3>
              {renderCampaignTable(oldCampaigns, false)}
            </div>
          )}
        </div>
      )}

      <AlertDialog open={!!repliedContact} onOpenChange={(open) => !open && setRepliedContact(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <span className="text-2xl">🎉</span>
              ¡El contacto ha respondido!
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p className="text-base">
                <strong className="text-foreground">
                  {repliedContact?.name}
                </strong>
                {' '}ha respondido a la campaña.
              </p>
              <p className="text-sm text-muted-foreground">
                📧 Email: {repliedContact?.email}
              </p>
              <p className="text-sm text-muted-foreground">
                📅 Fecha de respuesta: {repliedContact?.replyDate ? formatDateTime(repliedContact.replyDate) : 'Hoy'}
              </p>
              {repliedContact?.responseText && (
                <div className="mt-3 p-3 bg-muted rounded-md max-h-40 overflow-y-auto overflow-x-hidden">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Vista previa del mensaje:</p>
                  <div className="text-sm text-foreground italic break-all whitespace-pre-wrap overflow-wrap-anywhere">
                    "{renderTextWithLinks(repliedContact.responseText)}..."
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction 
              onClick={() => setRepliedContact(null)}
              className="bg-green-500 hover:bg-green-600"
            >
              Entendido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!selectedResponse} onOpenChange={(open) => !open && setSelectedResponse(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-xl">💬</span>
              Respuesta de {selectedResponse?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                📧 Email: {selectedResponse?.email}
              </p>
              <p className="text-sm text-muted-foreground">
                🏢 Organización: {selectedResponse?.organization}
              </p>
              <p className="text-sm text-muted-foreground">
                📅 Fecha de respuesta: {selectedResponse?.replyDate ? formatDateTime(selectedResponse.replyDate) : '-'}
              </p>
            </div>
            <div className="mt-4 p-4 bg-muted rounded-lg max-h-60 overflow-y-auto overflow-x-hidden">
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                Contenido de la respuesta:
              </p>
              <div className="text-sm text-foreground whitespace-pre-wrap break-all overflow-wrap-anywhere">
                {selectedResponse?.responseText && renderTextWithLinks(selectedResponse.responseText)}
              </div>
            </div>
          </div>
          
          <div className="flex justify-end pt-4">
            <Button onClick={() => setSelectedResponse(null)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};