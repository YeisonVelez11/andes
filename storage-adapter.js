/**
 * Adaptador de almacenamiento local
 * Proporciona una API única para el almacenamiento en el sistema de archivos
 */

const storageBackend = require('./local-storage');

console.log('📁 Modo de almacenamiento: LOCAL');

/**
 * Inicializa el sistema de almacenamiento
 */
async function initializeStorage() {
  return await storageBackend.initializeLocalStorage();
}

/**
 * Sube un archivo al almacenamiento
 */
async function uploadFile(folderId, fileName, buffer, mimeType) {
  return await storageBackend.uploadFileToLocal(folderId, fileName, buffer, mimeType);
}

/**
 * Lista archivos en una carpeta
 */
async function listFiles(folderId, query = {}) {
  return await storageBackend.listFilesInLocal(folderId, query);
}

/**
 * Lista carpetas en una carpeta padre
 */
async function listFolders(parentId) {
  return await storageBackend.listFoldersInLocal(parentId);
}

/**
 * Crea una nueva carpeta
 */
async function createFolder(parentId, folderName) {
  return await storageBackend.createFolderInLocal(parentId, folderName);
}

/**
 * Lee un archivo del almacenamiento
 */
async function readFile(fileId) {
  return await storageBackend.readFileFromLocal(fileId);
}

/**
 * Elimina un archivo del almacenamiento
 */
async function deleteFile(fileId) {
  return await storageBackend.deleteFileFromLocal(fileId);
}

/**
 * Obtiene información de una carpeta específica
 */
async function getFolderInfo(folderId) {
  return await storageBackend.getFolderInfo(folderId);
}

/**
 * Obtiene información sobre el modo de almacenamiento
 */
function getStorageInfo() {
  return {
    mode: 'local',
    enabled: true,
    basePath: storageBackend.BASE_DIR,
    configPath: storageBackend.CONFIG_DIR
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
  findFileById: localStorageModule.findFileById,
  isLocalMode: () => true
};
