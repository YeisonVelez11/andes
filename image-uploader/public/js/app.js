// Configuración de tamaños válidos por tipo de imagen y dispositivo
const validSizes = {
  imagenLateral: {
    desktop: [
      { width: 300, height: 250 },
      { width: 300, height: 600 },
      { width: 160, height: 600 }
    ],
    mobile: [
      { width: 300, height: 250 },
      { width: 300, height: 600 },
      { width: 160, height: 600 }
    ]
  },
  imagenAncho: {
    desktop: [
      { width: 728, height: 90 },
      { width: 990, height: 90 },
      { width: 970, height: 250 }
    ],
    mobile: [
      { width: 320, height: 50 },
      { width: 320, height: 100 },
      { width: 300, height: 100 }
    ]
  },
  imagenTop: {
    desktop: [
      { width: 728, height: 90 },
      { width: 990, height: 90 }
    ],
    mobile: [
      { width: 728, height: 90 },
      { width: 990, height: 90 }
    ]
  },
  itt: {
    desktop: [
      { width: 800, height: 600 }
    ],
    mobile: [
      { width: 320, height: 480 }
    ]
  },
  zocalo: {
    mobile: [
      { width: 320, height: 100 },
      { width: 320, height: 50 }
    ]
  }
};

// Estado global
let currentDeviceType = 'desktop';
let currentVisualizationType = 'A'; // A, B, C, D
let uploadedFiles = {};
let dateRange = { start: null, end: null };
let currentDisplayDate = new Date().toISOString().split('T')[0];
let showImages = true;

// Inicialización cuando el DOM está listo
document.addEventListener('DOMContentLoaded', function() {
  // Inicializar Materialize
  M.AutoInit();
  
  // Configurar event listeners
  setupEventListeners();
  
  // Inicializar date range pickers
  initializeDateRangePickers();
  
  // Configurar checkbox de mostrar/ocultar imágenes
  setupImageToggle();
  
  // Cargar imágenes del día actual solo si el checkbox está marcado
  if (showImages) {
    loadImagesForDate(currentDisplayDate);
  }
  
  // Mostrar toast de bienvenida
  M.toast({ html: '¡Bienvenido! Selecciona el tipo de dispositivo y carga tus imágenes.', classes: 'blue' });
});

// Configurar todos los event listeners
function setupEventListeners() {
  // Radio buttons para tipo de dispositivo
  const radioButtons = document.querySelectorAll('input[name="deviceType"]');
  radioButtons.forEach(radio => {
    radio.addEventListener('change', handleDeviceTypeChange);
  });
  
  // Radio buttons para tipo de visualización
  const visualizationRadios = document.querySelectorAll('input[name="visualizationType"]');
  visualizationRadios.forEach(radio => {
    radio.addEventListener('change', handleVisualizationTypeChange);
  });
  
  // Inputs de archivo
  const fileInputs = ['imagenLateral', 'imagenAncho', 'imagenTop', 'itt', 'zocalo'];
  fileInputs.forEach(inputId => {
    const input = document.getElementById(inputId);
    if (input) {
      input.addEventListener('change', (e) => handleFileSelect(e, inputId));
    }
  });
  
  // Formulario de envío
  const form = document.getElementById('uploadForm');
  form.addEventListener('submit', handleFormSubmit);
  
  // Botón de limpiar
  const clearBtn = document.getElementById('clearBtn');
  clearBtn.addEventListener('click', clearAllPreviews);
  
  // Inicializar visibilidad de secciones según tipo de visualización
  updateSectionVisibility();
}

// Manejar cambio de tipo de dispositivo
function handleDeviceTypeChange(e) {
  currentDeviceType = e.target.value;
  
  // Mostrar/ocultar opciones de visualización desktop
  const desktopVisualizationOptions = document.getElementById('desktopVisualizationOptions');
  if (currentDeviceType === 'desktop') {
    desktopVisualizationOptions.style.display = 'block';
  } else {
    desktopVisualizationOptions.style.display = 'none';
  }
  
  // Mostrar/ocultar sección de zócalo
  const zocaloSection = document.getElementById('zocalo-section');
  if (currentDeviceType === 'mobile') {
    zocaloSection.style.display = 'block';
  } else {
    zocaloSection.style.display = 'none';
    // Limpiar preview de zócalo si existe
    clearPreview('zocalo');
  }
  
  // Actualizar textos de tamaños permitidos
  updateSizeTexts();
  
  // Actualizar visibilidad de secciones
  updateSectionVisibility();
  
  // Limpiar todas las previsualizaciones
  clearAllPreviews();
  
  M.toast({ 
    html: `Modo cambiado a: ${currentDeviceType === 'desktop' ? 'Desktop' : 'Mobile'}`, 
    classes: 'blue' 
  });
}

