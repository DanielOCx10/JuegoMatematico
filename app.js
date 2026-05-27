// --- CONFIGURACIÓN DE ESTADO ---
const state = {
  activeScreen: 'screen-config',
  difficulty: 'medium', // easy, medium, auditor
  operations: ['sum', 'sub'], // sum, sub
  
  // Estadísticas de la sesión actual
  gameActive: false,
  isPaused: false,
  accumulatedTime: 0,
  startTime: null,
  lastResponseTime: null,
  speedFactor: 1.0,
  solvedCount: 0,
  attemptsCount: 0,
  currentStreak: 0,
  maxStreak: 0,
  focusPoints: 0, // Puntos de enfoque dinámicos para Hz y ritmo
  consecutiveErrors: 0, // Contador de errores consecutivos para bajar ritmo/Hz
  timerInterval: null,   // Guardará el ID del intervalo para el cronómetro del juego
  
  // Problema actual
  currentAnswer: null,
  num1: 0,
  num2: 0,
  opSymbol: '+',
  chancesLeft: 1, // Intentos permitidos por operación
  recentResults: [],
  recentPairs: [],
};

const DOM = {
  // Pantallas
  screenConfig: document.getElementById('screen-config'),
  screenGame: document.getElementById('screen-game'),
  resultsPanel: document.getElementById('results-panel'),
  
  // Botón de cambio de tema
  btnThemeToggle: document.getElementById('btn-theme-toggle'),

  // Elementos de Configuración
  optSum: document.getElementById('opt-sum'),
  optSub: document.getElementById('opt-sub'),
  toggleSFX: document.getElementById('toggle-sfx'),
  toggleMusic: document.getElementById('toggle-music'),
  btnStart: document.getElementById('btn-start'),
  
  // Elementos de Juego
  gameStreak: document.getElementById('game-streak'),
  gameSolved: document.getElementById('game-solved'),
  gameLevelTag: document.getElementById('game-level-tag'),
  gameTimer: document.getElementById('game-timer'),
  num1El: document.getElementById('num-1'),
  num2El: document.getElementById('num-2'),
  operatorEl: document.getElementById('math-operator'),
  answerInput: document.getElementById('answer-input'),
  mathBoardCard: document.getElementById('math-board-card'),
  btnExit: document.getElementById('btn-exit'),
  
  // Modal de Pausa
  modalPause: document.getElementById('modal-pause'),
  pauseSolved: document.getElementById('pause-solved'),
  pauseStreak: document.getElementById('pause-streak'),
  btnResume: document.getElementById('btn-resume'),
  btnPauseExit: document.getElementById('btn-pause-exit'),

  // Elementos de Resultados
  resultsDate: document.getElementById('results-date'),
  resultTotalSolved: document.getElementById('result-total-solved'),
  achievementBadgeName: document.getElementById('achievement-badge-name'),
  resultAccuracy: document.getElementById('result-accuracy'),
  resultRatio: document.getElementById('result-ratio'),
  resultSpeed: document.getElementById('result-speed'),
  resultMaxStreak: document.getElementById('result-max-streak'),
  resultDuration: document.getElementById('result-duration'),
  shareTextArea: document.getElementById('share-text-area'),
  btnCopy: document.getElementById('btn-copy'),
  copyToast: document.getElementById('copy-toast'),
};

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  applySettingsFromDOM();
  setupTheme();
  
  // Intento de reproducción en la primera interacción (evita bloqueo de autoplay de navegadores)
  const playOnInteraction = () => {
    if (!state.gameActive && sound.musicEnabled && sound.menuBGM.paused) {
      sound.playMenuBGM();
    }
    // Remover listeners para que solo se ejecute una vez
    document.removeEventListener('click', playOnInteraction);
    document.removeEventListener('keydown', playOnInteraction);
    document.removeEventListener('touchstart', playOnInteraction);
  };
  document.addEventListener('click', playOnInteraction);
  document.addEventListener('keydown', playOnInteraction);
  document.addEventListener('touchstart', playOnInteraction);
});

