import { useState, useEffect } from "react";
import { db } from "@/lib/db-adapter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Settings, Send, Trash2, FileText, X, Loader2, Sparkles, Calendar, Clock, User } from "lucide-react";
import { WebinarEmailEditor } from "@/components/webinars/WebinarEmailEditor";
import { useOutlookDraftBatch } from "@/hooks/useOutlookDraft";
import { formatDateES } from "@/utils/dateFormatter";
import { Badge } from "@/components/ui/badge";

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

  useEffect(() => {
    fetchDistributions();
  }, []);

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

  const handleRemovePdf = () => {
    setUploadedPdf(null);
    toast({
      title: "PDF eliminado",
      description: "Puedes subir otro archivo"
    });
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
      toast({ 
        title: "Error", 
        description: "No hay datos de webinars disponibles", 
        variant: "destructive" 
      });
      return;
    }

    setCreatingDrafts(true);

    try {
      const allContacts = await db.getContacts();
      const contactsWithWebinars = allContacts.filter((c: any) => 
        c.webinars_subscribed && 
        Array.isArray(c.webinars_subscribed) && 
        c.webinars_subscribed.length > 0
      );

      if (contactsWithWebinars.length === 0) {
        toast({ 
          title: "Sin contactos", 
          description: "No hay contactos suscritos a webinars", 
          variant: "destructive" 
        });
        return;
      }

      const accountManagerSetting = await db.getSetting('account_manager');
      const emailSignatureSetting = await db.getSetting('email_signature');
      const emailTemplateSetting = await db.getSetting('webinar_email_template');

      const accountManager = accountManagerSetting?.value || {};
      const signature = emailSignatureSetting?.value?.signature || '';
      const emailTemplate = emailTemplateSetting?.value || {};

      const draftsToCreate = contactsWithWebinars.map((contact: any) => {
        const role = contact.gartner_role || contact.webinar_role;
        const webinars = webinarsByRole[role] || [];

        let emailBody = emailTemplate.html || '';
        
        emailBody = emailBody
          .replace(/{{Nombre}}/g, contact.first_name || '')
          .replace(/{{mes}}/g, month.split('-')[1])
          .replace(/{{anio}}/g, month.split('-')[0]);

        if (webinars.length > 0) {
          const webinarRows = webinars.map((w: WebinarInfo, idx: number) => `
            <tr>
              <td>${w.date}</td>
              <td>${w.time}</td>
              <td>${w.title}</td>
              <td>${w.analyst}</td>
            </tr>
          `).join('');
          
          emailBody = emailBody.replace(
            '</table>',
            webinarRows + '</table>'
          );
        }

        emailBody += signature;

        return {
          to: contact.email,
          subject: emailTemplate.subject || `Webinars Gartner ${month}`,
          body: emailBody,
        };
      });

      createDraftsBatch({ emails: draftsToCreate }, {
        onSuccess: async () => {
          toast({ 
            title: "Éxito", 
            description: `${draftsToCreate.length} borradores creados en Outlook` 
          });

          await db.updateDistribution(currentDistributionId, { 
            sent: true, 
            sent_at: new Date().toISOString() 
          });
          
          setShowWebinarsDialog(false);
          setWebinarsByRole({});
          setCurrentDistributionId(null);
          fetchDistributions();
        },
        onError: (error) => {
          toast({ 
            title: "Error", 
            description: "No se pudieron crear los borradores", 
            variant: "destructive" 
          });
        }
      });

    } catch (error) {
      console.error("Error creando drafts:", error);
      toast({ 
        title: "Error", 
        description: "Error al preparar los borradores", 
        variant: "destructive" 
      });
    } finally {
      setCreatingDrafts(false);
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
          <h1 className="text-3xl font-bold text-foreground">Gestión de Webinars</h1>
          <Button 
            variant="outline" 
            className="rounded-full shadow-sm hover:shadow-md transition-shadow hover:bg-indigo-100"
            onClick={() => setShowEmailEditor(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Configurar Email
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Enviar nueva distribucuión</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
                    Analizar y enviar webinars
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Webinars enviados</CardTitle>
          </CardHeader>
          <CardContent>
            {distributions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No hay distribuciones creadas. Carga un PDF y guarda una distribución.
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