// Manejar cambio de tipo de visualización
function handleVisualizationTypeChange(e) {
  currentVisualizationType = e.target.value;
  
  // Actualizar visibilidad de secciones
  updateSectionVisibility();
  
  // Limpiar previsualizaciones de secciones ocultas
  clearHiddenSectionPreviews();
  
  const labels = {
    'A': 'Lateral y Ancho',
    'B': 'Lateral',
    'C': 'Top',
    'D': 'ITT'
  };
  
  M.toast({ 
    html: `Tipo de visualización: ${labels[currentVisualizationType]}`, 
    classes: 'teal' 
  });
}

// Actualizar visibilidad de secciones según tipo de visualización
function updateSectionVisibility() {
  // Solo aplicar si es desktop
  if (currentDeviceType !== 'desktop') {
    // En mobile, mostrar todas las secciones excepto zócalo que se maneja aparte
    showAllSections();
    return;
  }
  
  // Obtener todas las secciones de imágenes
  const lateralSection = document.querySelector('#imagenLateral').closest('.row');
  const anchoSection = document.querySelector('#imagenAncho').closest('.row');
  const topSection = document.querySelector('#imagenTop').closest('.row');
  const ittSection = document.querySelector('#itt').closest('.row');
  
  // Ocultar todas primero
  lateralSection.style.display = 'none';
  anchoSection.style.display = 'none';
  topSection.style.display = 'none';
  ittSection.style.display = 'none';
  
  // Mostrar según tipo de visualización
  switch(currentVisualizationType) {
    case 'A': // Lateral y Ancho
      lateralSection.style.display = 'block';
      anchoSection.style.display = 'block';
      break;
    case 'B': // Solo Lateral
      lateralSection.style.display = 'block';
      break;
    case 'C': // Solo Top
      topSection.style.display = 'block';
      break;
    case 'D': // Solo ITT
      ittSection.style.display = 'block';
      break;
  }
}

// Mostrar todas las secciones (para mobile)
function showAllSections() {
  const lateralSection = document.querySelector('#imagenLateral').closest('.row');
  const anchoSection = document.querySelector('#imagenAncho').closest('.row');
  const topSection = document.querySelector('#imagenTop').closest('.row');
  const ittSection = document.querySelector('#itt').closest('.row');
  
  lateralSection.style.display = 'block';
  anchoSection.style.display = 'block';
  topSection.style.display = 'block';
  ittSection.style.display = 'block';
}

// Limpiar previsualizaciones de secciones ocultas
function clearHiddenSectionPreviews() {
  if (currentDeviceType !== 'desktop') return;
  
  const sectionsToKeep = {
    'A': ['imagenLateral', 'imagenAncho'],
    'B': ['imagenLateral'],
    'C': ['imagenTop'],
    'D': ['itt']
  };
  
  const allSections = ['imagenLateral', 'imagenAncho', 'imagenTop', 'itt'];
  const keepSections = sectionsToKeep[currentVisualizationType];
  
  allSections.forEach(section => {
    if (!keepSections.includes(section)) {
      clearPreview(section);
      delete uploadedFiles[section];
    }
  });
}

// Actualizar textos de tamaños según dispositivo
function updateSizeTexts() {
  const desktopSizes = document.querySelectorAll('.desktop-size');
  const mobileSizes = document.querySelectorAll('.mobile-size');
  
  if (currentDeviceType === 'desktop') {
    desktopSizes.forEach(el => el.style.display = 'inline');
    mobileSizes.forEach(el => el.style.display = 'none');
  } else {
    desktopSizes.forEach(el => el.style.display = 'none');
    mobileSizes.forEach(el => el.style.display = 'inline');
  }
}

// Manejar selección de archivo
function handleFileSelect(event, inputId) {
  const file = event.target.files[0];
  
  if (!file) {
    clearPreview(inputId);
    return;
  }
  
  // Validar que sea una imagen
  if (!file.type.startsWith('image/')) {
    M.toast({ html: 'Por favor selecciona un archivo de imagen válido', classes: 'red' });
    event.target.value = '';
    clearPreview(inputId);
    return;
  }
  
  // Validar tamaño de archivo (máximo 5MB)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    M.toast({ html: 'El archivo es muy grande. Máximo 5MB permitido', classes: 'red' });
    event.target.value = '';
    clearPreview(inputId);
    return;
  }
  
  // Crear preview
  createImagePreview(file, inputId);
  
  // Guardar archivo en estado
  uploadedFiles[inputId] = file;
}

