// Motor de Audio y Música - MatemáticasYA
// Música de menú por MP3 local, música de juego sintetizada reactiva (Web Audio API) y SFX locales

class SoundEngine {
  constructor() {
    this.sfxEnabled = true;
    this.musicEnabled = true;
    
    // Música de menú MP3
    this.menuBGM = new Audio('sonidos/musicamenuyopciones.mp3');
    this.menuBGM.loop = true;
    this.menuBGM.volume = 0.20; // Establecemos un volumen moderado (20%) para que no suene demasiado fuerte
    
    // Configuración del sintetizador de juego (Web Audio API)
    this.ctx = null;
    this.isPlaying = false;      // Si el secuenciador de juego está reproduciendo
    this.isGameActive = false;   // Si estamos en la pantalla de juego
    this.bpm = 100;
    this.streak = 0;
    this.totalSolved = 0;
    this.speedFactor = 1.0;
    
    this.timerId = null;
    this.nextNoteTime = 0.0;
    this.currentStep = 0;
    
    // Secuenciador tiempos
    this.lookahead = 25.0; // ms
    this.scheduleAheadTime = 0.1; // segundos
    
    // Escala Mayor Pentatónica para música de juego (burbujas y campanas)
    this.scale = {
      bass: [65.41, 73.42, 82.41, 98.00, 110.00], // C2, D2, E2, G2, A2
      lead: [261.63, 293.66, 329.63, 392.00, 440.00, 523.25] // C4, D4, E4, G4, A4, C5
    };
    
    this.bassPattern = [0, 0, 3, 0, 4, 4, 3, 0, 1, 1, 3, 1, 2, 2, 4, 3];
  }

  // Inicializar contexto Web Audio
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Activar/Desactivar Efectos de Sonido
  setSFXEnabled(val) {
    this.sfxEnabled = val;
  }

  // Activar/Desactivar Música
  setMusicEnabled(val) {
    this.musicEnabled = val;
    this.init();
    if (val) {
      if (this.isGameActive) {
        this.startMusic();
      } else {
        this.playMenuBGM();
      }
    } else {
      this.stopAllMusic();
    }
  }

  // Reproducir música del menú (MP3)
  playMenuBGM() {
    if (!this.musicEnabled) return;
    this.isGameActive = false;
    
    // Detener sintetizador
    this.stopSequencer();
    
    // Evitar reiniciar si la música ya se está reproduciendo
    if (!this.menuBGM.paused) return;
    
    // Iniciar MP3 de menú
    this.menuBGM.currentTime = 0;
    this.menuBGM.play().catch(err => {
      console.log("Esperando interacción del usuario para reproducir menú BGM.");
    });
  }

  // Detener absolutamente todo
  stopAllMusic() {
    this.menuBGM.pause();
    this.stopSequencer();
    this.stopBinauralBeats();
  }

