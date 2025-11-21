import { db } from '@/lib/db-adapter';

export const PROMPT_FOLLOW_UP = `Analiza las notas de la siguiente reunión y extrae la información en formato JSON:

1. Identifica las principales iniciativas o prioridades que se comentaron durante la reunión:
   - Para cada iniciativa, incluye:
     * Título de la iniciativa
     * Actividades que se deban de realizar dentro de la iniciativa. Debe haber entre 1 y 3 actividades (mínimo 90 caracteres)

2. Identifica los próximos pasos acordados en la reunión:
   - Para cada próximo paso, incluye:
     * Actividad a realizar (mínimo 60 caracteres)
     * Responsable de la actividad

Estructura de la respuesta (devuelve SOLO JSON sin markdown):
{
  "initiatives": [
    {
      "title": "Título de la iniciativa",
      "activity_1": "Actividad a ejecutar"
      "activity_2": "Actividad a ejecutar" (si hay más de una actividad)
      "activity_3": "Actividad a ejecutar" (si hay más de una actividad)
    }
  ],
  "next_steps": [
    {
      "activity": "Actividad a realizar",
      "owner": "Responsable"
    }
  ]
}

Si no hay iniciativas:
{
  "initiatives": []
}

Si no hay próximos pasos:
{
  "next_steps": []
}

NOTAS DE LA REUNIÓN:
`;

export const analyzeWithGemini = async (notesContent: string, promptText: string): Promise<string> => {
  const geminiKey = (window as any).__GEMINI_API_KEY__ || '';

  if (!geminiKey) {
    throw new Error('GEMINI_API_KEY no configurada. Por favor, configúrala en Settings.');
  }

  const fullPrompt = `${promptText}

${notesContent}`;

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

export const generateFollowUpEmail = async (
  notes: string,
  contactFirstName: string,
  contactEmail: string
): Promise<void> => {
  console.log('📊 Analizando notas para follow-up...');

  const result = await analyzeWithGemini(notes, PROMPT_FOLLOW_UP);

  const jsonMatch = result.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No se pudo extraer JSON de la respuesta');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  const initiatives = parsed.initiatives || [];
  const nextSteps = parsed.next_steps || [];

  // Obtener Account Manager y Firma
  const amSetting = await db.getSetting("account_manager");
  const accountManagerName = amSetting?.value?.name || '';

  const signatureSetting = await db.getSetting("email_signature");
  let signature = '';
  if (signatureSetting?.value) {
    const value = signatureSetting.value;
    signature = value?.signature || "";
    signature = signature.trim();
    if (signature.startsWith('"') && signature.endsWith('"')) {
      signature = signature.slice(1, -1);
    }
    signature = signature.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\\//g, '/');
  }

  let emailBody = `<body>
    <div>
    <p><span style="font-size:11.0pt;">Hola ${contactFirstName},
    <br><br>Muchas gracias por tu tiempo en la sesión de ayer.
    <br><br>Te adjunto el documento que revisamos durante la sesión. Adicionalmente, describo, a alto nivel, mi entendimiento de tus prioridades clave:
    <br><br>`;

    if (initiatives.length > 0) {
      initiatives.forEach((initiative: any) => {
        emailBody += `<p style="margin:0;"><strong>${initiative.title}</strong><ul></p>`;
        
        // Añadir activity_1 si existe
        if (initiative.activity_1) {
          emailBody += `<li><p style="margin:0;">${initiative.activity_1}</p></li>`;
        }
        
        // Añadir activity_2 si existe
        if (initiative.activity_2) {
          emailBody += `<li><p style="margin:0;">${initiative.activity_2}</p></li>`;
        }
        
        // Añadir activity_3 si existe
        if (initiative.activity_3) {
          emailBody += `<li><p style="margin:0;">${initiative.activity_3}</p></li>`;
        }
        
        emailBody += `</ul><br>`;
      });
    }
    emailBody += `<br>`;
    if (nextSteps.length > 0) {
      emailBody += `Como siguientes pasos, hemos acordado:`;
      emailBody += `<ul>`;
      nextSteps.forEach((step: any) => {
        emailBody += `<li><p style="margin:0;"><strong>${step.owner}</strong>: ${step.activity}</p></li>`;
      });
      emailBody += `</ul></div>`;
    }

    emailBody = emailBody + signature +`</body>`;

  const subject = `Follow-up sesión con ${contactFirstName} - Gartner`;

  const response = await fetch('http://localhost:3002/api/draft-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: contactEmail,
      subject: subject,
      body: emailBody,
      attachments: [],
      contactEmail: contactEmail
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Error al crear borrador');
  }
};