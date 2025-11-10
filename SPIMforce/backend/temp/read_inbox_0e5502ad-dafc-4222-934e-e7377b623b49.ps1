$ErrorActionPreference = 'Stop'

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

  $dateLimit = (Get-Date).AddDays(-30)
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
    [System.IO.File]::WriteAllText('C:\\Users\\candresd\\Downloads\\SPIMForce\\SPIMforce\\backend\\temp\\inbox_3ee96030-9467-4dec-ad8b-28573e60033b.json', '[]', $utf8NoBom)
  } else {
    $json = $results | ConvertTo-Json -Depth 3 -Compress
    [System.IO.File]::WriteAllText('C:\\Users\\candresd\\Downloads\\SPIMForce\\SPIMforce\\backend\\temp\\inbox_3ee96030-9467-4dec-ad8b-28573e60033b.json', $json, $utf8NoBom)
  }

  Write-Host "Success"
  
} catch {
  Write-Host "ERROR CRITICO: $($_.Exception.Message)"
  Write-Host "StackTrace: $($_.Exception.StackTrace)"
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText('C:\\Users\\candresd\\Downloads\\SPIMForce\\SPIMforce\\backend\\temp\\inbox_3ee96030-9467-4dec-ad8b-28573e60033b.json', '[]', $utf8NoBom)
  exit 1
}