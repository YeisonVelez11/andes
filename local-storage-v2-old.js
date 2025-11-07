/**
 * Sistema de almacenamiento local sin metadata.json
 * Usa el sistema de archivos directamente
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');

// Rutas base
const BASE_DIR = path.join(__dirname, 'navegacion');
const CONFIG_DIR = path.join(__dirname, 'config_local');

// Mapeo de IDs de Google Drive a rutas locales
const FOLDER_ID_MAP = {
  // Carpetas de configuración (config_local)
  '1bbkECY_axw5IttYjgVpRLmi6-EF80fZz': path.join(CONFIG_DIR, 'imagenes_cargadas'),
  '1d40AKgKucYUY-CnSqcLd1v8uyXhElk33': path.join(CONFIG_DIR, 'jsones'),
  '1SWuk-zjLFg40weIaJ_oF3PbPgPDDTy49': path.join(CONFIG_DIR, 'html'),
  '1So5xiyo-X--XqPK3lh2zZJz7qYOJIGRR': path.join(CONFIG_DIR, 'capturas'),
  
  // Carpeta raíz de navegación
  '1norxhMEG62maIArwy-zjolxzPGsQoBzq': BASE_DIR
};

// Mapeo inverso: ruta -> ID
const PATH_TO_ID_MAP = {};
Object.keys(FOLDER_ID_MAP).forEach(id => {
  PATH_TO_ID_MAP[FOLDER_ID_MAP[id]] = id;
});

/**
 * Genera un ID único basado en la ruta del archivo/carpeta
 */
function generateIdFromPath(filePath) {
  return crypto.createHash('md5').update(filePath).digest('hex');
}

/**
 * Obtiene la ruta local de una carpeta dado su ID
 */
function getLocalPath(folderId) {
  // Si es un ID conocido, retornar la ruta mapeada
  if (FOLDER_ID_MAP[folderId]) {
    return FOLDER_ID_MAP[folderId];
  }
  
  // Si no, es un ID generado dinámicamente, buscar en navegacion
  // El ID es un hash MD5 de la ruta
  return null; // Se buscará dinámicamente
}

/**
 * Busca una carpeta por ID en el sistema de archivos
 */
async function findFolderById(folderId, searchPath = BASE_DIR) {
  // Verificar si es un ID conocido
  if (FOLDER_ID_MAP[folderId]) {
    return FOLDER_ID_MAP[folderId];
  }
  
  // Buscar recursivamente en navegacion
  try {
    const items = await fs.readdir(searchPath, { withFileTypes: true });
    
    for (const item of items) {
      if (item.isDirectory()) {
        const fullPath = path.join(searchPath, item.name);
        const itemId = generateIdFromPath(fullPath);
        
        if (itemId === folderId) {
          return fullPath;
        }
        
        // Buscar recursivamente
        const found = await findFolderById(folderId, fullPath);
        if (found) return found;
      }
    }
  } catch (error) {
    // Ignorar errores de permisos
  }
  
  return null;
}

/**
 * Busca un archivo por ID en el sistema de archivos
 */
async function findFileById(fileId, searchPath = null) {
  // Buscar en todas las carpetas conocidas
  const searchPaths = searchPath ? [searchPath] : [
    ...Object.values(FOLDER_ID_MAP),
  ];
  
  for (const basePath of searchPaths) {
    try {
      const items = await fs.readdir(basePath);
      
      for (const item of items) {
        const fullPath = path.join(basePath, item);
        const itemId = generateIdFromPath(fullPath);
        
        if (itemId === fileId) {
          return fullPath;
        }
      }
    } catch (error) {
      // Ignorar errores
    }
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
    let folderPath = FOLDER_ID_MAP[folderId];
    
    if (!folderPath) {
      folderPath = await findFolderById(folderId);
      if (!folderPath) {
        throw new Error(`Carpeta no encontrada: ${folderId}`);
      }
    }
    
    await fs.mkdir(folderPath, { recursive: true });
    
    const filePath = path.join(folderPath, fileName);
    await fs.writeFile(filePath, buffer);
    
    const stats = await fs.stat(filePath);
    const fileId = generateIdFromPath(filePath);
    
    return {
      id: fileId,
      name: fileName,
      mimeType: mimeType,
      size: stats.size,
      createdTime: stats.birthtime.toISOString(),
      modifiedTime: stats.mtime.toISOString(),
      webViewLink: `file://${filePath}`,
      webContentLink: `file://${filePath}`
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
    let folderPath = FOLDER_ID_MAP[folderId];
    
    if (!folderPath) {
      folderPath = await findFolderById(folderId);
      if (!folderPath) {
        return { files: [] };
      }
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
        
        const fileId = generateIdFromPath(itemPath);
        
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
    let parentPath = FOLDER_ID_MAP[parentId];
    
    if (!parentPath) {
      parentPath = await findFolderById(parentId);
      if (!parentPath) {
        return { folders: [] };
      }
    }
    
    const items = await fs.readdir(parentPath, { withFileTypes: true });
    const folders = [];
    
    for (const item of items) {
      if (item.isDirectory()) {
        const folderPath = path.join(parentPath, item.name);
        const stats = await fs.stat(folderPath);
        const folderId = generateIdFromPath(folderPath);
        
        folders.push({
          id: folderId,
          name: item.name,
          mimeType: 'application/vnd.google-apps.folder',
          createdTime: stats.birthtime.toISOString(),
          modifiedTime: stats.mtime.toISOString(),
          webViewLink: `file://${folderPath}`
        });
      }
    }
    
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
    let parentPath = FOLDER_ID_MAP[parentId];
    
    if (!parentPath) {
      parentPath = await findFolderById(parentId);
      if (!parentPath) {
        throw new Error(`Carpeta padre no encontrada: ${parentId}`);
      }
    }
    
    const folderPath = path.join(parentPath, folderName);
    await fs.mkdir(folderPath, { recursive: true });
    
    const stats = await fs.stat(folderPath);
    const folderId = generateIdFromPath(folderPath);
    
    return {
      id: folderId,
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
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
    let folderPath = FOLDER_ID_MAP[folderId];
    
    if (!folderPath) {
      folderPath = await findFolderById(folderId);
      if (!folderPath) {
        throw new Error(`Carpeta no encontrada: ${folderId}`);
      }
    }
    
    const stats = await fs.stat(folderPath);
    const folderName = path.basename(folderPath);
    
    // Obtener el ID del padre
    const parentPath = path.dirname(folderPath);
    let parentId = PATH_TO_ID_MAP[parentPath] || generateIdFromPath(parentPath);
    
    // Si es la raíz de navegacion, no tiene padre
    if (folderPath === BASE_DIR) {
      parentId = null;
    }
    
    return {
      id: folderId,
      name: folderName,
      parents: parentId ? [parentId] : [],
      mimeType: 'application/vnd.google-apps.folder',
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