// --- CAPTURA DE CONFIGURACIONES ---
function applySettingsFromDOM() {
  // Operaciones
  state.operations = [];
  if (DOM.optSum.classList.contains('active')) state.operations.push('sum');
  if (DOM.optSub.classList.contains('active')) state.operations.push('sub');
  
  // Dificultad
  const checkedDiff = document.querySelector('input[name="difficulty"]:checked');
  state.difficulty = checkedDiff ? checkedDiff.value : 'medium';
  
  // Sonido
  sound.setSFXEnabled(DOM.toggleSFX.checked);
  sound.setMusicEnabled(DOM.toggleMusic.checked);
}

// Configuración del Tema Claro/Oscuro
function setupTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
    DOM.btnThemeToggle.textContent = '☀️';
  } else {
    document.body.classList.remove('light-theme');
    DOM.btnThemeToggle.textContent = '🌙';
  }
  
  DOM.btnThemeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    DOM.btnThemeToggle.textContent = isLight ? '☀️' : '🌙';
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
  });
}

// --- CONFIGURAR EVENT LISTENERS ---
function setupEventListeners() {
  // Pantalla de Configuración: Selección de Sumas/Restas
  DOM.optSum.addEventListener('click', () => toggleOperation('sum', DOM.optSum));
  DOM.optSub.addEventListener('click', () => toggleOperation('sub', DOM.optSub));
  
  // Switches de Sonido
  DOM.toggleSFX.addEventListener('change', (e) => sound.setSFXEnabled(e.target.checked));
  DOM.toggleMusic.addEventListener('change', (e) => sound.setMusicEnabled(e.target.checked));
  
  // Botones de Inicio y Fin
  DOM.btnStart.addEventListener('click', startGame);
  DOM.btnExit.addEventListener('click', pauseGame); // Modificado para pausar en vez de salir directo
  
  // Botones del Modal de Pausa
  DOM.btnResume.addEventListener('click', resumeGame);
  DOM.btnPauseExit.addEventListener('click', stopGame);
  
  // Botones de la Pantalla de Resultados
  DOM.btnCopy.addEventListener('click', copyShareText);
  
  // Entrada de respuestas (Foco y Teclado)
  DOM.answerInput.addEventListener('keydown', handleInputKeydown);
  
  // Mantener el enfoque en el campo de texto en todo momento durante el juego
  document.addEventListener('click', (e) => {
    if (state.gameActive && !state.isPaused && e.target !== DOM.answerInput && e.target !== DOM.btnExit) {
      forceInputFocus();
    }
  });

  // Atajos globales (Escape para pausar, Enter para reanudar cuando pausado)
  window.addEventListener('keydown', (e) => {
    if (state.gameActive) {
      if (e.key === 'Escape') {
        if (state.isPaused) {
          resumeGame();
        } else {
          pauseGame();
        }
      } else if (e.key === 'Enter' && state.isPaused) {
        resumeGame();
      }
    }
  });
}

// Alternar selección de sumas y restas (evitando dejar vacío)
function toggleOperation(type, element) {
  if (element.classList.contains('active')) {
    // Si ya está activo, sólo desactivar si hay otra operación seleccionada
    const activeButtons = document.querySelectorAll('.btn-select.active');
    if (activeButtons.length > 1) {
      element.classList.remove('active');
    }
  } else {
    element.classList.add('active');
  }
  applySettingsFromDOM();
}

// --- CONTROLADOR DE PANTALLAS ---
function switchScreen(screenId) {
  state.activeScreen = screenId;
  
  // Ocultar todas las pantallas y desactivar transiciones antiguas
  [DOM.screenConfig, DOM.screenGame].forEach(screen => {
    if (screen) screen.classList.remove('active');
  });
  
  // Mostrar pantalla seleccionada
  const activeScreenEl = document.getElementById(screenId);
  if (activeScreenEl) activeScreenEl.classList.add('active');
}

// --- LÓGICA DEL JUEGO ---

