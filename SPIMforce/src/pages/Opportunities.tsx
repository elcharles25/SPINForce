import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/lib/db-adapter';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Pencil, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from "@/utils/dateFormatter";
import { useSearchParams } from 'react-router-dom';

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  organization: string;
  title: string;
}

interface Opportunity {
  id: string;
  contact_id: string;
  status: string;
  proposed_solution: string;
  offer_presented: boolean;
  contact: {
    first_name: string;
    last_name: string;
    organization: string;
    title: string;
  };
}

interface OpportunityForm {
  organization: string;
  contact_id: string;
  status: string;
  solution_type: string;
  solution_mode: string;
  offer_presented: boolean;
}

interface Meeting {
  id: string;
  opportunity_id: string;
  contact_id: string;
  meeting_type: string;
  meeting_date: string;
  feeling: string;
  notes: string;
}

const STATUSES = [
  { value: 'Abierta', label: 'Abierta' },
  { value: 'Qualification', label: 'Qualification' },
  { value: 'Capabilities', label: 'Capabilities' },
  { value: 'Propuesta', label: 'Propuesta' },
  { value: 'Cerrada ganada', label: 'Cerrada ganada' },
  { value: 'Cerrada perdida', label: 'Cerrada perdida' },
];

const STATUS_COLORS: Record<string, string> = {
  'Abierta': 'bg-gray-100 border-gray-500 text-gray-700',
  'Qualification': 'bg-blue-50 border-blue-500 text-blue-700',
  'Capabilities': 'bg-indigo-100 border-indigo-500 text-indigo-700',
  'Propuesta': 'bg-green-100 border-green-500 text-green-700',
  'Cerrada ganada': 'bg-green-500 text-white',
  'Cerrada perdida': 'bg-black text-white',
};

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

const getStatusProgress = (status: string): number => {
  const normalizedStatus = status.toLowerCase();
  
  if (normalizedStatus === 'abierta') return 10;
  if (normalizedStatus === 'qualification') return 25;
  if (normalizedStatus === 'capabilities') return 50;
  if (normalizedStatus === 'propuesta') return 90;
  if (normalizedStatus === 'cerrada ganada' || normalizedStatus === 'cerrada perdida') return 100;
  
  return 0;
};

const getProgressBarColor = (status: string): string => {
  const normalizedStatus = status.toLowerCase();
  
  if (normalizedStatus === 'abierta') return 'bg-gray-400';
  if (normalizedStatus === 'qualification') return 'bg-blue-400';
  if (normalizedStatus === 'capabilities') return 'bg-indigo-400';
  if (normalizedStatus === 'propuesta') return 'bg-mediumseagreen';
  if (normalizedStatus === 'cerrada ganada') return 'bg-mediumseagreen';
  if (normalizedStatus === 'cerrada perdida') return 'bg-black';
  
  return 'bg-gray-400';
};

