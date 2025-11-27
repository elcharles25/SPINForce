  import express from 'express';
  import cors from 'cors';
  import dotenv from 'dotenv';
  import { exec } from 'child_process';
  import { promisify } from 'util';
  import path from 'path';
  import { fileURLToPath } from 'url';
  import { v4 as uuidv4 } from 'uuid';
  import axios from 'axios';
  import fsSync from 'fs';
  import { promises as fs } from 'fs';
  import fetch from 'node-fetch';


  globalThis.fetch = fetch;

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // IMPORTANTE: Cargar .env ANTES de hacer nada
  const envPath = path.join(__dirname, '.env');
  dotenv.config({ path: envPath });

  console.log('=== DEBUG ===');
  console.log('Buscando .env en:', envPath);
  console.log('¿Existe .env?', fsSync.existsSync(envPath));

  const app = express();
  const PORT = 3002;
  const execPromise = promisify(exec);

    // ⭐ FLAGS GLOBALES para control de inicialización de caché
  let cacheInitializationInProgress = false;
  let cacheInitializationPromise = null;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb' }));

  const createOutlookDraft = async (to, subject, body, attachments = [], replyToEmail = null) => {
    console.log('🔍 DEBUG replyToEmail:');
    console.log('   - Existe?:', !!replyToEmail);
    console.log('   - Tipo:', typeof replyToEmail);
    console.log('   - Contenido:', JSON.stringify(replyToEmail, null, 2));
    
    const tempFiles = {
      scriptPath: null,
      bodyFilePath: null,
      subjectFilePath: null,
      attachmentPaths: []
    };

    try {
      if (replyToEmail) {
        console.log('   - Tiene EntryID?:', !!replyToEmail.EntryID);
        console.log('   - EntryID value:', replyToEmail.EntryID);
      }
      const fs_promises = await import('fs').then(m => m.promises);
      const tempDir = path.join(__dirname, 'temp');
      
      await fs_promises.mkdir(tempDir, { recursive: true }).catch(() => {});

      console.log(`📎 Procesando ${attachments.length} adjuntos...`);
      console.log(`📎 Attachments recibidos:`, JSON.stringify(attachments.map(a => ({
        hasUrl: !!a.url,
        hasContent: !!a.content,
        hasFilename: !!a.filename,
        name: a.name || a.filename,
        contentLength: a.content ? a.content.length : 0
      })), null, 2));

      for (const attachment of attachments) {
        try {
          let buffer;
          let filename;

          if (attachment.url) {
            filename = attachment.name || 'attachment';
            console.log(`📥 Descargando desde URL: ${filename}`);
            
            const response = await axios.get(attachment.url, { responseType: 'arraybuffer' });
            buffer = Buffer.from(response.data);
            console.log(`✅ URL descargada: ${filename}, tamaño: ${buffer.length}`);
          } 
          else if (attachment.content) {
            filename = attachment.filename || attachment.name || 'attachment';
            console.log(`📥 Procesando base64: ${filename}`);
            console.log(`📥 Tamaño content: ${attachment.content.length} caracteres`);
            
            buffer = Buffer.from(attachment.content, 'base64');
            console.log(`✅ Base64 procesado: ${filename}, tamaño buffer: ${buffer.length} bytes`);
          }
          else {
            console.warn(`⚠️ Adjunto sin URL ni content:`, JSON.stringify(attachment));
            continue;
          }

          const tempFilePath = path.join(tempDir, filename);
          await fs.writeFile(tempFilePath, buffer);
          tempFiles.attachmentPaths.push(tempFilePath);
          console.log(`💾 Adjunto guardado en: ${tempFilePath}`);
        } catch (error) {
          console.error(`❌ Error procesando adjunto:`, error.message);
          console.error(`❌ Stack:`, error.stack);
        }
      }

      console.log(`📎 Total de adjuntos guardados: ${tempFiles.attachmentPaths.length}`);
      console.log(`📎 Rutas de archivos:`, tempFiles.attachmentPaths);

      tempFiles.bodyFilePath = path.join(tempDir, `body_${uuidv4()}.html`);
      await fs.writeFile(tempFiles.bodyFilePath, body, 'utf8');
      
      tempFiles.subjectFilePath = path.join(tempDir, `subject_${uuidv4()}.txt`);
      await fs.writeFile(tempFiles.subjectFilePath, subject, 'utf8');
      
      const escapedTo = to.replace(/'/g, "''");
      const escapedBodyPath = tempFiles.bodyFilePath.replace(/\\/g, '\\\\');
      const escapedSubjectPath = tempFiles.subjectFilePath.replace(/\\/g, '\\\\');

      let attachmentLines = '';
      if (tempFiles.attachmentPaths.length > 0) {
        attachmentLines = tempFiles.attachmentPaths
          .map(filePath => {
            const escaped = filePath.replace(/\\/g, '\\\\');
            console.log(`📎 Añadiendo a PowerShell: ${escaped}`);
            return `$draft.Attachments.Add('${escaped}') | Out-Null`;
          })
          .join('\n');
      }

      console.log(`📜 Script PowerShell con adjuntos:\n${attachmentLines}`);

      let replySetup = '';
      console.log('🔍 Evaluando condición para reply:');
      console.log('   replyToEmail existe:', !!replyToEmail);
      console.log('   replyToEmail.EntryID existe:', replyToEmail ? !!replyToEmail.EntryID : 'N/A');

      if (replyToEmail && replyToEmail.EntryID) {
        const escapedEntryID = replyToEmail.EntryID.replace(/\\/g, '\\\\').replace(/'/g, "''");
        
        console.log('📧 Configurando respuesta sobre email anterior:');
        console.log('   EntryID:', escapedEntryID.substring(0, 50) + '...');
        
        replySetup = `
  Write-Host "=== INTENTANDO CREAR RESPUESTA ==="
  Write-Host "EntryID del email anterior: ${escapedEntryID.substring(0, 30)}..."

  try {
    $namespace = $outlook.GetNamespace("MAPI")
    $sentItems = $namespace.GetDefaultFolder(5)
    
    Write-Host "Buscando email original en Enviados..."
    
    $originalEmail = $null
    try {
      $originalEmail = $namespace.GetItemFromID('${escapedEntryID}')
      Write-Host "Email encontrado por GetItemFromID"
    } catch {
      Write-Host "GetItemFromID falló: $($_.Exception.Message)"
    }
    
    if ($originalEmail) {
      Write-Host "EXITO: Email original encontrado"
      Write-Host "Asunto original: $($originalEmail.Subject)"
      Write-Host "Creando Reply..."
      
      $draft = $originalEmail.Reply()
      $draft.To = '${escapedTo}'
      
      Write-Host "Reply creado correctamente"
    } else {
      Write-Host "ADVERTENCIA: Email original no encontrado, creando email nuevo"
      $draft = $outlook.CreateItem(0)
      $draft.To = '${escapedTo}'
      $draft.Subject = [System.IO.File]::ReadAllText('${escapedSubjectPath}', [System.Text.Encoding]::UTF8)
    }
  } catch {
    Write-Host "ERROR en proceso de reply: $($_.Exception.Message)"
    Write-Host "Creando email nuevo como fallback"
    $draft = $outlook.CreateItem(0)
    $draft.To = '${escapedTo}'
    $draft.Subject = [System.IO.File]::ReadAllText('${escapedSubjectPath}', [System.Text.Encoding]::UTF8)
  }`;
      } else {
        console.log('📧 Creando email nuevo (sin email anterior)');
        replySetup = `Write-Host "Creando email nuevo"
  $draft = $outlook.CreateItem(0)
  $draft.To = '${escapedTo}'
  $draft.Subject = [System.IO.File]::ReadAllText('${escapedSubjectPath}', [System.Text.Encoding]::UTF8)
  `;
      }

      const psScript = `$ErrorActionPreference = 'Stop'
  Add-Type -AssemblyName Microsoft.Office.Interop.Outlook

  try {
    Write-Host "Iniciando creación de borrador..."
    
    try {
      $outlook = [System.Runtime.InteropServices.Marshal]::GetActiveObject("Outlook.Application")
      Write-Host "Outlook conectado"
    } catch {
      $outlook = New-Object -ComObject Outlook.Application
      Write-Host "Outlook iniciado"
    }

    ${replySetup}

    Write-Host "Configurando cuerpo del email..."

    $newBody = [System.IO.File]::ReadAllText('${escapedBodyPath}', [System.Text.Encoding]::UTF8)

    if ($draft.HTMLBody -and $draft.HTMLBody.Length -gt 100) {
      Write-Host "Reply detectado - Concatenando nuevo contenido con historial"
      $draft.HTMLBody = $newBody + $draft.HTMLBody
      Write-Host "Historial concatenado correctamente"
    } else {
      Write-Host "Email nuevo - Estableciendo contenido"
      $draft.HTMLBody = $newBody
    }
    
    ${attachmentLines}
    
    Write-Host "Mostrando email..."
    $draft.Display()
    
    Write-Host "Success"
    
  } catch {
    Write-Host "ERROR CRITICO: $($_.Exception.Message)"
    Write-Host "StackTrace: $($_.Exception.StackTrace)"
    exit 1
  }`;

      tempFiles.scriptPath = path.join(__dirname, `temp_${uuidv4()}.ps1`);
      await fs.writeFile(tempFiles.scriptPath, psScript, 'utf8');

      console.log('🔧 Ejecutando PowerShell...');

      const { stdout, stderr } = await execPromise(
        `powershell -NoProfile -ExecutionPolicy Bypass -File "${tempFiles.scriptPath}"`,
        { encoding: 'utf8', timeout: 1500000 }
      );

      console.log(`✅ PowerShell stdout: ${stdout}`);
      if (stderr) console.log(`⚠️ PowerShell stderr: ${stderr}`);

      if (stdout.includes('Success')) {
        console.log(`✅ Borrador creado para: ${to}`);
        return { success: true };
      } else {
        throw new Error(`PowerShell error: ${stdout}`);
      }

    } catch (error) {
      console.error(`❌ Error para ${to}:`, error.message);
      console.error(`❌ Stack completo:`, error.stack);
      throw error;
    } finally {
      // 🧹 LIMPIEZA GARANTIZADA - Se ejecuta SIEMPRE (éxito o error)
      console.log('🧹 Limpiando archivos temporales...');
      
      if (tempFiles.scriptPath) {
        await fs.unlink(tempFiles.scriptPath).catch(() => {});
      }
      if (tempFiles.bodyFilePath) {
        await fs.unlink(tempFiles.bodyFilePath).catch(() => {});
      }
      if (tempFiles.subjectFilePath) {
        await fs.unlink(tempFiles.subjectFilePath).catch(() => {});
      }
      for (const filePath of tempFiles.attachmentPaths) {
        await fs.unlink(filePath).catch(() => {});
      }
      
      console.log('✅ Archivos temporales eliminados');
    }
  };

/**
 * Lee los emails del Inbox de Outlook de los últimos X días
 */
const readOutlookInbox = async (daysBack) => {
  try {
    const tempDir = path.join(__dirname, 'temp');
    await fs.mkdir(tempDir, { recursive: true });

    const outputPath = path.join(tempDir, `inbox_${uuidv4()}.json`);
    const escapedOutputPath = outputPath.replace(/\\/g, '\\\\');

    const psScript = `$ErrorActionPreference = 'Stop'

try {
  Write-Host "Conectando a Outlook..."
  
  try {
    $outlook = [System.Runtime.InteropServices.Marshal]::GetActiveObject("Outlook.Application")
    Write-Host "Conectado a Outlook existente"
  } catch {
    Add-Type -AssemblyName Microsoft.Office.Interop.Outlook
    $outlook = New-Object -ComObject Outlook.Application
    Write-Host "Nueva instancia creada"
  }

  $namespace = $outlook.GetNamespace("MAPI")
  $namespace.Logon($null, $null, $false, $false)
  
  $inbox = $namespace.GetDefaultFolder(6)
  Write-Host "Inbox: $($inbox.Name) - Total items: $($inbox.Items.Count)"

  $dateLimit = (Get-Date).AddDays(-${daysBack})
  Write-Host "Filtrando desde: $($dateLimit.ToString('yyyy-MM-dd HH:mm:ss'))"

  $filter = "[ReceivedTime] >= '$($dateLimit.ToString('g'))'"
  $filteredItems = $inbox.Items.Restrict($filter)
  $filteredItems.Sort("[ReceivedTime]", $true)
  
  Write-Host "Items filtrados: $($filteredItems.Count)"

  $results = @()
  $processed = 0
  $maxToProcess = 7000
  
  foreach ($item in $filteredItems) {
    try {
      if ($item.Class -ne 43 -and $item.Class -ne 46) { 
        continue 
      }
      
      $processed++
      if ($processed -gt $maxToProcess) { break }
      
      if ($item.Class -eq 46) {
        $senderEmail = "system-ndr@outlook.com"
        $senderName = "Mail Delivery System"
        
        $bodyPreview = ""
        try {
          if ($item.Body) {
            $bodyLength = [Math]::Min(1000, $item.Body.Length)
            $bodyPreview = $item.Body.Substring(0, $bodyLength)
          }
        } catch {
          $bodyPreview = ""
        }
        
        $receivedTimeStr = ""
        try {
          if ($item.ReceivedTime) {
            $receivedTimeStr = $item.ReceivedTime.ToString("yyyy-MM-dd HH:mm:ss")
          } else {
            $receivedTimeStr = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
          }
        } catch {
          $receivedTimeStr = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        }
        
        $results += [PSCustomObject]@{
          Subject = if ($item.Subject) { $item.Subject } else { "" }
          SenderName = $senderName
          SenderEmail = $senderEmail
          SenderEmailType = "ReportItem"
          Recipients = ""
          ReceivedTime = $receivedTimeStr
          Body = $bodyPreview
          ConversationTopic = if ($item.ConversationTopic) { $item.ConversationTopic } else { "" }
          ItemType = "ReportItem"
          ItemClass = 46
        }
        
      } else {
        $senderEmail = ""
        $senderName = ""
        
        try {
          $senderName = $item.SenderName
          
          if ($item.SenderEmailType -eq "EX") {
            try {
              # Intentar obtener el SMTP del remitente
              $sender = $item.Sender
              
              if ($sender -and $sender.AddressEntry) {
                # Método 1: GetExchangeUser
                try {
                  $exchangeUser = $sender.AddressEntry.GetExchangeUser()
                  if ($exchangeUser -and $exchangeUser.PrimarySmtpAddress) {
                    $senderEmail = $exchangeUser.PrimarySmtpAddress
                  }
                } catch {
                  # Ignorar error
                }
                
                # Método 2: PropertyAccessor (si método 1 falla)
                if ([string]::IsNullOrEmpty($senderEmail)) {
                  try {
                    $PA_SMTP = "http://schemas.microsoft.com/mapi/proptag/0x39FE001E"
                    $senderEmail = $sender.AddressEntry.PropertyAccessor.GetProperty($PA_SMTP)
                  } catch {
                    # Ignorar error
                  }
                }
                
                # Método 3: GetExchangeDistributionList
                if ([string]::IsNullOrEmpty($senderEmail)) {
                  try {
                    $exchangeDL = $sender.AddressEntry.GetExchangeDistributionList()
                    if ($exchangeDL -and $exchangeDL.PrimarySmtpAddress) {
                      $senderEmail = $exchangeDL.PrimarySmtpAddress
                    }
                  } catch {
                    # Ignorar error
                  }
                }
              }
              
              # Fallback: usar SenderEmailAddress (aunque sea formato EX)
              if ([string]::IsNullOrEmpty($senderEmail)) {
                $senderEmail = $item.SenderEmailAddress
              }
            } catch {
              $senderEmail = $item.SenderEmailAddress
            }
          } else {
            $senderEmail = $item.SenderEmailAddress
          }
        } catch {
          $senderEmail = "unknown@domain.com"
          $senderName = "Unknown"
        }
        
      $recipients = @()
      try {
        foreach ($recipient in $item.Recipients) {
          try {
            $recipientEmail = ""
            $recipientName = ""
            
            # Intentar obtener el nombre del destinatario
            try {
              $recipientName = $recipient.Name
            } catch {
              $recipientName = ""
            }
            
            if ($recipient.AddressEntry.Type -eq "EX") {
              # Método 1: GetExchangeUser
              try {
                $exchangeUser = $recipient.AddressEntry.GetExchangeUser()
                if ($exchangeUser -and $exchangeUser.PrimarySmtpAddress) {
                  $recipientEmail = $exchangeUser.PrimarySmtpAddress
                }
              } catch {
                # Ignorar error
              }
              
              # Método 2: PropertyAccessor
              if ([string]::IsNullOrEmpty($recipientEmail)) {
                try {
                  $PA_SMTP = "http://schemas.microsoft.com/mapi/proptag/0x39FE001E"
                  $recipientEmail = $recipient.AddressEntry.PropertyAccessor.GetProperty($PA_SMTP)
                } catch {
                  # Ignorar error
                }
              }
              
              # Método 3: GetExchangeDistributionList
              if ([string]::IsNullOrEmpty($recipientEmail)) {
                try {
                  $exchangeDL = $recipient.AddressEntry.GetExchangeDistributionList()
                  if ($exchangeDL -and $exchangeDL.PrimarySmtpAddress) {
                    $recipientEmail = $exchangeDL.PrimarySmtpAddress
                  }
                } catch {
                  # Ignorar error
                }
              }
              
              # Método 4: Si no se pudo obtener email, usar el nombre con prefijo especial
              if ([string]::IsNullOrEmpty($recipientEmail) -and -not [string]::IsNullOrEmpty($recipientName)) {
                # Usar formato especial para indicar que es un nombre, no un email
                $recipientEmail = "NAME:$recipientName"
              }
            } else {
              $recipientEmail = $recipient.Address
            }
            
            if (-not [string]::IsNullOrEmpty($recipientEmail)) {
              $recipients += $recipientEmail
            }
          } catch {
            # Ignorar error individual de destinatario
          }
        }
      } catch {
        # Si falla completamente la lectura de recipients, continuar sin ellos
      }
        
        $bodyPreview = ""
        try {
          if ($item.Body) {
            $bodyLength = [Math]::Min(8000, $item.Body.Length)
            $bodyPreview = $item.Body.Substring(0, $bodyLength)
          }
        } catch {
          $bodyPreview = ""
        }
        
        $results += [PSCustomObject]@{
          Subject = $item.Subject
          SenderName = $senderName
          SenderEmail = $senderEmail
          SenderEmailType = $item.SenderEmailType
          Recipients = ($recipients -join ";")
          ReceivedTime = $item.ReceivedTime.ToString("yyyy-MM-dd HH:mm:ss")
          Body = $bodyPreview
          ConversationTopic = $item.ConversationTopic
          ItemType = "MailItem"
          ItemClass = 43
        }
      }
      
    } catch {
      Write-Host "Error procesando item individual: $($_.Exception.Message)"
      # Continuar con el siguiente item
    }
  }

  Write-Host "Total procesados: $($results.Count)"
  
  $mailItems = ($results | Where-Object { $_.ItemClass -eq 43 }).Count
  $reportItems = ($results | Where-Object { $_.ItemClass -eq 46 }).Count
  Write-Host "  - MailItems: $mailItems"
  Write-Host "  - ReportItems (NDR): $reportItems"

  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  if ($results.Count -eq 0) {
    [System.IO.File]::WriteAllText('${escapedOutputPath}', '[]', $utf8NoBom)
  } else {
    $json = $results | ConvertTo-Json -Depth 3 -Compress
    [System.IO.File]::WriteAllText('${escapedOutputPath}', $json, $utf8NoBom)
  }

  Write-Host "Success"
  
} catch {
  Write-Host "ERROR CRITICO: $($_.Exception.Message)"
  Write-Host "StackTrace: $($_.Exception.StackTrace)"
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText('${escapedOutputPath}', '[]', $utf8NoBom)
  exit 1
}`;

    const scriptPath = path.join(tempDir, `read_inbox_${uuidv4()}.ps1`);
    await fs.writeFile(scriptPath, psScript, 'utf8');

    console.log('🔍 Leyendo Inbox de Outlook...');
    console.log(`📅 Últimos ${daysBack} días`);

    try {
      const { stdout, stderr } = await execPromise(
        `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`,
        { encoding: 'utf8', timeout: 1500000 }
      );

      console.log('📤 PowerShell stdout:');
      console.log(stdout);
      
      if (stderr) {
        console.log('⚠️ PowerShell stderr:');
        console.log(stderr);
      }
    } catch (execError) {
      console.error('❌ Error ejecutando PowerShell:');
      console.error('stdout:', execError.stdout);
      console.error('stderr:', execError.stderr);
      
      // Intentar leer el archivo de salida de todos modos
      if (fsSync.existsSync(outputPath)) {
        console.log('⚠️ Archivo de salida existe, intentando leer...');
      } else {
        throw execError;
      }
    }

    if (!fsSync.existsSync(outputPath)) {
      console.error('❌ Archivo no generado');
      await fs.unlink(scriptPath).catch(() => {});
      return [];
    }

    const buffer = await fs.readFile(outputPath);
    
    let data;
    if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
      console.log('🧹 BOM detectado y eliminado');
      data = buffer.slice(3).toString('utf8');
    } else {
      data = buffer.toString('utf8');
    }

    console.log('📄 Tamaño del contenido:', data.length, 'bytes');

    let emails = [];
    
    try {
      emails = JSON.parse(data);
      console.log(`✅ ${emails.length} emails parseados correctamente`);
      
      if (emails.length > 0) {
        const mailItems = emails.filter(e => e.ItemType === 'MailItem').length;
        const reportItems = emails.filter(e => e.ItemType === 'ReportItem').length;
        
        console.log(`📊 Resumen:`);
        console.log(`  - MailItems: ${mailItems}`);
        console.log(`  - ReportItems (NDR): ${reportItems}`);
        
        if (reportItems > 0) {
          console.log(`⚠️ Se detectaron ${reportItems} email(s) de error (NDR)`);
        }
      }
    } catch (parseError) {
      console.error('❌ Error parseando JSON:', parseError.message);
      console.error('📄 Primeros 100 caracteres:', data.substring(0, 100));
      emails = [];
    }

    await fs.unlink(scriptPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});

    return Array.isArray(emails) ? emails : [];

  } catch (err) {
    console.error('❌ Error leyendo inbox:', err.message);
    if (err.stdout) console.error('stdout:', err.stdout);
    if (err.stderr) console.error('stderr:', err.stderr);
    return [];
  }
};