function startGame() {
  applySettingsFromDOM();
  
  // Resetear estados
  state.gameActive = true;
  state.isPaused = false;
  state.accumulatedTime = 0;
  state.startTime = Date.now();
  state.lastResponseTime = state.startTime;
  state.speedFactor = 1.0;
  state.solvedCount = 0;
  state.attemptsCount = 0;
  state.currentStreak = 0;
  state.maxStreak = 0;
  state.focusPoints = 0;
  state.consecutiveErrors = 0;
  state.recentResults = [];
  state.recentPairs = [];
  
  // Ocultar modal de pausa y habilitar entrada
  DOM.modalPause.classList.remove('active');
  DOM.answerInput.disabled = false;
  
  // Ocultar panel de resultados
  DOM.resultsPanel.style.display = 'none';
  
  // Actualizar interfaz del juego
  DOM.gameStreak.textContent = '0';
  DOM.gameSolved.textContent = '0';
  DOM.gameTimer.textContent = '0:00';
  
  // Etiqueta del nivel en el tablero
  const diffLabels = { easy: 'Fácil', medium: 'Media', auditor: 'Auditor ⚖️' };
  DOM.gameLevelTag.textContent = `Dificultad: ${diffLabels[state.difficulty]}`;
  
  // Limpiar input y cambiar pantalla
  DOM.answerInput.value = '';
  switchScreen('screen-game');
  
  // Iniciar timer
  startTimerTicks();
  
  // Reiniciar intensidad de música
  sound.updateIntensity(0, 1.0, 0);
  if (DOM.toggleMusic.checked) {
    sound.startMusic();
  }
  
  // Siguiente problema y foco inmediato
  nextProblem();
  setTimeout(forceInputFocus, 50);
}

function pauseGame() {
  if (!state.gameActive || state.isPaused) return;
  state.isPaused = true;
  
  // Acumular tiempo transcurrido
  state.accumulatedTime += Date.now() - state.startTime;
  
  // Detener timer
  stopTimerTicks();
  
  // Mostrar modal y estadísticas actuales
  DOM.pauseSolved.textContent = state.solvedCount;
  DOM.pauseStreak.textContent = state.currentStreak;
  DOM.modalPause.classList.add('active');
  
  // Desactivar input
  DOM.answerInput.disabled = true;
  DOM.answerInput.blur();
  
  // Pausar música si está activa
  sound.stopMusic();
}
 
function resumeGame() {
  if (!state.gameActive || !state.isPaused) return;
  state.isPaused = false;
  
  // Ocultar modal
  DOM.modalPause.classList.remove('active');
  
  // Reactivar input
  DOM.answerInput.disabled = false;
  
  // Reiniciar temporizadores
  state.startTime = Date.now();
  state.lastResponseTime = state.startTime;
  
  // Iniciar timer
  startTimerTicks();
  
  // Reanudar música
  if (DOM.toggleMusic.checked) {
    sound.startMusic();
  }
  
  // Enfocar input
  setTimeout(forceInputFocus, 50);
}
 
function stopGame() {
  if (!state.gameActive) return;
  state.gameActive = false;
  
  // Detener timer
  stopTimerTicks();
  
  // Ocultar modal de pausa si estaba abierto
  DOM.modalPause.classList.remove('active');
  DOM.answerInput.disabled = false;
  
  // Cambiar a música de menú
  sound.playMenuBGM();
  
  // Calcular duración acumulada total
  const elapsedThisSession = state.isPaused ? 0 : (Date.now() - state.startTime);
  const durationMs = state.accumulatedTime + elapsedThisSession;
  const durationSec = Math.floor(durationMs / 1000);
  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  const formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  
  const accuracy = state.attemptsCount > 0 
    ? Math.round((state.solvedCount / state.attemptsCount) * 100) 
    : 0;
    
  // Calcular velocidad en operaciones por minuto (OPM)
  const durationMinutes = durationSec / 60;
  const speed = durationMinutes > 0 
    ? (state.attemptsCount / durationMinutes).toFixed(1) 
    : 0;
    
  // Definir Badge e Insignia según desempeño
  const badge = getAchievementBadge(state.solvedCount, state.difficulty);
  
  // Mostrar valores en pantalla de resultados
  DOM.resultTotalSolved.textContent = state.solvedCount;
  DOM.achievementBadgeName.textContent = `Rango: ${badge}`;
  DOM.resultAccuracy.textContent = `${accuracy}%`;
  DOM.resultRatio.textContent = `${state.solvedCount} de ${state.attemptsCount} correctas`;
  DOM.resultSpeed.innerHTML = `${speed} <small>op/m</small>`;
  DOM.resultMaxStreak.textContent = state.maxStreak;
  DOM.resultDuration.textContent = formattedDuration;
  
  // Formatear texto de logro para compartir
  const diffName = { easy: 'Fácil', medium: 'Medio', auditor: 'Auditor (Nivel Alto)' }[state.difficulty];
  const shareText = `🔥 ¡Hoy entrené en MatemáticasYA!\n` +
                    `📊 Nivel: ${diffName}\n` +
                    `🏆 Operaciones Resueltas: ${state.solvedCount}\n` +
                    `⚡ Velocidad: ${speed} op/min\n` +
                    `📈 Precisión: ${accuracy}%\n` +
                    `🔥 Racha Máxima: ${state.maxStreak}\n` +
                    `⏱️ Tiempo entrenando: ${formattedDuration}\n` +
                    `Rango obtenido: ${badge}\n` +
                    `¿Puedes superarme? 🧠💪`;
  DOM.shareTextArea.value = shareText;
  
  // Fecha del juego
  const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  DOM.resultsDate.textContent = `Sesión del ${new Date().toLocaleDateString('es-ES', dateOptions)}`;
  
  // Cambiar pantalla a la de configuración
  switchScreen('screen-config');
  
  // Mostrar el panel de resultados y desplazarse a él suavemente
  DOM.resultsPanel.style.display = 'block';
  setTimeout(() => {
    DOM.resultsPanel.scrollIntoView({ behavior: 'smooth' });
  }, 100);
}

