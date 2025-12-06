import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import initSqlJs from 'sql.js';
import fs from 'fs';
import { randomUUID } from 'crypto';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const upload = multer({ dest: path.join(__dirname, '..', 'runtime', 'temp') });

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const dbPath = './runtime/data/crm_campaigns.db';
let db;

// Crear directorio para webinars
const webinarsDir = path.join(__dirname, '..', 'runtime', 'webinars');
if (!fs.existsSync(webinarsDir)) {
  fs.mkdirSync(webinarsDir, { recursive: true });
  console.log('📁 Directorio de webinars creado:', webinarsDir);
}

// Crear directorio para fotos de contactos
const contactPhotosDir = path.join(__dirname, '..', 'runtime', 'contact-photos');
if (!fs.existsSync(contactPhotosDir)) {
  fs.mkdirSync(contactPhotosDir, { recursive: true });
  console.log('📁 Directorio de fotos de contactos creado:', contactPhotosDir);
}

// Configurar multer para webinars
const webinarStorage = multer.diskStorage({
  destination: webinarsDir,
  filename: (req, file, cb) => {
    // Mantener el nombre original con timestamp para evitar colisiones
    const uniqueName = `${file.originalname}`;
    cb(null, uniqueName);
  }
});

const uploadWebinar = multer({ 
  storage: webinarStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB límite
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF'));
    }
  }
});

// Configurar multer para fotos de contactos
const contactPhotoStorage = multer.diskStorage({
  destination: contactPhotosDir,
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const uploadContactPhoto = multer({ 
  storage: contactPhotoStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB límite
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen'));
    }
  }
});

// Crear directorio para adjuntos
const attachmentsDir = path.join(__dirname, '..', 'runtime', 'attachments');
if (!fs.existsSync(attachmentsDir)) {
  fs.mkdirSync(attachmentsDir, { recursive: true });
  console.log('📁 Directorio de adjuntos creado:', attachmentsDir);
}

// Configurar multer para guardar archivos
const storage = multer.diskStorage({
  destination: attachmentsDir,
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const uploadAttachment = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB límite
});

async function initDB() {
  const SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
}

function saveDB() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function rowsToObjects(result) {
  if (!result[0]) return [];
  return result[0].values.map(row => {
    const obj = {};
    result[0].columns.forEach((col, i) => obj[col] = row[i]);
    return obj;
  });
}

function rowToObject(result) {
  if (!result[0] || result[0].values.length === 0) return null;
  const obj = {};
  result[0].columns.forEach((col, i) => obj[col] = result[0].values[0][i]);
  return obj;
}

function parseJSONField(value, defaultValue = []) {
  if (!value) return defaultValue;
  try {
    return JSON.parse(value);
  } catch (e) {
    return defaultValue;
  }
}