// Crear preview de imagen
function createImagePreview(file, inputId) {
  const reader = new FileReader();
  
  reader.onload = function(e) {
    const img = new Image();
    img.src = e.target.result;
    
    img.onload = function() {
      const previewContainer = document.getElementById(`preview-${inputId}`);
      
      // Limpiar preview anterior
      previewContainer.innerHTML = '';
      
      // Validar dimensiones
      const isValidSize = validateImageSize(img.width, img.height, inputId);
      
      // Crear elementos de preview
      const wrapper = document.createElement('div');
      wrapper.className = 'preview-wrapper';
      
      // Botón para remover
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-preview';
      removeBtn.type = 'button';
      removeBtn.innerHTML = '<i class="material-icons">close</i>';
      removeBtn.onclick = () => {
        clearPreview(inputId);
        document.getElementById(inputId).value = '';
        delete uploadedFiles[inputId];
      };
      
      // Imagen
      const previewImg = document.createElement('img');
      previewImg.src = e.target.result;
      previewImg.className = 'preview-image';
      previewImg.alt = 'Preview';
      
      // Información de la imagen
      const info = document.createElement('div');
      info.className = 'preview-info';
      
      const sizeClass = isValidSize ? 'size-valid' : 'size-invalid';
      const sizeIcon = isValidSize ? '✓' : '✗';
      const sizeText = isValidSize ? 'Tamaño válido' : 'Tamaño no válido';
      
      info.innerHTML = `
        <p><strong>Nombre:</strong> ${file.name}</p>
        <p><strong>Dimensiones:</strong> ${img.width} x ${img.height}px</p>
        <p><strong>Tamaño:</strong> ${formatFileSize(file.size)}</p>
        <p class="${sizeClass}">${sizeIcon} ${sizeText}</p>
      `;
      
      // Ensamblar preview
      wrapper.appendChild(removeBtn);
      wrapper.appendChild(previewImg);
      wrapper.appendChild(info);
      previewContainer.appendChild(wrapper);
      
      // Mostrar mensaje si el tamaño no es válido
      if (!isValidSize) {
        const validSizesText = getValidSizesText(inputId);
        M.toast({ 
          html: `⚠️ La imagen no tiene un tamaño válido. Tamaños permitidos: ${validSizesText}`, 
          classes: 'orange darken-2',
          displayLength: 6000
        });
      }
    };
  };
  
  reader.readAsDataURL(file);
}

// Validar dimensiones de imagen
function validateImageSize(width, height, inputId) {
  const sizes = validSizes[inputId];
  if (!sizes) return false;
  
  const deviceSizes = sizes[currentDeviceType];
  if (!deviceSizes) return false;
  
  return deviceSizes.some(size => size.width === width && size.height === height);
}

// Obtener texto de tamaños válidos
function getValidSizesText(inputId) {
  const sizes = validSizes[inputId];
  if (!sizes) return '';
  
  const deviceSizes = sizes[currentDeviceType];
  if (!deviceSizes) return '';
  
  return deviceSizes.map(size => `${size.width}x${size.height}`).join(', ');
}

// Formatear tamaño de archivo
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Limpiar preview específico
function clearPreview(inputId) {
  const previewContainer = document.getElementById(`preview-${inputId}`);
  if (previewContainer) {
    previewContainer.innerHTML = '';
  }
}

// Limpiar todas las previsualizaciones
function clearAllPreviews() {
  const fileInputs = ['imagenLateral', 'imagenAncho', 'imagenTop', 'itt', 'zocalo'];
  fileInputs.forEach(inputId => {
    clearPreview(inputId);
    const input = document.getElementById(inputId);
    if (input) {
      input.value = '';
    }
  });
  uploadedFiles = {};
  hideResultMessage();
  M.toast({ html: 'Todas las previsualizaciones han sido limpiadas', classes: 'blue' });
}