// --- GENERADOR MATEMÁTICO ---
function nextProblem() {
  state.chancesLeft = 1; // Restablecer oportunidades para la nueva operación
  
  // Escoger operación aleatoria de la lista de seleccionadas
  const op = state.operations[Math.floor(Math.random() * state.operations.length)];
  
  let n1 = 0;
  let n2 = 0;
  let answer = 0;
  let attempts = 0;
  const maxAttempts = 25; // Evitar bucles infinitos
  
  do {
    if (state.difficulty === 'easy') {
      // 1 dígito (1 al 9)
      n1 = Math.floor(Math.random() * 9) + 1;
      n2 = Math.floor(Math.random() * 9) + 1;
    } 
    else if (state.difficulty === 'medium') {
      // 2 dígitos (10 al 99)
      n1 = Math.floor(Math.random() * 90) + 10;
      n2 = Math.floor(Math.random() * 90) + 10;
    } 
    else {
      // Auditor: mezcla de números de 3 y 4 dígitos
      const isBig = Math.random() > 0.4; // 60% 3 dígitos, 40% 4 dígitos
      if (isBig) {
        n1 = Math.floor(Math.random() * 9000) + 1000;
        n2 = Math.floor(Math.random() * 9000) + 1000;
      } else {
        n1 = Math.floor(Math.random() * 900) + 100;
        n2 = Math.floor(Math.random() * 900) + 100;
      }
    }
    
    // Si es resta, evitar números negativos en TODOS los niveles para mantener el flujo de velocidad
    if (op === 'sub' && n1 < n2) {
      [n1, n2] = [n2, n1];
    }
    
    answer = (op === 'sum') ? (n1 + n2) : (n1 - n2);
    attempts++;
    
    // Criterios de filtrado para asegurar variedad:
    // 1. Evitar que el resultado final sea igual a los últimos 6 resultados.
    // 2. Evitar que la combinación exacta de operandos esté en las últimas 5 combinaciones.
    // 3. Evitar que n1 o n2 sean idénticos al n1 o n2 de la última pregunta.
    const isRepeatedResult = state.recentResults.includes(answer);
    const isRepeatedPair = state.recentPairs.some(p => p[0] === n1 && p[1] === n2);
    const isSameAsLast = n1 === state.num1 || n2 === state.num2;
    
    if (!isRepeatedResult && !isRepeatedPair && !isSameAsLast) {
      break;
    }
  } while (attempts < maxAttempts);
  
  state.num1 = n1;
  state.num2 = n2;
  state.currentAnswer = answer;
  
  // Guardar en el historial de recientes
  state.recentResults.push(answer);
  if (state.recentResults.length > 6) {
    state.recentResults.shift();
  }
  
  state.recentPairs.push([n1, n2]);
  if (state.recentPairs.length > 5) {
    state.recentPairs.shift();
  }
  
  if (op === 'sum') {
    state.opSymbol = '+';
    DOM.mathBoardCard.classList.add('op-sum');
    DOM.mathBoardCard.classList.remove('op-sub');
  } else {
    state.opSymbol = '−';
    DOM.mathBoardCard.classList.add('op-sub');
    DOM.mathBoardCard.classList.remove('op-sum');
  }
  
  // Renderizar en el tablero
  DOM.num1El.textContent = formatNumber(n1);
  DOM.num2El.textContent = formatNumber(n2);
  DOM.operatorEl.textContent = state.opSymbol;
  DOM.answerInput.value = '';
}

