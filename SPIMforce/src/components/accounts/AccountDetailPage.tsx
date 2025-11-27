import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '@/lib/db-adapter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { formatDateTime } from '@/utils/dateFormatter';
import {
  Sparkles,
  TrendingUp,
  Copy,
  Loader2,
  RefreshCw,
  ArrowLeft,
  Pencil,
  Trash2,
  Globe,
  MapPin,
  Building2,
  User,
  Image as ImageIcon,
  Network,
  Plus,
  Save,
  X,
  GitBranch,
} from 'lucide-react';
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

interface Account {
  id: string;
  name: string;
  full_name: string;
  logo: string | null;
  sector: string;
  web_site: string;
  address: string;
  corporative_objectives: string | null;
  org_chart: string | null;
  created_at: string;
  updated_at: string;
}

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  title: string;
  contact_type: string;
  gartner_role: string;
  email: string;
  last_contact_date: string;
  phone: string | null;
}

interface CorporativeObjective {
  title: string;
  description: string;
  completion_date: string;
}

interface OrgChartNode {
  id: string;
  name: string;
  role: string;
  x: number;
  y: number;
}

interface OrgChartConnection {
  from: string;
  to: string;
}

interface OrgChartData {
  nodes: OrgChartNode[];
  connections: OrgChartConnection[];
}

