import { useState, useEffect } from "react";
import { db } from "@/lib/db-adapter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { HtmlEditor } from "@/components/ui/html-editor";
import { Save, Download, Upload, AlertTriangle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const Settings = () => {
  const [signature, setSignature] = useState("");
  const [accountManager, setAccountManager] = useState({
    name: "",
    role: "",
    email: "",
    surname: "",
  });
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showImportWarning, setShowImportWarning] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
    fetchAccountManager();
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await db.getSetting("email_signature");
      if (data?.value) {
        setSignature(data.value.signature || "");
      }
    } catch (error) {
      console.error("Error cargando firma:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar la firma de email",
        variant: "destructive"
      });
    }
  };

  const fetchAccountManager = async () => {
    try {
      const data = await db.getSetting("account_manager");
      if (data?.value) {
        setAccountManager({
          name: data.value.name || "",
          role: data.value.role || "",
          email: data.value.email || "",
          surname: data.value.surname || "",
        });
      }
    } catch (error) {
      console.error("Error cargando account manager:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar la información del Account Executive",
        variant: "destructive"
      });
    }
  };

  const [isMigrating, setIsMigrating] = useState(false);

const migrateAttachments = async () => {
  try {
    setIsMigrating(true);
    console.log('🔄 Iniciando migración de adjuntos...');

    const response = await fetch('http://localhost:3001/api/migrate-attachments', {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error('Error en la migración');
    }

    const result = await response.json();

    toast({
      title: "Migración completada",
      description: `${result.migratedCount} archivos migrados correctamente`
    });

    console.log('✅ Migración completada:', result);
  } catch (error) {
    console.error('❌ Error en migración:', error);
    toast({
      title: "Error",
      description: "No se pudo completar la migración",
      variant: "destructive"
    });
  } finally {
    setIsMigrating(false);
  }
};

  const saveSignature = async () => {
    try {
      await db.upsertSetting("email_signature", { signature });
      toast({ 
        title: "Éxito", 
        description: "Firma guardada correctamente" 
      });
    } catch (error) {
      console.error("Error guardando firma:", error);
      toast({ 
        title: "Error", 
        description: "No se pudo guardar la firma", 
        variant: "destructive" 
      });
    }
  };

  const saveAccountManager = async () => {
    if (!accountManager.name || !accountManager.role || !accountManager.email) {
      toast({ 
        title: "Error", 
        description: "Todos los campos son requeridos", 
        variant: "destructive" 
      });
      return;
    }

    try {
      await db.upsertSetting("account_manager", accountManager);
      toast({ 
        title: "Éxito", 
        description: "Datos del Account Executive guardados" 
      });
    } catch (error) {
      console.error("Error guardando account manager:", error);
      toast({ 
        title: "Error", 
        description: "No se pudo guardar la información", 
        variant: "destructive" 
      });
    }
  };

  const exportDatabase = async () => {
    try {
      setIsExporting(true);
      console.log('📤 Iniciando exportación de base de datos...');

      const response = await fetch('http://localhost:3001/api/export-database');
      
      if (!response.ok) {
        throw new Error('Error exportando base de datos');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      a.download = `crm_backup_${timestamp}.db`;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Éxito",
        description: "Base de datos exportada correctamente"
      });

      console.log('✅ Exportación completada');
    } catch (error) {
      console.error('❌ Error exportando base de datos:', error);
      toast({
        title: "Error",
        description: "No se pudo exportar la base de datos",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.db')) {
        toast({
          title: "Error",
          description: "Por favor selecciona un archivo .db válido",
          variant: "destructive"
        });
        return;
      }
      setSelectedFile(file);
      setShowImportWarning(true);
    }
  };

  const confirmImport = async () => {
    if (!selectedFile) return;

    try {
      setIsImporting(true);
      console.log('📥 Iniciando importación de base de datos...');

      const formData = new FormData();
      formData.append('database', selectedFile);

      const response = await fetch('http://localhost:3001/api/import-database', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error importando base de datos');
      }

      toast({
        title: "Éxito",
        description: "Base de datos importada correctamente. Recargando página..."
      });

      console.log('✅ Importación completada');
      
      // Recargar la página después de 2 segundos
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error) {
      console.error('❌ Error importando base de datos:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo importar la base de datos",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
      setShowImportWarning(false);
      setSelectedFile(null);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Configuración</h1>

        <Tabs defaultValue="account-manager">
          <TabsList>
            <TabsTrigger value="account-manager">Datos del Account Executive</TabsTrigger>
            <TabsTrigger value="signature">Firma de Email</TabsTrigger>
            <TabsTrigger value="database">Importar/Exportar Base de Datos</TabsTrigger>
            <TabsTrigger value="appearance">Apariencia</TabsTrigger>
            <TabsTrigger value="general">General</TabsTrigger>
          </TabsList>

          <TabsContent value="account-manager">
            <Card>
              <CardHeader>
                <CardTitle>Información del Account Executive</CardTitle>
                <CardDescription>Información del gestor de cuenta responsable</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="manager-name">Nombre</Label>
                  <Input
                    id="manager-name"
                    value={accountManager.name}
                    onChange={(e) => setAccountManager({ ...accountManager, name: e.target.value })}
                    placeholder="Nombre Account Executive"
                  />
                </div>
                <div>
                  <Label htmlFor="manager-surname">Apellidos</Label>
                  <Input
                    id="manager-surname"
                    value={accountManager.surname}
                    onChange={(e) => setAccountManager({ ...accountManager, surname: e.target.value })}
                    placeholder="Apellido Account Executive"
                  />
                </div>
                <div>
                  <Label htmlFor="manager-role">Rol</Label>
                  <Input
                    id="manager-role"
                    value={accountManager.role}
                    onChange={(e) => setAccountManager({ ...accountManager, role: e.target.value })}
                    placeholder="Rol"
                  />
                </div>
                <div>
                  <Label htmlFor="manager-email">Email</Label>
                  <Input
                    id="manager-email"
                    type="email"
                    value={accountManager.email}
                    onChange={(e) => setAccountManager({ ...accountManager, email: e.target.value })}
                    placeholder="email del Account Executive"
                  />
                </div>
                <Button 
                  className="rounded-full shadow-sm hover:shadow-md transition-shadow bg-indigo-500 hover:bg-indigo-600"
                  onClick={saveAccountManager}>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Account Executive
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

        <TabsContent value="signature">
          <Card>
            <CardHeader>
              <CardTitle>Firma de Email</CardTitle>
              <CardDescription>
                Esta firma se incluirá automáticamente en todos los emails de campañas y webinars
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="signature">Firma HTML</Label>
                <HtmlEditor
                  value={signature}
                  onChange={setSignature}
                  placeholder="Escribe tu firma de email..."
                  minHeight="300px"
                />
              </div>
              <Button 
                className="rounded-full shadow-sm hover:shadow-md transition-shadow bg-indigo-500 hover:bg-indigo-600"
                onClick={saveSignature}>
                <Save className="h-4 w-4 mr-2" />
                Guardar Firma
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

          <TabsContent value="database">
            <Card>
              <CardHeader>
                <CardTitle>Gestión de Base de Datos</CardTitle>
                <CardDescription>
                  Exporta o importa la base de datos completa para hacer backups o migrar datos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="bg-card rounded-lg shadow p-3">
                {/* Exportar */}
                <div className="space-y-3">
                    <div>
                    <h3 className="text-lg font-semibold">Exportar Base de Datos</h3>
                    <p className="text-sm text-muted-foreground">
                      Descarga una copia de seguridad de toda la base de datos incluyendo contactos, campañas, templates y configuración.
                    </p>
                  </div>
                  <Button 
                    className="rounded-full shadow-sm hover:shadow-md transition-shadow bg-indigo-500 hover:bg-indigo-600"
                    onClick={exportDatabase} disabled={isExporting}>
                    <Download className="h-4 w-4 mr-2" />
                    {isExporting ? "Exportando..." : "Exportar Base de Datos"}
                  </Button>
                </div>
                <div className="border-t pt-4 mt-6" />

                {/* Importar */}
                <div className="space-y-3">
                  <div>
                    <h3 className="text-lg font-semibold">Importar Base de Datos</h3>
                    <p className="text-sm text-muted-foreground">
                      Reemplaza la base de datos actual con una copia de seguridad. 
                      <span className="text-destructive font-semibold"> ¡ADVERTENCIA: Esta acción no se puede deshacer!</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Input
                      type="file"
                      accept=".db"
                      onChange={handleFileSelect}
                      disabled={isImporting}
                      className="max-w-md"
                    />
                  </div>
                  {selectedFile && (
                    <p className="text-sm text-muted-foreground">
                      Archivo seleccionado: <span className="font-medium">{selectedFile.name}</span>
                    </p>
                  )}
                </div>
              </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance">
            <Card>
              <CardHeader>
                <CardTitle>Apariencia</CardTitle>
                <CardDescription>Personaliza el aspecto de la aplicación</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Configuración de apariencia próximamente...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>Configuración General</CardTitle>
                <CardDescription>Ajustes básicos de la aplicación</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Configuración general próximamente...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog de confirmación de importación */}
      <AlertDialog open={showImportWarning} onOpenChange={setShowImportWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              ¿Estás seguro?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Esta acción reemplazará <span className="font-semibold">TODA</span> la base de datos actual con el archivo seleccionado:
              </p>
              <p className="font-medium text-foreground">
                {selectedFile?.name}
              </p>
              <p className="text-destructive font-semibold">
                ⚠️ Se perderán todos los datos actuales de forma permanente.
              </p>
              <p>
                Se recomienda hacer un backup antes de continuar.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setSelectedFile(null);
              setShowImportWarning(false);
            }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmImport}
              className="bg-destructive hover:bg-destructive/90"
              disabled={isImporting}
            >
              {isImporting ? "Importando..." : "Sí, importar base de datos"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Settings;