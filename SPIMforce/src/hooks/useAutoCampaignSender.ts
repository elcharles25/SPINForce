import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/db-adapter';

interface Campaign {
  id: string;
  contact_id: string;
  template_id: string | null;
  start_campaign: boolean;
  emails_sent: number;
  has_replied: boolean;
  email_incorrect?: boolean;
  email_1_date: string | null;
  email_2_date: string | null;
  email_3_date: string | null;
  email_4_date: string | null;
  email_5_date: string | null;
  contacts: {
    first_name: string;
    last_name: string;
    email: string;
    organization: string;
  };
}

const LAST_RUN_KEY = 'autoCampaignLastRun';
const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Hook que intenta enviar campañas en segundo plano.
 * - Se ejecuta a intervalos regulares (ej. cada 5 minutos).
 * - Respeta un throttle de 1 hora entre ejecuciones "reales".
 * - Evita solapamientos en la misma pestaña y entre pestañas.
 *
 * @param intervalMs Cada cuánto intentar ejecutar (no garantiza ejecución, respeta throttle). Default: 5min.
 */
export function useAutoCampaignSender(intervalMs: number = 5 * 60 * 1000) {
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);
  const runningRef = useRef(false); // barrera adicional de re-entrada

const sendEmail = async (campaign: Campaign, emailNumber: number) => {
  try {
    if (campaign.emails_sent >= emailNumber) {
      console.log(`Email ${emailNumber} ya fue enviado para campaña ${campaign.id}`);
      return;
    }

    const amSetting = await db.getSetting("account_manager");
    const accountManagerName = amSetting?.value?.name || '';

    const signatureSetting = await db.getSetting("email_signature");
    let signature = '';
    if (signatureSetting?.value) {
      const value = signatureSetting.value as any;
      signature = (value?.signature || "").trim();
      if (signature.startsWith('"') && signature.endsWith('"')) {
        signature = signature.slice(1, -1);
      }
      signature = signature.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\\//g, '/');
    }

    const template = await db.getTemplate(campaign.template_id);
    if (!template) {
      console.error('Template no encontrado. ID:', campaign.template_id);
      throw new Error('Template not found');
    }

    const currentYear = new Date().getFullYear().toString();
    const nextYear = (new Date().getFullYear() + 1).toString();

    // ⭐ SUBJECT: Agregar TODAS las variables
    let subject = template[`email_${emailNumber}_subject`];
    subject = subject.replace(/{{Nombre}}/g, campaign.contacts.first_name || '');
    subject = subject.replace(/{{nombre}}/g, campaign.contacts.first_name || '');
    subject = subject.replace(/{{ano}}/g, currentYear);
    subject = subject.replace(/{{año}}/g, currentYear);
    subject = subject.replace(/{{añoSiguiente}}/g, nextYear);
    subject = subject.replace(/{{anoSiguiente}}/g, nextYear);
    subject = subject.replace(/{{anosiguiente}}/g, nextYear);
    subject = subject.replace(/{{añosiguiente}}/g, nextYear);
    subject = subject.replace(/{{compania}}/g, campaign.contacts.organization || '');

    // ⭐ BODY: Agregar TODAS las variables
    let body = template[`email_${emailNumber}_html`];
    body = body.replace(/{{Nombre}}/g, campaign.contacts.first_name || '');
    body = body.replace(/{{nombre}}/g, campaign.contacts.first_name || '');
    body = body.replace(/{{nombreAE}}/g, accountManagerName);
    body = body.replace(/{{compania}}/g, campaign.contacts.organization || '');
    body = body.replace(/{{ano}}/g, currentYear);
    body = body.replace(/{{año}}/g, currentYear);
    body = body.replace(/{{añoSiguiente}}/g, nextYear);
    body = body.replace(/{{anoSiguiente}}/g, nextYear);
    body = body.replace(/{{anosiguiente}}/g, nextYear);
    body = body.replace(/{{añosiguiente}}/g, nextYear);

    if (signature) {
      body = body + signature;
    }

    // ⭐ BUSCAR EMAIL ANTERIOR (después de procesar subject)
    console.log('🔍 Buscando email anterior con subject:', subject);
    
    let replyToEmail = null;
    try {
      const previousEmailResponse = await fetch('http://localhost:3002/api/outlook/find-last-sent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactEmail: campaign.contacts.email,
          subject: subject,
          daysBack: 60
        })
      });

      const previousEmailData = await previousEmailResponse.json();
      replyToEmail = previousEmailData.emailInfo || null;

      if (replyToEmail) {
        console.log('✅ Email anterior encontrado, se hará REPLY');
        console.log('   EntryID:', replyToEmail.EntryID);
      } else {
        console.log('ℹ️ No se encontró email anterior, se creará email NUEVO');
      }
    } catch (searchError) {
      console.warn('⚠️ Error buscando email anterior:', searchError);
      // Continuar sin reply
    }

    const attachmentsFromTemplate = template[`email_${emailNumber}_attachments`] || [];
    const processedAttachments: { filename: string; content: string }[] = [];

