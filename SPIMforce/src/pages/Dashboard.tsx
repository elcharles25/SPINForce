import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "@/lib/db-adapter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, Target, TrendingUp, Mail, CircleArrowRight, XCircle, Clock, Building2, Zap, Award, Activity, Briefcase, CalendarCheck, CircleCheckBig, CircleOff, AlertCircle, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Bar } from "react-chartjs-2";
import { formatDateTime } from "@/utils/dateFormatter";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface DashboardMetrics {
  contacts: {
    total: number;
    byType: Record<string, number>;
    byTier: Record<string, number>;
    contacted: number;
    interested: number;
    withPA: number;
    webinarsSubscribed: number;
  };
  accounts: {
    total: number;
  };
  campaigns: {
    total: number;
    active: number;
    completed: number;
    replied: number;
    replyRate: number;
    campaignsInactive: number;
    bounced: number;
    pending: number;
    waiting: number;
    totalEmailsSent: number;
    averageEmailsPerCampaign: number;
  };
  opportunities: {
    total: number;
    byStatus: Record<string, number>;
    withOffer: number;
    conversionRate: number;
    totalMeetings: number;
    averageMeetingsPerOpp: number;
    wonOpportunitiesCount: number;
    staleOpportunities: Array<{
      id: string;
      organization: string;
      contactName: string;
    }>;
  };
  webinars: {
    total: number;
    sent: number;
    pending: number;
    subscribedContacts: number;
  };
}

interface ReplyRateByTemplate {
  templateName: string;
  total: number;
  replied: number;
  replyRate: number;
}

interface ReplyRateByRole {
  role: string;
  total: number;
  replied: number;
  replyRate: number;
}

interface Meeting {
  id: string;
  meeting_date: string;
  meeting_type: string;
  organization: string;
  contactName: string;
  contactId: string;
  opportunityId: string;
  }

