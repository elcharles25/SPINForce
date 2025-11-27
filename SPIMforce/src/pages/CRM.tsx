import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "@/lib/db-adapter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Upload, Download, CheckCircle2, XCircle } from "lucide-react";
import "@/app.css";

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
  tier?: string | null;
  csm_name?: string | null;
  csm_email?: string | null;
  ep_name?: string | null;
  ep_email?: string | null;
  last_email_check?: string | null;
}

const GARTNER_ROLES = ["CIO", "CTO", "CISO", "CDAO", "CAIO", "CInO", "Infrastructure & Operations", "D. Transformación", "Enterprise Architect", "Procurement"];
const TIPO_CLIENTE = ["Cliente","Cliente proxy", "Oportunidad", "Prospect"];
const WEBINARS_ROLES = ["CIO", "CISO", "CDAO", "CAIO", "Infrastructure & Operations", "Talent", "Workplace", "Procurement", "Enterprise Architect"];
const CSM_LIST = [
  { csm_name: "Cristina Lázaro", csm_email: "Cristina.Lazaro@gartner.com" },
  { csm_name: "Ismael Fathy Martínez", csm_email: "Ismael.FathyMartinez@gartner.com" },
  { csm_name: "Mengühan Gürer", csm_email: "menguhan.gurer@gartner.com" }];
const EP_LIST = [
  { ep_name: "Martín Piqueras", ep_email: "Martin.Piqueras@gartner.com" },
  { ep_name: "José Luis Antón", ep_email: "JoseLuis.AntonHernando@gartner.com" },
  { ep_name: "Cristina Magdalena", ep_email: "Cristina.Magdalena@gartner.com" },
  { ep_name: "Fabrizio Magnani", ep_email: "Fabrizio.Magnani@gartner.com" },
  { ep_name: "Mercedes Vidal", ep_email: "mercedes.vidallobato@gartner.com" },
  { ep_name: "Paco de los Santos", ep_email: "francisco.delossantos@gartner.com" },
  { ep_name: "Manuel Torres", ep_email: "manuel.torres2@gartner.com" }];

const downloadTemplate = () => {
  const templateData = [
    ['Organización', 'Nombre', 'Apellido', 'email', 'Tier', 'Teléfono', 'Rol tipo de Campañas', 'Rol en su organización', 'Tipo de Contacto', 'Contactado', 'Interesado en Gartner', 'Enviar Webinars', 'Rol para webinars', 'Notas', 'URL Linkedin', 'Nombre PA', 'Email PA', 'Teléfono PA', 'Tier','Nombre CSM', 'Email CSM', 'Nombre EP', 'Email EP' ],
    ['Mi Empresa', 'Juan', 'Pérez', 'juan@email.com', 'Tier 1','+34 666 777 888', 'CIO', 'Director IT', 'Cliente', 'false', 'true', 'true', 'CIO', 'Ejemplo de contacto', 'www.linkedin.com', 'Nombre Apellidos', 'nombre@organizacion.com', '+34 XXX XXX XXX', '1', 'Nombre CSM', 'Email CSM', 'Nombre EP', 'Email EP' ],
  ];

  const csv = templateData
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });

  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', 'contactos_template.csv');
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const CRM = () => {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [campaignTypes, setCampaignTypes] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>({
  key: "organization",
  direction: "asc",
  });
  const [filters, setFilters] = useState({
    search: "",
    organization: "",
    name: "",
    email: "",
    role: "",
    title: "",
    contact_type: "",
    contacted: "todos",
    interested: "todos",
    webinars: "todos",
    webinar_role: "",
    pa_name: "",
    pa_email: "",
    pa_phone: "",
    pa_filter: "todos",
    linkedin_url: "",
    tier: "",
    csm_name: "",
    csm_email: "",
    ep_name: "",
    ep_email: "",
    last_email_check: "",
    
  });
  const { toast } = useToast();

  const [suggestions, setSuggestions] = useState<string[]>([]);

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
    last_email_check: "",
  });

  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => {
    fetchContacts();
    fetchCampaignTypes();
    fetchAccounts();
  }, []);