for (const attachment of attachmentsFromTemplate) {
  try {
    if (attachment.url) {
      console.log(`📥 Procesando adjunto:`, {
        name: attachment.name,
        url: attachment.url,
        filename: attachment.filename
      });
      
      let fullUrl = attachment.url;
      
      // ⭐ Encodear la URL completa correctamente
      // Separar la base de la URL del nombre del archivo
      const urlParts = fullUrl.split('/attachments/');
      if (urlParts.length === 2) {
        const baseUrl = urlParts[0] + '/attachments/';
        const filename = urlParts[1];
        // Encodear solo el nombre del archivo
        fullUrl = baseUrl + encodeURIComponent(filename);
      }
      
      console.log(`   🌐 URL original: ${attachment.url}`);
      console.log(`   🌐 URL encoded: ${fullUrl}`);
      
      const response = await fetch(fullUrl);
      
      console.log(`   📡 Response status: ${response.status}`);
      console.log(`   📡 Response headers:`, Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        console.error(`   ❌ Error HTTP ${response.status}: ${response.statusText}`);
        console.error(`   ❌ URL que falló: ${fullUrl}`);
        
        // ⭐ FALLBACK: Intentar sin encoding
        console.log(`   🔄 Intentando sin encoding...`);
        const response2 = await fetch(attachment.url);
        
        if (!response2.ok) {
          throw new Error(`Error descargando archivo: ${response.status}`);
        }
        
        const blob = await response2.blob();
        console.log(`   ✅ Descargado con fallback: ${blob.size} bytes`);
        
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.onerror = reject;
        });

        processedAttachments.push({ 
          filename: attachment.name, 
          content: base64 
        });
        
        console.log(`✅ Adjunto procesado (fallback): ${attachment.name}`);
        continue;
      }
      
      const blob = await response.blob();
      console.log(`   ✅ Archivo descargado: ${blob.size} bytes`);
      
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
      });

      processedAttachments.push({ 
        filename: attachment.name, 
        content: base64 
      });
      
      console.log(`✅ Adjunto procesado: ${attachment.name}`);
    }
  } catch (error) {
    console.error(`❌ Error procesando adjunto ${attachment.name}:`, error);
    // Continuar sin este adjunto
  }
}

    // ⭐ AGREGAR replyToEmail al body
    await fetch('http://localhost:3002/api/draft-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: campaign.contacts.email,
        contactEmail: campaign.contacts.email,
        subject,
        body,
        attachments: processedAttachments,
        replyToEmail: replyToEmail  // ⭐ AGREGAR ESTO
      }),
    });

    await db.updateCampaign(campaign.id, { emails_sent: emailNumber });
    console.log(`✅ Email ${emailNumber} enviado para ${campaign.contacts.first_name} ${campaign.contacts.last_name}`);
  } catch (error) {
    console.error('Error enviando email:', error);
    throw error;
  }
};

  const autoSendDailyEmails = async () => {
    // Evita solapamientos en esta pestaña
    if (isSending || runningRef.current) {
      console.log('Ya hay un envío en curso, saltando...');
      return;
    }

    // Throttle por hora entre pestañas
    const now = Date.now();
    const lastRunRaw = localStorage.getItem(LAST_RUN_KEY);
    const lastRun = lastRunRaw ? Number(lastRunRaw) : 0;
    if (lastRun && now - lastRun < ONE_HOUR_MS) {
      const mins = Math.ceil((ONE_HOUR_MS - (now - lastRun)) / 60000);
      console.log(`Throttle activo. Próximo intento en ~${mins} min.`);
      return;
    }

    // Bloqueo optimista entre pestañas (marca inicio)
    localStorage.setItem(LAST_RUN_KEY, String(now));

    runningRef.current = true;
    setIsSending(true);

    try {
      console.log('Verificando emails para enviar (interval)...');

      const campaigns: Campaign[] = await db.getCampaigns();
      const today = new Date();
      const localDate = today.toLocaleDateString('en-CA'); // YYYY-MM-DD
      let emailsSent = 0;

      for (const campaign of campaigns) {
        if (!campaign.start_campaign) continue;

        for (let i = 1; i <= 5; i++) {
          const dateField = `email_${i}_date` as keyof Campaign;
          const emailDate = campaign[dateField] as string | null;
          const emailDateOnly = emailDate ? String(emailDate).split('T')[0] : null;

          if (emailDateOnly && emailDateOnly <= localDate && campaign.emails_sent < i) {
            console.log(`Auto-enviando email ${i} para campaña ${campaign.id}`);
            await sendEmail(campaign, i);
            emailsSent++;

            if (emailDateOnly < localDate) {
              const updatedDates: Record<string, string> = {};
              updatedDates[`email_${i}_date`] = localDate;

              const baseDate = new Date(localDate);
              baseDate.setHours(0, 0, 0, 0);

              for (let j = i + 1; j <= 5; j++) {
                baseDate.setDate(baseDate.getDate() + 3);
                const year = baseDate.getFullYear();
                const month = String(baseDate.getMonth() + 1).padStart(2, '0');
                const day = String(baseDate.getDate()).padStart(2, '0');
                updatedDates[`email_${j}_date`] = `${year}-${month}-${day}`;
              }

              console.log('Fechas actualizadas:', updatedDates);
              await db.updateCampaign(campaign.id, updatedDates);
            }

            // Solo un envío por campaña en cada ciclo
            break;
          }
        }
      }

      if (emailsSent > 0) {
        window.dispatchEvent(new CustomEvent('campaignsUpdated'));
        console.log(`✅ ${emailsSent} email(s) enviado(s), evento disparado`);
      } else {
        console.log('No hay emails de campañas para enviar en este ciclo');
      }

      // Ajusta sello de tiempo al finalizar (por si el proceso tardó)
      localStorage.setItem(LAST_RUN_KEY, String(Date.now()));
    } catch (e) {
      console.log('Auto send completed with error:', e);
      // En error, dejamos el LAST_RUN del inicio para evitar que varias pestañas re-intenten en bucle;
      // Si prefieres reintentar pronto tras error, elimina el LAST_RUN aquí:
      // localStorage.removeItem(LAST_RUN_KEY);
    } finally {
      runningRef.current = false;
      setIsSending(false);
    }
  };

  useEffect(() => {
    // Primer intento al montar
    autoSendDailyEmails();

    // Intervalo en segundo plano
    const id = setInterval(() => {
      // Opcional: solo ejecutar si la pestaña está visible, para ahorrar recursos
      if (typeof document !== 'undefined' && typeof document.visibilityState !== 'undefined') {
        if (document.visibilityState !== 'visible') {
          // Aun así, el throttle entre pestañas protege de duplicados; puedes comentar esta línea si quieres que corra incluso en background.
          // console.log('Pestaña no visible, saltando ciclo de intervalo.');
          // return;
        }
      }
      autoSendDailyEmails();
    }, intervalMs);

    const handleForceSend = () => {
      console.log('🚀 Envío forzado solicitado desde CampaignDetailPage');
      autoSendDailyEmails();
    };

    window.addEventListener('forceCampaignSend', handleForceSend);

    return () => clearInterval(id);
  }, [intervalMs]);

  // Sincronización opcional entre pestañas (escucha cambios del sello)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LAST_RUN_KEY) {
        // Aquí podrías cancelar timers o forzar estados si lo ves necesario.
        // En este diseño no es imprescindible hacer nada.
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return { isSending };
}