// Formatear números con puntos de miles para lectura de auditoría
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// --- GESTIÓN DE ENTRADA Y TECLADO ---

function forceInputFocus() {
  if (state.gameActive) {
    DOM.answerInput.focus();
  }
}

function handleInputKeydown(e) {
  // Tecla Enter para verificar la respuesta
  if (e.key === 'Enter') {
    e.preventDefault();
    verifyAnswer();
    return;
  }
  
  // Permitir teclas de edición habituales: Backspace, Delete, flechas, tab
  const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Minus', '-'];
  
  // Si no es un número y no está en la lista de teclas permitidas, bloquear
  if (!/[0-9\-]/.test(e.key) && !allowedKeys.includes(e.key)) {
    e.preventDefault();
  }
  
  // Evitar que el signo "-" se coloque en cualquier posición diferente al inicio del input
  // (Salvo que el foco esté al principio o haya una selección que empiece en el índice 0)
  if (e.key === '-' && DOM.answerInput.value.length > 0 && DOM.answerInput.selectionStart !== 0) {
    e.preventDefault();
  }
}

function verifyAnswer() {
  const inputVal = DOM.answerInput.value.trim();
  
  if (inputVal === '') return;
  
  const userAnswer = parseInt(inputVal, 10);
  const timeTaken = (Date.now() - state.lastResponseTime) / 1000;
  state.lastResponseTime = Date.now();
  
  let currentSpeedFactor = 1.0;
  if (timeTaken < 1.2) {
    currentSpeedFactor = 2.0; // Súper rápido (menos de 1.2s)
  } else if (timeTaken < 3.5) {
    currentSpeedFactor = 1.0 + (3.5 - timeTaken) / 2.3; // Rango intermedio de velocidad
  }
  
  if (userAnswer === state.currentAnswer) {
    // CORRECTO
    state.attemptsCount++;
    state.solvedCount++;
    state.focusPoints = Math.min(150, state.focusPoints + 1); // Subir 1 punto de enfoque
    state.currentStreak++;
    state.consecutiveErrors = 0; // Resetear errores consecutivos
    
    if (state.currentStreak > state.maxStreak) {
      state.maxStreak = state.currentStreak;
    }
    
    // SFX
    sound.playCorrect();
    
    // Retroalimentación visual
    flashBoard('success-flash');
    
    // Actualizar widgets
    DOM.gameSolved.textContent = state.solvedCount;
    DOM.gameStreak.textContent = state.currentStreak;
    
    // Suavizar velocidad promedio
    state.speedFactor = state.speedFactor * 0.6 + currentSpeedFactor * 0.4;
    
    // Actualizar intensidad de la música en base a la racha, factor de velocidad y puntos de enfoque
    sound.updateIntensity(state.currentStreak, state.speedFactor, state.focusPoints);
    
    // Generar siguiente problema
    nextProblem();
    forceInputFocus();
  } else {
    // INCORRECTO
    // Si responde rápido (menos de 3 segundos) y le quedan oportunidades, le damos reintento
    if (timeTaken < 3.0 && state.chancesLeft > 0) {
      state.chancesLeft--;
      
      // Sonido de advertencia corto y sutil
      sound.playWarning();
      
      // Animación de advertencia naranja
      flashBoard('warning-shake');
      
      // Limpiar input para otro intento
      DOM.answerInput.value = '';
      forceInputFocus();
      
      // Reiniciar contador de tiempo para este reintento
      state.lastResponseTime = Date.now();
    } else {
      // FALLO DEFINITIVO
      state.attemptsCount++;
      state.currentStreak = 0;
      state.consecutiveErrors++;
      
      // Detectar si fue un error intencionado / descuidado (hecho en menos de 1.2 segundos en este intento)
      const isIntentional = timeTaken < 1.2;
      
      // Penalizar enfoque (Hz) con mayor rigor si comete muchos errores o es intencionado
      let penalty = 2;
      if (isIntentional) {
        penalty = 5; // Mayor penalización por error intencionado/rápido
      } else if (state.consecutiveErrors === 2) {
        penalty = 4; // Segundo error consecutivo
      } else if (state.consecutiveErrors >= 3) {
        penalty = 8; // Racha de fallos consecutivos penaliza fuertemente
      }
      
      state.focusPoints = Math.max(0, state.focusPoints - penalty);
      
      // SFX de error
      sound.playIncorrect();
      
      // Retroalimentación visual de error
      flashBoard('error-shake');
      
      // Actualizar racha en la interfaz
      DOM.gameStreak.textContent = '0';
      
      // Bajar el ritmo. Permitimos que speedFactor baje de 1.0 (mínimo 0.6) para decelerar el tempo
      let speedReduction = 0.85; // Bajar 15% por defecto
      if (isIntentional || state.consecutiveErrors >= 2) {
        speedReduction = 0.70; // Bajar 30% si es intencionado o lleva varios errores
      }
      state.speedFactor = Math.max(0.6, state.speedFactor * speedReduction);
      
      // Actualizar intensidad de la música y del tono binaural
      sound.updateIntensity(state.currentStreak, state.speedFactor, state.focusPoints);
      
      // Generar siguiente problema
      nextProblem();
      forceInputFocus();
    }
  }
}