const Dashboard = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReplyRateDialog, setShowReplyRateDialog] = useState(false);
  const [replyRateByTemplate, setReplyRateByTemplate] = useState<ReplyRateByTemplate[]>([]);
  const [replyRateByRole, setReplyRateByRole] = useState<ReplyRateByRole[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDayMeetings, setSelectedDayMeetings] = useState<Meeting[]>([]);
  const [showMeetingsDialog, setShowMeetingsDialog] = useState(false);

  useEffect(() => {
    loadDashboardMetrics();
  }, []);

  const parseFlexibleDate = (dateString: string | null | undefined): Date => {
    if (!dateString) return new Date(0);
    
    try {
      if (dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
        return new Date(dateString);
      }
      
      if (dateString.match(/^\d{2}\/\d{2}\/\d{4}/)) {
        const parts = dateString.split(' ');
        const datePart = parts[0];
        const timePart = parts[1] || '00:00';
        
        const [day, month, year] = datePart.split('/');
        const [hours, minutes] = timePart.split(':');
        
        return new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          parseInt(hours || '0'),
          parseInt(minutes || '0')
        );
      }
      
      const parsed = new Date(dateString);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
      
      return new Date();
    } catch (error) {
      console.error('Error parseando fecha:', dateString, error);
      return new Date();
    }
  };

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

  const formatDate = (dateString: string) => {
    const date = parseFlexibleDate(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Justo ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 8) return `Hace ${diffDays}d`;
    return date.toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

const loadMeetings = async () => {
  try {
    const allMeetings: Meeting[] = [];
    const allowedTypes = ['SKO', 'QBR 90', 'QBR Midyear', 'QBR AA90', 'Qualification', 'Cap. Alignment', 'IPW', 'POC', 'EP POC', 'Proposal'];

    // Cargar reuniones CON oportunidad
    const opportunities = await db.getOpportunities();
    for (const opp of opportunities) {
      try {
        const oppMeetings = await db.getMeetingsByOpportunity(opp.id);
        
        oppMeetings.forEach((meeting: any) => {
          const meetingType = meeting.meeting_type?.trim();
          
          if (meetingType && allowedTypes.includes(meetingType)) {
            allMeetings.push({
              id: meeting.id,
              meeting_date: meeting.meeting_date,
              meeting_type: meetingType,
              organization: opp.contact.organization,
              contactName: `${opp.contact.first_name} ${opp.contact.last_name}`,
              opportunityId: opp.id,
              contactId: meeting.contact_id,
            });
          }
        });
      } catch (error) {
        console.error(`Error loading meetings for opportunity ${opp.id}:`, error);
      }
    }

    // Cargar reuniones SIN oportunidad
    try {
  const meetingsWithoutOpp = await db.getMeetingsWithoutOpportunity();
  
  meetingsWithoutOpp.forEach((meeting: any) => {
    const meetingType = meeting.meeting_type?.trim();
    
    if (meetingType && allowedTypes.includes(meetingType)) {
      allMeetings.push({
        id: meeting.id,
        meeting_date: meeting.meeting_date,
        meeting_type: meetingType,
        organization: meeting.contact?.organization || 'Sin organización',
        contactName: meeting.contact ? `${meeting.contact.first_name} ${meeting.contact.last_name}` : 'Sin contacto',
        opportunityId: '',
        contactId: meeting.contact_id,
      });
    }
  });
  } catch (error) {
    console.error('Error loading meetings without opportunity:', error);
  }

    setMeetings(allMeetings);
  } catch (error) {
    console.error('Error loading meetings:', error);
  }
};

  const loadDashboardMetrics = async () => {
    try {
      const [accounts, contacts, campaigns, opportunities, distributions, templates] = await Promise.all([
        db.getAccounts(),
        db.getContacts(),
        db.getCampaigns(),
        db.getOpportunities(),
        db.getDistributions(),
        db.getTemplates(),
      ]);

      const contactsByType: Record<string, number> = {};
      const contactsByTier: Record<string, number> = {};
      let contactedCount = 0;
      let interestedCount = 0;
      let withPACount = 0;
      let webinarsSubscribedCount = 0;

      contacts.forEach((contact: any) => {
        contactsByType[contact.contact_type] = (contactsByType[contact.contact_type] || 0) + 1;
        if (contact.tier) {
          contactsByTier[contact.tier] = (contactsByTier[contact.tier] || 0) + 1;
        }
        if (contact.contacted) contactedCount++;
        if (contact.interested) interestedCount++;
        if (contact.pa_name || contact.pa_email || contact.pa_phone) withPACount++;
        if (contact.webinars_subscribed) webinarsSubscribedCount++;
      });

      let activeCount = 0;
      let completedCount = 0;
      let repliedCount = 0;
      let bouncedCount = 0;
      let pendingCount = 0;
      let waitingCount = 0;
      let totalEmailsSent = 0;
      let wonOpportunitiesCount = 0;

      const hoy = normalizeToStartOfDay(new Date());

      campaigns.forEach((campaign: any) => {
        totalEmailsSent += campaign.emails_sent || 0;

        if (campaign.email_incorrect) {
          bouncedCount++;
        } else if (campaign.has_replied) {
          repliedCount++;
        } else if (campaign.emails_sent >= 5) {
          completedCount++;
        } else if (campaign.start_campaign && campaign.email_1_date) {
          const email1Date = parseDateSafe(campaign.email_1_date);
          if (email1Date) {
            const fechaEmail1 = normalizeToStartOfDay(email1Date);
            if (fechaEmail1 > hoy) {
              waitingCount++;
            } else {
              activeCount++;
            }
          } else {
            activeCount++;
          }
        } else {
          pendingCount++;
        }
      });

      const campaignsInactive = (repliedCount + completedCount);
      const campaignsInactActive = (campaignsInactive + activeCount);
      const replyRate = campaigns.length > 0 ? (repliedCount / campaignsInactActive) * 100 : 0;
      const averageEmailsPerCampaign = campaigns.length > 0 ? totalEmailsSent / campaignsInactActive : 0;

      const templateMap: Record<string, { total: number; replied: number; name: string }> = {};

      campaigns.forEach((campaign: any) => {
        if (campaign.template_id && campaign.campaign_templates) {
          const templateId = campaign.template_id;
          const templateName = campaign.campaign_templates.name;

          if (!templateMap[templateId]) {
            templateMap[templateId] = { total: 0, replied: 0, name: templateName };
          }

          templateMap[templateId].total++;
          if (campaign.has_replied) {
            templateMap[templateId].replied++;
          }
        }
      });

      const templateStats = Object.values(templateMap).map(template => ({
        templateName: template.name,
        total: template.total,
        replied: template.replied,
        replyRate: template.total > 0 ? (template.replied / template.total) * 100 : 0
      })).sort((a, b) => b.replyRate - a.replyRate);

      setReplyRateByTemplate(templateStats);

      const roleMap: Record<string, { total: number; replied: number }> = {};

      campaigns.forEach((campaign: any) => {
        if (campaign.contacts && campaign.contacts.gartner_role) {
          const role = campaign.contacts.gartner_role;

          if (!roleMap[role]) {
            roleMap[role] = { total: 0, replied: 0 };
          }

          roleMap[role].total++;
          if (campaign.has_replied) {
            roleMap[role].replied++;
          }
        }
      });

      const roleStats = Object.entries(roleMap).map(([role, stats]) => ({
        role,
        total: stats.total,
        replied: stats.replied,
        replyRate: stats.total > 0 ? (stats.replied / stats.total) * 100 : 0
      })).sort((a, b) => b.replyRate - a.replyRate);

      setReplyRateByRole(roleStats);

      const opportunitiesByStatus: Record<string, number> = {};
      let withOfferCount = 0;
      let totalMeetings = 0;
      const staleOpportunitiesList: Array<{
        id: string;
        organization: string;
        contactName: string;
      }> = [];

      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      for (const opp of opportunities) {
        opportunitiesByStatus[opp.status] = (opportunitiesByStatus[opp.status] || 0) + 1;

        if (opp.status === "Cerrada ganada") {
          wonOpportunitiesCount++;
        }

        if (opp.offer_presented) {
          withOfferCount++;
        }

        try {
          const meetings = await db.getMeetingsByOpportunity(opp.id);
          
          const filteredMeetings = meetings.filter(
            (meeting: any) => 
              meeting.meeting_type !== 'Email' && 
              meeting.meeting_type !== 'Teléfono'
          );

          totalMeetings += filteredMeetings.length;

          if (filteredMeetings.length > 0) {
            const sortedMeetings = [...filteredMeetings].sort((a: any, b: any) => {
              const dateA = parseFlexibleDate(a.meeting_date).getTime();
              const dateB = parseFlexibleDate(b.meeting_date).getTime();
              return dateB - dateA;
            });

            const lastMeetingDate = parseFlexibleDate(sortedMeetings[0].meeting_date);
            
            if (lastMeetingDate < oneMonthAgo && 
                opp.status !== 'Cerrada ganada' && 
                opp.status !== 'Cerrada perdida') {
              staleOpportunitiesList.push({
                id: opp.id,
                organization: opp.contact.organization,
                contactName: `${opp.contact.first_name} ${opp.contact.last_name}`
              });
            }
          }
        } catch (error) {
          console.error(`Error loading meetings for opportunity ${opp.id}:`, error);
        }
      }

      const prospectsAndOpps = contacts.filter((c: any) =>
        c.contact_type === 'Prospect' || c.contact_type === 'Oportunidad'
      ).length;
      const conversionRate = prospectsAndOpps > 0 ? (opportunities.length / prospectsAndOpps) * 100 : 0;

      const averageMeetingsPerOpp = opportunities.length > 0 ? totalMeetings / opportunities.length : 0;

      const sentDistributions = distributions.filter((d: any) => d.sent).length;
      const pendingDistributions = distributions.filter((d: any) => !d.sent).length;

      setMetrics({
        contacts: {
          total: contacts.length,
          byType: contactsByType,
          byTier: contactsByTier,
          contacted: contactedCount,
          interested: interestedCount,
          withPA: withPACount,
          webinarsSubscribed: webinarsSubscribedCount,
        },
        accounts: {
          total: accounts.length,
        },
        campaigns: {
          total: campaigns.length,
          active: activeCount,
          completed: completedCount,
          replied: repliedCount,
          replyRate,
          bounced: bouncedCount,
          pending: pendingCount,
          waiting: waitingCount,
          totalEmailsSent,
          averageEmailsPerCampaign,
          campaignsInactive,
        },
        opportunities: {
          total: opportunities.length,
          byStatus: opportunitiesByStatus,
          withOffer: withOfferCount,
          conversionRate,
          totalMeetings,
          averageMeetingsPerOpp,
          wonOpportunitiesCount,
          staleOpportunities: staleOpportunitiesList,
        },
        webinars: {
          total: distributions.length,
          sent: sentDistributions,
          pending: pendingDistributions,
          subscribedContacts: webinarsSubscribedCount,
        },
      });

      await loadMeetings();
    } catch (error) {
      console.error("Error loading dashboard metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(0)}%`;
  };

  const statusOrder = [
    'Abierta',
    'Qualification',
    'Capabilities',
    'Propuesta',
    'Cerrada ganada',
    'Cerrada perdida'
  ];

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    
    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const getMeetingsForDay = (day: number) => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    return meetings.filter(meeting => {
      const meetingDate = parseFlexibleDate(meeting.meeting_date);
      return (
        meetingDate.getFullYear() === year &&
        meetingDate.getMonth() === month &&
        meetingDate.getDate() === day
      );
    });
  };

  const getMeetingColor = (meetingType: string) => {
    if (meetingType === 'SKO' || meetingType === 'QBR 90'|| meetingType === 'QBR Midyear'|| meetingType === 'QBR AA90') {
      return 'bg-indigo-500';
    }
    return 'bg-amber-500';
  };

  const handleDayClick = (day: number) => {
    const dayMeetings = getMeetingsForDay(day);
    if (dayMeetings.length > 0) {
      setSelectedDayMeetings(dayMeetings);
      setShowMeetingsDialog(true);
    }
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const renderCalendar = () => {
    const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth);
    const days = [];
    const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom' ];

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="h-16 border border-gray-100"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dayMeetings = getMeetingsForDay(day);
      const isToday = new Date().getDate() === day && 
                      new Date().getMonth() === month && 
                      new Date().getFullYear() === year;

      days.push(
        <div
          key={day}
          onClick={() => handleDayClick(day)}
          className={`h-16 border border-gray-100 p-1 ${
            dayMeetings.length > 0 ? 'cursor-pointer hover:bg-gray-50' : ''
          } ${isToday ? 'bg-indigo-50' : ''}`}
        >
          <div className={`text-sm font-medium ${isToday ? 'text-indigo-600' : 'text-gray-700'}`}>
            {day}
          </div>
          <div className="mt-0.5 space-y-0.5">
            {dayMeetings.slice(0, 2).map((meeting, idx) => (
              <div
                key={idx}
                className={`text-xs px-0.5 py-0 rounded text-white truncate ${getMeetingColor(meeting.meeting_type)}`}
                title={`${meeting.meeting_type} - ${meeting.organization}`}
              >
                {meeting.meeting_type}
              </div>
            ))}
            {dayMeetings.length > 2 && (
              <div className="text-xs text-gray-500 px-0.5">
                +{dayMeetings.length - 2} más
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="grid grid-cols-7 gap-0">
          {dayNames.map(name => (
            <div key={name} className="text-center text-xs font-semibold text-gray-600 py-2 border border-gray-100 bg-gray-50">
              {name}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0">
          {days}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <Activity className="h-12 w-12 mx-auto mb-4 animate-pulse text-indigo-500" />
              <p className="text-muted-foreground">Cargando métricas...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-center text-muted-foreground">No se pudieron cargar las métricas</p>
        </div>
      </div>
    );
  }

if (metrics.contacts.total === 0 && metrics.accounts.total === 0) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Dashboard Comercial</h1>
              <p className="text-muted-foreground mt-1">Resumen general de actividad y rendimiento</p>
            </div>
          </div>

          <Card className="border-2 border-dashed border-indigo-200">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="rounded-full bg-indigo-50 p-6 mb-6">
                <Users className="h-16 w-16 text-indigo-400" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Todavía no has creado ninguna cuenta ni nungún contacto
              </h3>
              <p className="text-muted-foreground text-center mb-6 max-w-xl">
                Crea primero una cuenta y después un contacto para empezar a ver información en el dashboard y comenzar a gestionar tus campañas y oportunidades
              </p>
              <div className="flex gap-4">
                  <button
                    onClick={() => navigate('/accounts')}
                    className="flex px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                  >
                    Ir a Cuentas
                  </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (metrics.contacts.total === 0 && metrics.accounts.total > 0) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Dashboard Comercial</h1>
              <p className="text-muted-foreground mt-1">Resumen general de actividad y rendimiento</p>
            </div>
          </div>

          <Card className="border-2 border-dashed border-indigo-200">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="rounded-full bg-indigo-50 p-6 mb-6">
                <Users className="h-16 w-16 text-indigo-400" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Todavía no has creado ningún contacto
              </h3>
              <p className="text-muted-foreground text-center mb-6 max-w-xl">
                Crea un contacto para empezar a ver información en el dashboard y comenzar a gestionar tus campañas y oportunidades
              </p>  
              <button
                onClick={() => navigate('/crm')}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
              >
                Ir a Contactos
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard Comercial</h1>
            <p className="text-muted-foreground mt-1">Resumen general de actividad y rendimiento</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              <Clock className="h-3 w-3 mr-1" />
              Actualizado ahora
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow bg-gradient-to-br from-indigo-50 to-white border-indigo-100"
            onClick={() => navigate('/crm')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total contactos</CardTitle>
              <Users className="h-5 w-5 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{metrics.contacts.total}</div>
              <div className="flex gap-2 justify-center mt-3">
                <Badge variant="outline" className="text-xs bg-green-100 text-green-700">
                  {metrics.contacts.interested} interesados
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {metrics.contacts.contacted} contactados
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow bg-gradient-to-br from-indigo-50 to-white border-indigo-100"
            onClick={() => navigate('/campaigns')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Campañas activas</CardTitle>
              <Target className="h-5 w-5 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{metrics.campaigns.active}</div>
              <div className="flex justify-center gap-2 mt-3">
                <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-200">
                  {metrics.campaigns.replied} respondidas
                </Badge>
                <Badge variant="outline" className="text-xs bg-red-100 border-red-200">
                  {metrics.campaigns.bounced} emails erróneos
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow bg-gradient-to-br from-indigo-50 to-white border-indigo-100"
            onClick={() => navigate('/opportunities')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Oportunidades en curso</CardTitle>
              <Briefcase className="h-5 w-5 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{metrics.opportunities.total}</div>
              <div className="flex justify-center gap-2 mt-3">
                <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-200">
                  {metrics.opportunities.withOffer} con oferta
                </Badge>
                <Badge variant="outline" className="text-xs bg-amber-50 border-amber-200 text-amber-900">
                  {metrics.opportunities.staleOpportunities.length} con baja actividad
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow bg-gradient-to-br from-indigo-50 to-white border-indigo-100"
            onClick={() => navigate('/webinars')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Webinars enviados</CardTitle>
              <CalendarCheck className="h-5 w-5 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{metrics.webinars.total}</div>
              <div className="flex justify-center gap-2 mt-3">
                <Badge variant="outline" className="text-xs">
                  {metrics.webinars.sent} enviados
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {metrics.webinars.subscribedContacts} suscritos
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="lg:col-span-7">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Rendimiento de Campañas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {metrics.campaigns.total === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-indigo-50 p-4 mb-4">
                    <Target className="h-12 w-12 text-indigo-300" />
                  </div>
                  <p className="text-muted-foreground mb-2 font-medium">
                    Aún no has creado ninguna campaña
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Crea una campaña para empezar a ver información de rendimiento
                  </p>
                  <button
                    onClick={() => navigate('/campaigns')}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Ir a Campañas
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div 
                      className="text-center p-6 bg-gradient-to-br from-indigo-50 to-white rounded-lg border border-indigo-100 cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setShowReplyRateDialog(true)}
                    >
                      <div className="text-2xl font-bold">
                        {formatPercentage(metrics.campaigns.replyRate)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Tasa de respuesta</div>
                    </div>
                    <div className="text-center p-6 bg-gradient-to-br from-indigo-50 to-white rounded-lg border border-indigo-100">
                      <div className="text-2xl font-bold">
                        {metrics.campaigns.campaignsInactive}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Campañas completadas</div>
                    </div>
                    <div className="text-center p-6 bg-gradient-to-br from-indigo-50 to-white rounded-lg border border-indigo-100">
                      <div className="text-2xl font-bold">
                        {metrics.campaigns.averageEmailsPerCampaign.toFixed(1)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Emails promedio</div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CircleArrowRight className="h-4 w-4 text-indigo-600" />
                        <span className="text-sm font-medium">En Curso</span>
                      </div>
                      <span className="text-sm font-bold text-indigo-600">{metrics.campaigns.active}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-indigo-300 h-2 rounded-full transition-all"
                        style={{ width: `${(metrics.campaigns.active / metrics.campaigns.total) * 100}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <div className="flex items-center gap-2">
                        <CircleCheckBig className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium">Respondidas</span>
                      </div>
                      <span className="text-sm font-bold text-green-600">{metrics.campaigns.replied}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-mediumseagreen h-2 rounded-full transition-all"
                        style={{ width: `${(metrics.campaigns.replied / metrics.campaigns.total) * 100}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-slate-600" />
                        <span className="text-sm font-medium">Pendientes</span>
                      </div>
                      <span className="text-sm font-bold text-slate-600">{metrics.campaigns.waiting}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-slate-400 h-2 rounded-full transition-all"
                        style={{ width: `${(metrics.campaigns.waiting / metrics.campaigns.total) * 100}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <div className="flex items-center gap-2">
                        <CircleOff className="h-4 w-4 text-orange-600" />
                        <span className="text-sm font-medium">Completadas sin respuesta</span>
                      </div>
                      <span className="text-sm font-bold text-orange-600">{metrics.campaigns.completed}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-orange-300 h-2 rounded-full transition-all"
                        style={{ width: `${(metrics.campaigns.completed / metrics.campaigns.total) * 100}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-medium">Email erróneo</span>
                      </div>
                      <span className="text-sm font-bold text-red-600">{metrics.campaigns.bounced}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-red-300 h-2 rounded-full transition-all"
                        style={{ width: `${(metrics.campaigns.bounced / metrics.campaigns.total) * 100}%` }}
                      />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-5">
            <CardHeader className="flex flex-col gap-3 pb-2">
              <CardTitle className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  Reuniones agendadas
                </span>
              </CardTitle>
              <div className="flex items-center justify-between">
                <button
                  onClick={previousMonth}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-sm font-medium">
                  {currentMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  onClick={nextMonth}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {meetings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-4 text-center">
                  <div className="rounded-full bg-indigo-50 p-4 mb-4">
                    <Calendar className="h-8 w-8 text-indigo-300" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    No hay reuniones agendadas
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {renderCalendar()}
                  <div className="flex gap-4 justify-center pt-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-indigo-500"></div>
                      <span className="text-xs text-gray-600">SKO/QBR</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-amber-500"></div>
                      <span className="text-xs text-gray-600">Oportunidades</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Distribución de Contactos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {metrics.contacts.total === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-indigo-50 p-4 mb-4">
                    <Users className="h-12 w-12 text-indigo-300" />
                  </div>
                  <p className="text-muted-foreground mb-2 font-medium">
                    Aún no tienes contactos
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Crea contactos para ver su distribución
                  </p>
                  <button
                    onClick={() => navigate('/crm')}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Ir a Contactos
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-1 text-center p-4 rounded-lg border border-indigo-100">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-medium">Por tipo de contacto</span>
                    </div>
                    {Object.entries(metrics.contacts.byType)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([type, count]) => (
                        <div key={type}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm">{type}</span>
                            <span className="text-sm font-bold">{count}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="h-2 rounded-full transition-all bg-indigo-300"
                              style={{ width: `${(count / metrics.contacts.total) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>

                  <div className="space-y-1 text-center p-4 rounded-lg border border-indigo-100">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-medium">Por nivel de Tier</span>
                    </div>
                    {Object.entries(metrics.contacts.byTier)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([tier, count]) => (
                        <div key={tier}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm">Tier {tier}</span>
                            <span className="text-sm font-bold">{count}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="h-2 rounded-full transition-all bg-indigo-300"
                              style={{ width: `${(count / metrics.contacts.total) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Pipeline de Oportunidades
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {metrics.opportunities.total === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-indigo-50 p-4 mb-4">
                    <Briefcase className="h-12 w-12 text-indigo-300" />
                  </div>
                  <p className="text-muted-foreground mb-2 font-medium">
                    Aún no has creado ninguna oportunidad
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Crea una oportunidad para empezar a ver información del pipeline
                  </p>
                  <button
                    onClick={() => navigate('/opportunities')}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Ir a Oportunidades
                  </button>
                </div>
              ) : (
                <>
                <div className="flex justify-center gap-2">
                  <Badge variant="outline" className="text-xs">
                  Tasa de conversión: {formatPercentage(metrics.opportunities.wonOpportunitiesCount)}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Reuniones por oportunidad: {metrics.opportunities.averageMeetingsPerOpp.toFixed(1)}                
                </Badge>
                </div>
                  {metrics.opportunities.staleOpportunities.length > 0 && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-amber-900">
                              {metrics.opportunities.staleOpportunities.length} oportunidad{metrics.opportunities.staleOpportunities.length !== 1 ? 'es' : ''} con baja actividad
                            </p>
                            <p className="text-xs text-amber-700 mt-1 italic">
                                Oportunidades sin reuniones en más de 1 mes
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => navigate('/opportunities?filter=stale')}
                          className="text-xs font-medium text-amber-700 hover:text-amber-700 whitespace-nowrap"
                        >
                          Ver oportunidades
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="space-y-3">
                    {statusOrder.map(status => {
                      const count = metrics.opportunities.byStatus[status] || 0;
                      return (
                        <div key={status}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm">{status}</span>
                            <span className="text-sm font-bold">{count}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                status === 'Cerrada ganada' ? 'bg-green-500' :
                                status === 'Cerrada perdida' ? 'bg-black' :
                                'bg-indigo-300'
                              }`}
                              style={{ width: `${(count / metrics.opportunities.total) * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Dialog open={showReplyRateDialog} onOpenChange={setShowReplyRateDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-2xl">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Análisis de Tasa de Respuesta
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Mail className="h-5 w-5 text-indigo-600" />
                  Tasa de Respuesta por Tipo de Campaña
                </h3>
                {replyRateByTemplate.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay datos de campañas disponibles
                  </p>
                ) : (
                  <div className="space-y-3">
                    {replyRateByTemplate.map((template, index) => (
                      <div key={index} className="p-4 bg-gradient-to-br from-gray-50 to-white rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="font-medium text-sm">{template.templateName}</span>
                            <p className="text-xs text-muted-foreground mt-1">
                              {template.replied} respuestas de {template.total} campañas
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={template.replyRate >= 20 ? "bg-green-50 border-mediumseagreen text-gray-700 hover:bg-green-50" : ""}
                          >
                            {formatPercentage(template.replyRate)}
                          </Badge>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              template.replyRate >= 30 ? 'bg-mediumseagreen' :
                              template.replyRate >= 20 ? 'mediumseagreen' :
                              template.replyRate >= 10 ? 'bg-yellow-300' :
                              'bg-red-300'
                            }`}
                            style={{ width: `${Math.min(template.replyRate, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-600" />
                  Tasa de Respuesta por Rol
                </h3>
                {replyRateByRole.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay datos de roles disponibles
                  </p>
                ) : (
                  <div className="space-y-3">
                    {replyRateByRole.map((role, index) => (
                      <div key={index} className="p-4 bg-gradient-to-br from-gray-50 to-white rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="font-medium text-sm">{role.role}</span>
                            <p className="text-xs text-muted-foreground mt-1">
                              {role.replied} respuestas de {role.total} campañas
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={role.replyRate >= 20 ? "bg-green-50 border-mediumseagreen text-gray-700 hover:bg-green-50" : ""}
                          >
                            {formatPercentage(role.replyRate)}
                          </Badge>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              role.replyRate >= 30 ? 'bg-mediumseagreen' :
                              role.replyRate >= 20 ? 'mediumseagreen' :
                              role.replyRate >= 10 ? 'bg-yellow-300' :
                              'bg-red-300'
                            }`}
                            style={{ width: `${Math.min(role.replyRate, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showMeetingsDialog} onOpenChange={setShowMeetingsDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-600" />
                Reuniones del día
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {selectedDayMeetings.map((meeting, index) => (
                <div
                  key={index}
                  className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/crm/${meeting.contactId}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge
                          className={`${
                            meeting.meeting_type === 'SKO' || meeting.meeting_type === 'QBR 90' || meeting.meeting_type === 'QBR Midyear' || meeting.meeting_type === 'QBR AA90'
                              ? 'bg-indigo-500'
                              : 'bg-amber-500'
                          } text-white`}
                        >
                          {meeting.meeting_type}
                        </Badge>
                      </div>
                      <p className="font-medium text-sm">{meeting.organization}</p>
                      <p className="text-xs text-muted-foreground">{meeting.contactName}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Dashboard;