import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "@/lib/db-adapter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, Target, TrendingUp, Mail, Calendar, CheckCircle2, XCircle, Clock, Building2, Zap, Award, Activity, Briefcase, CalendarCheck, CircleCheckBig, CircleOff, AlertCircle } from "lucide-react";
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
  campaigns: {
    total: number;
    active: number;
    completed: number;
    replied: number;
    replyRate: number;
    campaignsInactive: number;
    bounced: number;
    pending: number;
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
  };
  webinars: {
    total: number;
    sent: number;
    pending: number;
    subscribedContacts: number;
  };
  recentActivity: Array<{
    type: string;
    description: string;
    date: string;
    icon: string;
  }>;
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

const Dashboard = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReplyRateDialog, setShowReplyRateDialog] = useState(false);
  const [replyRateByTemplate, setReplyRateByTemplate] = useState<ReplyRateByTemplate[]>([]);
  const [replyRateByRole, setReplyRateByRole] = useState<ReplyRateByRole[]>([]);

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

  const loadDashboardMetrics = async () => {
    try {
      const [contacts, campaigns, opportunities, distributions, templates] = await Promise.all([
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
      let totalEmailsSent = 0;
      let wonOpportunitiesCount = 0;

      campaigns.forEach((campaign: any) => {
        totalEmailsSent += campaign.emails_sent || 0;

        if (campaign.email_incorrect) {
          bouncedCount++;
        } else if (campaign.has_replied) {
          repliedCount++;
        } else if (campaign.emails_sent >= 5) {
          completedCount++;
        } else if (campaign.start_campaign) {
          activeCount++;
        } else {
          pendingCount++;
        }
      });

      const campaignsInactive = (repliedCount + completedCount);
      const replyRate = campaigns.length > 0 ? (repliedCount / campaigns.length) * 100 : 0;
      const averageEmailsPerCampaign = campaigns.length > 0 ? totalEmailsSent / campaigns.length : 0;

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
          totalMeetings += meetings.length;
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

      const recentActivity: Array<{
        type: string;
        description: string;
        date: string;
        icon: string;
      }> = [];

      campaigns
        .filter((c: any) => c.has_replied && c.last_reply_date)
        .sort((a: any, b: any) => parseFlexibleDate(b.last_reply_date).getTime() - parseFlexibleDate(a.last_reply_date).getTime())
        .slice(0, 3)
        .forEach((c: any) => {
          recentActivity.push({
            type: 'reply',
            description: `${c.contacts.first_name} ${c.contacts.last_name} respondió a campaña`,
            date: c.last_reply_date,
            icon: 'target'
          });
        });

      opportunities
        .filter((o: any) => o.created_at)
        .sort((a: any, b: any) => parseFlexibleDate(b.created_at || 0).getTime() - parseFlexibleDate(a.created_at || 0).getTime())
        .slice(0, 2)
        .forEach((o: any) => {
          recentActivity.push({
            type: 'opportunity_new',
            description: `Nueva oportunidad: ${o.contact.organization} - ${o.contact.first_name} ${o.contact.last_name} `,
            date: o.created_at || new Date().toISOString(),
            icon: 'briefcase'
          });
        });

      opportunities
        .filter((o: any) => o.status === 'Cerrada ganada' && o.updated_at)
        .sort((a: any, b: any) => parseFlexibleDate(b.updated_at || 0).getTime() - parseFlexibleDate(a.updated_at || 0).getTime())
        .slice(0, 2)
        .forEach((o: any) => {
          recentActivity.push({
            type: 'opportunity_won',
            description: `¡Oportunidad ganada! ${o.contact.organization}`,
            date: o.updated_at || new Date().toISOString(),
            icon: 'award'
          });
        });

      distributions
        .filter((d: any) => d.sent && d.sent_at)
        .sort((a: any, b: any) => new Date(b.sent_at || 0).getTime() - new Date(a.sent_at || 0).getTime())
        .slice(0, 2)
        .forEach((d: any) => {
          recentActivity.push({
            type: 'webinar',
            description: `Webinars enviados - ${d.month}`,
            date: d.sent_at || new Date().toISOString(),
            icon: 'calendar'
          });
        });

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      contacts
        .filter((c: any) => c.created_at && new Date(c.created_at) >= sevenDaysAgo)
        .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        .slice(0, 2)
        .forEach((c: any) => {
          recentActivity.push({
            type: 'contact_new',
            description: `Nuevo contacto: ${c.first_name} ${c.last_name} (${c.organization})`,
            date: c.created_at || new Date().toISOString(),
            icon: 'user'
          });
        });

      campaigns
        .filter((c: any) => c.start_campaign && c.email_1_date && new Date(c.email_1_date) >= sevenDaysAgo)
        .sort((a: any, b: any) => parseFlexibleDate(b.email_1_date || 0).getTime() - parseFlexibleDate(a.email_1_date || 0).getTime())
        .slice(0, 2)
        .forEach((c: any) => {
          recentActivity.push({
            type: 'campaign_started',
            description: `Campaña iniciada: ${c.contacts.organization}`,
            date: c.email_1_date || new Date().toISOString(),
            icon: 'target'
          });
        });

      for (const opp of opportunities.slice(0, 5)) {
        try {
          const meetings = await db.getMeetingsByOpportunity(opp.id);
          const recentMeetings = meetings
            .filter((m: any) => m.meeting_date && new Date(m.meeting_date) >= sevenDaysAgo)
            .sort((a: any, b: any) => new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime())
            .slice(0, 1);
          
          recentMeetings.forEach((m: any) => {
            recentActivity.push({
              type: 'meeting',
              description: `Reunión: ${opp.contact.organization} - ${m.meeting_type}`,
              date: m.meeting_date,
              icon: 'calendar'
            });
          });
        } catch (error) {
          console.error(`Error loading meetings for activity: ${opp.id}`, error);
        }
      }

      recentActivity.sort((a, b) => parseFlexibleDate(b.date).getTime() - parseFlexibleDate(a.date).getTime());

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
        campaigns: {
          total: campaigns.length,
          active: activeCount,
          completed: completedCount,
          replied: repliedCount,
          replyRate,
          bounced: bouncedCount,
          pending: pendingCount,
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
        },
        webinars: {
          total: distributions.length,
          sent: sentDistributions,
          pending: pendingDistributions,
          subscribedContacts: webinarsSubscribedCount,
        },
        recentActivity: recentActivity.slice(0, 11),
      });
    } catch (error) {
      console.error("Error loading dashboard metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const statusOrder = [
    'Abierta',
    'Qualification',
    'Capabilities',
    'Propuesta',
    'Cerrada ganada',
    'Cerrada perdida'
  ];

  const prepareChartData = () => {
    if (!replyRateByTemplate || replyRateByTemplate.length === 0) {
      return null;
    }

    const labels = replyRateByTemplate.map(t => t.templateName);
    const repliedData = replyRateByTemplate.map(t => t.replied);
    const notRepliedData = replyRateByTemplate.map(t => t.total - t.replied);

    return {
      labels,
      datasets: [
        {
          label: "Respondida",
          data: repliedData,
          backgroundColor: "mediumseagreen",
          borderColor: "mediumseagreen",
          borderWidth: 1,
        },
        {
          label: "Sin respuesta",
          data: notRepliedData,
          backgroundColor: "rgba(143, 143, 143, 0.8)",
          borderColor: "rgba(143, 143, 143, 0.8)",
          borderWidth: 1,
        },
      ],
    };
  };

  const chartOptions: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: false,
      },
      legend: {
        position: "bottom" as const,
        labels: {
          padding: 15,
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            const dataIndex = context.dataIndex;
            
            const replied = context.chart.data.datasets[0].data[dataIndex] as number;
            const notReplied = context.chart.data.datasets[1].data[dataIndex] as number;
            const total = replied + notReplied;
            
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
            
            return `${label}: ${value} (${percentage}%)`;
          }
        }
      }
    },
    scales: {
      x: {
        stacked: true,
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 11,
          },
        },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: {
          color: "rgba(0, 0, 0, 0.05)",
        },
        ticks: {
          stepSize: 1,
          font: {
            size: 11,
          },
        },
      },
    },
  };

  const chartData = prepareChartData();

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

  if (metrics.contacts.total === 0) {
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
              <div className="flex gap-2 mt-3">
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
              <div className="flex gap-2 mt-3">
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
              <div className="flex gap-2 mt-3">
                <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-200">
                  {metrics.opportunities.withOffer} con oferta
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {metrics.opportunities.totalMeetings} reuniones
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
              <div className="flex gap-2 mt-3">
                <Badge className="text-xs bg-green-100 text-green-700 border-green-200">
                  {metrics.webinars.sent} enviados
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {metrics.webinars.subscribedContacts} suscritos
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
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

                  {chartData && (
                    <div className="bg-white p-4 rounded-lg border border-indigo-100 shadow-sm">
                      <h4 className="text-sm font-semibold mb-4 text-center text-slate-700">
                        Respuestas por Tipo de Campaña
                      </h4>
                      <div className="h-64">
                        <Bar data={chartData} options={chartOptions} />
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-indigo-600" />
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Actividad Reciente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics.recentActivity.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No hay actividad reciente
                  </p>
                ) : (
                  metrics.recentActivity.map((activity, index) => {
                    let bgColor = 'bg-indigo-50';
                    let iconColor = 'text-indigo-500';
                    let Icon = Target;

                    switch (activity.icon) {
                      case 'mail':
                        bgColor = 'bg-indigo-50';
                        iconColor = 'text-indigo-500';
                        Icon = Mail;
                        break;
                      case 'briefcase':
                        bgColor = 'bg-indigo-50';
                        iconColor = 'text-indigo-500';
                        Icon = Briefcase;
                        break;
                      case 'award':
                        bgColor = 'bg-indigo-50';
                        iconColor = 'text-indigo-500';
                        Icon = Award;
                        break;
                      case 'calendar':
                        bgColor = 'bg-indigo-50';
                        iconColor = 'text-indigo-500';
                        Icon = CalendarCheck;
                        break;
                      case 'user':
                        bgColor = 'bg-indigo-50';
                        iconColor = 'text-indigo-500';
                        Icon = Users;
                        break;
                      case 'target':
                        bgColor = 'bg-indigo-50';
                        iconColor = 'text-indigo-500';
                        Icon = Target;
                        break;
                    }

                    return (
                      <div key={index} className="flex items-start gap-3 pb-3 border-b last:border-b-0">
                        <div className={`p-2 rounded-full ${bgColor}`}>
                          <Icon className={`h-4 w-4 ${iconColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {activity.description}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDate(activity.date)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
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
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center p-6 bg-gradient-to-br from-indigo-50 to-white rounded-lg border border-indigo-100">
                      <div className="text-xl font-bold">
                        {formatPercentage(metrics.opportunities.wonOpportunitiesCount)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Tasa de conversión</div>
                    </div>
                    <div className="text-center p-6 bg-gradient-to-br from-indigo-50 to-white rounded-lg border border-indigo-100">
                      <div className="text-xl font-bold">
                        {metrics.opportunities.averageMeetingsPerOpp.toFixed(1)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Media de reuniones por oportunidad</div>
                    </div>
                  </div>

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
                            className={template.replyRate >= 20 ? "bg-green-50 border-green-400 text-gray-700 hover:bg-green-50" : ""}
                          >
                            {formatPercentage(template.replyRate)}
                          </Badge>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              template.replyRate >= 30 ? 'bg-mediumseagreen' :
                              template.replyRate >= 20 ? 'bg-green-400' :
                              template.replyRate >= 10 ? 'bg-yellow-400' :
                              'bg-red-400'
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
                            className={role.replyRate >= 20 ? "bg-green-50 border-green-400 text-gray-700 hover:bg-green-50" : ""}
                          >
                            {formatPercentage(role.replyRate)}
                          </Badge>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              role.replyRate >= 30 ? 'bg-green-600' :
                              role.replyRate >= 20 ? 'bg-green-400' :
                              role.replyRate >= 10 ? 'bg-yellow-400' :
                              'bg-red-400'
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
      </div>
    </div>
  );
};

export default Dashboard;