const fetchContacts = async () => {
  try {
    const data = await db.getContacts();
    const normalized = data.map((row: any) => ({
      ...row,
      webinar_role: row.webinar_role ?? ""
    }));
    
    // Mostrar contactos inmediatamente
    setContacts(normalized);
    
    // Actualizar last_contact_date en segundo plano
    (async () => {
      for (const contact of normalized) {
        try {
          const meetings = await db.getMeetingsByContact(contact.id);
          
          if (meetings.length > 0) {
            const sortedMeetings = [...meetings].sort((a, b) => 
              new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime()
            );
            const lastMeetingDate = sortedMeetings[0].meeting_date;
            
            if (contact.last_contact_date !== lastMeetingDate) {
              await db.updateContact(contact.id, { 
                ...contact, 
                last_contact_date: lastMeetingDate 
              });
              
              // Actualizar el estado para reflejar el cambio
              setContacts(prev => prev.map(c => 
                c.id === contact.id 
                  ? { ...c, last_contact_date: lastMeetingDate }
                  : c
              ));
            }
          }
        } catch (error) {
          console.error(`Error actualizando last_contact_date para contacto ${contact.id}:`, error);
        }
      }
    })();
    
  } catch (error) {
    console.error('Error cargando contactos:', error);
    toast({ 
      title: "Error", 
      description: "No se pudieron cargar los contactos", 
      variant: "destructive" 
    });
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

  const fetchCampaignTypes = async () => {
    try {
      const data = await db.getTemplates();
      setCampaignTypes(data?.map((t: any) => t.name) || []);
    } catch (error) {
      console.error('Error cargando templates:', error);
    }
  };

  const fetchAccounts = async () => {
  try {
    const data = await db.getAccounts();
    setAccounts(data);
  } catch (error) {
    console.error('Error cargando cuentas:', error);
  }
};

const getFilteredContacts = () => {
  return contacts.filter((contact) => {
    const searchTerm = filters.search.toLowerCase();

    const fullName = `${contact.first_name} ${contact.last_name}`.toLowerCase();
    const email = contact.email.toLowerCase();
    const organization = contact.organization.toLowerCase();
    const title = contact.title.toLowerCase();
    const contactType = contact.contact_type.toLowerCase();

    const matchesSearch =
      fullName.includes(searchTerm) ||
      email.includes(searchTerm) ||
      organization.includes(searchTerm) ||
      title.includes(searchTerm) ||
      contactType.includes(searchTerm);

    const hasPA =
      (contact.pa_name && contact.pa_name.trim() !== "") ||
      (contact.pa_email && contact.pa_email.trim() !== "") ||
      (contact.pa_phone && contact.pa_phone.trim() !== "");

    const paFilterMatch =
      filters.pa_filter === "todos" ||
      (filters.pa_filter === "con_valor" && hasPA) ||
      (filters.pa_filter === "sin_valor" && !hasPA);

    return (
      matchesSearch &&
      contact.organization.toLowerCase().includes(filters.organization.toLowerCase()) &&
      fullName.includes(filters.name.toLowerCase()) &&
      contact.email.toLowerCase().includes(filters.email.toLowerCase()) &&
      contact.title.toLowerCase().includes(filters.title.toLowerCase()) &&
      (!filters.contact_type ||
        (filters.contact_type === "Cliente" &&
          (contact.contact_type === "Cliente" || contact.contact_type === "Cliente proxy")) ||
        contact.contact_type === filters.contact_type)
      &&
      (!filters.tier || contact.tier === filters.tier) &&
      (contact.webinar_role ?? "").toLowerCase().includes((filters.webinar_role ?? "").toLowerCase()) &&
      (filters.contacted === "todos" ||
        (filters.contacted === "true" && contact.contacted) ||
        (filters.contacted === "false" && !contact.contacted)) &&
      (filters.interested === "todos" ||
        (filters.interested === "true" && contact.interested) ||
        (filters.interested === "false" && !contact.interested)) &&
      (filters.webinars === "todos" ||
        (filters.webinars === "true" && contact.webinars_subscribed) ||
        (filters.webinars === "false" && !contact.webinars_subscribed)) &&
      paFilterMatch
    );
  });
};
  const filteredContacts = getFilteredContacts();
  const hasActiveFilters = Object.values(filters).some(v => v !== "" && v !== "todos");

  const clearFilters = () => {
    setFilters({
      search: "",
      organization: "",
      name: "",
      email: "",
      role: "",
      title: "",
      contact_type: "",
      contacted: "todos",
      interested: "todos",
      webinars: "todos",
      webinar_role: "",
      pa_name: "",
      pa_email: "",
      pa_phone: "",
      pa_filter: "todos",
      linkedin_url: "",
      tier: "",
      csm_name: "",
      csm_email: "",
      ep_name: "",
      ep_email: "",
      last_email_check: "",      
    });
  };

  const sortedContacts = [...filteredContacts].sort((a, b) => {
    if (!sortConfig) return 0;

    let aValue = a[sortConfig.key];
    let bValue = b[sortConfig.key];

    if (sortConfig.key === "name") {
      aValue = `${a.first_name} ${a.last_name}`;
      bValue = `${b.first_name} ${b.last_name}`;
    }

    if (typeof aValue === "string" && typeof bValue === "string") {
      return sortConfig.direction === "asc"
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    if (typeof aValue === "boolean" && typeof bValue === "boolean") {
      return sortConfig.direction === "asc"
        ? Number(aValue) - Number(bValue)
        : Number(bValue) - Number(aValue);
    }
    return sortConfig.direction === "asc" ? aValue - bValue : bValue - aValue;
  });

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
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
      csm_name: formData.csm_name,
      csm_email: formData.csm_email,
      ep_name: formData.ep_name,
      ep_email: formData.ep_email,
    };

    try {
      if (editingContact) {
        const { error } = await db.updateContact(editingContact.id, payload);
        if (error) {
          toast({
            title: "Error al actualizar",
            description: error.message || "Error desconocido",
            variant: "destructive",
          });
          return;
        }
        toast({ title: "Éxito", description: "Contacto actualizado correctamente" });
      } else {
        const { error } = await db.createContact(payload);
        if (error) {
          toast({
            title: "Error al crear",
            description: error.message || "Error desconocido",
            variant: "destructive",
          });
          return;
        }
        toast({ title: "Éxito", description: "Contacto creado correctamente" });
      }

      setIsDialogOpen(false);
      fetchContacts();
      resetForm();
    } catch (error) {
      toast({
        title: "Error",
        description: `Error al procesar el contacto: ${error instanceof Error ? error.message : "Desconocido"}`,
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    try {
      const text = await file.text();
      const lines = text.trim().split('\n');
      
      if (lines.length < 2) {
        toast({ title: "Error", description: "El archivo CSV está vacío o no tiene datos", variant: "destructive" });
        setIsImporting(false);
        e.target.value = "";
        return;
      }

      let separator = ',';
      if (lines[0].includes(';') && !lines[0].includes(',')) {
        separator = ';';
      }

      const headers = lines[0].split(separator).map(h => h.trim().replace(/^"|"$/g, ''));
      const jsonData = lines.slice(1).map((line) => {
        const values = line.split(separator).map(v => v.trim().replace(/^"|"$/g, ''));
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        return row;
      });

      const contactsToInsert = jsonData.map((row: any) => {
        const contactadoBool = String(row.Contactado || "false").toUpperCase() === "TRUE";
        const interesadoBool = String(row["Interesado en Gartner"] || "false").toUpperCase() === "TRUE";
        const webinarsBool = String(row["Enviar Webinars"] || "false").toUpperCase() === "TRUE";
        
        return {
          organization: String(row.Organización || row.organization || "").trim(),
          first_name: String(row.Nombre || "").trim(),
          last_name: String(row.Apellido || "").trim(),
          email: String(row.email || row.Email || "").trim(),
          tier: String(row.tier || row.Tier || "").trim(),
          phone: String(row.Telefono || row.phone || "").trim() || null,
          gartner_role: String(row["Rol tipo de Campañas"] || row.gartner_role || "").trim(),
          title: String(row["Rol en su organización"] || row.title || "").trim(),
          contact_type: String(row["Tipo de Contacto"] || row.contact_type || "").trim(),
          contacted: contactadoBool,
          last_contact_date: null,
          interested: interesadoBool,
          webinars_subscribed: webinarsBool,
          webinar_role: String(row["Rol para webinars"] || row.webinar_role || "").trim(),
          notes: String(row.Notas || row.notes || "").trim() || null,
          linkedin_url: String(row["URL Linkedin"] || row.linkedin_url || "").trim(),
          pa_name: String(row["Nombre PA"] || row.pa_name || "").trim(),
          pa_email: String(row["Email PA"] || row.pa_email || "").trim(),
          pa_phone: String(row["Teléfono PA"] || row.pa_phone || "").trim(),
          csm_name: String(row["Nombre CSM"] || row.csm_name || "").trim(),
          csm_email: String(row["Email CSM"] || row.csm_email || "").trim(),
          ep_name: String(row["Nombre EP"] || row.ep_name || "").trim(),
          ep_email: String(row["Email EP"] || row.ep_email || "").trim(),
        };
      });
      const validContacts = contactsToInsert.filter(c => {
        return c.email && c.email.length > 0 && c.email.includes('@');
      });
      
      if (validContacts.length === 0) {
        toast({ title: "Error", description: "No hay contactos con email válido", variant: "destructive" });
        setIsImporting(false);
        e.target.value = "";
        return;
      }

      let importedCount = 0;
      let skippedCount = 0;
      
      for (const contact of validContacts) {
        try {
          await db.createContact(contact);
          importedCount++;
        } catch (insertError: any) {
          if (insertError.message?.includes('23505') || insertError.message?.includes('unique')) {
            skippedCount++;
          }
        }
      }
      
      toast({ 
        title: "Importación completada", 
        description: `${importedCount} contactos importados, ${skippedCount} ignorados por duplicados` 
      });
      setIsImportDialogOpen(false);
      fetchContacts();
    } catch (error) {
      console.error('Error leyendo archivo:', error);
      toast({ 
        title: "Error", 
        description: `Error al procesar el archivo: ${error instanceof Error ? error.message : "Desconocido"}`, 
        variant: "destructive" 
      });
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este contacto?")) return;

    try {
      await db.deleteContact(id);
      toast({ title: "Éxito", description: "Contacto eliminado" });
      fetchContacts();
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar el contacto", variant: "destructive" });
    }
  };

  const resetForm = () => {
    setFormData({
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
      last_email_check: "",  
    });
    setEditingContact(null);
  };

  const openEditDialog = (contact: Contact, viewOnly = false) => {
    if (viewOnly) {
      navigate(`/crm/${contact.id}`);
      return;
    }
    
    setEditingContact(contact);
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
      last_email_check: contact.last_email_check || "",
      
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-foreground">Gestión de Contactos</h1>
          <div className="flex gap-2">
            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline"
                  className="rounded-full shadow-sm hover:shadow-md transition-shadow hover:bg-indigo-100">
                  <Upload className="mr-2 h-4 w-4" />
                  Importar contactos 
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Importar Contactos desde CSV</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Button onClick={downloadTemplate} variant="outline" className="w-full mb-4">
                      <Download className="mr-2 h-4 w-4" />
                      Descargar Template CSV
                    </Button>
                  </div>
                  <div className="border-t pt-4">
                    <Label htmlFor="file-upload">O selecciona tu archivo CSV</Label>
                    <Input
                      id="file-upload"
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleFileUpload}
                      disabled={isImporting}
                    />
                  </div>
                  <div className="text-sm text-muted-foreground space-y-2">
                    <p><strong>Campos esperados:</strong></p>
                    <ul className="list-disc list-inside text-xs space-y-1">
                      <li>Organización</li>
                      <li>Nombre</li>
                      <li>Apellido</li>
                      <li>Email</li>
                      <li>Tier</li>
                      <li>Teléfono (opcional)</li>
                      <li>Rol tipo de campañas</li>
                      <li>Rol en su organización</li>
                      <li>Tipo de contacto</li>
                      <li>Contactado (true/false)</li>
                      <li>Interesado en Gartner (true/false)</li>
                      <li>Enviar Webinars (true/false)</li>
                      <li>Rol para Webinars</li>
                      <li>URL Linkedin</li>
                      <li>Nombre de PA</li>
                      <li>Email de PA</li>
                      <li>Teléfono de PA</li>
                      <li>Nombre CSM</li>
                      <li>Email CSM</li>
                      <li>Nombre EP</li>
                      <li>Email EP</li>
                      <li>Notas</li>
                    </ul>
                  </div>
                  {isImporting && <p className="text-sm text-center">Importando contactos...</p>}
                </div>
              </DialogContent>
            </Dialog>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  className="rounded-full shadow-sm hover:shadow-md transition-shadow bg-indigo-500 hover:bg-indigo-600"
                  onClick={resetForm}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo contacto
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingContact ? "Editar Contacto" : "Nuevo Contacto"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="organization">Organización *</Label>
                      <div className="flex gap-2">
                        <Select
                          value={formData.organization}
                          onValueChange={(value) => setFormData({ ...formData, organization: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar organización" />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.length === 0 ? (
                              <SelectItem value="" disabled>
                                No hay cuentas disponibles
                              </SelectItem>
                            ) : (
                              accounts.map((account) => (
                                <SelectItem key={account.id} value={account.name}>
                                  {account.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            window.open('/accounts', '_blank');
                          }}
                          title="Crear nueva cuenta"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      {accounts.length === 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Crea primero una cuenta en el módulo de Cuentas
                        </p>
                      )}
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
                      <Label htmlFor="last_contact_date">Último Contacto</Label>
                      <Input
                        id="last_contact_date"
                        type="date"
                        value={formData.last_contact_date}
                        onChange={(e) => setFormData({ ...formData, last_contact_date: e.target.value })}
                      />
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
                        disabled={formData.contact_type !== 'Cliente' && formData.contact_type !== 'Cliente proxy'}
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
                        disabled={formData.contact_type !== 'Cliente' && formData.contact_type !== 'Cliente proxy'}
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
                    {editingContact && (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => {
                          handleDelete(editingContact.id);
                          setIsDialogOpen(false);
                        }}
                        className="mr-auto"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button type="button" className="rounded-full" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button 
                      className="rounded-full shadow-sm hover:shadow-md transition-shadow bg-indigo-500 hover:bg-indigo-600"
                      type="submit">{editingContact ? "Actualizar" : "Crear"}
                      </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <div className="mb-3 relative w-full max-w-md">
          <Input
            placeholder="Buscar por nombre, email u organización..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="w-full bg-white"
          />
          {suggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full bg-white border rounded shadow text-sm">
              {suggestions.map((s, i) => (
                <li
                  key={i}
                  className="px-3 py-1 hover:bg-gray-100 cursor-pointer"
                  onClick={() => setFilters({ ...filters, search: s })}
                >
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mb-8 flex flex-wrap gap-2">
        {/* Chips de Tier */}
        {["1", "2", "3"].map((tier) => (
          <button
            className={`filter-chip ${
                filters.tier === tier
                  ? "filter-chip-active"
                  : "filter-chip-inactive"
              }`}
            key={tier}
            onClick={() =>
              setFilters({ ...filters, tier: filters.tier === tier ? "" : tier })
            }
          >
            Tier {tier}
          </button>
        ))}

        {/* Chips de Tipo de contacto */}
        {["Cliente", "Prospect", "Oportunidad"].map((type) => (
          <button   
            className={`filter-chip ${
                filters.contact_type === type
                  ? "filter-chip-active"
                  : "filter-chip-inactive"
              }`}
            key={type}
            onClick={() =>
              setFilters({
                ...filters,
                contact_type: filters.contact_type === type ? "" : type,
              })
            }
          >
            {type}
          </button>
        ))}
      </div>
        <div className="bg-card rounded-lg shadow overflow-hidden overflow-x-auto">
          <Table className="w-full table-fixed">
            <colgroup>
              <col className="w-[100px]" />
              <col className="w-[100px]" />
              <col className="w-[80px]" />
              <col className="w-[100px]" />
              <col className="w-[80px]" />
              <col className="w-[80px]" />
              <col className="w-[70px]" />
              <col className="w-[70px]" />
              <col className="w-[70px]" />
              <col className="w-[50px]" />
            </colgroup>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted/50">
                <TableHead className="text-center cursor-pointer" onClick={() => handleSort("organization")}>Organización</TableHead>
                <TableHead className="text-center cursor-pointer" onClick={() => handleSort("name")}>Nombre</TableHead>
                <TableHead className="text-center cursor-pointer" onClick={() => handleSort("tier")}>Tier</TableHead>
                <TableHead className="text-center cursor-pointer" onClick={() => handleSort("title")}>Cargo</TableHead>
                <TableHead className="text-center cursor-pointer" onClick={() => handleSort("PA")}>PA</TableHead>
                <TableHead className="text-center cursor-pointer" onClick={() => handleSort("contact_type")}>Tipo de contacto</TableHead>
                <TableHead className="text-center cursor-pointer" onClick={() => handleSort("contacted")}>Contactado</TableHead>
                <TableHead className="text-center cursor-pointer" onClick={() => handleSort("interested")}>Interesado</TableHead>
                <TableHead className="text-center cursor-pointer" onClick={() => handleSort("webinars_subscribed")}>Webinars</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="p-8 text-center text-muted-foreground">
                    No se encontraron contactos que coincidan con los filtros
                  </TableCell>
                </TableRow>
              ) : sortedContacts.map((contact) => (
                <TableRow key={contact.id} 
                    className="cursor-pointer hover:bg-muted/50 text-sm text-center align-middle"
                    onClick={() => openEditDialog(contact, true)}>
                  <TableCell className="p-1">{contact.organization}</TableCell>
                  <TableCell className="p-1 text-left font-bold"> <span>{contact.first_name} {contact.last_name}</span></TableCell>
                  <TableCell className="p-1">
                    <div className="flex justify-center">
                      {contact.tier ? (
                        <span 
                          className={`tier-circle ${
                            contact.tier === "1" ? "tier-1" :
                            contact.tier === "2" ? "tier-2" :
                            "tier-3"
                          }`}
                        >
                          Tier {contact.tier}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="p-1">{contact.title}</TableCell>
                  <TableCell className="p-1 w-40">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-xs font-medium">{contact.pa_name || '-'}</span>
                      <span className="text-xs text-muted-foreground">{contact.pa_phone || '-'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="p-1 w-40">
                    <span
                      className={`rounded text-xs font-medium ${
                        contact.contact_type === "Cliente" ? "px-7 py-2.5 bg-green-500/20 text-green-700" : 
                        contact.contact_type === "Oportunidad" ? "px-3 py-2.5 bg-blue-500/20 text-blue-700" : 
                        contact.contact_type === "Cliente proxy" ? "px-3 py-2.5 bg-green-500/20 text-green-700" :
                        contact.contact_type === "Prospect" ? "px-6 py-2.5 bg-yellow-300/20 text-yellow-700" : 
                        "px-2 py-2.5 bg-muted text-muted-foreground"
                      }`}>
                      {contact.contact_type}
                    </span>
                  </TableCell>
                 <TableCell>
                    <div className="flex items-center justify-center">
                      {contact.contacted ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-400" />
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center justify-center">
                      {contact.interested ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-400" />
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center justify-center">
                      {contact.webinars_subscribed ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-400" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="p-0 text-center">
                    {contact.linkedin_url ? (
                      <a 
                        href={contact.linkedin_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center text-blue-600 hover:text-blue-800 w-full h-full py-2"
                        title="Ver LinkedIn"
                      >
                        <svg 
                          className="h-5 w-5" 
                          fill="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                        </svg>
                      </a>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
       </div>
    </div>
  );
};

export default CRM;