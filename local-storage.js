/**
 * Sistema de almacenamiento local
 * Gestiona archivos y carpetas en el sistema de archivos local
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');

// Rutas base
const BASE_DIR = path.join(__dirname, 'navegacion');
const CONFIG_DIR = path.join(__dirname, 'config_local');

// Mapeo de IDs especiales a rutas locales
const FOLDER_ID_MAP = {
  'imagenes_cargadas': path.join(CONFIG_DIR, 'imagenes_cargadas'),
  'jsones': path.join(CONFIG_DIR, 'jsones'),
  'html': path.join(CONFIG_DIR, 'html'),
  'capturas': path.join(CONFIG_DIR, 'capturas'),
  'root': BASE_DIR
};

/**
 * Convierte un folderId (nombre o path) a ruta absoluta
 */
function folderIdToPath(folderId, parentPath = BASE_DIR) {
  // Si es un ID especial, usar el mapeo
  if (FOLDER_ID_MAP[folderId]) {
    return FOLDER_ID_MAP[folderId];
  }
  
  // Si es una ruta absoluta, usarla directamente
  if (path.isAbsolute(folderId)) {
    return folderId;
  }
  
  // Si es un nombre de carpeta, construir la ruta desde el padre
  return path.join(parentPath, folderId);
}

/**
 * Convierte una ruta a un folderId (nombre de carpeta)
 */
function pathToFolderId(folderPath) {
  // Verificar si es una carpeta especial
  for (const [id, mappedPath] of Object.entries(FOLDER_ID_MAP)) {
    if (folderPath === mappedPath) {
      return id;
    }
  }
  
  // Para carpetas dinámicas, usar la ruta relativa desde BASE_DIR
  if (folderPath.startsWith(BASE_DIR)) {
    const relativePath = path.relative(BASE_DIR, folderPath);
    return relativePath || 'root';
  }
  
  // Para otras carpetas, usar la ruta completa
  return folderPath;
}

/**
 * Genera un ID único para archivos basado en su ruta
 */
function generateFileId(filePath) {
  return crypto.createHash('md5').update(filePath).digest('hex');
}

/**
 * Busca un archivo por ID recursivamente en el sistema de archivos
 */
async function findFileByIdRecursive(fileId, searchPath) {
  try {
    const items = await fs.readdir(searchPath, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(searchPath, item.name);
      
      if (item.isFile()) {
        const itemId = generateFileId(fullPath);
        // console.log(`🔍 Comparando: ${itemId} === ${fileId} (${item.name})`);
        if (itemId === fileId) {
          console.log(`✅ Archivo encontrado: ${fullPath}`);
          return fullPath;
        }
      } else if (item.isDirectory()) {
        // Buscar recursivamente en subdirectorios
        const found = await findFileByIdRecursive(fileId, fullPath);
        if (found) return found;
      }
    }
  } catch (error) {
    // Ignorar errores de permisos o carpetas que no existen
    console.log(`⚠️ Error buscando en ${searchPath}:`, error.message);
  }
  
  return null;
}

/**
 * Busca un archivo por ID en el sistema de archivos
 */
async function findFileById(fileId, searchPaths = null) {
  const paths = searchPaths || [
    ...Object.values(FOLDER_ID_MAP),
    BASE_DIR  // Agregar navegacion para buscar screenshots
  ];
  
  for (const basePath of paths) {
    const found = await findFileByIdRecursive(fileId, basePath);
    if (found) return found;
  }
  
  return null;
}

/**
 * Inicializa el sistema de almacenamiento local
 */
async function initializeLocalStorage() {
  try {
    await fs.mkdir(BASE_DIR, { recursive: true });
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    await fs.mkdir(path.join(CONFIG_DIR, 'imagenes_cargadas'), { recursive: true });
    await fs.mkdir(path.join(CONFIG_DIR, 'jsones'), { recursive: true });
    await fs.mkdir(path.join(CONFIG_DIR, 'html'), { recursive: true });
    await fs.mkdir(path.join(CONFIG_DIR, 'capturas'), { recursive: true });
    
    console.log('✅ Almacenamiento local inicializado');
  } catch (error) {
    console.error('❌ Error inicializando almacenamiento local:', error);
    throw error;
  }
}

/**
 * Sube un archivo al almacenamiento local
 */
