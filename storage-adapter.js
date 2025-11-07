/**
 * Adaptador de almacenamiento que unifica Google Drive y almacenamiento local
 * Proporciona una API única independiente del backend de almacenamiento
 */

const localStorageEnabled = process.env.CARPETAS_LOCALES === 'true' || true;

let storageBackend;

if (localStorageEnabled) {
  console.log('📁 Modo de almacenamiento: LOCAL');
  storageBackend = require('./local-storage');
} else {
  console.log('☁️  Modo de almacenamiento: GOOGLE DRIVE');
  storageBackend = null; // Se inicializará con Google Drive
}

/**
 * Inicializa el sistema de almacenamiento
 */
async function initializeStorage(driveClient = null) {
  if (localStorageEnabled) {
    return await storageBackend.initializeLocalStorage();
  } else {
    // Google Drive no requiere inicialización especial
    return driveClient;
  }
}

/**
 * Sube un archivo al almacenamiento
 */
async function uploadFile(folderId, fileName, buffer, mimeType, driveClient = null) {
  if (localStorageEnabled) {
    return await storageBackend.uploadFileToLocal(folderId, fileName, buffer, mimeType);
  } else {
    // Usar Google Drive
    if (!driveClient) {
      throw new Error("Google Drive client not initialized");
    }
    
    const fileMetadata = {
      name: fileName,
      parents: [folderId],
    };

    const media = {
      mimeType: mimeType,
      body: require('streamifier').createReadStream(buffer),
    };

    const response = await driveClient.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id, name, webViewLink, webContentLink",
    });

    return response.data;
  }
}

/**
 * Lista archivos en una carpeta
 */
async function listFiles(folderId, query = {}, driveClient = null) {
  if (localStorageEnabled) {
    return await storageBackend.listFilesInLocal(folderId, query);
  } else {
    // Usar Google Drive
    if (!driveClient) {
      throw new Error("Google Drive client not initialized");
    }
    
    let q = `'${folderId}' in parents and trashed=false`;
    
    if (query.name) {
      q += ` and name contains '${query.name}'`;
    }
    
    if (query.mimeType) {
      q += ` and mimeType='${query.mimeType}'`;
    }
    
    const response = await driveClient.files.list({
      q: q,
      fields: 'files(id, name, mimeType, createdTime, modifiedTime, size, webViewLink, webContentLink)',
      orderBy: 'createdTime desc'
    });
    
    return { files: response.data.files || [] };
  }
}

/**
 * Lista carpetas en una carpeta padre
 */
async function listFolders(parentId, driveClient = null) {
  if (localStorageEnabled) {
    return await storageBackend.listFoldersInLocal(parentId);
  } else {
    // Usar Google Drive
    if (!driveClient) {
      throw new Error("Google Drive client not initialized");
    }
    
    const response = await driveClient.files.list({
      q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name, mimeType, createdTime, webViewLink)',
      orderBy: 'name'
    });
    
    return { folders: response.data.files || [] };
  }
}

/**
 * Crea una nueva carpeta
 */
async function createFolder(parentId, folderName, driveClient = null) {
  if (localStorageEnabled) {
    return await storageBackend.createFolderInLocal(parentId, folderName);
  } else {
    // Usar Google Drive
    if (!driveClient) {
      throw new Error("Google Drive client not initialized");
    }
    
    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId]
    };
    
    const response = await driveClient.files.create({
      requestBody: fileMetadata,
      fields: 'id, name, mimeType, webViewLink'
    });
    
    return response.data;
  }
}

/**
 * Lee un archivo del almacenamiento
 */
async function readFile(fileId, driveClient = null) {
  if (localStorageEnabled) {
    return await storageBackend.readFileFromLocal(fileId);
  } else {
    // Usar Google Drive
    if (!driveClient) {
      throw new Error("Google Drive client not initialized");
    }
    
    const response = await driveClient.files.get({
      fileId: fileId,
      alt: 'media'
    }, { responseType: 'arraybuffer' });
    
    const metadata = await driveClient.files.get({
      fileId: fileId,
      fields: 'id, name, mimeType, size, createdTime'
    });
    
    return {
      data: Buffer.from(response.data),
      metadata: metadata.data
    };
  }
}

/**
 * Elimina un archivo del almacenamiento
 */
async function deleteFile(fileId, driveClient = null) {
  if (localStorageEnabled) {
    return await storageBackend.deleteFileFromLocal(fileId);
  } else {
    // Usar Google Drive
    if (!driveClient) {
      throw new Error("Google Drive client not initialized");
    }
    
    await driveClient.files.delete({
      fileId: fileId
    });
    
    return { success: true };
  }
}

/**
 * Obtiene información de una carpeta específica
 */
async function getFolderInfo(folderId, driveClient = null) {
  if (localStorageEnabled) {
    return await storageBackend.getFolderInfo(folderId);
  } else {
    // Usar Google Drive
    if (!driveClient) {
      throw new Error("Google Drive client not initialized");
    }
    
    const response = await driveClient.files.get({
      fileId: folderId,
      fields: 'id, name, parents, mimeType, createdTime'
    });
    
    return response.data;
  }
}

/**
 * Obtiene información sobre el modo de almacenamiento
 */
function getStorageInfo() {
  return {
    mode: localStorageEnabled ? 'local' : 'drive',
    enabled: localStorageEnabled,
    basePath: localStorageEnabled ? storageBackend.BASE_DIR : null,
    configPath: localStorageEnabled ? storageBackend.CONFIG_DIR : null
  };
}

module.exports = {
  initializeStorage,
  uploadFile,
  listFiles,
  listFolders,
  createFolder,
  readFile,
  deleteFile,
  getFolderInfo,
  getStorageInfo,
  isLocalMode: () => localStorageEnabled
};