/**
 * Busca el último email enviado a un contacto con un subject específico
 * @param {string} contactEmail - Email del contacto
 * @param {string} subject - Asunto del email (sin RE:, FW:, etc.)
 * @param {number} daysBack - Días hacia atrás para buscar
 * @returns {Object|null} - Información del email encontrado o null
 */
const findLastSentEmail = async (contactEmail, subject, daysBack = 60) => {
  try {
    const tempDir = path.join(__dirname, 'temp');
    await fs.mkdir(tempDir, { recursive: true });

    const outputPath = path.join(tempDir, `sent_${uuidv4()}.json`);
    const escapedOutputPath = outputPath.replace(/\\/g, '\\\\');
    const normalizedEmail = contactEmail.toLowerCase().trim();
    
    // Normalizar subject: quitar TODO menos letras, números y espacios
    const normalizedSubject = subject
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')  // Quitar TODO excepto letras, números y espacios
      .replace(/\s+/g, ' ')  // Normalizar espacios múltiples
      .trim();

    console.log(`🔍 Buscando email anterior:`);
    console.log(`   To: ${normalizedEmail}`);
    console.log(`   Subject normalizado: "${normalizedSubject}"`);

    const escapedEmail = normalizedEmail.replace(/'/g, "''");
    const escapedSubject = normalizedSubject.replace(/'/g, "''");

    const psScript = `$ErrorActionPreference = 'Stop'

# Función para normalizar texto - ELIMINANDO TODO EXCEPTO LETRAS Y NÚMEROS
function Normalize-Text {
    param([string]$text)
    
    if (-not $text) { return "" }
    
    $text = $text.ToLower()
    
    # Eliminar TODO excepto letras (a-z), números (0-9) y espacios
    $text = $text -replace '[^a-z0-9\\s]', ''
    
    # Normalizar espacios múltiples a uno solo
    $text = $text -replace '\\s+', ' '
    
    return $text.Trim()
}

try {
  Write-Host "Buscando email anterior"
  Write-Host "Target email: '${escapedEmail}'"
  Write-Host "Target subject: '${escapedSubject}'"
  Write-Host ""
  
  try {
    $outlook = [System.Runtime.InteropServices.Marshal]::GetActiveObject("Outlook.Application")
  } catch {
    Add-Type -AssemblyName Microsoft.Office.Interop.Outlook
    $outlook = New-Object -ComObject Outlook.Application
  }

  $namespace = $outlook.GetNamespace("MAPI")
  $sentItems = $namespace.GetDefaultFolder(5)
  $items = $sentItems.Items
  $items.Sort("[SentOn]", $true)

  $foundEmail = $null
  $checkedCount = 0
  $maxToCheck = 100
  $targetEmail = "${escapedEmail}"
  $targetSubject = "${escapedSubject}"

  foreach ($item in $items) {
    try {
      if ($item.Class -ne 43) { continue }
      $checkedCount++
      if ($checkedCount -gt $maxToCheck) { break }

      # Obtener los destinatarios reales (emails)
      $recipients = $item.Recipients
      $emailMatch = $false
      
      foreach ($recipient in $recipients) {
        $recipientEmail = ""
        
        try {
          if ($recipient.AddressEntry.Type -eq "EX") {
            $exchangeUser = $recipient.AddressEntry.GetExchangeUser()
            if ($exchangeUser -and $exchangeUser.PrimarySmtpAddress) {
              $recipientEmail = $exchangeUser.PrimarySmtpAddress.ToLower()
            }
          } else {
            $recipientEmail = $recipient.Address.ToLower()
          }
        } catch {
          try {
            $recipientEmail = $recipient.Address.ToLower()
          } catch {}
        }
        
        if ($recipientEmail -eq $targetEmail) {
          $emailMatch = $true
          break
        }
      }
      
      if ($emailMatch) {
        $originalSubject = $item.Subject
        
        # Remover prefijos RE:, FW:, FWD:
        $cleanedSubject = $originalSubject
        while ($cleanedSubject -match '^(re:|fw:|fwd:)\\s*') {
          $cleanedSubject = $cleanedSubject -replace '^(re:|fw:|fwd:)\\s*', ''
        }
        
        # Normalizar el subject (eliminar todo excepto letras, números y espacios)
        $normalizedItemSubject = Normalize-Text -text $cleanedSubject

        Write-Host "$checkedCount. MATCH EMAIL: $targetEmail"
        Write-Host "   Original subject: $originalSubject"
        Write-Host "   Normalized subject: '$normalizedItemSubject'"
        Write-Host "   Target subject: '$targetSubject'"
        Write-Host "   Subject match: $($normalizedItemSubject -eq $targetSubject)"
        Write-Host ""

        if ($normalizedItemSubject -eq $targetSubject) {
          Write-Host "🎉🎉🎉 ENCONTRADO 🎉🎉🎉"
          
          $convIndexBase64 = ""
          try {
            if ($item.ConversationIndex) {
              $convIndexBase64 = [System.Convert]::ToBase64String($item.ConversationIndex)
            }
          } catch {}

          $foundEmail = [PSCustomObject]@{
            EntryID = $item.EntryID
            ConversationID = if ($item.ConversationID) { $item.ConversationID } else { "" }
            ConversationIndex = $convIndexBase64
            Subject = $item.Subject
            SentOn = $item.SentOn.ToString("yyyy-MM-dd HH:mm:ss")
            To = $item.To
          }
          break
        }
      }
    } catch {
      Write-Host "Error procesando item: $($_.Exception.Message)"
      continue
    }
  }

  Write-Host "Total emails revisados: $checkedCount"
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  if ($foundEmail) {
    $json = $foundEmail | ConvertTo-Json -Depth 3 -Compress
    [System.IO.File]::WriteAllText('${escapedOutputPath}', $json, $utf8NoBom)
    Write-Host "Success: Email encontrado"
  } else {
    [System.IO.File]::WriteAllText('${escapedOutputPath}', 'null', $utf8NoBom)
    Write-Host "Success: No se encontró email anterior"
  }
} catch {
  Write-Host "ERROR: $($_.Exception.Message)"
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText('${escapedOutputPath}', 'null', $utf8NoBom)
  exit 1
}`;

    const scriptPath = path.join(tempDir, `find_sent_${uuidv4()}.ps1`);
    await fs.writeFile(scriptPath, psScript, 'utf8');

    console.log(`🔍 Ejecutando búsqueda...`);

    const { stdout, stderr } = await execPromise(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`,
      { encoding: 'utf8', timeout: 1500000 }
    );

    console.log('📤 PowerShell output:');
    console.log(stdout);

    if (!fsSync.existsSync(outputPath)) {
      console.error('❌ Archivo no generado');
      await fs.unlink(scriptPath).catch(() => {});
      return null;
    }

    const buffer = await fs.readFile(outputPath);
    let data;
    if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
      data = buffer.slice(3).toString('utf8');
    } else {
      data = buffer.toString('utf8');
    }

    await fs.unlink(scriptPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});

    if (data === 'null') {
      console.log('⚠️ No se encontró email anterior');
      return null;
    }

    const emailInfo = JSON.parse(data);
    console.log(`✅ Email anterior encontrado:`);
    console.log(`   Asunto: ${emailInfo.Subject}`);
    console.log(`   Fecha: ${emailInfo.SentOn}`);
    
    return emailInfo;

  } catch (err) {
    console.error('❌ Error buscando email anterior:', err.message);
    return null;
  }
};


/**
 * Helper para verificar si el contacto está en los destinatarios (más flexible)
 */
const isContactInRecipients = (recipientsString, contactEmail, contactFirstName = '', contactLastName = '') => {
  if (!recipientsString) return false;
  if (!contactEmail) return false;
  
  const recipientsLower = recipientsString.toLowerCase();
  const normalizedContactEmail = contactEmail.toLowerCase();
  
  // Método 1: Coincidencia exacta de email
  if (recipientsLower.includes(normalizedContactEmail)) {
    return true;
  }
  
  // Método 2: Buscar por username (parte antes de @)
  const contactUsername = normalizedContactEmail.split('@')[0];
  const contactDomain = normalizedContactEmail.split('@')[1];
  
  if (!contactUsername || !contactDomain) return false;
  
  // Extraer todos los emails del string de recipients
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  const foundEmails = recipientsLower.match(emailRegex) || [];
  
  for (const recipientEmail of foundEmails) {
    const recipientUsername = recipientEmail.split('@')[0];
    const recipientDomain = recipientEmail.split('@')[1];
    
    // Coincidencia exacta
    if (recipientEmail === normalizedContactEmail) {
      return true;
    }
    
    // Coincidencia por username y dominio
    if (recipientDomain === contactDomain && 
        contactUsername.length > 3 && 
        recipientUsername.includes(contactUsername)) {
      return true;
    }
    
    // Coincidencia por username similar
    if (contactUsername.length > 3 && recipientUsername.includes(contactUsername)) {
      return true;
    }
  }
  
  // Método 3: Buscar por nombre del contacto en formato "NAME:..."
  if (contactFirstName && contactFirstName.length > 2) {
    const firstNameNormalized = contactFirstName.toLowerCase().trim();
    
    // Buscar "NAME:pedro" o similar
    if (recipientsLower.includes(`name:${firstNameNormalized}`)) {
      console.log(`✅ MATCH por nombre: NAME:${firstNameNormalized}`);
      return true;
    }
  }
  
  if (contactLastName && contactLastName.length > 2) {
    const lastNameNormalized = contactLastName.toLowerCase().trim();
    
    // Buscar "NAME:higueras" o similar
    if (recipientsLower.includes(`name:${lastNameNormalized}`)) {
      console.log(`✅ MATCH por apellido: NAME:${lastNameNormalized}`);
      return true;
    }
  }
  
  // ⭐ Método 3.5: Buscar formato "NAME:apellido.nombre" o "NAME:nombre.apellido"
  if (contactFirstName && contactLastName) {
    const firstNameNormalized = contactFirstName.toLowerCase().trim();
    const lastNameNormalized = contactLastName.toLowerCase().trim();
    
    // Buscar "NAME:higueras.pedro" (apellido.nombre)
    if (recipientsLower.includes(`name:${lastNameNormalized}.${firstNameNormalized}`)) {
      console.log(`✅ MATCH: NAME:${lastNameNormalized}.${firstNameNormalized}`);
      return true;
    }
    
    // Buscar "NAME:pedro.higueras" (nombre.apellido)
    if (recipientsLower.includes(`name:${firstNameNormalized}.${lastNameNormalized}`)) {
      console.log(`✅ MATCH: NAME:${firstNameNormalized}.${lastNameNormalized}`);
      return true;
    }
    
    // Buscar "NAME:higueraspedro" (sin punto)
    if (recipientsLower.includes(`name:${lastNameNormalized}${firstNameNormalized}`)) {
      console.log(`✅ MATCH: NAME:${lastNameNormalized}${firstNameNormalized}`);
      return true;
    }
    
    // Buscar "NAME:pedrohigueras" (sin punto, invertido)
    if (recipientsLower.includes(`name:${firstNameNormalized}${lastNameNormalized}`)) {
      console.log(`✅ MATCH: NAME:${firstNameNormalized}${lastNameNormalized}`);
      return true;
    }
  }
  
  // Método 4: Buscar nombre completo con espacio en cualquier parte
  if (contactFirstName && contactLastName) {
    const fullName = `${contactFirstName} ${contactLastName}`.toLowerCase();
    if (recipientsLower.includes(fullName)) {
      return true;
    }
    
    // Invertido: apellido nombre
    const reversedName = `${contactLastName} ${contactFirstName}`.toLowerCase();
    if (recipientsLower.includes(reversedName)) {
      return true;
    }
  }
  
  // ⭐ Método 5: Buscar por username del email
  if (contactUsername.length > 3) {
    // Buscar "NAME:username_completo"
    if (recipientsLower.includes(`name:${contactUsername}`)) {
      console.log(`✅ MATCH por username completo: NAME:${contactUsername}`);
      return true;
    }
    
    // Si el username tiene punto, buscar las partes
    const usernameParts = contactUsername.split('.');
    if (usernameParts.length > 1) {
      // Buscar cada parte del username
      for (const part of usernameParts) {
        if (part.length > 2 && recipientsLower.includes(`name:${part}`)) {
          console.log(`✅ MATCH por parte del username: NAME:${part}`);
          return true;
        }
      }
      
      // ⭐ NUEVO: Buscar partes del username en orden inverso
      // Si username es "pedro.higueras", también buscar "higueras.pedro"
      const reversedUsername = [...usernameParts].reverse().join('.');
      if (recipientsLower.includes(`name:${reversedUsername}`)) {
        console.log(`✅ MATCH por username invertido: NAME:${reversedUsername}`);
        return true;
      }
    }
  }
  
  return false;
};

/**
 * Normaliza texto removiendo acentos, tildes y caracteres especiales
 */
const normalizeText = (text) => {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD') // Descomponer caracteres con acento
    .replace(/[\u0300-\u036f]/g, '') // Eliminar diacríticos
    .trim();
};

/**
 * Verifica si un email es del CSM/EP por email O por nombre
 * VERSIÓN MEJORADA con normalización de acentos y mejor manejo de nombres compuestos
 */
const isFromPerson = (email, targetEmail, targetName = null) => {
  if (!email || !email.SenderEmail) return false;
  
  const senderEmail = (email.SenderEmail || '').toLowerCase().trim();
  const senderName = normalizeText(email.SenderName || ''); // ⭐ NORMALIZAR
  
  // Si no hay targetEmail válido, no podemos verificar
  if (!targetEmail || targetEmail.length < 5) {
    console.log(`⚠️ targetEmail inválido: ${targetEmail}`);
    return false;
  }
  
  const normalizedTargetEmail = targetEmail.toLowerCase().trim();
  
  // === Método 1: Coincidencia exacta de email ===
  if (senderEmail === normalizedTargetEmail) {
    console.log(`✅ Match exacto de email: ${senderEmail}`);
    return true;
  }
  
  // === Método 2: Coincidencia por username (parte antes de @) ===
  const targetUsername = normalizedTargetEmail.split('@')[0];
  const senderUsername = senderEmail.split('@')[0];
  
  // Ejemplo: "joseluis.antonhernando" === "joseluis.antonhernando"
  if (targetUsername && senderUsername && 
      targetUsername.length > 5 && 
      targetUsername === senderUsername) {
    console.log(`✅ Match por username: ${targetUsername}`);
    return true;
  }
  
  // === Método 3: Coincidencia parcial de username (con punto) ===
  if (targetUsername && targetUsername.includes('.')) {
    const targetParts = targetUsername.split('.');
    const senderParts = senderUsername.split('.');
    
    if (senderParts.length > 1) {
      const hasMatchingParts = targetParts.some(targetPart => 
        targetPart.length > 3 && senderParts.some(senderPart => 
          senderPart === targetPart
        )
      );
      
      if (hasMatchingParts && targetParts.length === senderParts.length) {
        console.log(`✅ Match por partes del username: ${targetParts.join('.')}`);
        return true;
      }
    }
  }
  
  // === Método 4: Verificación por NOMBRE (targetName) ===
  if (targetName && targetName.length > 3) {
    const normalizedTargetName = normalizeText(targetName); // ⭐ NORMALIZAR
    
    console.log(`🔍 Comparando nombres:`);
    console.log(`   Target: "${normalizedTargetName}"`);
    console.log(`   Sender: "${senderName}"`);
    
    // ⭐ MÉTODO 4.1: Coincidencia exacta de nombre completo
    if (senderName === normalizedTargetName) {
      console.log(`✅ Match exacto de nombre completo`);
      return true;
    }
    
    // ⭐ MÉTODO 4.2: Dividir nombre en palabras y comparar
    // Ejemplo: "José Luis Antón Hernando" → ["jose", "luis", "anton", "hernando"]
    const targetWords = normalizedTargetName.split(' ').filter(w => w.length > 2);
    const senderWords = senderName.split(' ').filter(w => w.length > 2);
    
    console.log(`   Target words: [${targetWords.join(', ')}]`);
    console.log(`   Sender words: [${senderWords.join(', ')}]`);
    
    // Contar cuántas palabras coinciden
    let matchCount = 0;
    for (const targetWord of targetWords) {
      if (senderWords.includes(targetWord)) {
        matchCount++;
      }
    }
    
    console.log(`   Palabras coincidentes: ${matchCount}/${targetWords.length}`);
    
    // ⭐ Si coinciden al menos 3 palabras O el 75% de las palabras, es un match
    const requiredMatches = Math.max(3, Math.ceil(targetWords.length * 0.75));
    if (matchCount >= requiredMatches) {
      console.log(`✅ Match por nombre: ${matchCount}/${targetWords.length} palabras coinciden (requeridas: ${requiredMatches})`);
      return true;
    }
    
    // ⭐ MÉTODO 4.3: Verificar si TODAS las palabras del sender están en target
    // Ejemplo: "Jose Luis Anton Hernando" vs "José Luis Antón Hernando"
    // Esto maneja casos donde el sender tiene el nombre completo
    const allSenderWordsInTarget = senderWords.every(senderWord => 
      targetWords.some(targetWord => 
        targetWord.includes(senderWord) || senderWord.includes(targetWord)
      )
    );
    
    if (allSenderWordsInTarget && senderWords.length >= 3) {
      console.log(`✅ Match: todas las palabras del sender (${senderWords.length}) están en target`);
      return true;
    }
    
    // ⭐ MÉTODO 4.4: Verificar orden de palabras (nombres compuestos y dos apellidos)
    // Para "José Luis Antón Hernando" → debe encontrar "jose luis" Y "anton hernando"
    if (targetWords.length >= 3) {
      // Buscar primeras 2 palabras (nombre compuesto: "jose luis")
      const firstTwoTarget = targetWords.slice(0, 2).join(' ');
      const firstTwoSender = senderWords.slice(0, 2).join(' ');
      
      // Buscar últimas 2 palabras (dos apellidos: "anton hernando")
      const lastTwoTarget = targetWords.slice(-2).join(' ');
      const lastTwoSender = senderWords.slice(-2).join(' ');
      
      console.log(`   Comparando segmentos:`);
      console.log(`     Primeras 2 palabras: "${firstTwoTarget}" vs "${firstTwoSender}"`);
      console.log(`     Últimas 2 palabras: "${lastTwoTarget}" vs "${lastTwoSender}"`);
      
      // Si coinciden las primeras 2 O las últimas 2 palabras
      if (firstTwoTarget === firstTwoSender || lastTwoTarget === lastTwoSender) {
        console.log(`✅ Match por segmento de nombre`);
        return true;
      }
    }
  }
  
  // === Método 5: Verificación por partes del email en el nombre ===
  if (targetUsername && targetUsername.includes('.')) {
    const targetParts = targetUsername.split('.');
    
    // Contar cuántas partes del username aparecen en senderName
    let usernameMatchCount = 0;
    for (const part of targetParts) {
      if (part.length > 3 && senderName.includes(part)) {
        usernameMatchCount++;
      }
    }
    
    // Si coinciden todas las partes del username en el nombre
    if (usernameMatchCount >= targetParts.length && targetParts.length > 1) {
      console.log(`✅ Match: todas las partes del username (${targetParts.join(', ')}) en nombre`);
      return true;
    }
  }
  
  return false;
};

/**
 * Verifica si un contacto específico ha respondido Y si CSM/EP le han enviado emails
 * VERSIÓN MEJORADA con mejor detección de CSM/EP
 */
const checkContactReplies = (emails, contactEmail, csmEmail = null, epEmail = null, contactFirstName = '', contactLastName = '', csmName = '', epName = '') => {
  if (!Array.isArray(emails) || emails.length === 0) {
    console.log('⚠️ No hay emails para verificar');
    return { 
      hasReplied: false, 
      replyCount: 0, 
      lastReplyDate: null, 
      replies: [],
      csmEmails: [],
      epEmails: []
    };
  }

  if (!contactEmail || typeof contactEmail !== 'string') {
    console.log('⚠️ Email del contacto inválido:', contactEmail);
    return { 
      hasReplied: false, 
      replyCount: 0, 
      lastReplyDate: null, 
      replies: [],
      csmEmails: [],
      epEmails: []
    };
  }

  const normalizedContactEmail = contactEmail.toLowerCase().trim();
  const normalizedCsmEmail = csmEmail ? csmEmail.toLowerCase().trim() : null;
  const normalizedEpEmail = epEmail ? epEmail.toLowerCase().trim() : null;
  
  console.log(`\n🔍 === BÚSQUEDA DE EMAILS ===`);
  console.log(`📧 Contacto: ${contactFirstName} ${contactLastName} (${normalizedContactEmail})`);
  console.log(`👤 CSM: ${csmName || 'N/A'} (${normalizedCsmEmail || 'N/A'})`);
  console.log(`👤 EP: ${epName || 'N/A'} (${normalizedEpEmail || 'N/A'})`);
  console.log(`📊 Total emails a revisar: ${emails.length}`);

  // ========== EMAILS DEL CONTACTO (FROM = contacto) ==========
  const replies = emails.filter(email => {
    if (!email || !email.SenderEmail) return false;

    const senderEmail = (email.SenderEmail || '').toLowerCase().trim();
    
    if (senderEmail === 'unknown@domain.com' || senderEmail.length < 5) return false;
    
    const contactUsername = normalizedContactEmail.split('@')[0];
    const senderUsername = senderEmail.split('@')[0];
    const contactDomain = normalizedContactEmail.split('@')[1] || '';
    const senderDomain = senderEmail.split('@')[1] || '';
    
    const matches = 
      senderEmail === normalizedContactEmail ||
      (contactUsername.length > 3 && senderUsername.includes(contactUsername)) ||
      (senderUsername.length > 3 && contactUsername.includes(senderUsername)) ||
      (contactDomain === senderDomain && 
       contactUsername.length > 3 && 
       senderUsername.includes(contactUsername));
    
    if (matches) {
      console.log(`✅ Respuesta del contacto: ${senderEmail} - ${email.Subject}`);
    }
    
    return matches;
  });

  // ========== EMAILS DEL CSM AL CONTACTO ==========
  const csmEmails = normalizedCsmEmail ? emails.filter(email => {
    if (!email || !email.SenderEmail || !email.Recipients) return false;
    
    const subject = (email.Subject || '').toLowerCase();
    
    // Filtrar automáticos
    if (subject.includes('undeliverable') || 
        subject.includes('automatic reply') ||
        subject.includes('out of office')) {
      return false;
    }
    
    // ⭐ VERIFICAR FROM = CSM (con nombre)
    const isFromCsm = isFromPerson(email, normalizedCsmEmail, csmName);
    
    if (!isFromCsm) return false;
    
    // ⭐ VERIFICAR TO = Contacto (con nombre y apellido)
    const isToContact = isContactInRecipients(email.Recipients, normalizedContactEmail, contactFirstName, contactLastName);
    
    if (isToContact) {
      console.log(`✅ Email de CSM → Contacto: ${email.Subject}`);
      console.log(`   From: ${email.SenderName} (${email.SenderEmail})`);
      console.log(`   To: ${email.Recipients}`);
    }
    
    return isToContact;
  }) : [];

  // ========== EMAILS DEL EP AL CONTACTO ==========
  const epEmails = normalizedEpEmail ? emails.filter(email => {
    if (!email || !email.SenderEmail || !email.Recipients) return false;
    
    const subject = (email.Subject || '').toLowerCase();
    
    // Filtrar automáticos
    if (subject.includes('undeliverable') || 
        subject.includes('automatic reply') ||
        subject.includes('out of office')) {
      return false;
    }
    
    // ⭐ VERIFICAR FROM = EP (con nombre)
    const isFromEp = isFromPerson(email, normalizedEpEmail, epName);
    
    if (!isFromEp) return false;
    
    // ⭐ VERIFICAR TO = Contacto (con nombre y apellido)
    const isToContact = isContactInRecipients(email.Recipients, normalizedContactEmail, contactFirstName, contactLastName);
    
    if (isToContact) {
      console.log(`✅ Email de EP → Contacto: ${email.Subject}`);
      console.log(`   From: ${email.SenderName} (${email.SenderEmail})`);
      console.log(`   To: ${email.Recipients}`);
    }
    
    return isToContact;
  }) : [];

  const result = {
    hasReplied: replies.length > 0,
    replyCount: replies.length,
    lastReplyDate: replies.length > 0
      ? replies.sort((a, b) => 
          new Date(b.ReceivedTime).getTime() - new Date(a.ReceivedTime).getTime()
        )[0].ReceivedTime
      : null,
    replies: replies.map(r => ({
      subject: r.Subject || 'Sin asunto',
      date: r.ReceivedTime,
      body: r.Body || '',
      senderEmail: r.SenderEmail,
      senderName: r.SenderName || 'Desconocido'
    })),
    csmEmails: csmEmails.map(r => ({
      subject: r.Subject || 'Sin asunto',
      date: r.ReceivedTime,
      body: r.Body || '',
      senderEmail: r.SenderEmail,
      senderName: r.SenderName || 'Desconocido'
    })),
    epEmails: epEmails.map(r => ({
      subject: r.Subject || 'Sin asunto',
      date: r.ReceivedTime,
      body: r.Body || '',
      senderEmail: r.SenderEmail,
      senderName: r.SenderName || 'Desconocido'
    }))
  };

  console.log(`\n📊 === RESUMEN PARA ${normalizedContactEmail} ===`);
  console.log(`   Respuestas del contacto: ${result.replyCount}`);
  console.log(`   Emails de CSM: ${result.csmEmails.length}`);
  console.log(`   Emails de EP: ${result.epEmails.length}`);
  console.log(`======================================\n`);

  return result;
};

/**
 * Detecta y elimina duplicados al inicio del body
 */
const removeDuplicatedPrefix = (body) => {
  if (!body || body.length < 500) return body;
  
  // Tomar los primeros 250 caracteres
  const chunkSize = 250;
  const firstChunk = body.substring(0, chunkSize);
  const rest = body.substring(chunkSize);
  
  // Si el primer chunk aparece de nuevo al inicio del resto
  if (rest.startsWith(firstChunk)) {
    console.log('⚠️ Duplicado detectado al inicio, eliminando...');
    return rest; // Eliminar el primer chunk duplicado
  }
  
  return body;
};

/**
 * Limpia el body del email eliminando banners de seguridad y contenido no deseado
 */
const cleanEmailBody = (body) => {
  if (!body) return '';
  
  let cleaned = body;
  
  // PRIMERO: Eliminar duplicados
  cleaned = removeDuplicatedPrefix(cleaned);
  
  // Eliminar banner de Proofpoint/seguridad externo
  cleaned = cleaned.replace(/ZjQcmQRYFpfptBannerStart[\s\S]*?ZjQcmQRYFpfptBannerEnd/g, '');
  
  // Eliminar otros patrones comunes de banners de seguridad
  cleaned = cleaned.replace(/This Message Is From an External Sender[\s\S]*?Report Suspicious/g, '');
  cleaned = cleaned.replace(/Caution: This email originated from outside[\s\S]*?content is safe\./g, '');
  
  // Eliminar URLs de Proofpoint
  cleaned = cleaned.replace(/https:\/\/us-phishalarm-ewt\.proofpoint\.com[\S]*/g, '');
  
  // Eliminar múltiples líneas vacías consecutivas
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  // Trim espacios al inicio y final
  cleaned = cleaned.trim();
  
  return cleaned;
};


  app.get('/api/health', (req, res) => {
    res.json({
      status: 'OK',
      server: 'Email server running',
      method: 'PowerShell + Outlook COM'
    });
  });

app.post('/api/draft-email', async (req, res) => {
  console.log('\n📨 === NUEVA PETICIÓN /api/draft-email ===');
  
  try {
    const { to, subject, body, attachments = [], contactEmail } = req.body;
    console.log('📋 Datos recibidos:', { 
      to, 
      subject: subject?.substring(0, 50),
      attachmentsCount: attachments.length,
      hasContactEmail: !!contactEmail
    });

    if (!to || !subject || !body) {
      console.error('❌ Faltan parámetros: to, subject o body');
      return res.status(400).json({ error: 'Missing to, subject or body' });
    }
    
    // Buscar email anterior si se proporciona contactEmail Y subject
    let replyToEmail = null;
    if (contactEmail && subject) {
      console.log(`🔍 Buscando email anterior de esta campaña...`);
      console.log(`   To: ${contactEmail}`);
      console.log(`   Subject: ${subject}`);
      
      replyToEmail = await findLastSentEmail(contactEmail, subject, 60);
      
      if (replyToEmail) {
        console.log(`✅ Se responderá sobre email anterior:`);
        console.log(`   Asunto original: "${replyToEmail.Subject}"`);
        console.log(`   Fecha: ${replyToEmail.SentOn}`);
      } else {
        console.log(`ℹ️ No se encontró email anterior, se creará nuevo hilo`);
      }
    }

    console.log(`📝 Creando borrador para: ${to}`);

    const result = await createOutlookDraft(to, subject, body, attachments, replyToEmail);

    console.log('✅ Borrador creado exitosamente');
    res.json({
      success: true,
      message: 'Draft created in Outlook',
      to: to,
      attachmentsCount: attachments.length,
      isReply: replyToEmail ? true : false
    });

  } catch (error) {
    console.error('💥 Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});
  app.post('/api/draft-emails-batch', async (req, res) => {
    try {
      const { emails } = req.body;

      if (!Array.isArray(emails) || emails.length === 0) {
        return res.status(400).json({ error: 'Email array required' });
      }

      console.log(`📨 Creando ${emails.length} borradores...`);

      const results = [];
      let successCount = 0;
      let errorCount = 0;

      for (const email of emails) {
        try {
          const { to, subject, body, attachments = [] } = email;

          if (!to || !subject || !body) {
            results.push({ to, status: 'error', message: 'Missing fields' });
            errorCount++;
            continue;
          }

          await createOutlookDraft(to, subject, body, attachments);
          results.push({ to, status: 'success' });
          successCount++;

          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
          results.push({
            to: email.to,
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown error'
          });
          errorCount++;
        }
      }

      res.json({
        success: true,
        message: `${successCount} borradores creados, ${errorCount} errores`,
        successCount: successCount,
        errorCount: errorCount,
        totalCount: emails.length,
        details: results
      });

    } catch (error) {
      console.error('Error en batch:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

// Servir PDFs desde la carpeta Webinars
app.get('/api/webinars/pdf/:filename', async (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const webinarsDir = path.join(__dirname, '..', 'Webinars');
    const filePath = path.join(webinarsDir, filename);

    console.log(`Buscando PDF en: ${filePath}`);

    // Verificar si el archivo existe
    if (!fsSync.existsSync(filePath)) {
      console.error(`PDF no encontrado: ${filePath}`);
      return res.status(404).json({ error: `PDF no encontrado: ${filename}` });
    }

    // Servir el archivo con el tipo MIME correcto
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    // Usar sendFile para servir el archivo
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error(`Error sirviendo PDF ${filename}:`, err);
        res.status(500).json({ error: 'Error sirviendo el archivo PDF' });
      }
    });
  } catch (error) {
    console.error('Error en /api/webinars/pdf:', error);
    res.status(500).json({
      error: 'Error sirviendo el PDF',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

  app.get('/api/webinars/list-pdfs', async (req, res) => {
    try {
      const fs_promises = await import('fs').then(m => m.promises);
      const webinarsDir = path.join(__dirname, '..', 'Webinars');

      console.log('Buscando PDFs en:', webinarsDir);

      try {
        await fs_promises.mkdir(webinarsDir, { recursive: true });
      } catch (e) {
        console.warn('Carpeta Webinars existe o no se pudo crear');
      }

      const files = await fs_promises.readdir(webinarsDir);
      const pdfs = files.filter(f => f.toLowerCase().endsWith('.pdf'));

      console.log(`PDFs encontrados: ${pdfs.length}`);

      res.json({
        success: true,
        pdfs: pdfs,
        folder: webinarsDir
      });
    } catch (error) {
      console.error('Error listing PDFs:', error);
      res.status(500).json({
        error: 'Error listing PDFs',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/outlook/inbox
   * Lee todos los emails del inbox de los últimos X días
   */
  app.get('/api/outlook/inbox', async (req, res) => {
    try {
      const daysBack = typeof req.query.days === 'string' ? parseInt(req.query.days) : 30;
      console.log(`📬 Leyendo inbox de los últimos ${daysBack} días...`);
      
      const emails = await readOutlookInbox(daysBack);
      
      res.json({
        success: true,
        count: emails.length,
        daysBack,
        emails
      });
    } catch (error) {
      console.error('Error leyendo inbox:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  /**
   * POST /api/outlook/check-replies
   * Verifica si contactos específicos han respondido
   * Body: { contacts: [{ id: string, email: string }] }
   */
  app.post('/api/outlook/check-replies', async (req, res) => {
  try {
    const { contacts, daysBack = 30 } = req.body;
    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'Contacts array required' });
    }

    const emails = await readOutlookInbox(daysBack);

    const results = contacts.map(contact => {
      const replyInfo = checkContactReplies(
        emails, 
        contact.email,
        contact.csm_email,
        contact.ep_email,
        contact.first_name || '',
        contact.last_name  || '',
        contact.csm_name, 
        contact.ep_name  
      );
      return {
        contactId: contact.id,
        email: contact.email,
        name: contact.name,
        ...replyInfo
      };
    });

    const repliedCount = results.filter(r => r.hasReplied).length;

    res.json({
      success: true,
      totalContacts: contacts.length,
      repliedCount,
      notRepliedCount: contacts.length - repliedCount,
      results
    });
  } catch (error) {
    console.error('Error verificando respuestas:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

  /**
 * POST /api/campaigns/check-all-replies
 * Verifica respuestas de todos los contactos en campañas activas
 * Actualiza has_replied y last_reply_date en BBDD
 */
app.post('/api/campaigns/check-all-replies', async (req, res) => {
  try {
    const { daysBack = 30 } = req.body;

    console.log('📊 Obteniendo campañas de la base de datos...');

    const { data: campaigns, error: campaignsError } = await getCampaigns()

    if (campaignsError) {
      console.error('❌ Error obteniendo campañas:', campaignsError);
      throw campaignsError;
    }

    if (!campaigns || campaigns.length === 0) {
      console.log('⚠️ No hay campañas en la base de datos');
      return res.json({
        success: true,
        message: 'No hay campañas',
        totalCampaigns: 0,
        repliedCount: 0
      });
    }

    console.log(`📬 Verificando ${campaigns.length} campañas...`);

    // ⭐ CAMBIO: Usar getEmailsWithCache en lugar de readOutlookInbox
    console.log('📥 Obteniendo emails (caché + inbox reciente)...');
    const emails = await getEmailsWithCache(daysBack);
    console.log(`📧 Total emails obtenidos: ${emails.length}`);

    if (emails.length === 0) {
      console.log('⚠️ No se encontraron emails en caché ni inbox');
      return res.json({
        success: true,
        message: 'No hay emails disponibles',
        totalCampaigns: campaigns.length,
        repliedCount: 0
      });
    }

    let updatedCount = 0;
    let errorCount = 0;
    const results = [];

    for (const campaign of campaigns) {
      const contact = campaign.contacts;
      
      if (!contact || !contact.email) {
        console.log(`⚠️ Campaña ${campaign.id}: sin contacto válido`);
        results.push({
          campaignId: campaign.id,
          error: 'No contact email'
        });
        errorCount++;
        continue;
      }

      console.log(`\n🔍 Verificando: ${contact.first_name} ${contact.last_name} (${contact.email})`);

      const csmName = contact.csm_name || null;
      const epName = contact.ep_name || null;
      const firstName = contact.first_name || '';
      const lastName = contact.last_name || '';
      const csmEmail = contact.csm_email || null;
      const epEmail = contact.ep_email || null;

      const replyInfo = checkContactReplies(
        emails, 
        contact.email, 
        csmEmail, 
        epEmail, 
        firstName,
        lastName,
        csmName,
        epName
      );

      const updateData = {
        has_replied: replyInfo.hasReplied,
        last_reply_date: replyInfo.lastReplyDate
      };

      console.log(`💾 Actualizando campaña ${campaign.id}:`, updateData);

      const { data: updateResult, error: updateError } = await db.updateCampaign(campaign.id, updateData);

      if (updateError) {
        console.error(`❌ Error actualizando campaña ${campaign.id}:`, updateError);
        results.push({
          campaignId: campaign.id,
          contactName: `${contact.first_name} ${contact.last_name}`,
          contactEmail: contact.email,
          error: updateError.message,
          ...replyInfo
        });
        errorCount++;
      } else {
        console.log(`✅ Campaña ${campaign.id} actualizada exitosamente`);
        if (replyInfo.hasReplied) {
          updatedCount++;
          console.log(`   📨 ${replyInfo.replyCount} respuesta(s) encontrada(s)`);
        } else {
          console.log(`   ⭕ Sin respuestas`);
        }

        results.push({
          campaignId: campaign.id,
          contactName: `${contact.first_name} ${contact.last_name}`,
          contactEmail: contact.email,
          updated: true,
          ...replyInfo
        });
      }
    }

    console.log(`\n✅ Proceso completado:`);
    console.log(`   Total campañas: ${campaigns.length}`);
    console.log(`   Con respuestas: ${updatedCount}`);
    console.log(`   Sin respuestas: ${campaigns.length - updatedCount - errorCount}`);
    console.log(`   Errores: ${errorCount}`);

    res.json({
      success: true,
      totalCampaigns: campaigns.length,
      repliedCount: updatedCount,
      notRepliedCount: campaigns.length - updatedCount - errorCount,
      errorCount: errorCount,
      results
    });

  } catch (error) {
    console.error('💥 Error en check-all-replies:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
});

/**
 * Obtiene la lista de archivos de caché ordenados por fecha
 */
const getCacheFiles = async () => {
  try {
    const cacheDir = path.join(__dirname, 'temp', 'inbox_cache');
    await fs.mkdir(cacheDir, { recursive: true });
    
    const files = await fs.readdir(cacheDir);
    const cacheFiles = files
      .filter(f => f.startsWith('inbox_') && f.endsWith('.json'))
      .map(f => {
        const match = f.match(/inbox_(\d{4}-\d{2}-\d{2})_to_(\d{4}-\d{2}-\d{2})\.json/);
        if (match) {
          return {
            filename: f,
            path: path.join(cacheDir, f),
            startDate: match[1],
            endDate: match[2]
          };
        }
        return null;
      })
      .filter(f => f !== null)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    
    return cacheFiles;
  } catch (error) {
    console.error('Error obteniendo archivos de caché:', error);
    return [];
  }
};

/**
 * Lee emails desde los archivos de caché
 */
const readFromCache = async (startDate, endDate) => {
  try {
    const cacheFiles = await getCacheFiles();
    console.log(`📂 Archivos de caché disponibles: ${cacheFiles.length}`);
    
    const allEmails = [];
    
    for (const cacheFile of cacheFiles) {
      // Verificar si el rango del archivo se solapa con el rango solicitado
      if (cacheFile.endDate >= startDate && cacheFile.startDate <= endDate) {
        console.log(`📖 Leyendo caché: ${cacheFile.filename}`);
        
        const data = await fs.readFile(cacheFile.path, 'utf8');
        const emails = JSON.parse(data);
        
        // Filtrar emails por rango de fechas
        const filteredEmails = emails.filter(email => {
          const emailDate = email.ReceivedTime.split(' ')[0];
          return emailDate >= startDate && emailDate <= endDate;
        });
        
        allEmails.push(...filteredEmails);
        console.log(`   ✅ ${filteredEmails.length} emails del rango solicitado`);
      }
    }
    
    console.log(`📊 Total emails desde caché: ${allEmails.length}`);
    return allEmails;
  } catch (error) {
    console.error('Error leyendo desde caché:', error);
    return [];
  }
};

/**
 * Guarda emails en un archivo de caché incremental
 */
const saveToCache = async (emails, startDate, endDate) => {
  try {
    const cacheDir = path.join(__dirname, 'temp', 'inbox_cache');
    await fs.mkdir(cacheDir, { recursive: true });
    
    const filename = `inbox_${startDate}_to_${endDate}.json`;
    const filepath = path.join(cacheDir, filename);
    
    console.log(`💾 Guardando ${emails.length} emails en caché: ${filename}`);
    
    await fs.writeFile(filepath, JSON.stringify(emails, null, 2), 'utf8');
    
    console.log(`✅ Caché guardada exitosamente`);
    return filepath;
  } catch (error) {
    console.error('Error guardando en caché:', error);
    throw error;
  }
};

/**
 * Obtiene la fecha del último archivo de caché
 */
const getLastCacheDate = async () => {
  try {
    const cacheFiles = await getCacheFiles();
    
    if (cacheFiles.length === 0) {
      return null;
    }
    
    // Obtener el archivo más reciente
    const lastFile = cacheFiles[cacheFiles.length - 1];
    return lastFile.endDate;
  } catch (error) {
    console.error('Error obteniendo última fecha de caché:', error);
    return null;
  }
};

/**
 * Crea un nuevo archivo de caché incremental
 * - Primera caché: 365 días
 * - Cachés incrementales: desde última caché hasta hoy (máximo 30 días por archivo)
 */
const createIncrementalCache = async (silent = false) => {
  // ⭐ EVITAR MÚLTIPLES CONSTRUCCIONES SIMULTÁNEAS
  if (cacheInitializationInProgress) {
    console.log('⚠️ Ya hay una construcción de caché en progreso...');
    if (cacheInitializationPromise) {
      return await cacheInitializationPromise;
    }
    return { success: false, message: 'Construcción en progreso', daysAdded: 0 };
  }

  // ⭐ MARCAR COMO EN PROGRESO
  cacheInitializationInProgress = true;
  
  try {
    if (!silent) console.log('\n🔄 Creando caché incremental del inbox...');
    
    const lastCacheDate = await getLastCacheDate();
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    let startDate;
    let daysToFetch;
    
    if (lastCacheDate) {
      // ===== CACHÉ INCREMENTAL =====
      const lastDate = new Date(lastCacheDate);
      lastDate.setDate(lastDate.getDate() + 1); // Día siguiente al último caché
      startDate = lastDate.toISOString().split('T')[0];
      
      const diffTime = today - lastDate;
      daysToFetch = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // Si han pasado más de 30 días, limitar a 30 (para no sobrecargar)
      if (daysToFetch > 30) {
        console.log(`⚠️ Han pasado ${daysToFetch} días, limitando a 30 días por archivo`);
        const limitedStartDate = new Date(today);
        limitedStartDate.setDate(limitedStartDate.getDate() - 30);
        startDate = limitedStartDate.toISOString().split('T')[0];
        daysToFetch = 30;
      }
      
      if (!silent) {
        console.log(`📅 Última caché: ${lastCacheDate}`);
        console.log(`📅 Caché incremental desde: ${startDate} hasta: ${todayStr}`);
        console.log(`📅 Días a descargar: ${daysToFetch}`);
      }
    } else {
      // ===== PRIMERA CACHÉ: 365 DÍAS =====
      daysToFetch = 365;
      const startDateObj = new Date(today);
      startDateObj.setDate(startDateObj.getDate() - daysToFetch);
      startDate = startDateObj.toISOString().split('T')[0];
      
      if (!silent) {
        console.log(`📅 🎉 PRIMERA CACHÉ - Descargando últimos 365 días`);
        console.log(`📅 Desde: ${startDate} hasta: ${todayStr}`);
        console.log(`⏳ Esto puede tardar varios minutos...`);
      }
    }
    
    if (daysToFetch < 1) {
      if (!silent) console.log('⚠️ La caché ya está actualizada');
      return { success: true, message: 'Caché ya actualizada', daysAdded: 0 };
    }
    
    // Descargar emails
    if (!silent) console.log(`📥 Descargando ${daysToFetch} días de emails...`);
    const emails = await readOutlookInbox(daysToFetch);
    
    if (emails.length === 0) {
      if (!silent) console.log('⚠️ No se encontraron emails en el rango');
      return { success: false, message: 'No hay emails en el rango', daysAdded: 0 };
    }
    
    // Guardar en caché
    await saveToCache(emails, startDate, todayStr);
    
    if (!silent) {
      console.log(`✅ Caché ${lastCacheDate ? 'incremental' : 'inicial'} creada exitosamente`);
      console.log(`📊 ${emails.length} emails guardados`);
    }
    
    return {
      success: true,
      message: lastCacheDate ? 'Caché incremental creada' : 'Primera caché creada',
      startDate,
      endDate: todayStr,
      emailCount: emails.length,
      daysAdded: daysToFetch,
      isFirstCache: !lastCacheDate
    };
  } catch (error) {
    console.error('❌ Error creando caché incremental:', error);
    throw error;
  } finally {
    // ⭐ SIEMPRE LIBERAR EL FLAG
    cacheInitializationInProgress = false;
    cacheInitializationPromise = null;
  }
};

/**
 * Inicializa el caché en background al arrancar el servidor
 */
const initializeCacheOnStartup = async () => {
  try {
    console.log('\n🔍 Verificando estado del caché...');
    
    const cacheFiles = await getCacheFiles();
    
    if (cacheFiles.length === 0) {
      console.log('⚠️ No hay caché disponible - iniciando construcción en BACKGROUND');
      console.log('🚀 La aplicación seguirá funcionando mientras se construye el caché');
      console.log('⏳ Este proceso puede tardar varios minutos (365 días de emails)\n');
      
      // ⭐ EJECUTAR EN BACKGROUND SIN BLOQUEAR
      cacheInitializationPromise = createIncrementalCache(false)
        .then(result => {
          if (result.success) {
            console.log('\n✅✅✅ CACHÉ INICIAL COMPLETADA ✅✅✅');
            console.log(`📊 ${result.emailCount} emails guardados`);
            console.log(`📅 Rango: ${result.startDate} → ${result.endDate}\n`);
          } else {
            console.error('⚠️ Construcción de caché terminó sin éxito:', result.message);
          }
          return result;
        })
        .catch(err => {
          console.error('❌ Error en construcción de caché:', err.message);
          return { success: false, message: err.message };
        });
      
      // ⭐ NO ESPERAR - Continuar con el arranque del servidor
      console.log('✅ Construcción de caché iniciada en background');
      
    } else {
      console.log(`✅ Caché encontrada: ${cacheFiles.length} archivo(s)`);
      const lastCacheDate = await getLastCacheDate();
      console.log(`📅 Última actualización: ${lastCacheDate}\n`);
    }
  } catch (error) {
    console.error('⚠️ Error verificando caché:', error.message);
  }
};


/**
 * Obtiene emails combinando caché + inbox reciente
 * Y actualiza la caché SIEMPRE después de obtener los emails
 */
const getEmailsWithCache = async (daysBack) => {
  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const startDateObj = new Date(today);
    startDateObj.setDate(startDateObj.getDate() - daysBack);
    const startDateStr = startDateObj.toISOString().split('T')[0];
    
    console.log(`\n📧 === OBTENIENDO EMAILS CON CACHÉ ===`);
    console.log(`📅 Rango solicitado: ${startDateStr} → ${todayStr} (${daysBack} días)`);
    
    // 1. Verificar si hay caché disponible
    const cacheFiles = await getCacheFiles();
    console.log(`📂 Archivos de caché disponibles: ${cacheFiles.length}`);
    
    // 2. Obtener última fecha de caché
    const lastCacheDate = await getLastCacheDate();
    console.log(`📅 Última fecha en caché: ${lastCacheDate || 'No hay caché'}`);
    
// ========== SI NO HAY CACHÉ: VERIFICAR SI SE ESTÁ CONSTRUYENDO ==========
    if (cacheFiles.length === 0) {
      console.log(`\n🚨 NO HAY CACHÉ DISPONIBLE`);
      
      // ⭐ VERIFICAR SI YA SE ESTÁ CONSTRUYENDO EN BACKGROUND
      if (cacheInitializationInProgress && cacheInitializationPromise) {
        console.log(`⏳ Caché en construcción en background...`);
        console.log(`⚠️ FALLBACK: Descargando últimos ${Math.min(daysBack, 30)} días directamente`);
        
        // Mientras tanto, obtener emails recientes directamente
        const fallbackEmails = await readOutlookInbox(Math.min(daysBack, 30));
        
        console.log(`\n📊 === RESUMEN TEMPORAL ===`);
        console.log(`   📥 Emails obtenidos (fallback): ${fallbackEmails.length}`);
        console.log(`   ⚠️ Nota: Caché completa se está construyendo en background`);
        console.log(`=========================\n`);
        
        return fallbackEmails;
      }
      
      // Si no se está construyendo, algo falló - usar fallback directo
      console.log(`⚠️ No hay construcción en progreso - usando fallback directo`);
      return await readOutlookInbox(Math.min(daysBack, 90));
    }
    
    // ========== SI HAY CACHÉ: PROCESO NORMAL ==========
    let cachedEmails = [];
    let recentEmails = [];
    
    // 3. Leer desde caché existente
    if (lastCacheDate && lastCacheDate >= startDateStr) {
      console.log(`\n📖 LEYENDO DESDE CACHÉ...`);
      cachedEmails = await readFromCache(startDateStr, lastCacheDate);
      console.log(`✅ ${cachedEmails.length} emails desde caché`);
    } else if (lastCacheDate) {
      // Hay caché pero no cubre todo el rango solicitado
      console.log(`\n📖 LEYENDO DESDE CACHÉ (parcial)...`);
      cachedEmails = await readFromCache(lastCacheDate, lastCacheDate);
      console.log(`✅ ${cachedEmails.length} emails desde caché`);
    }
    
    // 4. Calcular días faltantes (desde última caché hasta hoy)
    let daysToFetch = 0;
    
    if (lastCacheDate) {
      const lastDate = new Date(lastCacheDate);
      const diffTime = today - lastDate;
      daysToFetch = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      
      if (daysToFetch > 0) {
        console.log(`\n📥 DESCARGANDO EMAILS RECIENTES...`);
        console.log(`   Días a descargar: ${daysToFetch} (desde ${lastCacheDate})`);
        recentEmails = await readOutlookInbox(daysToFetch);
        console.log(`✅ ${recentEmails.length} emails recientes descargados`);
      } else {
        console.log(`\n✅ Caché está actualizada (última caché: ${lastCacheDate})`);
      }
    }
    
    // 5. Combinar y eliminar duplicados
    console.log(`\n🔄 COMBINANDO RESULTADOS...`);
    const allEmails = [...cachedEmails, ...recentEmails];
    console.log(`   Total antes de deduplicar: ${allEmails.length}`);
    
    const uniqueEmails = [];
    const seen = new Set();
    
    for (const email of allEmails) {
      const key = `${email.Subject}_${email.ReceivedTime}_${email.SenderEmail}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueEmails.push(email);
      }
    }
    
    console.log(`   Total después de deduplicar: ${uniqueEmails.length}`);
    
    // ⭐ 6. ACTUALIZAR CACHÉ SIEMPRE (SI HAY EMAILS NUEVOS)
    if (recentEmails.length > 0) {
      console.log(`\n🔄 ACTUALIZANDO CACHÉ...`);
      
      // Determinar si necesitamos crear caché incremental o actualizar la existente
      const lastDate = lastCacheDate ? new Date(lastCacheDate) : null;
      const daysSinceLastCache = lastDate 
        ? Math.ceil((today - lastDate) / (1000 * 60 * 60 * 24))
        : 0;
      
      // Si han pasado 30+ días O si hay muchos emails nuevos, crear caché incremental
      const shouldCreateIncremental = daysSinceLastCache >= 30 || recentEmails.length > 500;
      
      if (shouldCreateIncremental) {
        console.log(`   📦 Creando nueva caché incremental (${daysSinceLastCache} días desde última)...`);
        
        // Ejecutar de forma NO bloqueante en segundo plano
        createIncrementalCache(true).then(result => {
          if (result.success) {
            console.log(`✅ Caché incremental actualizada: ${result.emailCount} emails (${result.daysAdded} días)`);
          }
        }).catch(err => {
          console.error(`⚠️ Error actualizando caché incremental:`, err.message);
        });
      } else {
        console.log(`   📝 Actualizando caché existente (añadiendo ${recentEmails.length} emails nuevos)...`);
        
        // Actualizar la última caché con los emails nuevos
        const lastFile = cacheFiles[cacheFiles.length - 1];
        
        try {
          // Leer la última caché
          const existingData = await fs.readFile(lastFile.path, 'utf8');
          const existingEmails = JSON.parse(existingData);
          
          // Combinar con emails nuevos
          const combinedEmails = [...existingEmails, ...recentEmails];
          
          // Eliminar duplicados
          const uniqueCombined = [];
          const seenKeys = new Set();
          
          for (const email of combinedEmails) {
            const key = `${email.Subject}_${email.ReceivedTime}_${email.SenderEmail}`;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              uniqueCombined.push(email);
            }
          }
          
          // Actualizar el archivo de caché con el nuevo rango de fechas
          const newFilename = `inbox_${lastFile.startDate}_to_${todayStr}.json`;
          const newFilepath = path.join(path.dirname(lastFile.path), newFilename);
          
          // Guardar
          await fs.writeFile(newFilepath, JSON.stringify(uniqueCombined, null, 2), 'utf8');
          
          // Si el nombre cambió, eliminar el archivo antiguo
          if (newFilepath !== lastFile.path) {
            await fs.unlink(lastFile.path).catch(() => {});
          }
          
          console.log(`   ✅ Caché actualizada: ${uniqueCombined.length} emails totales`);
        } catch (updateError) {
          console.error(`   ⚠️ Error actualizando caché existente:`, updateError.message);
        }
      }
    } else {
      console.log(`\n✅ No hay emails nuevos para añadir a la caché`);
    }
    
    console.log(`\n📊 === RESUMEN FINAL ===`);
    console.log(`   📂 Desde caché: ${cachedEmails.length}`);
    console.log(`   📥 Desde inbox: ${recentEmails.length}`);
    console.log(`   ✅ Total único: ${uniqueEmails.length}`);
    console.log(`   💾 Caché actualizada: ${recentEmails.length > 0 ? 'Sí' : 'No (ya actualizada)'}`);
    console.log(`=========================\n`);
    
    return uniqueEmails;
    
  } catch (error) {
    console.error('❌ Error obteniendo emails con caché:', error);
    console.log('⚠️ FALLBACK: Descargando directamente del inbox');
    return await readOutlookInbox(Math.min(daysBack, 90));
  }
};