async function uploadFileToLocal(folderId, fileName, buffer, mimeType) {
  try {
    console.log(`📤 uploadFileToLocal - folderId recibido: "${folderId}"`);
    const folderPath = folderIdToPath(folderId);
    console.log(`📂 Ruta calculada: "${folderPath}"`);
    
    // Verificar que la carpeta existe
    try {
      await fs.access(folderPath);
      console.log(`✅ Carpeta existe: ${folderPath}`);
    } catch {
      console.log(`❌ Carpeta NO existe: ${folderPath}`);
      throw new Error(`Carpeta no encontrada: ${folderId} (${folderPath})`);
    }
    
    const filePath = path.join(folderPath, fileName);
    await fs.writeFile(filePath, buffer);
    
    const stats = await fs.stat(filePath);
    const fileId = generateFileId(filePath);
    
    return {
      id: fileId,
      name: fileName,
      mimeType: mimeType,
      size: stats.size,
      createdTime: stats.birthtime.toISOString(),
      modifiedTime: stats.mtime.toISOString(),
      webViewLink: `/local-files/${fileId}`,
      webContentLink: `/local-files/${fileId}`
    };
  } catch (error) {
    console.error('Error subiendo archivo local:', error);
    throw error;
  }
}

/**
 * Lista archivos en una carpeta local
 */
async function listFilesInLocal(folderId, query = {}) {
  try {
    const folderPath = folderIdToPath(folderId);
    
    // Verificar que la carpeta existe
    try {
      await fs.access(folderPath);
    } catch {
      console.log(`Carpeta no encontrada: ${folderId} (${folderPath})`);
      return { files: [] };
    }
    
    const items = await fs.readdir(folderPath);
    const files = [];
    
    for (const item of items) {
      const itemPath = path.join(folderPath, item);
      const stats = await fs.stat(itemPath);
      
      if (stats.isFile()) {
        // Filtrar por nombre si se especifica
        if (query.name && !item.includes(query.name)) {
          continue;
        }
        
        // Detectar mimeType
        let mimeType = 'application/octet-stream';
        const ext = path.extname(item).toLowerCase();
        if (ext === '.json') mimeType = 'application/json';
        else if (ext === '.html') mimeType = 'text/html';
        else if (['.jpg', '.jpeg'].includes(ext)) mimeType = 'image/jpeg';
        else if (ext === '.png') mimeType = 'image/png';
        else if (ext === '.gif') mimeType = 'image/gif';
        
        // Filtrar por mimeType si se especifica
        if (query.mimeType && mimeType !== query.mimeType) {
          continue;
        }
        
        const fileId = generateFileId(itemPath);
        
        files.push({
          id: fileId,
          name: item,
          mimeType: mimeType,
          size: stats.size,
          createdTime: stats.birthtime.toISOString(),
          modifiedTime: stats.mtime.toISOString(),
          webViewLink: `file://${itemPath}`,
          webContentLink: `file://${itemPath}`
        });
      }
    }
    
    return { files };
  } catch (error) {
    console.error('Error listando archivos locales:', error);
    return { files: [] };
  }
}

/**
 * Lista carpetas en una carpeta padre
 */
async function listFoldersInLocal(parentId) {
  try {
    const parentPath = folderIdToPath(parentId);
    
    console.log(`📂 Listando carpetas en: ${parentPath} (parentId: ${parentId})`);
    
    // Verificar que la carpeta existe
    try {
      await fs.access(parentPath);
    } catch {
      console.log(`⚠️ Carpeta no encontrada: ${parentId} (${parentPath})`);
      return { folders: [] };
    }
    
    const items = await fs.readdir(parentPath, { withFileTypes: true });
    const folders = [];
    
    for (const item of items) {
      if (item.isDirectory()) {
        const folderPath = path.join(parentPath, item.name);
        const stats = await fs.stat(folderPath);
        
        // Usar la ruta relativa desde BASE_DIR como ID
        let folderId;
        if (parentPath === BASE_DIR) {
          // Si estamos en la raíz, solo el nombre
          folderId = item.name;
        } else {
          // Si estamos en una subcarpeta, construir la ruta relativa
          const parentRelative = path.relative(BASE_DIR, parentPath);
          folderId = path.join(parentRelative, item.name);
        }
        
        folders.push({
          id: folderId,
          name: item.name,
          mimeType: 'folder',
          createdTime: stats.birthtime.toISOString(),
          modifiedTime: stats.mtime.toISOString(),
          webViewLink: `file://${folderPath}`
        });
      }
    }
    
    console.log(`✅ Encontradas ${folders.length} carpetas`);
    return { folders };
  } catch (error) {
    console.error('Error listando carpetas locales:', error);
    return { folders: [] };
  }
}