// Aplica clases temporales de animación al tablero de matemáticas
function flashBoard(className) {
  DOM.mathBoardCard.classList.remove('success-flash', 'error-shake');
  // Forzar reflujo para reiniciar animación en CSS
  void DOM.mathBoardCard.offsetWidth;
  DOM.mathBoardCard.classList.add(className);
}

// --- CONTROL DEL CRONÓMETRO DE JUEGO ---
function startTimerTicks() {
  stopTimerTicks();
  state.timerInterval = setInterval(() => {
    if (state.gameActive && !state.isPaused) {
      const elapsedMs = state.accumulatedTime + (Date.now() - state.startTime);
      const elapsedSec = Math.floor(elapsedMs / 1000);
      const minutes = Math.floor(elapsedSec / 60);
      const seconds = elapsedSec % 60;
      DOM.gameTimer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }, 200);
}

function stopTimerTicks() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

// --- DETERMINAR RANGO/BADGE DE LOGRO ---
function getAchievementBadge(solved, difficulty) {
  if (difficulty === 'auditor') {
    if (solved >= 50) return 'Auditor Legendario 👑';
    if (solved >= 25) return 'Analista Senior de Datos ⚡';
    if (solved >= 10) return 'Auditor Profesional 📊';
    return 'Auditor en Prácticas 📂';
  } 
  else if (difficulty === 'medium') {
    if (solved >= 40) return 'Calculadora Humana 🤖';
    if (solved >= 20) return 'Mago de las Sumas 🚀';
    if (solved >= 8) return 'Contador Ágil 📐';
    return 'Entrenando Números ✏️';
  } 
  else {
    if (solved >= 30) return 'Cerebro Veloz 🧠';
    if (solved >= 15) return 'Principiante Ágil ⚡';
    return 'Iniciación Numérica 📏';
  }
}

// --- COPIAR LOGRO AL PORTAPAPELES ---
function copyShareText() {
  const textToCopy = DOM.shareTextArea.value;
  
  navigator.clipboard.writeText(textToCopy)
    .then(() => {
      // Mostrar Toast
      DOM.copyToast.style.display = 'block';
      setTimeout(() => {
        DOM.copyToast.style.display = 'none';
      }, 1500);
    })
    .catch(err => {
      console.error('Error al copiar texto: ', err);
    });
}
