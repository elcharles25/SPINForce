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

const DEFAULT_TEMPLATE = {
  subject: "Webinars gratuitos Gartner {{mes}} {{anio}} - Comparte con quien consideres",
  html: `<div>
<p><span style="font-size:11.0pt;">Hola {{Nombre}},
<br><br>Como en ocasiones anteriores, Gartner ha publicado el listado de webinars gratuitos del mes que viene para que puedas apuntarte tú o alguien de tu equipo (adjunto en pdf).
<br><br> De los webinars de este mes, creo que pueden resultarte intersantes: 
<br><br>
<div style="margin-left: 30px;">
<table border=1 cellspacing=0 cellpadding=0 style='border-collapse:collapse;border:none;border-top:solid #7F7F7F .5pt;border-bottom:solid #7F7F7F .5pt;padding:0cm 5.4pt 0cm 5.4pt'>
 <tr style='height:14.15pt'>
  <td width=91 style='width:68.05pt;border:none;background:#D9D9D9;padding:0cm 5.4pt 0cm 5.4pt;height:14.15pt'>
  <p align=center style='text-align:center;margin:0cm'><b><span style='font-size:9.0pt;color:black'>Fecha</span></b></p>
  </td>
  <td width=68 style='width:51.0pt;border:none;background:#D9D9D9;padding:0cm 5.4pt 0cm 5.4pt;height:14.15pt'>
  <p align=center style='text-align:center;margin:0cm'><b><span style='font-size:9.0pt;color:black'>Hora</span></b></p>
  </td>
  <td width=476 style='width:357.15pt;border:none;background:#D9D9D9;padding:0cm 5.4pt 0cm 5.4pt;height:14.15pt'>
  <p align=center style='text-align:center;margin:0cm'><b><span style='font-size:9.0pt;color:black'>Título</span></b></p>
  </td>
  <td width=155 style='width:116.2pt;border:none;background:#D9D9D9;padding:0cm 5.4pt 0cm 5.4pt;height:14.15pt'>
  <p align=center style='text-align:center;margin:0cm'><b><span style='font-size:9.0pt;color:black'>Analista</span></b></p>
  </td>
 </tr>
 <tr style='height:1.0pt'>
  <td width=91 style='width:68.05pt;border:none;border-bottom:solid #7F7F7F 1.0pt;padding:0cm 5.4pt 0cm 5.4pt;height:1.0pt'>
  <p align=center style='text-align:center;margin:0cm'><b><span style='font-size:7.0pt'>&nbsp;</span></b></p>
  </td>
  <td width=68 style='width:51.0pt;border:none;border-bottom:solid #7F7F7F 1.0pt;padding:0cm 5.4pt 0cm 5.4pt;height:1.0pt'>
  <p align=center style='text-align:center;margin:0cm'><span style='font-size:7.0pt'>&nbsp;</span></p>
  </td>
  <td width=476 style='width:357.15pt;border:none;border-bottom:solid #7F7F7F 1.0pt;padding:0cm 5.4pt 0cm 5.4pt;height:1.0pt'>
  <p style='margin:0cm'><span style='font-size:7.0pt'>&nbsp;</span></p>
  </td>
  <td width=155 style='width:116.2pt;border:none;border-bottom:solid #7F7F7F 1.0pt;padding:0cm 5.4pt 0cm 5.4pt;height:1.0pt'>
  <p align=center style='text-align:center;margin:0cm'><span style='font-size:7.0pt'>&nbsp;</span></p>
  </td>
 </tr>
 <tr style='height:19.85pt'>
  <td width=91 style='width:68.05pt;border:none;padding:0cm 5.4pt 0cm 5.4pt;height:19.85pt'>
  <p align=center style='text-align:center;margin:0cm'><b><span style='font-size:9.0pt'>{{Fecha1}}</span></b></p>
  </td>
  <td width=68 style='width:51.0pt;border:none;padding:0cm 5.4pt 0cm 5.4pt;height:19.85pt'>
  <p align=center style='text-align:center;margin:0cm'><span style='font-size:9.0pt'>{{Hora1}}</span></p>
  </td>
  <td width=476 style='width:357.15pt;border:none;padding:0cm 5.4pt 0cm 5.4pt;height:19.85pt'>
  <p style='margin:0cm'><span style='font-size:9.0pt'>{{Webinar1}}</span></p>
  </td>
  <td width=155 style='width:116.2pt;border:none;padding:0cm 5.4pt 0cm 5.4pt;height:19.85pt'>
  <p align=center style='text-align:center;margin:0cm'><span style='font-size:9.0pt'>{{Analista1}}</span></p>
  </td>
 </tr>
 <tr style='height:19.85pt'>
  <td width=91 style='width:68.05pt;border-top:solid #7F7F7F 1.0pt;border-left:none;border-bottom:solid #7F7F7F 1.0pt;border-right:none;padding:0cm 5.4pt 0cm 5.4pt;height:19.85pt'>
  <p align=center style='text-align:center;margin:0cm'><b><span style='font-size:9.0pt'>{{Fecha2}}</span></b></p>
  </td>
  <td width=68 style='width:51.0pt;border-top:solid #7F7F7F 1.0pt;border-left:none;border-bottom:solid #7F7F7F 1.0pt;border-right:none;padding:0cm 5.4pt 0cm 5.4pt;height:19.85pt'>
  <p align=center style='text-align:center;margin:0cm'><span style='font-size:9.0pt'>{{Hora2}}</span></p>
  </td>
  <td width=476 style='width:357.15pt;border-top:solid #7F7F7F 1.0pt;border-left:none;border-bottom:solid #7F7F7F 1.0pt;border-right:none;padding:0cm 5.4pt 0cm 5.4pt;height:19.85pt'>
  <p style='margin:0cm'><span style='font-size:9.0pt'>{{Webinar2}}</span></p>
  </td>
  <td width=155 style='width:116.2pt;border-top:solid #7F7F7F 1.0pt;border-left:none;border-bottom:solid #7F7F7F 1.0pt;border-right:none;padding:0cm 5.4pt 0cm 5.4pt;height:19.85pt'>
  <p align=center style='text-align:center;margin:0cm'><span style='font-size:9.0pt'>{{Analista2}}</span></p>
  </td>
 </tr>
</table>
</div>
<br><span style="font-size:11.0pt;">Siéntente libre de enviar el listado a vuestro equipo o a quién consideres conveniente para que se puedan apuntar.</span></p>
</div>`
};


export function WebinarEmailEditor() {
const [emailConfig, setEmailConfig] = useState(DEFAULT_TEMPLATE);
  const { toast } = useToast();

  useEffect(() => {
    fetchEmailConfig();
  }, []);

  const fetchEmailConfig = async () => {
    try {
      const data = await db.getSetting("webinar_email_template");
      if (data?.value && data.value.html) {
        // Si hay plantilla guardada en BD, usarla
        setEmailConfig({
          subject: data.value.subject || DEFAULT_TEMPLATE.subject,
          html: data.value.html
        });
      }
      // Si no hay datos en BD, se mantiene DEFAULT_TEMPLATE del useState
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
          <Label htmlFor="subject">Asunto</Label>
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
          <Label htmlFor="html">Cuerpo</Label>
          <HtmlEditor
            value={emailConfig.html}
            onChange={(html) => setEmailConfig({ ...emailConfig, html })}
            placeholder="Escribe la plantilla del email..."
            minHeight="400px"
          />
          <p className="text-sm text-muted-foreground mt-1">
            Variables disponibles: {"{{nombre}}"}, {"{{apellido}}"}, {"{{organizacion}}"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            No es necesario añadir firma. Se añade automáticamente la firma definida en el aparatado de configuración.
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
