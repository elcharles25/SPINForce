import { useState, useEffect } from "react";
import { db } from "@/lib/db-adapter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";
import { HtmlEditor } from "@/components/ui/html-editor";

export function WebinarEmailEditor() {
  const [emailConfig, setEmailConfig] = useState({
    subject: "Webinars disponibles este mes",
    html: `<h2>Hola {{nombre}},</h2>
<p>Aquí están los webinars disponibles para este mes en tu organización {{organizacion}}.</p>
<p>Adjuntamos el PDF con toda la información.</p>
<p>Saludos,<br>El equipo</p>`,
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchEmailConfig();
  }, []);

  const fetchEmailConfig = async () => {
    try {
      const data = await db.getSetting("webinar_email_template");
      if (data?.value) {
        setEmailConfig(data.value || emailConfig);
      }
    } catch (error) {
      console.error("Error cargando configuración:", error);
    }
  };

  const saveEmailConfig = async () => {
    try {
      await db.upsertSetting("webinar_email_template", emailConfig);
      toast({ title: "Éxito", description: "Plantilla de email guardada" });
    } catch (error) {
      console.error("Error guardando configuración:", error);
      toast({ 
        title: "Error", 
        description: "No se pudo guardar la plantilla", 
        variant: "destructive" 
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurar Email de Webinars</CardTitle>
        <CardDescription>Esta plantilla se usará para todos los envíos de webinars</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="subject">Asunto del Email</Label>
          <Input
            id="subject"
            value={emailConfig.subject}
            onChange={(e) => setEmailConfig({ ...emailConfig, subject: e.target.value })}
          />
          <p className="text-sm text-muted-foreground mt-1">
            Variables disponibles: {"{{mes}}"}, {"{{anio}}"}
          </p>
        </div>
        <div>
          <Label htmlFor="html">Plantilla HTML</Label>
          <HtmlEditor
            value={emailConfig.html}
            onChange={(html) => setEmailConfig({ ...emailConfig, html })}
            placeholder="Escribe la plantilla del email..."
            minHeight="400px"
          />
          <p className="text-sm text-muted-foreground mt-1">
            Variables disponibles: {"{{nombre}}"}, {"{{apellido}}"}, {"{{organizacion}}"}
          </p>
        </div>
        <Button 
          className="rounded-full shadow-sm hover:shadow-md transition-shadow bg-indigo-500 hover:bg-indigo-600"
          onClick={saveEmailConfig}>
          <Save 
          className="h-4 w-4 mr-2" 
          />
          Guardar Plantilla
        </Button>
      </CardContent>
    </Card>
  );
}