  // Detiene el temporizador del secuenciador
  stopSequencer() {
    this.isPlaying = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  // Iniciar la música de juego (Sintetizador Web Audio)
  startMusic() {
    this.init();
    this.isGameActive = true;
    this.isPlaying = true;
    
    // Detener MP3 del menú
    this.menuBGM.pause();
    
    // Iniciar secuenciador
    this.nextNoteTime = this.ctx.currentTime;
    this.currentStep = 0;
    this.scheduler();
    
    // Iniciar Binaural Beats reactivos de fondo
    this.startBinauralBeats();
  }

  // Pausar sintetizador de juego
  stopMusic() {
    this.stopSequencer();
    this.stopBinauralBeats();
  }

  // Ajusta la intensidad (tempo y brillo de filtros)
  updateIntensity(streak, speedFactor = 1.0, totalSolved = 0) {
    this.streak = streak;
    this.speedFactor = speedFactor;
    this.totalSolved = totalSolved;
    
    if (totalSolved < 5) {
      const speedPenalty = speedFactor < 1.0 ? Math.min(0, (speedFactor - 1.0) * 40) : 0;
      this.bpm = Math.round(100 + speedPenalty);
    } else {
      const streakBonus = Math.min(streak * 3.5, 35);
      const speedBonus = (speedFactor - 1.0) * 45;
      this.bpm = Math.round(110 + streakBonus + speedBonus);
    }
    
    // Forzar límites razonables para el tempo
    this.bpm = Math.max(70, Math.min(180, this.bpm));
    
    // Actualizar la frecuencia de los Binaural Beats
    this.updateBinauralBeatsFreq(totalSolved);
  }

  // --- AUDIO BINAURAL (BINAURAL BEATS) ---
  startBinauralBeats() {
    if (!this.ctx || !this.musicEnabled) return;
    
    // Detener si ya están activas
    this.stopBinauralBeats();
    
    this.binauralLeftOsc = this.ctx.createOscillator();
    this.binauralRightOsc = this.ctx.createOscillator();
    this.binauralGain = this.ctx.createGain();
    
    const pannerLeft = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    const pannerRight = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    
    // Frecuencia base agradable (tono bajo)
    const baseFreq = 140; // 140 Hz hum de fondo
    this.binauralLeftOsc.type = 'sine';
    this.binauralLeftOsc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
    
    // Iniciar en Ondas Alfa (diferencia de 8 Hz: 148 Hz en el canal derecho, alineado con la fórmula)
    this.binauralRightOsc.type = 'sine';
    this.binauralRightOsc.frequency.setValueAtTime(baseFreq + 8, this.ctx.currentTime);
    
    // Ajustar ganancia baja para acompañar la música sutilmente
    this.binauralGain.gain.setValueAtTime(0.02, this.ctx.currentTime);
    
    if (pannerLeft) {
      pannerLeft.pan.setValueAtTime(-1, this.ctx.currentTime);
      this.binauralLeftOsc.connect(pannerLeft);
      pannerLeft.connect(this.binauralGain);
    } else {
      this.binauralLeftOsc.connect(this.binauralGain);
    }
    
    if (pannerRight) {
      pannerRight.pan.setValueAtTime(1, this.ctx.currentTime);
      this.binauralRightOsc.connect(pannerRight);
      pannerRight.connect(this.binauralGain);
    } else {
      this.binauralRightOsc.connect(this.binauralGain);
    }
    
    this.binauralGain.connect(this.ctx.destination);
    
    this.binauralLeftOsc.start(0);
    this.binauralRightOsc.start(0);
  }

  stopBinauralBeats() {
    if (this.binauralLeftOsc) {
      try { this.binauralLeftOsc.stop(); } catch(e) {}
      this.binauralLeftOsc = null;
    }
    if (this.binauralRightOsc) {
      try { this.binauralRightOsc.stop(); } catch(e) {}
      this.binauralRightOsc = null;
    }
    if (this.binauralGain) {
      this.binauralGain.disconnect();
      this.binauralGain = null;
    }
  }

  updateBinauralBeatsFreq(totalSolved) {
    const baseFreq = 140;
    // Escala continua de 8 Hz (Alfa) hasta 30 Hz (Beta - Concentración de Estudio) a lo largo de 150 operaciones
    const beatFreq = 8 + Math.min(totalSolved * 0.1466, 22);
    
    // Actualizar la gráfica vertical (siempre se actualiza en el DOM, incluso si el oscilador de audio no está creado aún)
    this.updateFocusGaugeUI(beatFreq, totalSolved);
    
    if (!this.ctx || !this.binauralRightOsc) return;
    
    const targetFreq = baseFreq + beatFreq;
    const now = this.ctx.currentTime;
    
    // Transición suave de frecuencia de 1.5s
    this.binauralRightOsc.frequency.setTargetAtTime(targetFreq, now, 0.5);
  }

  updateFocusGaugeUI(beatFreq, totalSolved) {
    const gaugeBar = document.getElementById('focus-gauge-bar');
    const gaugeLabel = document.getElementById('focus-gauge-label');
    
    if (gaugeBar && gaugeLabel) {
      // Calcular porcentaje de la barra (rango de 8Hz a 30Hz es de 22Hz)
      const percent = Math.min(((beatFreq - 8) / 22) * 100, 100);
      gaugeBar.style.height = `${percent}%`;
      
      // Mostrar etiqueta de frecuencia redondeada
      gaugeLabel.textContent = `${Math.round(beatFreq)}Hz`;
      
      // Ajustar opacidad sutilmente según la intensidad (de 0.15 a 0.30)
      const container = gaugeBar.closest('.focus-gauge-container');
      if (container) {
        container.style.opacity = 0.15 + (percent / 100) * 0.15;
      }
    }
  }

  // --- SECUENCIADOR SINTETIZADO (Música del juego) ---

  scheduler() {
    if (!this.isPlaying) return;
    
    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.currentStep, this.nextNoteTime);
      this.advanceNote();
    }
    
