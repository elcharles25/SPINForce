import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { db } from '@/lib/db-adapter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateES, formatDateTime} from '@/utils/dateFormatter';
import { Mail, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Pencil, Trash2, Calendar, User } from 'lucide-react';
import { PROMPT_FOLLOW_UP, generateFollowUpEmail } from '@/utils/followUpGenerator';

interface Meeting {
  id: string;
  opportunity_id: string | null;
  contact_id: string;
  meeting_type: string;
  meeting_date: string;
  feeling: string;
  notes: string | null;
  created_at: string;
}

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  organization: string;
  email: string;
  title: string;
}

interface Opportunity {
  id: string;
  proposed_solution: string;
  status: string;
}

const FEELING_OPTIONS = [
  { value: 'Excelente', label: 'Excelente', color: 'bg-green-500' },
  { value: 'Bien', label: 'Bien', color: 'bg-blue-500' },
  { value: 'Neutral', label: 'Neutral', color: 'bg-yellow-500' },
  { value: 'Mal', label: 'Mal', color: 'bg-orange-500' },
  { value: 'Muy mal', label: 'Muy mal', color: 'bg-red-500' },
  { value: 'N/A', label: 'N/A', color: 'bg-gray-500' },
];

export default function MeetingDetailPage() {
  const navigate = useNavigate();
  const { meetingId } = useParams();
  const location = useLocation();
  const { toast } = useToast();

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [formData, setFormData] = useState({
    opportunity_id: "Sin oportunidad",
    meeting_type: "",
    meeting_date: "",
    feeling: "Neutral",
    notes: "",
  });

  // Obtener información de origen de la navegación
  const from = location.state?.from;
  const contactId = location.state?.contactId;
  const opportunityId = location.state?.opportunityId;

  const handleGoBack = () => {
    if (from === 'opportunity' && opportunityId) {
      navigate(`/opportunities/${opportunityId}`);
    } else if (from === 'contact' && contactId) {
      navigate(`/crm/${contactId}`);
    } else if (contact?.id) {
      // Fallback: ir al contacto si existe
      navigate(`/crm/${contact.id}`);
    } else {
      // Fallback final: ir a CRM
      navigate('/crm');
    }
  };


const formatDateOnly = (dateString: string): string => {
  if (!dateString) return '';
  
  // Si la fecha ya está en formato DD/MM/YYYY, solo cambiar / por -
  if (dateString.includes('/') && dateString.split('/').length === 3) {
    return dateString.split(' ')[0].replace(/\//g, '-');
  }
  
  // Si está en formato ISO
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

  const getBackButtonText = () => {
    if (from === 'opportunity') {
      return 'Volver a Oportunidad';
    } else if (from === 'contact') {
      return 'Volver a Contacto';
    }
    return 'Volver';
  };

  useEffect(() => {
    if (meetingId) {
      loadData();
    }
  }, [meetingId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const meetingData = await db.getMeeting(meetingId!);
      setMeeting(meetingData);

      if (meetingData.contact_id) {
        const contactData = await db.getContact(meetingData.contact_id);
        setContact(contactData);

        // Cargar oportunidades del contacto
        const allOpportunities = await db.getOpportunities();
        const contactOpportunities = (allOpportunities || []).filter(
          (opp: any) => opp.contact_id === meetingData.contact_id
        );
        setOpportunities(contactOpportunities);
      }

      if (meetingData.opportunity_id) {
        try {
          const oppData = await db.getOpportunity(meetingData.opportunity_id);
          setOpportunity(oppData);
        } catch (error) {
          console.warn('Oportunidad no encontrada:', meetingData.opportunity_id);
          setOpportunity(null);
        }
      } else {
        setOpportunity(null);
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar la reunión",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getFeelingColor = (feeling: string) => {
    const option = FEELING_OPTIONS.find(f => f.value === feeling);
    return option?.color || 'bg-gray-500';
  };

  const getFeelingLabel = (feeling: string) => {
    const option = FEELING_OPTIONS.find(f => f.value === feeling);
    return option?.label || feeling;
  };

const openEditDialog = () => {
  if (!meeting) return;
  
  // Formatear la fecha para el input type="date" (YYYY-MM-DD)
  const formattedDate = meeting.meeting_date.includes('T') 
    ? meeting.meeting_date.split('T')[0]
    : meeting.meeting_date.split(' ')[0];
  
  setFormData({
    opportunity_id: meeting.opportunity_id || "Sin oportunidad",
    meeting_type: meeting.meeting_type,
    meeting_date: formattedDate,
    feeling: meeting.feeling,
    notes: meeting.notes || "",
  });
  setIsEditDialogOpen(true);
};

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!formData.meeting_type) {
    toast({
      title: "Campo obligatorio",
      description: "Por favor selecciona un tipo de reunión.",
      variant: "destructive",
    });
    return;
  }
  if (!formData.meeting_date) {
    toast({
      title: "Campo obligatorio",
      description: "Por favor selecciona una fecha.",
      variant: "destructive",
    });
    return;
  }

  const payload = {
    contact_id: meeting?.contact_id,
    opportunity_id: (formData.opportunity_id === "none" || formData.opportunity_id === "Sin oportunidad") 
      ? "Sin oportunidad" 
      : formData.opportunity_id,
    meeting_type: formData.meeting_type,
    meeting_date: formData.meeting_date,
    feeling: formData.feeling,
    notes: formData.notes || null,
  };

  try {
    await db.updateMeeting(meetingId!, payload);
    toast({ title: "Éxito", description: "Reunión actualizada correctamente" });
    setIsEditDialogOpen(false);
    loadData();
  } catch (error) {
    toast({
      title: "Error",
      description: `Error al actualizar la reunión: ${error instanceof Error ? error.message : "Desconocido"}`,
      variant: "destructive",
    });
  }
};

  const handleDelete = async () => {
    if (!confirm("¿Estás seguro de eliminar esta reunión?")) return;

    try {
      await db.deleteMeeting(meetingId!);
      toast({ title: "Éxito", description: "Reunión eliminada" });
      handleGoBack();
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar la reunión", variant: "destructive" });
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Cargando...</div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="container mx-auto py-8 px-4">
        <p>Reunión no encontrada</p>
      </div>
    );
  }

const handleGenerateFollowUp = async () => {
  if (!meeting?.notes || !contact) {
    toast({
      title: 'Sin información',
      description: 'No hay notas de reunión o contacto disponible',
      variant: 'destructive',
    });
    return;
  }

  setGeminiLoading(true);
  try {
    await generateFollowUpEmail(
      meeting.notes,
      contact.first_name,
      contact.email,
      meeting.meeting_date  // ← AÑADIR ESTE PARÁMETRO
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
    setGeminiLoading(false);
  }
};

  return (
    <div className="container mx-auto py-8 px-4">
      <Button
        variant="ghost"
        onClick={handleGoBack}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {getBackButtonText()}
      </Button>

      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold">
            {meeting.meeting_type}
          </h1>
          <p className="text-xl text-muted-foreground mt-1">
            {formatDateOnly(meeting.meeting_date)}
          </p>
        </div>
       <div className="flex gap-2">
  <Button
    variant="outline"
    onClick={handleGenerateFollowUp}
    disabled={geminiLoading || !meeting.notes}
    className="rounded-full px-6 shadow-sm hover:shadow-md transition-shadow"
  >
    {geminiLoading ? (
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
    ) : (
      <Mail className="mr-2 h-4 w-4" />
    )}
    Generar email Follow-up
  </Button>
  <Button
    variant="outline"
    onClick={openEditDialog}
    className="rounded-full px-6 shadow-sm hover:shadow-md transition-shadow"
  >
    <Pencil className="mr-2 h-4 w-4" />
    Editar
  </Button>
</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Información de la Reunión</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Fecha:</span>
              <span>{formatDateOnly(meeting.meeting_date)}</span>
            </div>
            <div>
              <span className="font-medium">Tipo:</span>{' '}
              <Badge variant="outline">{meeting.meeting_type}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Sensación:</span>
              <div className={`w-4 h-4 rounded-full ${getFeelingColor(meeting.feeling)}`} />
              <span>{getFeelingLabel(meeting.feeling)}</span>
            </div>
            {opportunity && (
              <div className="pt-2 border-t">
                <span className="font-medium">Oportunidad:</span>{' '}
                <div className="mt-1">
                  <Badge variant="secondary">{opportunity.status}</Badge>
                  <p className="text-sm mt-1">{opportunity.proposed_solution}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {contact && (
          <Card>
            <CardHeader>
              <CardTitle>Contacto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <button
                  onClick={() => navigate(`/crm/${contact.id}`)}
                  className="text-primary hover:underline font-medium"
                >
                  {contact.first_name} {contact.last_name}
                </button>
              </div>
              <div>
                <span className="font-medium">Cargo:</span>{' '}
                {contact.title}
              </div>
              <div>
                <span className="font-medium">Organización:</span>{' '}
                {contact.organization}
              </div>
              <div>
                <span className="font-medium">Email:</span>{' '}
                <a href={`mailto:${contact.email}`} className="text-primary hover:underline">
                  {contact.email}
                </a>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {meeting.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notas / Minutas de la Reunión</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap font-mono text-sm bg-muted p-4 rounded-md">
              {meeting.notes}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Reunión</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="meeting_type">Tipo de Reunión *</Label>
                <Select 
                  value={formData.meeting_type} 
                  onValueChange={(value) => setFormData({ ...formData, meeting_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SKO">SKO</SelectItem>
                    <SelectItem value="QBR 90">QBR 90</SelectItem>
                    <SelectItem value="QBR Midyear">QBR Midyear</SelectItem>
                    <SelectItem value="QBR AA90">QBR AA90</SelectItem>
                    <SelectItem value="Delivery">Delivery</SelectItem>
                    <SelectItem value="Qualification">Qualification</SelectItem>
                    <SelectItem value="Cap. Alignment">Cap. Alignment</SelectItem>
                    <SelectItem value="IPW">IPW</SelectItem>
                    <SelectItem value="POC">POC</SelectItem>
                    <SelectItem value="EP POC">EP POC</SelectItem>
                    <SelectItem value="Proposal">Proposal</SelectItem>
                    <SelectItem value="Email">Email</SelectItem>
                    <SelectItem value="Teléfono">Teléfono</SelectItem>
                    <SelectItem value="Otros">Otros</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="meeting_date">Fecha *</Label>
                <Input
                  id="meeting_date"
                  type="date"
                  value={formData.meeting_date}
                  onChange={(e) => setFormData({ ...formData, meeting_date: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="feeling">Sensación de la Reunión</Label>
                <Select 
                  value={formData.feeling} 
                  onValueChange={(value) => setFormData({ ...formData, feeling: value })}
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
                  value={formData.opportunity_id} 
                  onValueChange={(value) => setFormData({ ...formData, opportunity_id: value })}
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
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={30}
                placeholder="Detalles de la reunión, minutas, acuerdos alcanzados, próximos pasos..."
                className="font-mono text-sm"
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
    </div>
  );
}