export default function OpportunitiesPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [meetingCounts, setMeetingCounts] = useState<Record<string, number>>({});
  const [lastMeetingDates, setLastMeetingDates] = useState<Record<string, string>>({});
  const [meetingTypes, setMeetingTypes] = useState<Record<string, string[]>>({});
  const [form, setForm] = useState<OpportunityForm>({
    organization: '',
    contact_id: '',
    status: 'Abierta',
    solution_type: '',
    solution_mode: '',
    offer_presented: false,
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const [staleOpportunityIds, setStaleOpportunityIds] = useState<Set<string>>(new Set());
  const filterType = searchParams.get('filter');

  useEffect(() => {
    initData();
  }, []);

  const initData = async () => {
    await fetchOpportunities();
    await fetchContacts();
    setLoading(false);
  };

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

const fetchOpportunities = async () => {
  try {
    const data = await db.getOpportunities();
    setOpportunities(data);
    
    const counts: Record<string, number> = {};
    const lastDates: Record<string, string> = {};
    const types: Record<string, string[]> = {};
    const staleIds = new Set<string>();
    
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    oneMonthAgo.setHours(0, 0, 0, 0);
    
    await Promise.all(
      data.map(async (opp) => {
        try {
          const meetings = await db.getMeetingsByOpportunity(opp.id);
          
          const filteredMeetings = meetings.filter(
            (meeting: Meeting) => 
              meeting.meeting_type !== 'Email' && 
              meeting.meeting_type !== 'Teléfono'
          );
          
          counts[opp.id] = filteredMeetings.length;
          
          const uniqueTypes = [...new Set(filteredMeetings.map((m: Meeting) => m.meeting_type))];
          const mappedTypes = uniqueTypes.map(type => MEETING_TYPE_MAP[type as string] || type);
          types[opp.id] = mappedTypes as string[];
          
          if (filteredMeetings.length > 0) {
            const sortedMeetings = [...filteredMeetings].sort((a, b) => {
              const dateA = parseFlexibleDate(a.meeting_date).getTime();
              const dateB = parseFlexibleDate(b.meeting_date).getTime();
              return dateB - dateA;
            });
            
            const lastMeetingDateStr = sortedMeetings[0].meeting_date;
            lastDates[opp.id] = lastMeetingDateStr;
            
            const lastMeetingDate = parseFlexibleDate(lastMeetingDateStr);
            lastMeetingDate.setHours(0, 0, 0, 0);
            
            if (lastMeetingDate.getTime() < oneMonthAgo.getTime()) {
              staleIds.add(opp.id);
            }
          }
        } catch (error) {
          console.error(`Error cargando reuniones para oportunidad ${opp.id}:`, error);
          counts[opp.id] = 0;
          types[opp.id] = [];
        }
      })
    );
    
    setMeetingCounts(counts);
    setLastMeetingDates(lastDates);
    setMeetingTypes(types);
    setStaleOpportunityIds(staleIds);
  } catch (error) {
    console.error('Error cargando oportunidades:', error);
    toast({
      title: 'Error',
      description: 'No se pudieron cargar las oportunidades',
      variant: 'destructive',
    });
  }
};

  const fetchContacts = async () => {
    try {
      const data = await db.getContacts();
      setContacts(data);
    } catch (error) {
      console.error('Error cargando contactos:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los contactos',
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (opportunity: Opportunity) => {
    setEditingOpportunity(opportunity);
    
    const proposedSolution = opportunity.proposed_solution || '';
    const parts = proposedSolution.split(' - ');
    const solution_type = parts[0] || '';
    const solution_mode = parts[1] || '';
    
    setForm({
      organization: opportunity.contact.organization,
      contact_id: opportunity.contact_id,
      status: opportunity.status,
      solution_type: solution_type,
      solution_mode: solution_mode,
      offer_presented: opportunity.offer_presented,
    });
    
    const filtered = contacts.filter(c => c.organization === opportunity.contact.organization);
    setFilteredContacts(filtered);
    
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setForm({
      organization: '',
      contact_id: '',
      status: 'Abierta',
      solution_type: '',
      solution_mode: '',
      offer_presented: false,
    });
    setFilteredContacts([]);
    setEditingOpportunity(null);
  };

  const handleOrganizationChange = (organization: string) => {
    setForm({ ...form, organization, contact_id: '' });
    const filtered = contacts.filter(c => c.organization === organization);
    setFilteredContacts(filtered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.contact_id) {
      toast({
        title: 'Campo requerido',
        description: 'Debes seleccionar un contacto',
        variant: 'destructive',
      });
      return;
    }

    if (!form.solution_type || !form.solution_mode) {
      toast({
        title: 'Campos requeridos',
        description: 'Debes seleccionar el tipo y modo de solución',
        variant: 'destructive',
      });
      return;
    }

    const proposed_solution = `${form.solution_type} - ${form.solution_mode}`;

    const payload = {
      contact_id: form.contact_id,
      status: form.status,
      proposed_solution: proposed_solution,
      offer_presented: form.offer_presented,
    };

    try {
      if (editingOpportunity) {
        await db.updateOpportunity(editingOpportunity.id, payload);
        toast({
          title: 'Éxito',
          description: 'Oportunidad actualizada correctamente',
        });
      } else {
        await db.createOpportunity(payload);
        
        try {
          const contact = await db.getContact(form.contact_id);
          const updatedContact = {
            ...contact,
            contact_type: 'Oportunidad'
          };
          await db.updateContact(form.contact_id, updatedContact);
        } catch (contactError) {
          console.error('Error actualizando tipo de contacto:', contactError);
        }
        
        toast({
          title: 'Éxito',
          description: 'Oportunidad creada correctamente',
        });
      }
      setIsDialogOpen(false);
      resetForm();
      fetchOpportunities();
    } catch (error) {
      console.error('Error guardando oportunidad:', error);
      toast({
        title: 'Error',
        description: 'Error al guardar la oportunidad',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const opportunity = opportunities.find(opp => opp.id === id);
      
      if (opportunity) {
        await db.deleteOpportunity(id);
        
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
      } else {
        await db.deleteOpportunity(id);
        toast({
          title: 'Éxito',
          description: 'Oportunidad eliminada correctamente',
        });
      }
      
      fetchOpportunities();
    } catch (error) {
      console.error('Error eliminando oportunidad:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la oportunidad',
        variant: 'destructive',
      });
    }
  };

  const getStatusLabel = (status: string) => {
    return STATUSES.find(s => s.value === status)?.label || status;
  };

  if (loading) return <div className="p-6">Cargando...</div>;

  const STATUS_ORDER: Record<string, number> = {
    'cerrada ganada': 0,
    'cerrada perdida': 1,
    'propuesta': 2,
    'capabilities': 3,
    'qualification': 4,
    'abierta': 5,
  };

  const normalize = (s?: string) =>
    (s ?? '')
      .toLocaleLowerCase('es')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');

  const compareByCustomStatus = (a: any, b: any) => {
    const aStatus = normalize(a?.status);
    const bStatus = normalize(b?.status);

    const aRank = STATUS_ORDER[aStatus] ?? Number.POSITIVE_INFINITY;
    const bRank = STATUS_ORDER[bStatus] ?? Number.POSITIVE_INFINITY;

    if (aRank !== bRank) return aRank - bRank;

    return aStatus.localeCompare(bStatus, 'es', { sensitivity: 'base' });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestión de Oportunidades</h1>
          {filterType === 'stale' && staleOpportunityIds.size > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="bg-amber-50 border-amber-200 text-amber-900">
                Mostrando {staleOpportunityIds.size} oportunidad{staleOpportunityIds.size !== 1 ? 'es' : ''} sin actividad (mayor de 1 mes)
              </Badge>
              <button
                onClick={() => setSearchParams({})}
                className="text-sm text-indigo-600 hover:text-indigo-700 underline"
              >
                Ver todas
              </button>
            </div>
          )}
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="rounded-full shadow-sm hover:shadow-md transition-shadow bg-indigo-500 hover:bg-indigo-600"
                onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Oportunidad
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingOpportunity ? 'Editar Oportunidad' : 'Nueva Oportunidad'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Organización *</Label>
                  <Select
                    value={form.organization}
                    onValueChange={handleOrganizationChange}
                    disabled={contacts.length === 0}
                  >
                    <SelectTrigger className={!form.organization ? "border-red-500" : ""}>
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
                    value={form.contact_id}
                    onValueChange={(value) => setForm({ ...form, contact_id: value })}
                    disabled={!form.organization || filteredContacts.length === 0}
                  >
                    <SelectTrigger className={!form.contact_id ? "border-red-500" : ""}>
                      <SelectValue
                        placeholder={
                          !form.organization
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
                    value={form.status}
                    onValueChange={(value) => setForm({ ...form, status: value })}
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
                        value={form.solution_type}
                        onValueChange={(value) => setForm({ ...form, solution_type: value })}
                      >
                        <SelectTrigger className={!form.solution_type ? "border-red-500" : ""}>
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
                        value={form.solution_mode}
                        onValueChange={(value) => setForm({ ...form, solution_mode: value })}
                      >
                        <SelectTrigger className={!form.solution_mode ? "border-red-500" : ""}>
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
                    checked={form.offer_presented}
                    onCheckedChange={(checked) => setForm({ ...form, offer_presented: checked })}
                  />
                  <Label>Oferta presentada</Label>
                </div>

                <div className="flex justify-end gap-3">
                  {editingOpportunity && (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => {
                        handleDelete(editingOpportunity.id);
                        setIsDialogOpen(false);
                      }}
                      className="mr-auto"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    className="rounded-full"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    className="rounded-full shadow-sm hover:shadow-md transition-shadow bg-indigo-500 hover:bg-indigo-600"
                    disabled={contacts.length === 0}>
                    {editingOpportunity ? 'Actualizar' : 'Crear'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-card rounded-lg shadow overflow-hidden overflow-x-auto">
          <Table className="w-full table-fixed">
            <colgroup>
              <col className="w-[100px]" />
              <col className="w-[100px]" />
              <col className="w-[120px]" />
              <col className="w-[100px]" />
              <col className="w-[300px]" />
              <col className="w-[60px]" />
              <col className="w-[150px]" />
            </colgroup>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted/50">
                <TableHead className="text-center">Organización</TableHead>
                <TableHead className="text-center">Contacto</TableHead>
                <TableHead className="text-center">Cargo</TableHead>
                <TableHead className="text-center">Estado</TableHead>
                <TableHead className="text-center">Progreso</TableHead>
                <TableHead className="text-center">Oferta</TableHead>
                <TableHead className="text-center">Reuniones</TableHead>
              </TableRow>
            </TableHeader>
              <TableBody>
              {opportunities.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="p-8 text-center text-muted-foreground">
                            No hay oportunidades registradas
                          </TableCell>
                        </TableRow>
                      ) : (
                        [...opportunities]
                          .filter((opp) => {
                            if (filterType === 'stale') {
                              return staleOpportunityIds.has(opp.id);
                            }
                            return true;
                          })
                          .sort(compareByCustomStatus)
                          .map((opportunity) => {
                            const completedMeetings = meetingTypes[opportunity.id] || [];
                            
                            return (
                            <TableRow
                              key={opportunity.id}
                              className="cursor-pointer hover:bg-muted/50 text-sm text-center align-middle"
                              onClick={() => navigate(`/opportunities/${opportunity.id}`)}
                            >
                        <TableCell>{opportunity?.contact?.organization ?? '—'}</TableCell>
                        <TableCell className="font-bold">
                          {opportunity?.contact?.first_name} {opportunity?.contact?.last_name}
                        </TableCell>
                        <TableCell>{opportunity?.contact?.title}</TableCell>
                        <TableCell>
                                <Badge 
                                  variant="outline"
                                  className={STATUS_COLORS[opportunity.status] || 'bg-gray-500'}>
                                  {getStatusLabel(opportunity.status)}
                               </Badge>
                        </TableCell>
<TableCell className="p-0">
  <div className="flex flex-col items-center gap-2 w-full px-2">
    {/* Contenedor relativo para barra y etiqueta de porcentaje */}
    <div className="w-full relative">
      {/* Barra de progreso */}
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${getProgressBarColor(opportunity.status)}`}
          style={{ width: `${getStatusProgress(opportunity.status)}%` }}
        />
      </div>

      {/* Etiqueta de porcentaje posicionada sobre el progreso */}
      {(() => {
        const progress = Math.round(getStatusProgress(opportunity.status)); // 0–100
        // Opcional: clampa para evitar que se corte en extremos si quieres
        const clamped = Math.min(98, Math.max(2, progress)); // deja 2%/98% como margen visual
        return (
          <div
            className="absolute -top-4 /* separada 4px encima de la barra */ 
                       text-[10px] font-semibold text-slate-600
                       rounded pointer-events-none select-none"
            style={{
              left: `${clamped}%`,
              transform: 'translateX(-50%)',
            }}
            aria-label={`Progreso: ${progress}%`}
          >
            {progress}%
          </div>
        );
      })()}
    </div>

    {/* Flecha segmentada (tu bloque actual ajustado para ocupar todo el ancho) */}
    <div className="flex w-full mt-1">
      {MEETING_TYPE_ORDER.map((type, index) => {
        const isCompleted = completedMeetings.includes(type);
        const isFirst = index === 0;
        const isLast = index === MEETING_TYPE_ORDER.length - 1;

        return (
          <div
            key={type}
            className={`relative flex items-center justify-center text-white text-[8px] font-medium
              ${isCompleted ? 'bg-indigo-300' : 'bg-gray-400'}
              ${isFirst ? '' : '-ml-2'}
              ${isFirst ? 'rounded-l' : ''} ${isLast ? 'rounded-r' : ''} flex-1 select-none`}
            style={{
              height: '22px',
              lineHeight: '22px',
              clipPath: isFirst
                ? 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)'
                : 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%)',
              zIndex: MEETING_TYPE_ORDER.length - index,
            }}
          >
            <span className="whitespace-nowrap text-[7px]">{type}</span>
          </div>
        );
      })}
    </div>
  </div>
</TableCell>

                        <TableCell>
                          {opportunity.offer_presented ? (
                            <span className="text-green-600">✓ Sí</span>
                          ) : (
                            <span className="text-muted-foreground">No</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-center gap-1">
                            <Badge variant="secondary">
                              {meetingCounts[opportunity.id] || 0}
                            </Badge>
                            {lastMeetingDates[opportunity.id] && (
                              <span className="text-xs text-muted-foreground">
                                Última reunión: {formatDateTime(lastMeetingDates[opportunity.id])}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                            );
                          })
                )}
              </TableBody>

          </Table>
        </div>
      </div>
    </div>
  );
}