// Manejar envío del formulario
async function handleFormSubmit(e) {
  e.preventDefault();
  
  // Validar que al menos una imagen esté seleccionada
  if (Object.keys(uploadedFiles).length === 0) {
    M.toast({ html: 'Por favor selecciona al menos una imagen', classes: 'red' });
    return;
  }
  
  // Validar que un rango de fechas esté seleccionado
  if (!dateRange.start || !dateRange.end) {
    M.toast({ html: 'Por favor selecciona un rango de fechas', classes: 'orange' });
    return;
  }

  // Crear FormData
  const formData = new FormData();
  
  // Agregar archivos
  for (const [key, file] of Object.entries(uploadedFiles)) {
    formData.append(key, file);
  }
  
  // Agregar tipo de dispositivo
  formData.append('deviceType', currentDeviceType);
  
  // Agregar tipo de visualización (solo para desktop)
  if (currentDeviceType === 'desktop') {
    formData.append('visualizationType', currentVisualizationType);
  }
  
  // Agregar rango de fechas
  formData.append('dateRange1', JSON.stringify({
    start: dateRange.start.toISOString().split('T')[0],
    end: dateRange.end.toISOString().split('T')[0]
  }));
  
  // Deshabilitar botón de envío
  const submitBtn = document.getElementById('submitBtn');
  const originalText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="material-icons left">hourglass_empty</i>Subiendo...';
  
  try {
    // Enviar al servidor
    const response = await fetch('/upload', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (result.success) {
      let jsonFilesInfo = '';
      if (result.jsonFiles && result.jsonFiles.length > 0) {
        const created = result.jsonFiles.filter(f => f.action === 'created').length;
        const updated = result.jsonFiles.filter(f => f.action === 'updated').length;
        jsonFilesInfo = `<br><strong>Archivos JSON:</strong> ${created} creados, ${updated} actualizados`;
      }
      
      showResultMessage('success', `
        ✓ ¡Imágenes subidas correctamente!<br>
        <strong>Dispositivo:</strong> ${result.deviceType}<br>
        <strong>Archivos subidos:</strong> ${Object.keys(result.files).length}<br>
        ${jsonFilesInfo}
        <strong>Fecha:</strong> ${new Date(result.uploadedAt).toLocaleString()}
      `);
      
      M.toast({ html: '¡Imágenes y archivos JSON creados exitosamente!', classes: 'green' });
      
      // Recargar galería de imágenes del día actual
      loadImagesForDate(currentDisplayDate);
      
      // Limpiar formulario después de 2 segundos
      setTimeout(() => {
        clearAllPreviews();
      }, 2000);
    } else {
      showResultMessage('error', `✗ Error: ${result.error}`);
      M.toast({ html: 'Error al subir imágenes', classes: 'red' });
    }
  } catch (error) {
    console.error('Error:', error);
    showResultMessage('error', `✗ Error de conexión: ${error.message}`);
    M.toast({ html: 'Error de conexión con el servidor', classes: 'red' });
  } finally {
    // Rehabilitar botón
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
}

// Mostrar mensaje de resultado
function showResultMessage(type, message) {
  const resultMessage = document.getElementById('resultMessage');
  const resultText = document.getElementById('resultText');
  const cardPanel = resultMessage.querySelector('.card-panel');
  
  // Limpiar clases anteriores
  cardPanel.classList.remove('success-message', 'error-message');
  
  // Agregar clase según tipo
  if (type === 'success') {
    cardPanel.classList.add('success-message');
  } else {
    cardPanel.classList.add('error-message');
  }
  
  resultText.innerHTML = message;
  resultMessage.style.display = 'block';
  
  // Scroll hacia el mensaje
  resultMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Ocultar mensaje de resultado
function hideResultMessage() {
  const resultMessage = document.getElementById('resultMessage');
  resultMessage.style.display = 'none';
}

// Inicializar date range picker
function initializeDateRangePickers() {
  const dateRangePicker = flatpickr('#dateRange', {
    mode: 'range',
    dateFormat: 'Y-m-d',
    locale: 'es',
    altInput: true,
    altFormat: 'j F, Y',
    showMonths: 2,
    minDate: null,
    maxDate: null,
    onChange: function(selectedDates, dateStr, instance) {
      if (selectedDates.length === 2) {
        dateRange.start = selectedDates[0];
        dateRange.end = selectedDates[1];
        updateSelectedDatesDisplay();
        
        const startDate = selectedDates[0].toISOString().split('T')[0];
        const endDate = selectedDates[1].toISOString().split('T')[0];
        
        // Solo cargar imágenes si el checkbox está marcado
        if (showImages) {
          // Si es un solo día, cargar las imágenes de ese día
          if (startDate === endDate) {
            currentDisplayDate = startDate;
            loadImagesForDate(currentDisplayDate);
            M.toast({ html: 'Mostrando imágenes del día seleccionado', classes: 'blue' });
          } else {
            // Si es un rango, cargar todas las imágenes del rango
            loadImagesForDateRange(startDate, endDate);
            M.toast({ html: 'Mostrando imágenes del rango seleccionado', classes: 'green' });
          }
        } else {
          M.toast({ html: 'Rango de fechas seleccionado. Marca el checkbox para ver las imágenes', classes: 'blue' });
        }
      }
    },
    onClose: function(selectedDates, dateStr, instance) {
      if (selectedDates.length === 1) {
        // Permitir seleccionar un solo día
        dateRange.start = selectedDates[0];
        dateRange.end = selectedDates[0];
        currentDisplayDate = selectedDates[0].toISOString().split('T')[0];
        updateSelectedDatesDisplay();
        
        // Solo cargar imágenes si el checkbox está marcado
        if (showImages) {
          loadImagesForDate(currentDisplayDate);
          M.toast({ html: 'Mostrando imágenes del día seleccionado', classes: 'blue' });
        } else {
          M.toast({ html: 'Fecha seleccionada. Marca el checkbox para ver las imágenes', classes: 'blue' });
        }
      }
    }
  });
}

// Actualizar la visualización de las fechas seleccionadas
function updateSelectedDatesDisplay() {
  const container = document.getElementById('selectedDates');
  let html = '';

  if (dateRange.start && dateRange.end) {
    html = `<p><strong>Rango Seleccionado:</strong><br>
      <i class="material-icons tiny">calendar_today</i> 
      ${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}
      <span class="grey-text">(${getDaysDifference(dateRange.start, dateRange.end)} día${getDaysDifference(dateRange.start, dateRange.end) > 1 ? 's' : ''})</span>
    </p>`;
  } else {
    html = '<p class="grey-text text-darken-2"><small>El rango de fechas seleccionado aparecerá aquí</small></p>';
  }

  container.innerHTML = html;
}

// Formatear fecha
function formatDate(date) {
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString('es-ES', options);
}

// Calcular diferencia de días
function getDaysDifference(start, end) {
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
}

// Configurar checkbox de mostrar/ocultar imágenes
function setupImageToggle() {
  const checkbox = document.getElementById('showImagesCheckbox');
  if (checkbox) {
    checkbox.addEventListener('change', function() {
      showImages = this.checked;
      const gallery = document.getElementById('imageGallery');
      
      if (showImages) {
        // Si se marca, cargar las imágenes
        gallery.style.display = 'block';
        
        // Determinar si cargar un día o un rango
        if (dateRange.start && dateRange.end) {
          const startDate = dateRange.start.toISOString().split('T')[0];
          const endDate = dateRange.end.toISOString().split('T')[0];
          
          if (startDate === endDate) {
            loadImagesForDate(startDate);
          } else {
            loadImagesForDateRange(startDate, endDate);
          }
        } else {
          // Si no hay rango seleccionado, cargar fecha actual
          loadImagesForDate(currentDisplayDate);
        }
      } else {
        // Si se desmarca, ocultar y limpiar
        gallery.style.display = 'none';
        gallery.innerHTML = '<div class="col s12 center-align"><p class="grey-text">Marca el checkbox para mostrar las imágenes</p></div>';
      }
    });
  }
}

// Generar array de fechas entre dos fechas
function generateDateArray(startDate, endDate) {
  const dates = [];
  const current = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

// Cargar imágenes para un rango de fechas
async function loadImagesForDateRange(startDate, endDate) {
  const gallery = document.getElementById('imageGallery');
  const displayDateEl = document.getElementById('displayDate');
  
  // Actualizar fecha mostrada
  if (displayDateEl) {
    displayDateEl.textContent = `${formatDate(new Date(startDate + 'T00:00:00'))} - ${formatDate(new Date(endDate + 'T00:00:00'))}`;
  }
  
  if (!showImages) {
    gallery.style.display = 'none';
    return;
  }
  
  gallery.style.display = 'block';
  gallery.innerHTML = '<div class="col s12 center-align"><div class="preloader-wrapper small active"><div class="spinner-layer spinner-blue-only"><div class="circle-clipper left"><div class="circle"></div></div><div class="gap-patch"><div class="circle"></div></div><div class="circle-clipper right"><div class="circle"></div></div></div></div><p>Cargando imágenes del rango...</p></div>';
  
  try {
    // Generar todas las fechas del rango
    const dates = generateDateArray(startDate, endDate);
    
    // Obtener lista de archivos JSON
    const response = await fetch('/json-files');
    const result = await response.json();
    
    if (!result.success) {
      gallery.innerHTML = '<div class="col s12 center-align"><p class="red-text">Error al buscar archivos JSON</p></div>';
      return;
    }
    
    // Limpiar galería
    gallery.innerHTML = '';
    
    let totalImages = 0;
    
    // Para cada fecha en el rango
    for (const date of dates) {
      const jsonFileName = `${date}.json`;
      const jsonFile = result.files.find(f => f.name === jsonFileName);
      
      if (!jsonFile) continue;
      
      // Obtener el contenido del JSON
      const contentResponse = await fetch(`/json-file/${jsonFile.id}`);
      const contentResult = await contentResponse.json();
      
      if (!contentResult.success || !contentResult.content || contentResult.content.length === 0) {
        continue;
      }
      
      // Crear sección para esta fecha
      const dateSection = document.createElement('div');
      dateSection.className = 'col s12';
      dateSection.style.marginBottom = '30px';
      
      const dateDivider = document.createElement('div');
      dateDivider.innerHTML = `
        <h5 style="border-bottom: 2px solid #2196f3; padding-bottom: 10px; margin-bottom: 20px;">
          <i class="material-icons" style="vertical-align: middle;">date_range</i>
          ${formatDate(new Date(date + 'T00:00:00'))}
          <span class="grey-text" style="font-size: 0.9rem; font-weight: normal;">
            (${contentResult.content.length} entrada${contentResult.content.length > 1 ? 's' : ''})
          </span>
        </h5>
      `;
      dateSection.appendChild(dateDivider);
      
      // Mostrar cada entrada del JSON
      contentResult.content.forEach((entry, index) => {
        const entryDiv = document.createElement('div');
        entryDiv.style.marginBottom = '20px';
        
        const entryCard = document.createElement('div');
        entryCard.className = 'card';
        
        const entryContent = document.createElement('div');
        entryContent.className = 'card-content';
        
        entryContent.innerHTML = `
          <span class="card-title">
            Entrada #${index + 1} - ${entry.deviceType}
            <span class="grey-text" style="font-size: 0.9rem; font-weight: normal;">
              (${new Date(entry.uploadedAt).toLocaleString()})
            </span>
          </span>
        `;
        
        const imagesRow = document.createElement('div');
        imagesRow.className = 'row';
        
        // Crear cards para cada tipo de imagen
        const imageTypes = [
          { key: 'imagenLateral', label: 'Imagen Lateral' },
          { key: 'imagenAncho', label: 'Imagen Ancho' },
          { key: 'imagenTop', label: 'Imagen Top' },
          { key: 'itt', label: 'ITT' },
          { key: 'zocalo', label: 'Zócalo' }
        ];
        
        imageTypes.forEach(type => {
          if (entry[type.key]) {
            totalImages++;
            const col = document.createElement('div');
            col.className = 'col s12 m6 l4';
            
            const imgCard = document.createElement('div');
            imgCard.className = 'card';
            
            const imgDiv = document.createElement('div');
            imgDiv.className = 'card-image';
            
            const img = document.createElement('img');
            img.src = entry[type.key];
            img.alt = type.label;
            img.style.objectFit = 'contain';
            img.style.maxHeight = '200px';
            img.style.width = '100%';
            img.onerror = function() {
              this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImagen no disponible%3C/text%3E%3C/svg%3E';
            };
            
            imgDiv.appendChild(img);
            
            const imgContent = document.createElement('div');
            imgContent.className = 'card-content';
            imgContent.innerHTML = `<p class="center-align"><strong>${type.label}</strong></p>`;
            
            imgCard.appendChild(imgDiv);
            imgCard.appendChild(imgContent);
            col.appendChild(imgCard);
            imagesRow.appendChild(col);
          }
        });
        
        entryContent.appendChild(imagesRow);
        entryCard.appendChild(entryContent);
        entryDiv.appendChild(entryCard);
        dateSection.appendChild(entryDiv);
      });
      
      gallery.appendChild(dateSection);
    }
    
    if (totalImages === 0) {
      gallery.innerHTML = `<div class="col s12 center-align"><p class="grey-text">No hay imágenes en el rango de fechas seleccionado</p></div>`;
    }
    
  } catch (error) {
    console.error('Error al cargar imágenes del rango:', error);
    gallery.innerHTML = '<div class="col s12 center-align"><p class="red-text">Error al cargar imágenes</p></div>';
  }
}

// Cargar imágenes para una fecha específica
async function loadImagesForDate(date) {
  const gallery = document.getElementById('imageGallery');
  const displayDateEl = document.getElementById('displayDate');
  
  // Actualizar fecha mostrada
  if (displayDateEl) {
    displayDateEl.textContent = formatDate(new Date(date + 'T00:00:00'));
  }
  
  if (!showImages) {
    gallery.style.display = 'none';
    return;
  }
  
  gallery.style.display = 'block';
  gallery.innerHTML = '<div class="col s12 center-align"><div class="preloader-wrapper small active"><div class="spinner-layer spinner-blue-only"><div class="circle-clipper left"><div class="circle"></div></div><div class="gap-patch"><div class="circle"></div></div><div class="circle-clipper right"><div class="circle"></div></div></div></div><p>Cargando imágenes...</p></div>';
  
  try {
    // Buscar el archivo JSON para esta fecha
    const jsonFileName = `${date}.json`;
    const response = await fetch('/json-files');
    const result = await response.json();
    
    if (!result.success) {
      gallery.innerHTML = '<div class="col s12 center-align"><p class="red-text">Error al buscar archivos JSON</p></div>';
      return;
    }
    
    // Buscar el archivo específico
    const jsonFile = result.files.find(f => f.name === jsonFileName);
    
    if (!jsonFile) {
      gallery.innerHTML = `<div class="col s12 center-align"><p class="grey-text">No hay imágenes para la fecha ${date}</p></div>`;
      return;
    }
    
    // Obtener el contenido del JSON
    const contentResponse = await fetch(`/json-file/${jsonFile.id}`);
    const contentResult = await contentResponse.json();
    
    if (!contentResult.success || !contentResult.content || contentResult.content.length === 0) {
      gallery.innerHTML = `<div class="col s12 center-align"><p class="grey-text">No hay imágenes para la fecha ${date}</p></div>`;
      return;
    }
    
    // Limpiar galería
    gallery.innerHTML = '';
    
    // Mostrar cada entrada del JSON
    contentResult.content.forEach((entry, index) => {
      const entryDiv = document.createElement('div');
      entryDiv.className = 'col s12';
      entryDiv.style.marginBottom = '20px';
      
      const entryCard = document.createElement('div');
      entryCard.className = 'card';
      
      const entryContent = document.createElement('div');
      entryContent.className = 'card-content';
      
      // Determinar el nombre del tipo de visualización
      const visualizationNames = {
        'A': 'Lateral / Ancho',
        'B': 'Lateral',
        'C': 'Top',
        'D': 'ITT'
      };
      
      const visualizationType = entry.tipo_visualizacion || 'No especificado';
      const visualizationName = visualizationNames[visualizationType] || visualizationType;
      
      entryContent.innerHTML = `
        <span class="card-title">
          Entrada #${index + 1}
          <span class="grey-text" style="font-size: 0.9rem; font-weight: normal;">
            (${new Date(entry.uploadedAt).toLocaleString()})
          </span>
        </span>
        <div style="margin-top: 10px; margin-bottom: 15px;">
          <span class="chip blue white-text" style="display: inline-flex; align-items: center; gap: 5px;">
            <i class="material-icons" style="font-size: 18px;">devices</i>
            <span>${entry.deviceType || 'No especificado'}</span>
          </span>
          <span class="chip teal white-text" style="display: inline-flex; align-items: center; gap: 5px;">
            <i class="material-icons" style="font-size: 18px;">view_module</i>
            <span>Tipo ${visualizationType}: ${visualizationName}</span>
          </span>
        </div>
      `;
      
      const imagesRow = document.createElement('div');
      imagesRow.className = 'row';
      
      // Crear cards para cada tipo de imagen
      const imageTypes = [
        { key: 'imagenLateral', label: 'Imagen Lateral' },
        { key: 'imagenAncho', label: 'Imagen Ancho' },
        { key: 'imagenTop', label: 'Imagen Top' },
        { key: 'itt', label: 'ITT' },
        { key: 'zocalo', label: 'Zócalo' }
      ];
      
      imageTypes.forEach(type => {
        if (entry[type.key]) {
          const col = document.createElement('div');
          col.className = 'col s12 m6 l4';
          
          const imgCard = document.createElement('div');
          imgCard.className = 'card';
          
          const imgDiv = document.createElement('div');
          imgDiv.className = 'card-image';
          
          const img = document.createElement('img');
          img.src = entry[type.key];
          img.alt = type.label;
          img.style.objectFit = 'contain';
          img.style.maxHeight = '200px';
          img.style.width = '100%';
          img.onerror = function() {
            this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImagen no disponible%3C/text%3E%3C/svg%3E';
          };
          
          imgDiv.appendChild(img);
          
          const imgContent = document.createElement('div');
          imgContent.className = 'card-content';
          imgContent.innerHTML = `<p class="center-align"><strong>${type.label}</strong></p>`;
          
          imgCard.appendChild(imgDiv);
          imgCard.appendChild(imgContent);
          col.appendChild(imgCard);
          imagesRow.appendChild(col);
        }
      });
      
      entryContent.appendChild(imagesRow);
      entryCard.appendChild(entryContent);
      entryDiv.appendChild(entryCard);
      gallery.appendChild(entryDiv);
    });
    
  } catch (error) {
    console.error('Error al cargar imágenes:', error);
    gallery.innerHTML = '<div class="col s12 center-align"><p class="red-text">Error al cargar imágenes</p></div>';
  }
}

// Prevenir envío del formulario al presionar Enter en inputs
document.addEventListener('keypress', function(e) {
  if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') {
    e.preventDefault();
  }
});

// ==================== FUNCIONALIDAD SCREENSHOT ====================

// Botón Generar Screenshot
const generateScreenshotBtn = document.getElementById('generateScreenshotBtn');
const screenshotLoading = document.getElementById('screenshotLoading');
const screenshotResult = document.getElementById('screenshotResult');

if (generateScreenshotBtn) {
  generateScreenshotBtn.addEventListener('click', async function() {
    // Obtener el tipo de dispositivo seleccionado
    const deviceTypeRadio = document.querySelector('input[name="deviceType"]:checked');
    const deviceType = deviceTypeRadio ? deviceTypeRadio.value : 'desktop';
    
    // Deshabilitar botón y mostrar loading
    generateScreenshotBtn.disabled = true;
    screenshotLoading.style.display = 'block';
    screenshotResult.innerHTML = '';
    
    try {
      const response = await fetch('/generate-screenshot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          deviceType: deviceType
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Verificar si hay múltiples screenshots
        const screenshots = Array.isArray(data.data) ? data.data : [data.data];
        
        let html = `
          <div class="card green lighten-5" style="border-left: 4px solid #4caf50;">
            <div class="card-content">
              <h6><i class="material-icons tiny">check_circle</i> ${data.message}</h6>
              <div class="divider" style="margin: 10px 0;"></div>
        `;
        
        // Mostrar cada screenshot
        screenshots.forEach((screenshot, index) => {
          if (screenshot.success) {
            const visualizationLabel = screenshot.visualizationType ? 
              ` - Tipo ${screenshot.visualizationType}` : '';
            
            html += `
              <div style="margin-bottom: 20px; ${index > 0 ? 'padding-top: 15px; border-top: 1px solid #ddd;' : ''}">
                <h6 class="purple-text">Screenshot ${index + 1}${visualizationLabel}</h6>
                <p><strong>Dispositivo:</strong> ${screenshot.deviceType}</p>
                <p><strong>Archivo:</strong> ${screenshot.fileName}</p>
                <p><strong>Drive ID:</strong> <code>${screenshot.driveId}</code></p>
                <p><strong>Link:</strong> <a href="${screenshot.driveLink}" target="_blank" class="purple-text text-darken-2">${screenshot.driveLink}</a></p>
                <div class="center-align" style="margin-top: 10px;">
                  <a href="${screenshot.driveLink}" target="_blank" class="btn waves-effect waves-light purple darken-2">
                    <i class="material-icons left">open_in_new</i>
                    Ver en Google Drive
                  </a>
                </div>
              </div>
            `;
          } else {
            html += `
              <div style="margin-bottom: 20px; ${index > 0 ? 'padding-top: 15px; border-top: 1px solid #ddd;' : ''}">
                <h6 class="red-text">Screenshot ${index + 1} - Error</h6>
                <p><strong>Error:</strong> ${screenshot.error}</p>
              </div>
            `;
          }
        });
        
        html += `
            </div>
          </div>
        `;
        
        screenshotResult.innerHTML = html;
        M.toast({html: `✅ ${screenshots.length} screenshot(s) generado(s) exitosamente!`, classes: 'green'});
      } else {
        screenshotResult.innerHTML = `
          <div class="card red lighten-5" style="border-left: 4px solid #f44336;">
            <div class="card-content">
              <h6><i class="material-icons tiny">error</i> Error al generar screenshot</h6>
              <div class="divider" style="margin: 10px 0;"></div>
              <p><strong>Error:</strong> ${data.error || 'Error desconocido'}</p>
              ${data.details ? `<p><strong>Detalles:</strong> <code>${data.details}</code></p>` : ''}
            </div>
          </div>
        `;
        M.toast({html: '❌ Error al generar screenshot', classes: 'red'});
      }
    } catch (error) {
      screenshotResult.innerHTML = `
        <div class="card red lighten-5" style="border-left: 4px solid #f44336;">
          <div class="card-content">
            <h6><i class="material-icons tiny">error</i> Error de conexión</h6>
            <div class="divider" style="margin: 10px 0;"></div>
            <p><strong>Error:</strong> ${error.message}</p>
            <p>No se pudo conectar con el servidor. Asegúrate de que el servidor esté corriendo.</p>
          </div>
        </div>
      `;
      M.toast({html: '❌ Error de conexión', classes: 'red'});
    } finally {
      // Rehabilitar botón y ocultar loading
      generateScreenshotBtn.disabled = false;
      screenshotLoading.style.display = 'none';
    }
  });
}

// Cargar imágenes del día actual al iniciar la página
document.addEventListener('DOMContentLoaded', function() {
  // Obtener fecha actual en formato YYYY-MM-DD
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const todayString = `${year}-${month}-${day}`;
  
  console.log('📅 Cargando imágenes del día actual:', todayString);
  
  // Cargar imágenes del día actual
  loadImagesForDate(todayString);
});