/**
 * Crea una nueva carpeta
 */
async function createFolderInLocal(parentId, folderName) {
  try {
    const parentPath = folderIdToPath(parentId);
    const folderPath = path.join(parentPath, folderName);
    
    await fs.mkdir(folderPath, { recursive: true });
    
    const stats = await fs.stat(folderPath);
    
    // Calcular el ID como ruta relativa desde BASE_DIR
    let folderId;
    if (parentPath === BASE_DIR) {
      folderId = folderName;
    } else {
      const parentRelative = path.relative(BASE_DIR, parentPath);
      folderId = path.join(parentRelative, folderName);
    }
    
    return {
      id: folderId,
      name: folderName,
      mimeType: 'folder',
      createdTime: stats.birthtime.toISOString(),
      webViewLink: `file://${folderPath}`
    };
  } catch (error) {
    console.error('Error creando carpeta local:', error);
    throw error;
  }
}

/**
 * Lee un archivo del almacenamiento local
 */
async function readFileFromLocal(fileId) {
  try {
    const filePath = await findFileById(fileId);
    
    if (!filePath) {
      throw new Error(`Archivo no encontrado: ${fileId}`);
    }
    
    const data = await fs.readFile(filePath);
    const stats = await fs.stat(filePath);
    
    // Detectar mimeType
    let mimeType = 'application/octet-stream';
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.json') mimeType = 'application/json';
    else if (ext === '.html') mimeType = 'text/html';
    else if (['.jpg', '.jpeg'].includes(ext)) mimeType = 'image/jpeg';
    else if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.gif') mimeType = 'image/gif';
    
    return {
      data: data,
      metadata: {
        id: fileId,
        name: path.basename(filePath),
        mimeType: mimeType,
        size: stats.size,
        createdTime: stats.birthtime.toISOString()
      }
    };
  } catch (error) {
    console.error('Error leyendo archivo local:', error);
    throw error;
  }
}

/**
 * Elimina un archivo del almacenamiento local
 */
async function deleteFileFromLocal(fileId) {
  try {
    const filePath = await findFileById(fileId);
    
    if (!filePath) {
      throw new Error(`Archivo no encontrado: ${fileId}`);
    }
    
    await fs.unlink(filePath);
    
    return { success: true };
  } catch (error) {
    console.error('Error eliminando archivo local:', error);
    throw error;
  }
}

/**
 * Obtiene información de una carpeta
 */
async function getFolderInfo(folderId) {
  try {
    const folderPath = folderIdToPath(folderId);
    
    console.log(`📋 Obteniendo info de carpeta: ${folderId} -> ${folderPath}`);
    
    // Verificar que la carpeta existe
    try {
      await fs.access(folderPath);
    } catch {
      throw new Error(`Carpeta no encontrada: ${folderId} (${folderPath})`);
    }
    
    const stats = await fs.stat(folderPath);
    const folderName = path.basename(folderPath);
    
    // Obtener el padre
    const parentPath = path.dirname(folderPath);
    let parentId = null;
    
    // Si no es la raíz de navegacion, calcular el parentId
    if (folderPath !== BASE_DIR) {
      parentId = pathToFolderId(parentPath);
    }
    
    return {
      id: folderId,
      name: folderName,
      parents: parentId ? [parentId] : [],
      mimeType: 'folder',
      createdTime: stats.birthtime.toISOString()
    };
  } catch (error) {
    console.error('Error obteniendo info de carpeta:', error);
    throw error;
  }
}

module.exports = {
  initializeLocalStorage,
  uploadFileToLocal,
  listFilesInLocal,
  listFoldersInLocal,
  createFolderInLocal,
  readFileFromLocal,
  deleteFileFromLocal,
  getFolderInfo,
  BASE_DIR,
  CONFIG_DIR
};