/**
 * POST /api/contacts/import-received-emails
 * Importa emails recibidos de un contacto específico y los guarda como meetings
 * Body: { contactId: string, contactEmail: string, daysBack: number }
 */
app.post('/api/contacts/import-received-emails', async (req, res) => {
  try {
    const { contactId, contactEmail, lastEmailCheck } = req.body;

    if (!contactId || !contactEmail) {
      return res.status(400).json({ error: 'contactId y contactEmail son requeridos' });
    }

    const today = new Date().toISOString().split('T')[0];
    let daysBack = 365;
    
    console.log(`⚠️ Fecha en last_email_check: ${lastEmailCheck}`);

    if (lastEmailCheck && lastEmailCheck.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const lastCheckDate = new Date(lastEmailCheck);
      const todayDate = new Date();
      
      if (!isNaN(lastCheckDate.getTime())) {
        daysBack = Math.ceil((todayDate - lastCheckDate) / (1000 * 60 * 60 * 24));
        
        if (daysBack < 1) daysBack = 1;
        if (daysBack > 365) daysBack = 365;
        
        console.log(`📅 Última revisión: ${lastEmailCheck}, días desde entonces: ${daysBack}`);
      } else {
        console.log(`⚠️ Fecha inválida en last_email_check: ${lastEmailCheck}, usando 360 días por defecto`);
        daysBack = 360;
      }
    } else {
      console.log(`📅 Primera importación (o formato inválido), revisando últimos ${daysBack} días`);
    }

    console.log(`📥 Importando emails recibidos de ${contactEmail}...`);

    const contactResponse = await fetch(`http://localhost:3001/api/contacts/${contactId}`);
    const contactData = await contactResponse.json();
    
    const csmEmail = contactData.csm_email || null;
    const epEmail = contactData.ep_email || null;
    const csmName = contactData.csm_name || null; 
    const epName = contactData.ep_name || null;   
    const firstName = contactData.first_name || '';  
    const lastName = contactData.last_name || '';    

    const emails = await getEmailsWithCache(daysBack);
    console.log(`📧 Total emails obtenidos: ${emails.length}`);

    // ⭐ ACTUALIZAR LLAMADA con TODOS los parámetros
    const replyInfo = checkContactReplies(
      emails, 
      contactEmail, 
      csmEmail, 
      epEmail, 
      firstName, 
      lastName,     
      csmName,    
      epName       
    );
    
    const totalEmails = replyInfo.replies.length + replyInfo.csmEmails.length + replyInfo.epEmails.length;
    
    if (totalEmails === 0) {
      console.log(`⚠️ No se encontraron emails de ${contactEmail}, CSM o EP`);
      
      const updateResponse = await fetch(`http://localhost:3001/api/contacts/${contactId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...contactData,
          last_email_check: today
        })
      });

      return res.json({
        success: true,
        message: 'No se encontraron emails de este contacto, CSM o EP',
        importedCount: 0,
        skippedCount: 0,
        lastEmailCheck: today
      });
    }

    console.log(`✅ Encontrados ${totalEmails} emails totales:`);
    console.log(`   - Respuestas del contacto: ${replyInfo.replies.length}`);
    console.log(`   - Emails de CSM: ${replyInfo.csmEmails.length}`);
    console.log(`   - Emails de EP: ${replyInfo.epEmails.length}`);

    // ... resto del código igual ...
    const existingMeetingsResponse = await fetch(`http://localhost:3001/api/meetings/contact/${contactId}`);
    const existingMeetings = await existingMeetingsResponse.json();
    
    console.log(`📋 Meetings existentes: ${existingMeetings.length}`);

    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const results = [];

    const allEmails = [
      ...replyInfo.replies.map(r => ({ ...r, type: 'Email cliente' })),
      ...replyInfo.csmEmails.map(r => ({ ...r, type: 'Email CSM' })),
      ...replyInfo.epEmails.map(r => ({ ...r, type: 'Email EP' }))
    ];

    for (const reply of allEmails) {
      try {
        const meetingDate = reply.date.split(' ')[0];
        const normalizedSubject = reply.subject.trim().toLowerCase();
        
        const isDuplicate = existingMeetings.some(meeting => {
          if (meeting.meeting_type !== 'Email') return false;
          if (!meeting.notes) return false;
          
          let existingDate = meeting.meeting_date;
          if (existingDate.includes('/')) {
            const [day, month, yearTime] = existingDate.split('/');
            const year = yearTime.split(' ')[0];
            existingDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }
          
          if (existingDate !== meetingDate) return false;
          
          const firstLine = meeting.notes.split('\n')[0];
          const meetingSubject = firstLine.replace(/\[.*?\]\s*Asunto:\s*/i, '').trim().toLowerCase();
          return meetingSubject === normalizedSubject;
        });

        if (isDuplicate) {
          console.log(`⏭️  Email ya importado, omitiendo: ${reply.subject}`);
          skippedCount++;
          results.push({
            subject: reply.subject,
            date: reply.date,
            type: reply.type,
            status: 'skipped',
            reason: 'Ya existe'
          });
          continue;
        }

        const cleanedBody = cleanEmailBody(reply.body);

        const meetingData = {
          contact_id: contactId,
          opportunity_id: 'Sin oportunidad',
          meeting_type: 'Email',
          meeting_date: meetingDate,
          feeling: '',
          notes: `[${reply.type}] Asunto: ${reply.subject}\n\nDe: ${reply.senderName} <${reply.senderEmail}>\n\n${cleanedBody}`
        };

        const response = await fetch('http://localhost:3001/api/meetings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(meetingData)
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Error HTTP ${response.status}:`, errorText);
          throw new Error(`Error HTTP: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        
        importedCount++;
        results.push({
          subject: reply.subject,
          date: reply.date,
          type: reply.type,
          status: 'imported',
          meetingId: result.id
        });
        
        console.log(`✅ Email importado [${reply.type}]: ${reply.subject}`);
      } catch (error) {
        errorCount++;
        results.push({
          subject: reply.subject,
          date: reply.date,
          type: reply.type,
          status: 'error',
          error: error.message
        });
        console.error(`❌ Error importando email "${reply.subject}":`, error.message);
      }
    }

    const updateResponse = await fetch(`http://localhost:3001/api/contacts/${contactId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...contactData,
        last_email_check: today
      })
    });

    if (!updateResponse.ok) {
      console.warn('⚠️ No se pudo actualizar last_email_check');
    } else {
      console.log(`✅ last_email_check actualizado: ${today}`);
    }

    console.log(`\n📊 Importación completada:`);
    console.log(`   Importados: ${importedCount}`);
    console.log(`   Omitidos (duplicados): ${skippedCount}`);
    console.log(`   Errores: ${errorCount}`);

    res.json({
      success: true,
      importedCount,
      skippedCount,
      errorCount,
      totalFound: totalEmails,
      lastEmailCheck: today,
      results
    });

  } catch (error) {
    console.error('💥 Error importando emails:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/inbox/create-cache
 * Crea un nuevo archivo de caché incremental (90 días o desde último caché)
 */
app.post('/api/inbox/create-cache', async (req, res) => {
  try {
    const result = await createIncrementalCache();
    res.json(result);
  } catch (error) {
    console.error('Error creando caché:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * GET /api/inbox/cache-info
 * Información sobre los archivos de caché
 */
app.get('/api/inbox/cache-info', async (req, res) => {
  try {
    const cacheFiles = await getCacheFiles();
    const lastCacheDate = await getLastCacheDate();
    
    const totalEmails = await Promise.all(
      cacheFiles.map(async (file) => {
        const data = await fs.readFile(file.path, 'utf8');
        const emails = JSON.parse(data);
        return emails.length;
      })
    );
    
    const sum = totalEmails.reduce((a, b) => a + b, 0);
    
    res.json({
      success: true,
      cacheFiles: cacheFiles.map((f, i) => ({
        filename: f.filename,
        startDate: f.startDate,
        endDate: f.endDate,
        emailCount: totalEmails[i]
      })),
      totalCacheFiles: cacheFiles.length,
      totalEmailsCached: sum,
      lastCacheDate
    });
  } catch (error) {
    console.error('Error obteniendo info de caché:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// 🔍 DEBUG ENDPOINT - Diagnosticar problema de caché
app.get('/api/inbox/debug-cache', async (req, res) => {
  const cacheDir = path.join(__dirname, 'temp', 'inbox_cache');
  
  const info = {
    __dirname,
    cacheDir,
    dirExists: fsSync.existsSync(cacheDir),
    files: []
  };
  
  try {
    await fs.mkdir(cacheDir, { recursive: true });
    if (fsSync.existsSync(cacheDir)) {
      info.files = fsSync.readdirSync(cacheDir);
    }
    
    // Test de escritura
    const testFile = path.join(cacheDir, 'test.txt');
    fsSync.writeFileSync(testFile, 'test');
    info.canWrite = true;
    fsSync.unlinkSync(testFile);
  } catch (e) {
    info.canWrite = false;
    info.error = e.message;
  }
  
  res.json(info);
});

/**
 * GET /api/outlook/cache
 * Lee emails desde los archivos de caché
 */
app.get('/api/outlook/cache', async (req, res) => {
  try {
    const daysBack = typeof req.query.days === 'string' ? parseInt(req.query.days) : 30;
    
    console.log(`📂 Leyendo caché (últimos ${daysBack} días)...`);
    
    const today = new Date();
    const startDateObj = new Date(today);
    startDateObj.setDate(startDateObj.getDate() - daysBack);
    const startDateStr = startDateObj.toISOString().split('T')[0];
    const endDateStr = today.toISOString().split('T')[0];
    
    const emails = await readFromCache(startDateStr, endDateStr);
    
    res.json({
      success: true,
      count: emails.length,
      daysBack,
      emails
    });
  } catch (error) {
    console.error('Error leyendo caché:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      emails: []
    });
  }
});

/**
 * GET /api/outlook/emails-with-cache
 * Obtiene emails combinando caché + inbox reciente (delta)
 * Usa la función getEmailsWithCache() existente
 */
app.get('/api/outlook/emails-with-cache', async (req, res) => {
  try {
    const daysBack = typeof req.query.days === 'string' ? parseInt(req.query.days) : 30;
    
    console.log(`📧 Obteniendo emails con caché (últimos ${daysBack} días)...`);
    
    const emails = await getEmailsWithCache(daysBack);
    
    res.json({
      success: true,
      count: emails.length,
      daysBack,
      emails
    });
  } catch (error) {
    console.error('Error obteniendo emails con caché:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      emails: []
    });
  }
});

  app.listen(PORT, async () => {
      console.log(`\n✅ Servidor de email ejecutándose en http://localhost:${PORT}`);
      console.log('\nEndpoints disponibles:');
      console.log('  POST /api/draft-email - Crear un borrador');
      console.log('  POST /api/draft-emails-batch - Crear múltiples borradores');
      console.log('  GET /api/health - Health check');
      console.log('  POST /api/campaigns/check-all-replies - Revisar respuestas\n');

      // ⭐ INICIALIZAR CACHÉ EN BACKGROUND AL ARRANCAR
      await initializeCacheOnStartup();
    });