// Función helper para formatear fechas con hora
function formatDateTime(dateString) {
  if (!dateString) return null;
  
  try {
    let date;
    
    // Caso 1: Formato DD/MM/YYYY HH:MM (español)
    if (dateString.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) {
      const parts = dateString.split(' ');
      const datePart = parts[0]; // DD/MM/YYYY
      const timePart = parts[1] || '00:00'; // HH:MM
      
      const [day, month, year] = datePart.split('/');
      
      // Construir fecha en formato ISO para que sea válida
      const isoString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart}:00`;
      date = new Date(isoString);
    }
    // Caso 2: Formato YYYY-MM-DD HH:MM o ISO
    else {
      date = new Date(dateString);
    }
    
    // Verificar si la fecha es válida
    if (isNaN(date.getTime())) {
      console.warn('Fecha inválida:', dateString);
      // ⭐ DEVOLVER LA FECHA ORIGINAL en lugar de lanzar error
      return dateString;
    }
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch (e) {
    console.error('❌ Error formateando fecha:', dateString, e);
    // ⭐ DEVOLVER LA FECHA ORIGINAL en lugar de null
    return dateString;
  }
}
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.get('/api/contacts', (req, res) => {
  try {
    const result = db.exec('SELECT * FROM contacts ORDER BY created_at DESC');
    res.json(rowsToObjects(result));
  } catch (error) {
    console.error('Error obteniendo contactos:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/contacts/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.exec('SELECT * FROM contacts WHERE id = ?', [id]);
    const row = rowToObject(result);
    if (!row) {
      return res.status(404).json({ error: 'Contacto no encontrado' });
    }
    res.json(row);
  } catch (error) {
    console.error('Error obteniendo contacto:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/contacts', (req, res) => {
  try {
    const id = randomUUID();
    db.run(`
      INSERT INTO contacts (
        id, first_name, last_name, email, phone, organization, title, gartner_role,
        contact_type, tier, linkedin_url, pa_name, pa_email, pa_phone, webinar_role,
        contacted, last_contact_date, interested, webinars_subscribed, notes, csm_name, csm_email, ep_name, ep_email, last_email_check, ai_initiatives, photo_url,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `, [
      id, 
      req.body.first_name, 
      req.body.last_name, 
      req.body.email, 
      req.body.phone || null,
      req.body.organization, 
      req.body.title, 
      req.body.gartner_role,
      req.body.contact_type, 
      req.body.tier || null, 
      req.body.linkedin_url || null,
      req.body.pa_name || null, 
      req.body.pa_email || null, 
      req.body.pa_phone || null, 
      req.body.webinar_role || null,
      req.body.contacted ? 1 : 0, 
      req.body.last_contact_date || null,
      req.body.interested ? 1 : 0, 
      req.body.webinars_subscribed ? 1 : 0,
      req.body.notes || null, 
      req.body.csm_name || null, 
      req.body.csm_email || null, 
      req.body.ep_name || null, 
      req.body.ep_email || null, 
      req.body.last_email_check || null,
      req.body.ai_initiatives || null,
      req.body.photo_url || null
    ]);
    saveDB();
    const result = db.exec('SELECT * FROM contacts WHERE id = ?', [id]);
    res.status(201).json(rowToObject(result));
  } catch (error) {
    console.error('Error creando contacto:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/contacts/:id', (req, res) => {
  try {
    db.run(`
      UPDATE contacts SET
        first_name = ?, last_name = ?, email = ?, phone = ?, organization = ?, title = ?, gartner_role = ?,
        contact_type = ?, tier = ?, linkedin_url = ?, pa_name = ?, pa_email = ?, pa_phone = ?, webinar_role = ?,
        contacted = ?, last_contact_date = ?, interested = ?, webinars_subscribed = ?,
        csm_name = ?, csm_email = ?, ep_name = ?, ep_email = ?, last_email_check = ?, notes = ?, ai_initiatives = ?, photo_url = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
        req.body.first_name, 
        req.body.last_name, 
        req.body.email, 
        req.body.phone || null,
        req.body.organization, 
        req.body.title, 
        req.body.gartner_role,
        req.body.contact_type, 
        req.body.tier || null, 
        req.body.linkedin_url || null,
        req.body.pa_name || null, 
        req.body.pa_email || null, 
        req.body.pa_phone || null, 
        req.body.webinar_role || null,
        req.body.contacted ? 1 : 0, 
        req.body.last_contact_date || null,
        req.body.interested ? 1 : 0, 
        req.body.webinars_subscribed ? 1 : 0,
        req.body.csm_name || null, 
        req.body.csm_email || null, 
        req.body.ep_name || null, 
        req.body.ep_email || null, 
        req.body.last_email_check || null,
        req.body.notes || null,
        req.body.ai_initiatives || null,
        req.body.photo_url || null,
        req.params.id
    ]);
    saveDB();
    const result = db.exec('SELECT * FROM contacts WHERE id = ?', [req.params.id]);
    const row = rowToObject(result);
    if (!row) {
      return res.status(404).json({ error: 'Contacto no encontrado' });
    }
    res.json(row);
  } catch (error) {
    console.error('Error actualizando contacto:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/contacts/:id', (req, res) => {
  try {
    db.run('DELETE FROM contacts WHERE id = ?', [req.params.id]);
    saveDB();
    res.json({ success: true, id: req.params.id });
  } catch (error) {
    console.error('Error eliminando contacto:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/contacts/search/:query', (req, res) => {
  try {
    const { query } = req.params;
    const likeQuery = `%${query}%`;
    const result = db.exec(`
      SELECT * FROM contacts 
      WHERE first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR organization LIKE ?
      ORDER BY created_at DESC
    `, [likeQuery, likeQuery, likeQuery, likeQuery]);
    res.json(rowsToObjects(result));
  } catch (error) {
    console.error('Error buscando contactos:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para subir foto de contacto
app.post('/api/contacts/:id/photo', uploadContactPhoto.single('photo'), async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó archivo' });
    }

    console.log('📸 Subiendo foto de contacto...');
    console.log('   Contact ID:', id);
    console.log('   Archivo:', req.file.filename);
    console.log('   Tamaño:', req.file.size, 'bytes');

    const photoUrl = `/contact-photos/${req.file.filename}`;
    
    // Actualizar el contacto con la nueva URL de foto
    db.run('UPDATE contacts SET photo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [photoUrl, id]);
    saveDB();
    
    res.json({
      success: true,
      photo_url: photoUrl,
      filename: req.file.filename
    });
  } catch (error) {
    console.error('❌ Error subiendo foto:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para subir foto desde base64 (para pegar desde clipboard)
app.post('/api/contacts/:id/photo-base64', async (req, res) => {
  try {
    const { id } = req.params;
    const { base64Data } = req.body;
    
    if (!base64Data) {
      return res.status(400).json({ error: 'No se proporcionó imagen' });
    }

    console.log('📸 Guardando foto de contacto desde base64...');
    console.log('   Contact ID:', id);

    // Obtener foto antigua para eliminarla
    const result = db.exec('SELECT photo_url FROM contacts WHERE id = ?', [id]);
    const currentContact = rowToObject(result);
    
    if (currentContact && currentContact.photo_url) {
      const oldFilename = currentContact.photo_url.split('/').pop();
      const oldFilepath = path.join(contactPhotosDir, oldFilename);
      
      if (fs.existsSync(oldFilepath)) {
        fs.unlinkSync(oldFilepath);
        console.log('   🗑️ Foto antigua eliminada:', oldFilename);
      }
    }

    // Extraer el tipo de imagen y los datos
    const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: 'Formato de imagen inválido' });
    }

    const imageType = matches[1];
    const imageData = matches[2];
    const buffer = Buffer.from(imageData, 'base64');
    
    // Generar nombre único
    const filename = `${id}-${Date.now()}.${imageType}`;
    const filepath = path.join(contactPhotosDir, filename);
    
    // Guardar archivo
    fs.writeFileSync(filepath, buffer);
    
    console.log('   ✅ Archivo guardado:', filename);
    console.log('   📏 Tamaño:', buffer.length, 'bytes');

    const photoUrl = `/contact-photos/${filename}`;
    
    // Actualizar el contacto con la nueva URL de foto
    db.run('UPDATE contacts SET photo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [photoUrl, id]);
    saveDB();
    
    console.log('   💾 Base de datos actualizada con photo_url:', photoUrl);
    
    // Verificar que se guardó correctamente
    const verifyResult = db.exec('SELECT photo_url FROM contacts WHERE id = ?', [id]);
    const verifiedContact = rowToObject(verifyResult);
    console.log('   🔍 Verificación - photo_url en BD:', verifiedContact?.photo_url);
    
    res.json({
      success: true,
      photo_url: photoUrl,
      filename: filename
    });
  } catch (error) {
    console.error('❌ Error guardando foto:', error);
    res.status(500).json({ error: error.message });
  }
});

// Servir fotos de contactos
app.use('/contact-photos', express.static(contactPhotosDir));

// Eliminar foto de contacto
app.delete('/api/contacts/:id/photo', (req, res) => {
  try {
    const { id } = req.params;
    
    // Obtener la URL actual de la foto
    const result = db.exec('SELECT photo_url FROM contacts WHERE id = ?', [id]);
    const row = rowToObject(result);
    
    if (row && row.photo_url) {
      const filename = row.photo_url.split('/').pop();
      const filepath = path.join(contactPhotosDir, filename);
      
      // Eliminar archivo si existe
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        console.log('🗑️ Foto eliminada:', filename);
      }
    }
    
    // Actualizar contacto para quitar la URL
    db.run('UPDATE contacts SET photo_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    saveDB();
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error eliminando foto:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/templates', (req, res) => {
  try {
    const result = db.exec('SELECT * FROM campaign_templates');
    const rows = rowsToObjects(result);
    
    rows.forEach(row => {
      row.email_1_attachments = parseJSONField(row.email_1_attachments);
      row.email_2_attachments = parseJSONField(row.email_2_attachments);
      row.email_3_attachments = parseJSONField(row.email_3_attachments);
      row.email_4_attachments = parseJSONField(row.email_4_attachments);
      row.email_5_attachments = parseJSONField(row.email_5_attachments);
      row.attachments = parseJSONField(row.attachments);
      
      // Formatear fechas a solo día
      if (row.created_at) {
        row.created_at = new Date(row.created_at).toLocaleDateString('en-CA'); // YYYY-MM-DD
      }
      if (row.updated_at) {
        row.updated_at = new Date(row.updated_at).toLocaleDateString('en-CA');
      }
    });
    
    res.json(rows);
  } catch (error) {
    console.error('Error obteniendo templates:', error);
    res.status(500).json({ error: error.message });
  }
});


app.get('/api/templates/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.exec('SELECT * FROM campaign_templates WHERE id = ?', [id]);
    const row = rowToObject(result);
    if (!row) return res.status(404).json({ error: 'Template no encontrado' });
    
    row.email_1_attachments = parseJSONField(row.email_1_attachments);
    row.email_2_attachments = parseJSONField(row.email_2_attachments);
    row.email_3_attachments = parseJSONField(row.email_3_attachments);
    row.email_4_attachments = parseJSONField(row.email_4_attachments);
    row.email_5_attachments = parseJSONField(row.email_5_attachments);
    row.attachments = parseJSONField(row.attachments);
    
    // Formatear fechas a solo día
    if (row.created_at) {
      row.created_at = new Date(row.created_at).toLocaleDateString('en-CA');
    }
    if (row.updated_at) {
      row.updated_at = new Date(row.updated_at).toLocaleDateString('en-CA');
    }
    
    res.json(row);
  } catch (error) {
    console.error('Error obteniendo template:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/templates', (req, res) => {
  try {
    const id = randomUUID();
    const {
      name, gartner_role,
      email_1_subject, email_1_html, email_1_attachments,
      email_2_subject, email_2_html, email_2_attachments,
      email_3_subject, email_3_html, email_3_attachments,
      email_4_subject, email_4_html, email_4_attachments,
      email_5_subject, email_5_html, email_5_attachments,
      attachments
    } = req.body;

    db.run(`
      INSERT INTO campaign_templates (
        id, name, gartner_role,
        email_1_subject, email_1_html, email_1_attachments,
        email_2_subject, email_2_html, email_2_attachments,
        email_3_subject, email_3_html, email_3_attachments,
        email_4_subject, email_4_html, email_4_attachments,
        email_5_subject, email_5_html, email_5_attachments,
        attachments
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, name, gartner_role,
      email_1_subject, email_1_html, JSON.stringify(email_1_attachments || []),
      email_2_subject, email_2_html, JSON.stringify(email_2_attachments || []),
      email_3_subject, email_3_html, JSON.stringify(email_3_attachments || []),
      email_4_subject, email_4_html, JSON.stringify(email_4_attachments || []),
      email_5_subject, email_5_html, JSON.stringify(email_5_attachments || []),
      JSON.stringify(attachments || [])
    ]);
    saveDB();
    const result = db.exec('SELECT * FROM campaign_templates WHERE id = ?', [id]);
    const row = rowToObject(result);
    
    row.email_1_attachments = parseJSONField(row.email_1_attachments);
    row.email_2_attachments = parseJSONField(row.email_2_attachments);
    row.email_3_attachments = parseJSONField(row.email_3_attachments);
    row.email_4_attachments = parseJSONField(row.email_4_attachments);
    row.email_5_attachments = parseJSONField(row.email_5_attachments);
    row.attachments = parseJSONField(row.attachments);
    
    res.status(201).json(row);
  } catch (error) {
    console.error('Error creando template:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/templates/:id', (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, gartner_role,
      email_1_subject, email_1_html, email_1_attachments,
      email_2_subject, email_2_html, email_2_attachments,
      email_3_subject, email_3_html, email_3_attachments,
      email_4_subject, email_4_html, email_4_attachments,
      email_5_subject, email_5_html, email_5_attachments,
      attachments
    } = req.body;

    db.run(`
      UPDATE campaign_templates SET
        name = ?, gartner_role = ?,
        email_1_subject = ?, email_1_html = ?, email_1_attachments = ?,
        email_2_subject = ?, email_2_html = ?, email_2_attachments = ?,
        email_3_subject = ?, email_3_html = ?, email_3_attachments = ?,
        email_4_subject = ?, email_4_html = ?, email_4_attachments = ?,
        email_5_subject = ?, email_5_html = ?, email_5_attachments = ?,
        attachments = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      name, gartner_role,
      email_1_subject, email_1_html, JSON.stringify(email_1_attachments || []),
      email_2_subject, email_2_html, JSON.stringify(email_2_attachments || []),
      email_3_subject, email_3_html, JSON.stringify(email_3_attachments || []),
      email_4_subject, email_4_html, JSON.stringify(email_4_attachments || []),
      email_5_subject, email_5_html, JSON.stringify(email_5_attachments || []),
      JSON.stringify(attachments || []),
      id
    ]);
    saveDB();
    const result = db.exec('SELECT * FROM campaign_templates WHERE id = ?', [id]);
    const row = rowToObject(result);
    if (!row) {
      return res.status(404).json({ error: 'Template no encontrado' });
    }
    
    row.email_1_attachments = parseJSONField(row.email_1_attachments);
    row.email_2_attachments = parseJSONField(row.email_2_attachments);
    row.email_3_attachments = parseJSONField(row.email_3_attachments);
    row.email_4_attachments = parseJSONField(row.email_4_attachments);
    row.email_5_attachments = parseJSONField(row.email_5_attachments);
    row.attachments = parseJSONField(row.attachments);
    
    res.json(row);
  } catch (error) {
    console.error('Error actualizando template:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/templates/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.run('DELETE FROM campaign_templates WHERE id = ?', [id]);
    saveDB();
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error eliminando template:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/campaigns', (req, res) => {
  try {
  
    const result = db.exec(`
      SELECT 
        c.*,
        ct.first_name, ct.last_name, ct.email, ct.organization, 
        ct.gartner_role, ct.title, ct.contact_type,
        t.name as template_name
      FROM campaigns c
      LEFT JOIN contacts ct ON c.contact_id = ct.id
      LEFT JOIN campaign_templates t ON c.template_id = t.id
    `);

    const rows = rowsToObjects(result);
    
    const campaigns = rows.map(row => ({
      id: row.id,
      contact_id: row.contact_id,
      template_id: row.template_id,
      campaign_name: row.campaign_name,
      start_campaign: Boolean(row.start_campaign),
      email_1_date: row.email_1_date,
      email_2_date: row.email_2_date,
      email_3_date: row.email_3_date,
      email_4_date: row.email_4_date,
      email_5_date: row.email_5_date,
      status: row.status,
      response_date: row.response_date,
      response_text: row.response_text,
      emails_sent: row.emails_sent || 0,
      has_replied: Boolean(row.has_replied),
      last_reply_date: formatDateTime(row.last_reply_date),
      email_incorrect: Boolean(row.email_incorrect),
      created_at: formatDateTime(row.created_at),
      updated_at: formatDateTime(row.updated_at),
      contacts: {
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        organization: row.organization,
        gartner_role: row.gartner_role,
        title: row.title,
        contact_type: row.contact_type
      },
      campaign_templates: {
        name: row.template_name
      }
    }));

    res.json(campaigns);
  } catch (error) {
    console.error('❌ Error obteniendo campaigns:', error);
    res.status(500).json({ error: error.message });
  }
});
app.get('/api/campaigns/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.exec(`
      SELECT 
        c.*,
        ct.first_name, ct.last_name, ct.email, ct.organization, 
        ct.gartner_role, ct.title, ct.contact_type,
        t.name as template_name
      FROM campaigns c
      LEFT JOIN contacts ct ON c.contact_id = ct.id
      LEFT JOIN campaign_templates t ON c.template_id = t.id
      WHERE c.id = ?
    `, [id]);

    const row = rowToObject(result);
    if (!row) {
      return res.status(404).json({ error: 'Campaign no encontrada' });
    }

    const campaign = {
      id: row.id,
      contact_id: row.contact_id,
      template_id: row.template_id,
      campaign_name: row.campaign_name,
      start_campaign: Boolean(row.start_campaign),
      email_1_date: row.email_1_date,
      email_2_date: row.email_2_date,
      email_3_date: row.email_3_date,
      email_4_date: row.email_4_date,
      email_5_date: row.email_5_date,
      status: row.status,
      response_date: row.response_date,
      response_text: row.response_text,
      emails_sent: row.emails_sent || 0,
      has_replied: Boolean(row.has_replied),
      last_reply_date: formatDateTime(row.last_reply_date),
      email_incorrect: Boolean(row.email_incorrect),
      created_at: row.created_at ? row.created_at.split(' ')[0] : null,
      updated_at: row.updated_at ? row.updated_at.split(' ')[0] : null,
      contacts: {
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        organization: row.organization,
        gartner_role: row.gartner_role,
        title: row.title,
        contact_type: row.contact_type
      },
      campaign_templates: {
        name: row.template_name
      }
    };

    res.json(campaign);
  } catch (error) {
    console.error('Error obteniendo campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/campaigns', (req, res) => {
  try {
    console.log('📝 Creando nueva campaña...');
    console.log('Body recibido:', JSON.stringify(req.body, null, 2));
    
    const id = randomUUID();
    const {
      contact_id, template_id, campaign_name, start_campaign,
      email_1_date, email_2_date, email_3_date, email_4_date, email_5_date,
      status, response_date, response_text, emails_sent, has_replied, last_reply_date
    } = req.body;

    // Validaciones
    if (!contact_id) {
      return res.status(400).json({ error: 'contact_id es requerido' });
    }

    console.log('Insertando en base de datos...');
    console.log('Valores:', {
      id,
      contact_id,
      template_id,
      campaign_name,
      start_campaign: start_campaign ? 1 : 0,
      email_1_date,
      email_2_date,
      email_3_date,
      email_4_date,
      email_5_date,
      status: status ?? 'pending',
      emails_sent: emails_sent ?? 0
    });

    try {
      db.run(`
        INSERT INTO campaigns (
          id, contact_id, template_id, campaign_name, start_campaign,
          email_1_date, email_2_date, email_3_date, email_4_date, email_5_date,
          status, response_date, response_text, emails_sent, has_replied, 
          last_reply_date, email_incorrect, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `, [
        id, 
        contact_id, 
        template_id, 
        campaign_name || null, 
        start_campaign ? 1 : 0,
        email_1_date || null, 
        email_2_date || null, 
        email_3_date || null, 
        email_4_date || null, 
        email_5_date || null,
        status || 'pending', 
        response_date || null, 
        response_text || null, 
        emails_sent || 0,
        has_replied ? 1 : 0, 
        last_reply_date || null,
        0 // email_incorrect por defecto
      ]);
      
      console.log('✅ INSERT ejecutado correctamente');
    } catch (insertError) {
      console.error('❌ Error en INSERT:', insertError);
      throw new Error(`Error en INSERT: ${insertError.message}`);
    }

    saveDB();
    console.log('💾 Base de datos guardada');
    
    console.log('🔍 Recuperando campaña creada...');
    const result = db.exec(`
      SELECT 
        c.*,
        ct.first_name, ct.last_name, ct.email, ct.organization, 
        ct.gartner_role, ct.title, ct.contact_type,
        t.name as template_name
      FROM campaigns c
      LEFT JOIN contacts ct ON c.contact_id = ct.id
      LEFT JOIN campaign_templates t ON c.template_id = t.id
      WHERE c.id = ?
    `, [id]);
    
    if (!result[0] || result[0].values.length === 0) {
      console.error('❌ Campaña no encontrada después de crear');
      return res.status(500).json({ error: 'Campaña creada pero no se pudo recuperar' });
    }
    
    const row = rowToObject(result);
    console.log('✅ Campaña recuperada:', row);
    
    const campaign = {
      id: row.id,
      contact_id: row.contact_id,
      template_id: row.template_id,
      campaign_name: row.campaign_name,
      start_campaign: Boolean(row.start_campaign),
      email_1_date: row.email_1_date,
      email_2_date: row.email_2_date,
      email_3_date: row.email_3_date,
      email_4_date: row.email_4_date,
      email_5_date: row.email_5_date,
      status: row.status,
      response_date: row.response_date,
      response_text: row.response_text,
      emails_sent: row.emails_sent || 0,
      has_replied: Boolean(row.has_replied),
      last_reply_date: formatDateTime(row.last_reply_date),
      email_incorrect: Boolean(row.email_incorrect),
      created_at: row.created_at ? row.created_at.split(' ')[0] : null,
      updated_at: row.updated_at ? row.updated_at.split(' ')[0] : null,
      contacts: {
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        organization: row.organization,
        gartner_role: row.gartner_role,
        title: row.title,
        contact_type: row.contact_type
      },
      campaign_templates: {
        name: row.template_name
      }
    };
    
    console.log('✅ Campaña formateada y lista para enviar');
    res.status(201).json(campaign);
    
  } catch (error) {
    console.error('💥 Error creando campaign:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      error: error.message,
      details: error.stack
    });
  }
});
app.put('/api/campaigns/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar que la campaña existe
    const existing = db.exec('SELECT id FROM campaigns WHERE id = ?', [id]);
    if (!existing[0] || existing[0].values.length === 0) {
      return res.status(404).json({ error: 'Campaign no encontrada' });
    }

    const {
      contact_id, template_id, campaign_name, start_campaign,
      email_1_date, email_2_date, email_3_date, email_4_date, email_5_date,
      status, response_date, response_text, emails_sent, has_replied, 
      last_reply_date, email_incorrect
    } = req.body;

    // Construir la query dinámicamente solo con los campos presentes
    const fields = [];
    const values = [];

    if (contact_id !== undefined) { fields.push('contact_id = ?'); values.push(contact_id); }
    if (template_id !== undefined) { fields.push('template_id = ?'); values.push(template_id); }
    if (campaign_name !== undefined) { fields.push('campaign_name = ?'); values.push(campaign_name); }
    if (start_campaign !== undefined) { fields.push('start_campaign = ?'); values.push(start_campaign ? 1 : 0); }
    if (email_1_date !== undefined) { fields.push('email_1_date = ?'); values.push(email_1_date); }
    if (email_2_date !== undefined) { fields.push('email_2_date = ?'); values.push(email_2_date); }
    if (email_3_date !== undefined) { fields.push('email_3_date = ?'); values.push(email_3_date); }
    if (email_4_date !== undefined) { fields.push('email_4_date = ?'); values.push(email_4_date); }
    if (email_5_date !== undefined) { fields.push('email_5_date = ?'); values.push(email_5_date); }
    if (status !== undefined) { fields.push('status = ?'); values.push(status); }
    if (response_date !== undefined) { fields.push('response_date = ?'); values.push(response_date); }
    if (response_text !== undefined) { fields.push('response_text = ?'); values.push(response_text); }
    if (emails_sent !== undefined) { fields.push('emails_sent = ?'); values.push(emails_sent); }
    if (has_replied !== undefined) { fields.push('has_replied = ?'); values.push(has_replied ? 1 : 0); }
    if (last_reply_date !== undefined) { fields.push('last_reply_date = ?'); values.push(last_reply_date); }
    if (email_incorrect !== undefined) { fields.push('email_incorrect = ?'); values.push(email_incorrect ? 1 : 0); }

    fields.push('updated_at = CURRENT_TIMESTAMP');

    if (fields.length === 1) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    values.push(id);

    const query = `UPDATE campaigns SET ${fields.join(', ')} WHERE id = ?`;
    
    console.log('Query UPDATE:', query);
    console.log('Values:', values);

    db.run(query, values);
    saveDB();

    const result = db.exec(`
      SELECT 
        c.*,
        ct.first_name, ct.last_name, ct.email, ct.organization, 
        ct.gartner_role, ct.title, ct.contact_type,
        t.name as template_name
      FROM campaigns c
      LEFT JOIN contacts ct ON c.contact_id = ct.id
      LEFT JOIN campaign_templates t ON c.template_id = t.id
      WHERE c.id = ?
    `, [id]);

    if (!result[0] || result[0].values.length === 0) {
      return res.status(404).json({ error: 'Campaign no encontrada después de actualizar' });
    }

    const row = rowToObject(result);
    const campaign = {
      id: row.id,
      contact_id: row.contact_id,
      template_id: row.template_id,
      campaign_name: row.campaign_name,
      start_campaign: Boolean(row.start_campaign),
      email_1_date: row.email_1_date,
      email_2_date: row.email_2_date,
      email_3_date: row.email_3_date,
      email_4_date: row.email_4_date,
      email_5_date: row.email_5_date,
      status: row.status,
      response_date: row.response_date,
      response_text: row.response_text,
      emails_sent: row.emails_sent || 0,
      has_replied: Boolean(row.has_replied),
      last_reply_date: formatDateTime(row.last_reply_date),
      email_incorrect: Boolean(row.email_incorrect),
      created_at: row.created_at ? row.created_at.split(' ')[0] : null,
      updated_at: row.updated_at ? row.updated_at.split(' ')[0] : null,
      contacts: {
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        organization: row.organization,
        gartner_role: row.gartner_role,
        title: row.title,
        contact_type: row.contact_type
      },
      campaign_templates: {
        name: row.template_name
      }
    };

    res.json(campaign);
  } catch (error) {
    console.error('Error actualizando campaign:', error);
    res.status(500).json({ error: error.message });
  }
});
app.delete('/api/campaigns/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.run('DELETE FROM campaigns WHERE id = ?', [id]);
    saveDB();
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error eliminando campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/settings', (req, res) => {
  try {
    const result = db.exec('SELECT * FROM settings');
    const rows = rowsToObjects(result);
    
    rows.forEach(row => {
      row.value = parseJSONField(row.value, row.value);
    });
    
    res.json(rows);
  } catch (error) {
    console.error('Error obteniendo settings:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/settings/:key', (req, res) => {
  try {
    const { key } = req.params;
    const result = db.exec('SELECT * FROM settings WHERE key = ?', [key]);
    const row = rowToObject(result);
    if (!row) {
      return res.json(null);
    }
    
    row.value = parseJSONField(row.value, row.value);
    
    res.json(row);
  } catch (error) {
    console.error('Error obteniendo setting:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/settings', (req, res) => {
  try {
    const { key, value } = req.body;
    db.run(`
      INSERT INTO settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `, [key, JSON.stringify(value)]);
    saveDB();
    const result = db.exec('SELECT * FROM settings WHERE key = ?', [key]);
    const row = rowToObject(result);
    row.value = parseJSONField(row.value, row.value);
    res.json(row);
  } catch (error) {
    console.error('Error guardando setting:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/settings/:key', (req, res) => {
  try {
    const { key } = req.params;
    db.run('DELETE FROM settings WHERE key = ?', [key]);
    saveDB();
    res.json({ success: true, key });
  } catch (error) {
    console.error('Error eliminando setting:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/distributions', (req, res) => {
  try {
    const result = db.exec('SELECT * FROM webinar_distributions ORDER BY created_at DESC');
    const rows = rowsToObjects(result);
    
    rows.forEach(row => {
      row.webinar_table = parseJSONField(row.webinar_table);
    });
    
    res.json(rows);
  } catch (error) {
    console.error('Error obteniendo distributions:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/distributions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.exec('SELECT * FROM webinar_distributions WHERE id = ?', [id]);
    const row = rowToObject(result);
    if (!row) {
      return res.status(404).json({ error: 'Distribution no encontrada' });
    }
    
    row.webinar_table = parseJSONField(row.webinar_table);
    
    res.json(row);
  } catch (error) {
    console.error('Error obteniendo distribution:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/distributions', (req, res) => {
  try {
    const id = randomUUID();
    const {
      file_name, file_url, month, email_subject, email_html, webinar_table, sent, sent_at
    } = req.body;

    db.run(`
      INSERT INTO webinar_distributions (
        id, file_name, file_url, month, email_subject, email_html, webinar_table, sent, sent_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `, [
      id, file_name || '', file_url || '', month || '', email_subject || '', email_html || '',
      JSON.stringify(webinar_table || []), sent ? 1 : 0, sent_at || null
    ]);
    saveDB();
    const result = db.exec('SELECT * FROM webinar_distributions WHERE id = ?', [id]);
    const row = rowToObject(result);
    row.webinar_table = parseJSONField(row.webinar_table);
    res.status(201).json(row);
  } catch (error) {
    console.error('Error creando distribution:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/distributions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const {
      file_name, file_url, month, email_subject, email_html, webinar_table, sent, sent_at
    } = req.body;

    db.run(`
      UPDATE webinar_distributions SET
        file_name = ?, file_url = ?, month = ?, email_subject = ?,
        email_html = ?, webinar_table = ?, sent = ?, sent_at = ?
      WHERE id = ?
    `, [
      file_name, file_url, month, email_subject, email_html,
      JSON.stringify(webinar_table || []), sent, sent_at, id
    ]);
    saveDB();
    const result = db.exec('SELECT * FROM webinar_distributions WHERE id = ?', [id]);
    const row = rowToObject(result);
    if (!row) {
      return res.status(404).json({ error: 'Distribution no encontrada' });
    }
    row.webinar_table = parseJSONField(row.webinar_table);
    res.json(row);
  } catch (error) {
    console.error('Error actualizando distribution:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/distributions/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.run('DELETE FROM webinar_distributions WHERE id = ?', [id]);
    saveDB();
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error eliminando distribution:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/recommendations', (req, res) => {
  try {
    const result = db.exec('SELECT * FROM webinar_recommendations ORDER BY created_at DESC');
    res.json(rowsToObjects(result));
  } catch (error) {
    console.error('Error obteniendo recommendations:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/recommendations/distribution/:distributionId', (req, res) => {
  try {
    const { distributionId } = req.params;
    const result = db.exec(`
      SELECT * FROM webinar_recommendations
      WHERE distribution_id = ?
      ORDER BY created_at DESC
    `, [distributionId]);
    res.json(rowsToObjects(result));
  } catch (error) {
    console.error('Error obteniendo recommendations:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/recommendations', (req, res) => {
  try {
    const id = randomUUID();
    const {
      distribution_id, gartner_role, webinar_title, webinar_description, relevance_score
    } = req.body;

    db.run(`
      INSERT INTO webinar_recommendations (
        id, distribution_id, gartner_role, webinar_title, webinar_description, relevance_score,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `, [
      id, distribution_id, gartner_role, webinar_title, webinar_description, relevance_score
    ]);
    saveDB();
    const result = db.exec('SELECT * FROM webinar_recommendations WHERE id = ?', [id]);
    res.status(201).json(rowToObject(result));
  } catch (error) {
    console.error('Error creando recommendation:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/recommendations/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.run('DELETE FROM webinar_recommendations WHERE id = ?', [id]);
    saveDB();
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error eliminando recommendation:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  try {
    db.exec('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected', error: error.message });
  }
});

// Endpoint para exportar la base de datos
app.get('/api/export-database', (req, res) => {
  try {
    console.log('📤 Exportando base de datos...');
    
    const data = db.export();
    const buffer = Buffer.from(data);
    
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="crm_backup.db"');
    res.send(buffer);
    
    console.log('✅ Base de datos exportada correctamente');
  } catch (error) {
    console.error('❌ Error exportando base de datos:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para importar la base de datos
app.post('/api/import-database', upload.single('database'), async (req, res) => {
  try {
    console.log('📥 Importando base de datos...');
    
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    }

    console.log('📁 Archivo recibido:', req.file.originalname);
    console.log('📏 Tamaño:', req.file.size, 'bytes');

    // Leer el archivo subido
    const uploadedData = fs.readFileSync(req.file.path);
    
    // Crear una nueva instancia de la base de datos con los datos importados
    const SQL = await initSqlJs();
    const newDb = new SQL.Database(uploadedData);
    
    // Verificar que la base de datos es válida haciendo una query simple
    try {
      newDb.exec('SELECT name FROM sqlite_master WHERE type="table"');
      console.log('✅ Base de datos válida');
    } catch (e) {
      throw new Error('El archivo no es una base de datos SQLite válida');
    }
    
    // Reemplazar la base de datos actual
    db = newDb;
    
    // Guardar la nueva base de datos en disco
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
    
    // Eliminar el archivo temporal
    fs.unlinkSync(req.file.path);
    
    console.log('✅ Base de datos importada y guardada correctamente');
    
    res.json({ 
      success: true,
      message: 'Base de datos importada correctamente' 
    });
  } catch (error) {
    console.error('❌ Error importando base de datos:', error);
    
    // Limpiar archivo temporal si existe
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
    }
    
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para subir adjuntos
app.post('/api/upload-attachment', uploadAttachment.single('file'), (req, res) => {
  try {
    console.log('📤 Subiendo adjunto...');
    
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó archivo' });
    }

    console.log('✅ Archivo guardado:', req.file.filename);
    console.log('   Nombre original:', req.file.originalname);
    console.log('   Tamaño:', req.file.size, 'bytes');

    const fileUrl = `/attachments/${req.file.filename}`;
    
    res.json({
      success: true,
      name: req.file.originalname,
      url: fileUrl,
      filename: req.file.filename,
      size: req.file.size
    });
  } catch (error) {
    console.error('❌ Error subiendo archivo:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para servir archivos adjuntos
app.use('/attachments', express.static(attachmentsDir));

// Endpoint para eliminar adjunto (opcional pero útil)
app.delete('/api/attachment/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(attachmentsDir, filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('🗑️ Archivo eliminado:', filename);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Archivo no encontrado' });
    }
  } catch (error) {
    console.error('❌ Error eliminando archivo:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para migrar adjuntos antiguos (base64) a archivos
app.post('/api/migrate-attachments', async (req, res) => {
  try {
    console.log('🔄 Iniciando migración de adjuntos...');
    
    const result = db.exec('SELECT * FROM campaign_templates');
    const templates = rowsToObjects(result);
    
    let migratedCount = 0;
    
    for (const template of templates) {
      let updated = false;
      const updates = {};
      
      for (let i = 1; i <= 5; i++) {
        const attachmentField = `email_${i}_attachments`;
        const attachments = parseJSONField(template[attachmentField]);
        
        if (!attachments || attachments.length === 0) continue;
        
        const migratedAttachments = [];
        
        for (const attachment of attachments) {
          // Si tiene 'data' (base64), migrar
          if (attachment.data) {
            try {
              console.log(`   Migrando: ${attachment.name}`);
              
              // Extraer el base64 (quitar el prefijo data:...)
              const base64Data = attachment.data.includes(',') 
                ? attachment.data.split(',')[1] 
                : attachment.data;
              
              // Convertir base64 a buffer
              const buffer = Buffer.from(base64Data, 'base64');
              
              // Generar nombre único
              const filename = `${attachment.name}`;
              const filepath = path.join(attachmentsDir, filename);
              
              // Guardar archivo
              fs.writeFileSync(filepath, buffer);
              
              console.log(`   ✅ Guardado: ${filename} (${buffer.length} bytes)`);
              
              migratedAttachments.push({
                name: attachment.name,
                url: `/attachments/${filename}`,
                filename: filename,
                size: buffer.length
              });
              
              migratedCount++;
            } catch (error) {
              console.error(`   ❌ Error migrando ${attachment.name}:`, error);
              // Mantener el adjunto original si falla
              migratedAttachments.push(attachment);
            }
          } else if (attachment.url) {
            // Ya está migrado o es una URL válida
            migratedAttachments.push(attachment);
          }
        }
        
        if (migratedAttachments.length > 0) {
          updates[attachmentField] = JSON.stringify(migratedAttachments);
          updated = true;
        }
      }
      
      // Actualizar template si se migró algo
      if (updated) {
        const setClauses = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const values = Object.values(updates);
        
        db.run(
          `UPDATE campaign_templates SET ${setClauses}, updated_at = datetime('now') WHERE id = ?`,
          [...values, template.id]
        );
        
        console.log(`✅ Template "${template.name}" actualizado`);
      }
    }
    
    saveDB();
    
    console.log(`🎉 Migración completada: ${migratedCount} archivos migrados`);
    
    res.json({
      success: true,
      migratedCount,
      message: `${migratedCount} archivos migrados exitosamente`
    });
  } catch (error) {
    console.error('❌ Error en migración:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para subir PDF de webinar
app.post('/api/upload-webinar', uploadWebinar.single('file'), (req, res) => {
  try {
    console.log('📤 Subiendo PDF de webinar...');
    
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó archivo' });
    }

    console.log('✅ PDF guardado:', req.file.filename);
    console.log('   Nombre original:', req.file.originalname);
    console.log('   Tamaño:', req.file.size, 'bytes');

    const fileUrl = `/webinars/${req.file.filename}`;
    
    res.json({
      success: true,
      name: req.file.originalname,
      url: fileUrl,
      filename: req.file.filename,
      size: req.file.size
    });
  } catch (error) {
    console.error('❌ Error subiendo PDF:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para servir PDFs de webinars
app.use('/webinars', express.static(webinarsDir));

// Endpoint para listar PDFs disponibles en runtime/webinars
app.get('/api/webinars/list', (req, res) => {
  try {
    console.log('📋 Listando PDFs de webinars...');
    
    if (!fs.existsSync(webinarsDir)) {
      return res.json({ success: true, pdfs: [] });
    }

    const files = fs.readdirSync(webinarsDir);
    const pdfs = files.filter(f => f.toLowerCase().endsWith('.pdf'));
    
    const pdfDetails = pdfs.map(filename => {
      const filePath = path.join(webinarsDir, filename);
      const stats = fs.statSync(filePath);
      
      return {
        filename,
        originalName: filename.split('-').slice(1).join('-'), // Quitar timestamp
        url: `/webinars/${filename}`,
        size: stats.size,
        createdAt: stats.birthtime
      };
    });

    console.log(`✅ ${pdfDetails.length} PDFs encontrados`);
    
    res.json({
      success: true,
      pdfs: pdfDetails
    });
  } catch (error) {
    console.error('❌ Error listando PDFs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para eliminar PDF de webinar
app.delete('/api/webinars/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(webinarsDir, filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('🗑️ PDF eliminado:', filename);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Archivo no encontrado' });
    }
  } catch (error) {
    console.error('❌ Error eliminando PDF:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/opportunities', (req, res) => {
  try {
    const result = db.exec(`
      SELECT 
        o.*,
        c.first_name, c.last_name, c.organization, c.title
      FROM opportunities o
      LEFT JOIN contacts c ON o.contact_id = c.id
      ORDER BY o.created_at DESC
    `);
    const rows = rowsToObjects(result);
    
    const opportunities = rows.map(row => ({
      id: row.id,
      contact_id: row.contact_id,
      status: row.status,
      proposed_solution: row.proposed_solution,
      offer_presented: Boolean(row.offer_presented),
      qualification_initiatives: parseJSONField(row.qualification_initiatives),
      last_qualification_update: row.last_qualification_update,
      created_at: formatDateTime(row.created_at),
      updated_at: formatDateTime(row.updated_at),
      contact: {
        first_name: row.first_name,
        last_name: row.last_name,
        organization: row.organization,
        title: row.title
      }
    }));
    
    res.json(opportunities);
  } catch (error) {
    console.error('Error obteniendo opportunities:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/opportunities/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.exec(`
      SELECT 
        o.*,
        c.first_name, c.last_name, c.organization, c.title
      FROM opportunities o
      LEFT JOIN contacts c ON o.contact_id = c.id
      WHERE o.id = ?
    `, [id]);
    
    const row = rowToObject(result);
    if (!row) {
      return res.status(404).json({ error: 'Oportunidad no encontrada' });
    }
    
    const opportunity = {
      id: row.id,
      contact_id: row.contact_id,
      status: row.status,
      proposed_solution: row.proposed_solution,
      offer_presented: Boolean(row.offer_presented),
      qualification_initiatives: parseJSONField(row.qualification_initiatives),
      last_qualification_update: row.last_qualification_update,
      created_at: formatDateTime(row.created_at),
      updated_at: formatDateTime(row.updated_at),
      contact: {
        first_name: row.first_name,
        last_name: row.last_name,
        organization: row.organization,
        title: row.title
      }
    };
    
    res.json(opportunity);
  } catch (error) {
    console.error('Error obteniendo opportunity:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/opportunities', (req, res) => {
  try {
    const id = randomUUID();
    const { contact_id, status, proposed_solution, offer_presented, qualification_initiatives, last_qualification_update } = req.body;
    
    if (!contact_id) {
      return res.status(400).json({ error: 'contact_id es requerido' });
    }
    
    db.run(`
      INSERT INTO opportunities (
        id, contact_id, status, proposed_solution, offer_presented, qualification_initiatives, last_qualification_update,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `, [
      id, contact_id, status || 'open', proposed_solution || null, 
      offer_presented ? 1 : 0,
      qualification_initiatives ? JSON.stringify(qualification_initiatives) : null,
      last_qualification_update || null,
    ]);
    
    saveDB();
    
    const result = db.exec(`
      SELECT 
        o.*,
        c.first_name, c.last_name, c.organization, c.title
      FROM opportunities o
      LEFT JOIN contacts c ON o.contact_id = c.id
      WHERE o.id = ?
    `, [id]);
    
    const row = rowToObject(result);
    const opportunity = {
      id: row.id,
      contact_id: row.contact_id,
      status: row.status,
      proposed_solution: row.proposed_solution,
      offer_presented: Boolean(row.offer_presented),
      qualification_initiatives: parseJSONField(row.qualification_initiatives),
      last_qualification_update: row.last_qualification_update,
      created_at: formatDateTime(row.created_at),
      updated_at: formatDateTime(row.updated_at),
      contact: {
        first_name: row.first_name,
        last_name: row.last_name,
        organization: row.organization,
        title: row.title
      }
    };
    
    res.status(201).json(opportunity);
  } catch (error) {
    console.error('Error creando opportunity:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/opportunities/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { contact_id, status, proposed_solution, offer_presented, qualification_initiatives, last_qualification_update } = req.body;
    
    db.run(`
      UPDATE opportunities SET
        contact_id = ?, status = ?, proposed_solution = ?, 
        offer_presented = ?, qualification_initiatives = ?, last_qualification_update = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [contact_id, status, proposed_solution, offer_presented ? 1 : 0, 
      qualification_initiatives ? JSON.stringify(qualification_initiatives) : null,
      last_qualification_update || null,
      id]);
    
    saveDB();
    
    const result = db.exec(`
      SELECT 
        o.*,
        c.first_name, c.last_name, c.organization, c.title
      FROM opportunities o
      LEFT JOIN contacts c ON o.contact_id = c.id
      WHERE o.id = ?
    `, [id]);
    
    const row = rowToObject(result);
    if (!row) {
      return res.status(404).json({ error: 'Oportunidad no encontrada' });
    }
    
    const opportunity = {
      id: row.id,
      contact_id: row.contact_id,
      status: row.status,
      proposed_solution: row.proposed_solution,
      offer_presented: Boolean(row.offer_presented),
      qualification_initiatives: parseJSONField(row.qualification_initiatives),
      last_qualification_update: row.last_qualification_update,
      created_at: formatDateTime(row.created_at),
      updated_at: formatDateTime(row.updated_at),
      contact: {
        first_name: row.first_name,
        last_name: row.last_name,
        organization: row.organization,
        title: row.title
      }
    };
    
    res.json(opportunity);
  } catch (error) {
    console.error('Error actualizando opportunity:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/opportunities/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.run('DELETE FROM opportunities WHERE id = ?', [id]);
    saveDB();
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error eliminando opportunity:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET meetings by opportunity
app.get('/api/meetings/opportunity/:opportunityId', (req, res) => {
  try {
    const { opportunityId } = req.params;
    const result = db.exec(`
      SELECT 
        m.*,
        c.first_name, c.last_name, c.organization
      FROM meetings m
      LEFT JOIN contacts c ON m.contact_id = c.id
      WHERE m.opportunity_id = ?
      ORDER BY m.meeting_date DESC
    `, [opportunityId]);
    
    const rows = rowsToObjects(result);
    const meetings = rows.map(row => ({
      id: row.id,
      opportunity_id: row.opportunity_id,
      contact_id: row.contact_id,
      meeting_type: row.meeting_type,
      meeting_date: formatDateTime(row.meeting_date),
      feeling: row.feeling || '',
      notes: row.notes,
      created_at: formatDateTime(row.created_at),
      contact: row.contact_id ? {
        first_name: row.first_name,
        last_name: row.last_name,
        organization: row.organization
      } : null
    }));
    
    res.json(meetings);
  } catch (error) {
    console.error('Error obteniendo meetings:', error);
    res.status(500).json({ error: error.message });
  }
});

 // GET meetings sin oportunidad
// GET meetings sin oportunidad
app.get('/api/meetings/without-opportunity', (req, res) => {
  try {
    const result = db.exec(`
      SELECT 
        m.*,
        c.first_name, c.last_name, c.organization
      FROM meetings m
      LEFT JOIN contacts c ON m.contact_id = c.id
      WHERE m.opportunity_id IS NULL 
         OR m.opportunity_id = 'Sin oportunidad' 
         OR m.opportunity_id = 'none'
         OR m.opportunity_id = ''
      ORDER BY m.meeting_date DESC
    `);
    const rows = rowsToObjects(result);
    const meetings = rows.map(row => ({
      id: row.id,
      opportunity_id: row.opportunity_id,
      contact_id: row.contact_id,
      meeting_type: row.meeting_type,
      meeting_date: formatDateTime(row.meeting_date),
      feeling: row.feeling || '',
      notes: row.notes,
      created_at: formatDateTime(row.created_at),
      contact: row.contact_id ? {
        first_name: row.first_name,
        last_name: row.last_name,
        organization: row.organization
      } : null
    }));
    res.json(meetings);
  } catch (error) {
    console.error('Error obteniendo meetings sin oportunidad:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST create meeting
app.post('/api/meetings', (req, res) => {
  try {
    const id = randomUUID();
    const { opportunity_id, contact_id, meeting_type, meeting_date, feeling, notes } = req.body;
    
    if (!contact_id) {
      return res.status(400).json({ error: 'contact_id es requerido' });
    }
    if (!meeting_type) {
      return res.status(400).json({ error: 'meeting_type es requerido' });
    }
    if (!meeting_date) {
      return res.status(400).json({ error: 'meeting_date es requerido' });
    }
    
    // ⭐ CORRECCIÓN: Usar 'Sin oportunidad' si opportunity_id es null/undefined/vacío
    const finalOpportunityId = opportunity_id && opportunity_id !== 'none' && opportunity_id !== '' 
      ? opportunity_id 
      : 'Sin oportunidad';
    
    db.run(`
      INSERT INTO meetings (
        id, opportunity_id, contact_id, meeting_type, meeting_date, feeling, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `, [
      id, 
      finalOpportunityId,  // ⭐ Siempre tiene un valor válido
      contact_id, 
      meeting_type, 
      meeting_date, 
      feeling || '', 
      notes || null
    ]);
    
    saveDB();
    
    const result = db.exec(`
      SELECT 
        m.*,
        c.first_name, c.last_name, c.organization
      FROM meetings m
      LEFT JOIN contacts c ON m.contact_id = c.id
      WHERE m.id = ?
    `, [id]);
    const row = rowToObject(result);
    
    const meeting = {
      id: row.id,
      opportunity_id: row.opportunity_id,
      contact_id: row.contact_id,
      meeting_type: row.meeting_type,
      meeting_date: formatDateTime(row.meeting_date),
      feeling: row.feeling || '',
      notes: row.notes,
      created_at: formatDateTime(row.created_at),
      contact: row.contact_id ? {
        first_name: row.first_name,
        last_name: row.last_name,
        organization: row.organization
      } : null
    };
    
    res.status(201).json(meeting);
  } catch (error) {
    console.error('Error creando meeting:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT update meeting
app.put('/api/meetings/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const opportunity_id = req.body.opportunity_id;
    const contact_id = req.body.contact_id;
    const meeting_type = req.body.meeting_type;
    const meeting_date = req.body.meeting_date;
    const feeling = req.body.feeling || '';
    const notes = req.body.notes || null;
    
    if (!contact_id) {
      return res.status(400).json({ error: 'contact_id es requerido' });
    }
    if (!meeting_type) {
      return res.status(400).json({ error: 'meeting_type es requerido' });
    }
    if (!meeting_date) {
      return res.status(400).json({ error: 'meeting_date es requerido' });
    }
    
    // ⭐ CORRECCIÓN: Usar 'Sin oportunidad' si opportunity_id es null/undefined/vacío
    const finalOpportunityId = opportunity_id && opportunity_id !== 'none' && opportunity_id !== '' 
      ? opportunity_id 
      : 'Sin oportunidad';
    
    db.run(`
      UPDATE meetings SET
        opportunity_id = ?, contact_id = ?, meeting_type = ?, meeting_date = ?, feeling = ?, notes = ?
      WHERE id = ?
    `, [
      finalOpportunityId,  // ⭐ Siempre tiene un valor válido
      contact_id,
      meeting_type,
      meeting_date,
      feeling,
      notes,
      id
    ]);
    
    saveDB();
    
    const result = db.exec(`
      SELECT 
        m.*,
        c.first_name, c.last_name, c.organization
      FROM meetings m
      LEFT JOIN contacts c ON m.contact_id = c.id
      WHERE m.id = ?
    `, [id]);
    
    const row = rowToObject(result);
    if (!row) {
      return res.status(404).json({ error: 'Reunión no encontrada' });
    }
    
    const meeting = {
      id: row.id,
      opportunity_id: row.opportunity_id,
      contact_id: row.contact_id,
      meeting_type: row.meeting_type,
      meeting_date: formatDateTime(row.meeting_date),
      feeling: row.feeling || '',
      notes: row.notes,
      created_at: formatDateTime(row.created_at),
      contact: row.contact_id ? {
        first_name: row.first_name,
        last_name: row.last_name,
        organization: row.organization
      } : null
    };
    
    res.json(meeting);
  } catch (error) {
    console.error('Error actualizando meeting:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/meetings/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.run('DELETE FROM meetings WHERE id = ?', [id]);
    saveDB();
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error eliminando meeting:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET meetings by contact
app.get('/api/meetings/contact/:contactId', (req, res) => {
  try {
    const { contactId } = req.params;
    const result = db.exec(`
      SELECT 
        m.*,
        o.status as opportunity_status,
        o.proposed_solution
      FROM meetings m
      LEFT JOIN opportunities o ON m.opportunity_id = o.id
      WHERE m.contact_id = ?
      ORDER BY m.meeting_date DESC
    `, [contactId]);
    
    const rows = rowsToObjects(result);
    const meetings = rows.map(row => ({
      id: row.id,
      opportunity_id: row.opportunity_id,
      contact_id: row.contact_id,
      meeting_type: row.meeting_type,
      meeting_date: formatDateTime(row.meeting_date),
      feeling: row.feeling || '',
      notes: row.notes,
      created_at: formatDateTime(row.created_at),
      opportunity: {
        status: row.opportunity_status,
        proposed_solution: row.proposed_solution
      }
    }));
    
    // GET meeting individual
app.get('/api/meetings/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.exec(`
      SELECT 
        m.*,
        c.first_name, c.last_name, c.organization, c.email, c.title,
        o.status as opportunity_status,
        o.proposed_solution
      FROM meetings m
      LEFT JOIN contacts c ON m.contact_id = c.id
      LEFT JOIN opportunities o ON m.opportunity_id = o.id
      WHERE m.id = ?
    `, [id]);
    
    const row = rowToObject(result);
    if (!row) {
      return res.status(404).json({ error: 'Reunión no encontrada' });
    }
    
    const meeting = {
      id: row.id,
      opportunity_id: row.opportunity_id || null,
      contact_id: row.contact_id,
      meeting_type: row.meeting_type,
      meeting_date: row.meeting_date,
      feeling: row.feeling || '',
      notes: row.notes,
      created_at: formatDateTime(row.created_at),
    };
    
    // Solo agregar contact si existe
    if (row.contact_id && row.first_name) {
      meeting.contact = {
        id: row.contact_id,
        first_name: row.first_name,
        last_name: row.last_name,
        organization: row.organization,
        email: row.email,
        title: row.title
      };
    }
    
    // Solo agregar opportunity si existe
    if (row.opportunity_id && row.opportunity_status) {
      meeting.opportunity = {
        id: row.opportunity_id,
        status: row.opportunity_status,
        proposed_solution: row.proposed_solution
      };
    }
    
    res.json(meeting);
  } catch (error) {
    console.error('Error obteniendo meeting:', error);
    res.status(500).json({ error: error.message });
  }
});


    res.json(meetings);
  } catch (error) {
    console.error('Error obteniendo meetings por contacto:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== ACCOUNTS ====================
app.get('/api/accounts', (req, res) => {
  try {
    const result = db.exec('SELECT * FROM accounts ORDER BY created_at DESC');
    const rows = rowsToObjects(result);
    res.json(rows);
  } catch (error) {
    console.error('Error obteniendo accounts:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/accounts/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.exec('SELECT * FROM accounts WHERE id = ?', [id]);
    const row = rowToObject(result);
    if (!row) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }
    res.json(row);
  } catch (error) {
    console.error('Error obteniendo account:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/accounts', (req, res) => {
  try {
    const id = randomUUID();
    const { name, full_name, logo, sector, web_site, address, corporative_objectives, org_chart } = req.body;

    db.run(`
      INSERT INTO accounts (
        id, name, full_name, logo, sector, web_site, address, corporative_objectives, org_chart,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `, [
      id, 
      name || null, 
      full_name || null, 
      logo || null, 
      sector || null, 
      web_site || null, 
      address || null,
      corporative_objectives || null,
      org_chart || null
    ]);

    saveDB();
    const result = db.exec('SELECT * FROM accounts WHERE id = ?', [id]);
    res.status(201).json(rowToObject(result));
  } catch (error) {
    console.error('Error creando account:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/accounts/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, full_name, logo, sector, web_site, address, corporative_objectives, org_chart } = req.body;

    db.run(`
      UPDATE accounts SET
        name = ?, full_name = ?, logo = ?, sector = ?, web_site = ?, 
        address = ?, corporative_objectives = ?, org_chart = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `, [
      name || null,
      full_name || null,
      logo || null,
      sector || null,
      web_site || null,
      address || null,
      corporative_objectives || null,
      org_chart || null,
      id
    ]);

    saveDB();
    const result = db.exec('SELECT * FROM accounts WHERE id = ?', [id]);
    const row = rowToObject(result);
    if (!row) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }
    res.json(row);
  } catch (error) {
    console.error('Error actualizando account:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/accounts/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.run('DELETE FROM accounts WHERE id = ?', [id]);
    saveDB();
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error eliminando account:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para obtener contactos de una cuenta
app.get('/api/accounts/:id/contacts', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.exec(`
      SELECT * FROM contacts 
      WHERE organization = (SELECT name FROM accounts WHERE id = ?)
      ORDER BY first_name, last_name
    `, [id]);
    res.json(rowsToObjects(result));
  } catch (error) {
    console.error('Error obteniendo contactos de la cuenta:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para subir logo de cuenta desde base64
app.post('/api/accounts/:id/logo-base64', async (req, res) => {
  try {
    const { id } = req.params;
    const { base64Data } = req.body;
    
    if (!base64Data) {
      return res.status(400).json({ error: 'No se proporcionó imagen' });
    }

    console.log('📸 Guardando logo de cuenta desde base64...');
    console.log('   Account ID:', id);

    const result = db.exec('SELECT logo FROM accounts WHERE id = ?', [id]);
    const currentAccount = rowToObject(result);
    
    if (currentAccount && currentAccount.logo) {
      const oldFilename = currentAccount.logo.split('/').pop();
      const oldFilepath = path.join(contactPhotosDir, oldFilename);
      
      if (fs.existsSync(oldFilepath)) {
        fs.unlinkSync(oldFilepath);
        console.log('   🗑️ Logo antiguo eliminado:', oldFilename);
      }
    }

    const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: 'Formato de imagen inválido' });
    }

    const imageType = matches[1];
    const imageData = matches[2];
    const buffer = Buffer.from(imageData, 'base64');
    
    const filename = `account-${id}-${Date.now()}.${imageType}`;
    const filepath = path.join(contactPhotosDir, filename);
    
    fs.writeFileSync(filepath, buffer);
    
    console.log('   ✅ Archivo guardado:', filename);
    console.log('   📏 Tamaño:', buffer.length, 'bytes');

    const logoUrl = `/contact-photos/${filename}`;
    
    db.run('UPDATE accounts SET logo = ?, updated_at = datetime(\'now\') WHERE id = ?', [logoUrl, id]);
    saveDB();
    
    console.log('   💾 Base de datos actualizada con logo:', logoUrl);
    
    res.json({
      success: true,
      logo: logoUrl,
      filename: filename
    });
  } catch (error) {
    console.error('❌ Error guardando logo:', error);
    res.status(500).json({ error: error.message });
  }
});

// Eliminar logo de cuenta
app.delete('/api/accounts/:id/logo', (req, res) => {
  try {
    const { id } = req.params;
    
    const result = db.exec('SELECT logo FROM accounts WHERE id = ?', [id]);
    const row = rowToObject(result);
    
    if (row && row.logo) {
      const filename = row.logo.split('/').pop();
      const filepath = path.join(contactPhotosDir, filename);
      
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        console.log('🗑️ Logo eliminado:', filename);
      }
    }
    
    db.run('UPDATE accounts SET logo = NULL, updated_at = datetime(\'now\') WHERE id = ?', [id]);
    saveDB();
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error eliminando logo:', error);
    res.status(500).json({ error: error.message });
  }
});


const PORT = process.env.PORT || 3001;

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
  });
});