const analyzeWithGemini = async (contacts: Contact[], accountName: string): Promise<string> => {
  const geminiKey = (window as any).__GEMINI_API_KEY__ || '';
  
  if (!geminiKey) {
    throw new Error('GEMINI_API_KEY no configurada. Por favor, configúrala en Settings.');
  }

  const contactsInfo = contacts.map(c => 
    `- ${c.first_name} ${c.last_name} (${c.title}) - Tipo: ${c.contact_type}`
  ).join('\n');

  const fullPrompt = `Analiza la siguiente información de la organización "${accountName}" y sus contactos clave para identificar los objetivos corporativos que puedan estar persiguiendo.

CONTACTOS DE LA ORGANIZACIÓN:
${contactsInfo}

Basándote en los roles y títulos de los contactos, identifica los objetivos corporativos más probables de esta organización.

IMPORTANTE: Devuelve SOLO un objeto JSON válido (sin markdown, sin \`\`\`json) con esta estructura exacta:
{
  "objectives": [
    {
      "title": "Título del objetivo (máx 80 caracteres)",
      "description": "Descripción detallada del objetivo estratégico (máx 300 caracteres)",
      "completion_date": "YYYY-MM-DD"
    }
  ]
}

Si no puedes identificar objetivos claros, devuelve:
{
  "objectives": []
}`;

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

export default function AccountDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const logoDropZoneRef = useRef<HTMLDivElement>(null);
  const orgChartRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [account, setAccount] = useState<Account | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [objectives, setObjectives] = useState<CorporativeObjective[]>([]);
  const [lastObjectivesUpdate, setLastObjectivesUpdate] = useState<string | null>(null);

  const [orgChartData, setOrgChartData] = useState<OrgChartData>({ nodes: [], connections: [] });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    full_name: '',
    sector: '',
    web_site: '',
    address: '',
  });

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  useEffect(() => {
    if (account && account.corporative_objectives) {
      try {
        const parsed = JSON.parse(account.corporative_objectives);
        setObjectives(parsed.objectives || []);
        setLastObjectivesUpdate(parsed.lastUpdate || null);
      } catch (error) {
        console.error('Error cargando objetivos:', error);
      }
    }
  }, [account]);

  useEffect(() => {
    if (account && account.org_chart) {
      try {
        const parsed = JSON.parse(account.org_chart);
        setOrgChartData(parsed);
        setIsInitialLoad(false);
      } catch (error) {
        console.error('Error cargando organigrama:', error);
        setIsInitialLoad(false);
      }
    } else {
      setIsInitialLoad(false);
    }
  }, [account]);

  useEffect(() => {
    if (isInitialLoad || !account) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      autoSaveOrgChart();
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [orgChartData, isInitialLoad, account]);

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!logoDropZoneRef.current || !account) return;
      
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          e.preventDefault();
          const blob = items[i].getAsFile();
          if (blob) {
            await handleLogoUpload(blob);
          }
          break;
        }
      }
    };

    if (logoDropZoneRef.current) {
      logoDropZoneRef.current.addEventListener('paste', handlePaste as any);
    }

    return () => {
      if (logoDropZoneRef.current) {
        logoDropZoneRef.current.removeEventListener('paste', handlePaste as any);
      }
    };
  }, [account]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (editingNode && orgChartRef.current) {
        const editingElement = document.getElementById(`editing-${editingNode}`);
        if (editingElement && !editingElement.contains(e.target as Node)) {
          setEditingNode(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editingNode]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [accountData, contactsData] = await Promise.all([
        db.getAccount(id!),
        db.getAccountContacts(id!),
      ]);
      
      setAccount(accountData);
      setContacts(contactsData);
    } catch (error) {
      console.error('Error cargando datos:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los datos de la cuenta',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getContactById = (name: string) => {
    return contacts.find(c => `${c.first_name} ${c.last_name}` === name);
  };

  const getNodeStyles = (nodeName: string) => {
    const contact = getContactById(nodeName);
    if (!contact) return { borderColor: 'border-slate-300', bgColor: '' };

    // Calcular si el último contacto es mayor a 2 meses
    let isOldContact = false;
    if (contact.last_contact_date) {
      const [datePart] = contact.last_contact_date.split(' ');
      const [day, month, year] = datePart.split('/');
      const lastContactDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      lastContactDate.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today.getTime() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24));
      isOldContact = diffDays > 60;
    }

    // Determinar color del borde según tipo de contacto
    let borderColor = 'border-slate-300';
    if (contact.contact_type === 'Cliente' || contact.contact_type === 'Cliente proxy') {
      borderColor = 'border-green-500';
    } else if (contact.contact_type === 'Prospect') {
      borderColor = 'border-yellow-500';
    } else if (contact.contact_type === 'Oportunidad') {
      borderColor = 'border-blue-500';
    }

    return {
      borderColor,
      bgColor: isOldContact ? 'bg-yellow-100' : 'bg-white'
    };
  };

  const getMissingRoles = () => {
  const requiredRoles = [
    "CIO", "CTO", "CISO", "CDAO", "CAIO", "CInO", 
    "Infrastructure & Operations", "D. Transformación", "Enterprise Architect"
  ];
  
  const existingRoles = contacts.map(c => c.gartner_role);
  
  return requiredRoles.filter(role => !existingRoles.includes(role));
};

  const handleLogoUpload = async (file: File) => {
    if (!account) return;
    
    setUploadingLogo(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = reader.result as string;
        
        try {
          const response = await fetch(`http://localhost:3001/api/accounts/${account.id}/logo-base64`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64Data })
          });

          const data = await response.json();

          if (data.success) {
            const updatedAccount = await db.getAccount(account.id);
            setAccount(updatedAccount);
            
            toast({
              title: 'Logo actualizado',
              description: 'El logo de la cuenta se ha guardado correctamente',
            });
          } else {
            throw new Error(data.error || 'Error desconocido');
          }
        } catch (error) {
          console.error('Error subiendo logo:', error);
          toast({
            title: 'Error',
            description: error instanceof Error ? error.message : 'Error al guardar el logo',
            variant: 'destructive',
          });
        } finally {
          setUploadingLogo(false);
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
      setUploadingLogo(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingLogo(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingLogo(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingLogo(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
      await handleLogoUpload(files[0]);
    }
  };

  const handleAnalyzeObjectives = async () => {
    if (contacts.length === 0) {
      toast({
        title: 'Sin información',
        description: 'No hay contactos asociados para analizar',
        variant: 'destructive',
      });
      return;
    }

    setGeminiLoading(true);
    try {
      console.log('📊 Iniciando análisis de objetivos corporativos...');

      const result = await analyzeWithGemini(contacts, account?.name || '');
      console.log('✅ Respuesta recibida de Gemini');
      
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No se pudo extraer JSON de la respuesta');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      const extractedObjectives = parsed.objectives || [];
      
      setObjectives(extractedObjectives);
      setLastObjectivesUpdate(new Date().toISOString());
      
      if (account) {
        const updatedAccount = {
          ...account,
          corporative_objectives: JSON.stringify({
            objectives: extractedObjectives,
            lastUpdate: new Date().toISOString()
          })
        };
        await db.updateAccount(account.id, updatedAccount);
      }
      
      toast({
        title: 'Análisis completado',
        description: `Se encontraron ${extractedObjectives.length} objetivo(s) corporativo(s)`,
      });
    } catch (error) {
      console.error('Error analizando objetivos:', error);
      
      let errorMessage = 'Error al analizar objetivos';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setGeminiLoading(false);
    }
  };

  const autoSaveOrgChart = async () => {
    if (!account) return;

    try {
      const updatedAccount = {
        ...account,
        org_chart: JSON.stringify(orgChartData),
      };
      await db.updateAccount(account.id, updatedAccount);
    } catch (error) {
      console.error('Error autoguardando organigrama:', error);
    }
  };

  const addOrgNode = () => {
    const newNode: OrgChartNode = {
      id: `node-${Date.now()}`,
      name: '',
      role: '',
      x: 20,
      y: 20,
    };
    setOrgChartData({
      ...orgChartData,
      nodes: [...orgChartData.nodes, newNode],
    });
    setEditingNode(newNode.id);
    setSelectedNode(newNode.id);
  };

  const deleteOrgNode = (nodeId: string) => {
    setOrgChartData({
      nodes: orgChartData.nodes.filter(n => n.id !== nodeId),
      connections: orgChartData.connections.filter(c => c.from !== nodeId && c.to !== nodeId),
    });
    setSelectedNode(null);
  };

  const updateOrgNode = (nodeId: string, updates: Partial<OrgChartNode>) => {
    setOrgChartData({
      ...orgChartData,
      nodes: orgChartData.nodes.map(n => n.id === nodeId ? { ...n, ...updates } : n),
    });
  };

const handleContactSelect = (nodeId: string, contactId: string) => {
  console.log('handleContactSelect llamado:', { nodeId, contactId });
  console.log('Contactos disponibles:', contacts);
  
  const selectedContact = contacts.find(c => c.id === contactId);
  console.log('Contacto encontrado:', selectedContact);
  
  if (selectedContact) {
    const updates = {
      name: `${selectedContact.first_name} ${selectedContact.last_name}`,
      role: selectedContact.title
    };
    console.log('Actualizando con:', updates);
    
    updateOrgNode(nodeId, updates);
    setEditingNode(null);
  } else {
    console.log('NO se encontró el contacto con id:', contactId);
  }
};

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (connectingFrom) {
      if (connectingFrom !== nodeId) {
        const connectionExists = orgChartData.connections.some(
          c => (c.from === connectingFrom && c.to === nodeId) || (c.from === nodeId && c.to === connectingFrom)
        );
        
        if (!connectionExists) {
          setOrgChartData({
            ...orgChartData,
            connections: [...orgChartData.connections, { from: connectingFrom, to: nodeId }],
          });
        }
      }
      setConnectingFrom(null);
      return;
    }

    if (editingNode === nodeId) return;

    const rect = orgChartRef.current?.getBoundingClientRect();
    if (!rect) return;

    const node = orgChartData.nodes.find(n => n.id === nodeId);
    if (!node) return;

    setDraggingNode(nodeId);
    setSelectedNode(nodeId);
    setDragOffset({
      x: e.clientX - rect.left - node.x,
      y: e.clientY - rect.top - node.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingNode) return;

    const rect = orgChartRef.current?.getBoundingClientRect();
    if (!rect) return;

    const gridSize = 40; // Tamaño de la cuadrícula

    let x = Math.max(0, Math.min(rect.width - 200, e.clientX - rect.left - dragOffset.x));
    let y = Math.max(0, Math.min(rect.height - 120, e.clientY - rect.top - dragOffset.y));

    // Alinear a la cuadrícula
    x = Math.round(x / gridSize) * gridSize;
    y = Math.round(y / gridSize) * gridSize;

    updateOrgNode(draggingNode, { x, y });
  };

  const handleMouseUp = () => {
    setDraggingNode(null);
  };

  const deleteConnection = (from: string, to: string) => {
    setOrgChartData({
      ...orgChartData,
      connections: orgChartData.connections.filter(c => !(c.from === from && c.to === to)),
    });
  };

  const openEditDialog = () => {
    if (!account) return;
    
    setFormData({
      name: account.name,
      full_name: account.full_name,
      sector: account.sector,
      web_site: account.web_site,
      address: account.address,
    });
    setIsEditDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      toast({
        title: 'Campo obligatorio',
        description: 'El nombre es obligatorio',
        variant: 'destructive',
      });
      return;
    }

    try {
      const payload = {
        ...formData,
        logo: account?.logo || null,
      };
      
      await db.updateAccount(id!, payload);
      toast({ title: 'Éxito', description: 'Cuenta actualizada correctamente' });
      setIsEditDialogOpen(false);
      loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: `Error al actualizar la cuenta: ${error instanceof Error ? error.message : 'Desconocido'}`,
        variant: 'destructive',
      });
    }
  };
  
  const handleDelete = async () => {
    if (!confirm('¿Estás seguro de eliminar esta cuenta?')) return;

    try {
      await db.deleteAccount(id!);
      toast({ title: 'Éxito', description: 'Cuenta eliminada' });
      navigate('/accounts');
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar la cuenta', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Cargando...</div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="container mx-auto py-8 px-4">
        <p>Cuenta no encontrada</p>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-6 px-4">
      <Button
        variant="ghost"
        onClick={() => navigate('/accounts')}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver a Cuentas
      </Button>

      <div className="flex gap-6 mb-6">
        <div className="h-32 aspect-[2/1] overflow-hidden">
          <div
            ref={logoDropZoneRef}
            tabIndex={0}
            className={
              `relative w-full h-full overflow-hidden 
              ${account.logo 
                  ? ''
                  : `rounded-2xl border-2 border-dashed 
                    ${isDraggingLogo ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 bg-gray-50'}
                    transition-colors cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500`
              }`
            }
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {account.logo ? (
              <>
                <img
                  src={`http://localhost:3001${account.logo}?t=${Date.now()}`}
                  alt={account.name}
                  className="absolute inset-0 w-full h-full object-contain p-1"
                  key={account.logo}
                />
                <button
                  type="button"
                  className="absolute inset-0 w-full h-full"
                  onClick={() => {}}
                  aria-label="Actualizar logo"
                />
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                {uploadingLogo ? (
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                ) : (
                  <>
                    <ImageIcon className="h-8 w-8" />
                    <p className="text-xs text-center px-2 mt-2">
                      Pega o arrastra un logo
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                {account.name}
              </h1>
              {account.full_name && (
                <p className="text-xl text-slate-600 mt-1">{account.full_name}</p>
              )}
              {account.sector && (
                <div className="text-sm flex text-slate-500 items-center mt-1 italic">
                  {account.sector}
                </div>
              )}
            </div>
            <Button 
              variant="outline"
              onClick={openEditDialog}
              className="rounded-full px-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Button>
          </div>
            
          <div className="flex gap-6 text-sm text-slate-600">
            {account.web_site && (
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-indigo-600" />
                <a
                  href={account.web_site}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Sitio Web
                </a>
              </div>
            )}
            {account.address && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-indigo-600" />
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(account.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {account.address}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      <Card className="mb-6 bg-gradient-to-br from-indigo-50/20 to-indigo-100/50 border-indigo-200 shadow-sm rounded-2xl">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800">
            <Sparkles className="h-5 w-5 text-indigo-500" />
            Análisis de Objetivos Corporativos con AI
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              {lastObjectivesUpdate && (
                <p className="text-xs italic text-slate-500">
                  Última actualización: {new Date(lastObjectivesUpdate).toLocaleDateString('es-ES')}
                </p>
              )}
            </div>
            <Button
              size="sm"
              onClick={handleAnalyzeObjectives}
              disabled={geminiLoading || contacts.length === 0}
              className="bg-indigo-500 hover:bg-indigo-600 text-white"
            >
              {geminiLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analizando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {objectives.length > 0 ? 'Actualizar' : 'Analizar'}
                </>
              )}
            </Button>
          </div>

          <div className="space-y-3">
            {objectives.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-slate-500 mb-2">
                  No hay objetivos corporativos analizados
                </p>
                {contacts.length === 0 && (
                  <p className="text-xs text-slate-400">
                    Necesitas contactos asociados para realizar el análisis
                  </p>
                )}
              </div>
            ) : (
              objectives.map((objective, index) => (
                <div
                  key={index}
                  className="bg-white p-4 rounded-lg border border-indigo-100 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="text-base font-semibold text-slate-800">
                      {objective.title}
                    </h4>
                    <Badge variant="outline" className="shrink-0 bg-indigo-50 text-indigo-700 border-indigo-200">
                      {new Date(objective.completion_date).toLocaleDateString('es-ES', {
                        month: 'short',
                        year: 'numeric'
                      })}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {objective.description}
                  </p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6 shadow-sm rounded-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Network className="h-5 w-5 text-indigo-600" />
              Organigrama de la Compañía
            </CardTitle>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={addOrgNode}
                className="rounded-full"
              >
                <Plus className="h-4 w-4 mr-1" />
                Añadir Persona
              </Button>
              {connectingFrom && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConnectingFrom(null)}
                  className="rounded-full bg-red-50 text-red-600 hover:bg-red-100"
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancelar Conexión
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div
            ref={orgChartRef}
            className="relative w-full h-[600px] bg-slate-50 rounded-lg border-2 border-slate-200 overflow-hidden"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setSelectedNode(null);
                setConnectingFrom(null);
              }
            }}
          >
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {orgChartData.connections.map((conn, idx) => {
                const fromNode = orgChartData.nodes.find(n => n.id === conn.from);
                const toNode = orgChartData.nodes.find(n => n.id === conn.to);
                
                if (!fromNode || !toNode) return null;

                const x1 = fromNode.x + 100;
                const y1 = fromNode.y + 40;
                const x2 = toNode.x + 100;
                const y2 = toNode.y + 40;

                const midY = (y1 + y2) / 2;

                return (
                  <g key={idx}>
                    <path
                      d={`M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`}
                      stroke="#b8b8b8ff"
                      strokeWidth="2"
                      fill="none"
                      className="pointer-events-auto cursor-pointer hover:stroke-red-500"
                      onClick={() => deleteConnection(conn.from, conn.to)}
                    />
                    <circle cx={x1} cy={y1} r="4" fill="#b8b8b8ff" />
                    <circle cx={x2} cy={y2} r="4" fill="#b8b8b8ff" />
                  </g>
                );
              })}
            </svg>

            {orgChartData.nodes.map((node) => {
              const nodeStyles = getNodeStyles(node.name);
              
              return (
                <div
                  key={node.id}
                  className={`absolute w-[200px] ${nodeStyles.bgColor} rounded-lg border-2 shadow-md transition-all cursor-move ${
                    selectedNode === node.id
                      ? `${nodeStyles.borderColor} shadow-lg scale-105`
                      : `${nodeStyles.borderColor} hover:border-indigo-400`
                  } ${connectingFrom === node.id ? 'ring-4 ring-indigo-300' : ''}`}
                  style={{
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                  }}
                  onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                >
                  <div className="p-3 md:p-3">
                    {editingNode === node.id ? (
                      <div id={`editing-${node.id}`} className="space-y-2" onClick={(e) => e.stopPropagation()}>
                        <select
                            className="w-full h-8 text-sm font-semibold border rounded px-2"
                            value=""
                            onChange={(e) => {
                              console.log('onChange disparado:', e.target.value);
                              handleContactSelect(node.id, e.target.value);
                            }}
                          >
                            <option value="">Seleccionar contacto</option>
                            {contacts
                              .filter((contact) => {
                                const fullName = `${contact.first_name} ${contact.last_name}`;
                                return !orgChartData.nodes.some(n => n.name === fullName && n.id !== node.id);
                              })
                              .map((contact) => (
                                <option key={contact.id} value={contact.id}>
                                  {contact.first_name} {contact.last_name}
                                </option>
                              ))}
                          </select>
                        {node.role && (
                          <p className="text-sm text-slate-500 text-center italic">
                            {node.role}
                          </p>
                        )}
                      </div>
                    ) : (
                      <>
                        <div
                          className="mb-2 text-center"
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setEditingNode(node.id);
                          }}
                        >
                          <p className="font-semibold text-sm text-slate-800 truncate">
                            {node.name || 'Sin nombre'}
                          </p>
                          <p className="text-sm text-slate-500 truncate italic">{node.role || 'Sin rol'}</p>
                        </div>
                        {selectedNode === node.id && (
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setConnectingFrom(node.id)}
                              className="flex-1 h-7 text-xs"
                              disabled={connectingFrom === node.id}
                            >
                              <GitBranch className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => deleteOrgNode(node.id)}
                              className="h-7 px-2 text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {orgChartData.nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <Network className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Haz clic en "Añadir Persona" para comenzar</p>
                  <p className="text-xs mt-1">
                    Selecciona contactos, arrastra las cajas, haz doble clic para editar
                  </p>
                </div>
              </div>
            )}
          </div>

          {connectingFrom && (
            <div className="mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
              <p className="text-sm text-indigo-700">
                <strong>Modo conexión activo:</strong> Haz clic en otra persona para crear una conexión
              </p>
            </div>
          )}
        </CardContent>
        <div className="flex items-center gap-4 mt-[-10px] mb-4 justify-center">
          <div className="flex items-center gap-2">
            <div className="text-xs text-slate-600 p-1 rounded-lg border-2 border-green-500 bg-white shadow-sm">Cliente</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-slate-600 p-1 rounded-lg border-2 border-yellow-500 bg-white shadow-sm">Prospect</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-slate-600 p-1 rounded-lg border-2 border-blue-500 bg-white shadow-sm">Oportunidad</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-slate-600 p-1 rounded-lg border-2 border-slate-300 bg-yellow-100 shadow-sm">+2 meses sin contacto</div>  
          </div>
        </div>

        {(() => {
          const missingRoles = getMissingRoles();
          
          if (missingRoles.length === 0) return null;
          
          return (
            <div className="mb-4 mx-6 p-4 bg-slate-50 border-slate-200 rounded-lg rounded-lg border-2 overflow-hidden">
              <h4 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
                <User className="h-4 w-4" />
                Roles sin identificar ({missingRoles.length})
              </h4>
              <div className="flex flex-wrap gap-2 justify-center">
                {missingRoles.map((role) => (
                  <div className="text-sm text-slate-600 p-3 rounded-lg border-2  bg-white border-red-300">
                    {role}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </Card>

      <Card className="shadow-sm rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <User className="h-5 w-5 text-indigo-600" />
            Contactos asociados ({contacts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <p className="text-center py-8 text-slate-500">
              No hay contactos asociados a esta cuenta
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted hover:bg-muted/50">
                    <TableHead>Nombre</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Tipo de Contacto</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Último contacto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => (
                    <TableRow
                      key={contact.id}
                      className="cursor-pointer hover:bg-slate-50"
                        onClick={() => navigate(`/contacts/${contact.id}`, { 
                          state: { from: 'account', accountId: id } 
                        })}
                    >
                      <TableCell className="font-medium">
                        {contact.first_name} {contact.last_name}
                      </TableCell>
                      <TableCell>{contact.title}</TableCell>
                      <TableCell>
                        <Badge
                          className={`text-xs px-3 py-1 rounded-full font-medium shadow-sm ${
                            contact.contact_type === 'Cliente' || contact.contact_type === 'Cliente proxy'
                              ? 'bg-green-500 hover:bg-green-600'
                              : contact.contact_type === 'Oportunidad'
                              ? 'bg-blue-500 hover:bg-blue-600'
                              : contact.contact_type === 'Prospect'
                              ? 'bg-amber-500 hover:bg-amber-600'
                              : 'bg-slate-500 hover:bg-slate-600'
                          }`}
                        >
                          {contact.contact_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <a
                          href={`mailto:${contact.email}`}
                          className="text-blue-600 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {contact.email}
                        </a>
                      </TableCell>
                    <TableCell>
                      {(() => {
                        if (!contact.last_contact_date) return '-';
                        
                        // Parsear fecha en formato DD/MM/YYYY HH:MM
                        const [datePart] = contact.last_contact_date.split(' ');
                        const [day, month, year] = datePart.split('/');
                        const lastContactDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                        
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        lastContactDate.setHours(0, 0, 0, 0);
                        
                        const diffDays = Math.floor((today.getTime() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24));
                        const isOld = diffDays > 60;
                        
                        return (
                          <span className={`px-2 py-1 rounded ${isOld ? 'bg-yellow-200' : ''}`}>
                            {formatDateTime(contact.last_contact_date)}
                          </span>
                        );
                      })()}
                    </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Cuenta</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {account?.logo && (
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border">
                <img
                  src={`http://localhost:3001${account.logo}`}
                  alt="Logo actual"
                  className="h-16 w-16 object-contain"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-700">Logo actual</p>
                  <p className="text-xs text-slate-500">
                    Puedes cambiar el logo desde la zona de arrastrar/pegar en la página principal
                  </p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="full_name">Nombre Completo</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="sector">Sector</Label>
                <Select
                  value={formData.sector}
                  onValueChange={(value) =>
                    setFormData({ ...formData, sector: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar sector" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Banking and Finance">Banking and Finance</SelectItem>
                    <SelectItem value="Insurance">Insurance</SelectItem>
                    <SelectItem value="Energy and Utilities">Energy and Utilities</SelectItem>
                    <SelectItem value="Technology and Telecom">Technology and Telecom</SelectItem>
                    <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                    <SelectItem value="Healthcare">Healthcare</SelectItem>
                    <SelectItem value="Retail">Retail</SelectItem>
                    <SelectItem value="Services">Services</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="web_site">Sitio Web</Label>
                <Input
                  id="web_site"
                  type="url"
                  value={formData.web_site}
                  onChange={(e) => setFormData({ ...formData, web_site: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="address">Dirección</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
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
              <Button
                type="button"
                className="rounded-full"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                className="rounded-full shadow-sm hover:shadow-md transition-shadow bg-indigo-500 hover:bg-indigo-600"
                type="submit"
              >
                Actualizar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}