    this.timerId = setTimeout(() => this.scheduler(), this.lookahead);
  }

  advanceNote() {
    const secondsPerBeat = 60.0 / this.bpm;
    this.nextNoteTime += 0.25 * secondsPerBeat;
    this.currentStep = (this.currentStep + 1) % 16;
  }

  scheduleNote(step, time) {
    if (!this.musicEnabled) return;

    const factor = this.speedFactor || 1.0;
    const filterCutoff = 150 + Math.min((factor - 1.0) * 350, 400);

    // --- CAPA 1: BASSLINE BURBUJEANTE ---
    const bassIdx = this.bassPattern[step];
    const bassFreq = this.scale.bass[bassIdx % this.scale.bass.length];
    this.triggerBubblyBass(bassFreq, time, filterCutoff);

    // --- CAPA 2: LATIDO DIGITAL (Bombo acuático) ---
    if (step % 4 === 0) {
      this.triggerWaterKick(time);
    }

    // --- CAPA 3: GOTA DE AGUA RÍTMICA (Rítmico progresivo, orgánico) ---
    // Se activa tras resolver 10 operaciones, en los contra-tiempos
    if (this.totalSolved >= 10) {
      if (step % 4 === 2) {
        this.triggerWaterDrip(time);
      }
    }

    // --- CAPA 4: WATER SNARE / RIMSHOT (Rítmico progresivo) ---
    // Se activa tras resolver 20 operaciones, en los tiempos de caja (4 y 12)
    if (this.totalSolved >= 20) {
      if (step === 4 || step === 12) {
        this.triggerWaterSnare(time);
      }
    }

    // --- CAPA 5: ARPEGIO CRISTALINO DE ALTA INTENSIDAD ---
    // Solo se activa tras resolver 5 problemas en total
    if (this.totalSolved >= 5) {
      if (step % 2 === 0) {
        const leadIdx = (step * 3 + this.streak) % this.scale.lead.length;
        const melodyFreq = this.scale.lead[leadIdx];
        this.triggerBubblyArpeggio(melodyFreq, time, factor);
      } else if (this.streak >= 6) {
        // Racha alta acelera densidad armónica
        const leadIdx = (step * 7) % this.scale.lead.length;
        const melodyFreq = this.scale.lead[leadIdx] * 1.5;
        this.triggerBubblyArpeggio(melodyFreq, time, factor);
      }
    }
  }

  triggerBubblyBass(freq, time, filterFreq) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    
    filter.type = 'lowpass';
    filter.Q.setValueAtTime(8, time);
    
    filter.frequency.setValueAtTime(filterFreq * 2, time);
    filter.frequency.exponentialRampToValueAtTime(filterFreq, time + 0.12);
    
    gain.gain.setValueAtTime(0.14, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.20);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(time);
    osc.stop(time + 0.22);
  }

  triggerBubblyArpeggio(freq, time, speedFactor) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.05, time + 0.03);
    
    const volume = Math.min(0.018 * speedFactor, 0.05);
    
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(time);
    osc.stop(time + 0.28);
  }

  triggerWaterKick(time) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(100, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.12);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(120, time);
    
    gain.gain.setValueAtTime(0.24, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(time);
    osc.stop(time + 0.16);
  }

  triggerWaterDrip(time) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, time); // Tono de gota cristalino
    osc.frequency.exponentialRampToValueAtTime(300, time + 0.04);
    
    gain.gain.setValueAtTime(0.014, time); // Muy sutil y suave de fondo
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(time);
    osc.stop(time + 0.05);
  }

  triggerWaterSnare(time) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, time);
    osc.frequency.exponentialRampToValueAtTime(150, time + 0.08);
    
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, time);
    filter.Q.setValueAtTime(2, time);
    
    gain.gain.setValueAtTime(0.035, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(time);
    osc.stop(time + 0.09);
  }

  // --- EFECTOS DE SONIDO (SFX SINTETIZADOS) ---
  
  playCorrect() {
    if (!this.sfxEnabled) return;
    this.init();
    const now = this.ctx.currentTime;
    
    // Pop de burbuja
    const bubbleOsc = this.ctx.createOscillator();
    const bubbleGain = this.ctx.createGain();
    bubbleOsc.type = 'sine';
    bubbleOsc.frequency.setValueAtTime(180, now);
    bubbleOsc.frequency.exponentialRampToValueAtTime(1400, now + 0.05);
    bubbleGain.gain.setValueAtTime(0.001, now);
    bubbleGain.gain.linearRampToValueAtTime(0.12, now + 0.015);
    bubbleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    bubbleOsc.connect(bubbleGain);
    bubbleGain.connect(this.ctx.destination);
    bubbleOsc.start(now);
    bubbleOsc.stop(now + 0.06);

    // Campana de cristal
    const bellOsc1 = this.ctx.createOscillator();
    const bellGain = this.ctx.createGain();
    bellOsc1.type = 'sine';
    bellOsc1.frequency.setValueAtTime(1975.53, now + 0.01);
    bellGain.gain.setValueAtTime(0.001, now);
    bellGain.gain.linearRampToValueAtTime(0.08, now + 0.03);
    bellGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    bellOsc1.connect(bellGain);
    bellGain.connect(this.ctx.destination);
    bellOsc1.start(now);
    bellOsc1.stop(now + 0.45);
  }

  playIncorrect() {
    if (!this.sfxEnabled) return;
    this.init();
    const now = this.ctx.currentTime;
    const modulator = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const carrier = this.ctx.createOscillator();
    const carrierGain = this.ctx.createGain();
    
    modulator.type = 'sawtooth';
    modulator.frequency.setValueAtTime(90, now);
    modGain.gain.setValueAtTime(800, now);
    
    carrier.type = 'triangle';
    carrier.frequency.setValueAtTime(350, now);
    carrier.frequency.exponentialRampToValueAtTime(80, now + 0.22);
    
    carrierGain.gain.setValueAtTime(0.2, now);
    carrierGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    
    modulator.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(carrierGain);
    carrierGain.connect(this.ctx.destination);
    
    modulator.start(now);
    carrier.start(now);
    modulator.stop(now + 0.25);
    carrier.stop(now + 0.25);
  }

  playWarning() {
    if (!this.sfxEnabled) return;
    this.init();
    const now = this.ctx.currentTime;
    
    // Tono de advertencia suave (doble bip corto ascendente)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(330, now); // Mi (E4)
    osc.frequency.setValueAtTime(392, now + 0.07); // Sol (G4)
    
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.15);
  }
}

window.sound = new SoundEngine();
