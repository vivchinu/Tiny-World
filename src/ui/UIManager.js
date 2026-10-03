export class UIManager {
  constructor(app) {
    this.app = app;

    // DOM Elements
    this.dockButtons = document.querySelectorAll('.dock-btn');
    this.subToolbar = document.getElementById('sub-toolbar');
    this.promptBadge = document.getElementById('prompt-badge');
    this.promptText = document.getElementById('prompt-text');

    this.btnPresets = document.getElementById('btn-presets');
    this.presetsModal = document.getElementById('presets-modal');
    this.btnCloseModal = document.getElementById('btn-close-modal');

    this.btnEnvToggle = document.getElementById('btn-env-toggle');
    this.envDrawer = document.getElementById('env-drawer');
    this.btnCloseDrawer = document.getElementById('btn-close-drawer');

    this.timeSlider = document.getElementById('time-slider');
    this.timePills = document.querySelectorAll('[data-time]');
    this.weatherPills = document.querySelectorAll('[data-weather]');

    this.btnUndo = document.getElementById('btn-undo');
    this.btnRedo = document.getElementById('btn-redo');
    this.btnAudio = document.getElementById('btn-audio');
    this.audioIconOn = document.getElementById('audio-icon-on');
    this.audioIconOff = document.getElementById('audio-icon-off');

    this.btnPhotoMode = document.getElementById('btn-photo-mode');
    this.btnExitPhoto = document.getElementById('btn-exit-photo');
    this.btnCapturePhoto = document.getElementById('btn-capture-photo');

    this.toast = document.getElementById('toast');

    // Sub-toolbar definitions
    this.toolVariations = {
      house: [
        { id: 'cottage', label: '🏡 Cottage', color: '#c2410c' },
        { id: 'manor', label: '🏛️ Manor', color: '#334155' },
        { id: 'mossy', label: '🌿 Mossy', color: '#4d7c0f' },
        { id: 'windmill', label: '🌾 Windmill', color: '#a16207' }
      ],
      wall: [
        { id: 'stone', label: '🧱 Stone Wall', color: '#78716c' },
        { id: 'wood', label: '🪵 Wood Fence', color: '#854d0e' },
        { id: 'hedge', label: '🍃 Hedge', color: '#2e7d32' }
      ],
      path: [
        { id: 'cobble', label: '🪨 Cobblestone', color: '#94a3b8' },
        { id: 'stepping', label: '⚪ Stepping Stones', color: '#cbd5e1' }
      ],
      tree: [
        { id: 'oak', label: '🌳 Oak', color: '#4d7c0f' },
        { id: 'pine', label: '🌲 Pine', color: '#1e3a29' },
        { id: 'sakura', label: '🌸 Sakura', color: '#f472b6' },
        { id: 'autumn', label: '🍁 Autumn', color: '#ea580c' },
        { id: 'birch', label: '🌾 Birch', color: '#a3e635' }
      ],
      pond: [
        { id: 'pond', label: '💧 Lily Pond', color: '#38bdf8' }
      ],
      prop: [
        { id: 'lantern', label: '🏮 Street Lamp', color: '#f59e0b' },
        { id: 'bench', label: '🪵 Park Bench', color: '#a16207' },
        { id: 'campfire', label: '🔥 Campfire', color: '#ef4444' },
        { id: 'well', label: '⛲ Wishing Well', color: '#64748b' },
        { id: 'flowers', label: '💐 Flower Patch', color: '#ec4899' }
      ]
    };

    this.promptTips = {
      house: { badge: 'HOUSE', text: 'Drag a rectangular footprint on the island to build' },
      wall: { badge: 'WALL', text: 'Drag a line between two points to construct walls' },
      path: { badge: 'PATH', text: 'Drag across the ground to lay down cobblestones' },
      tree: { badge: 'TREE', text: 'Click anywhere on the grass to plant a tree' },
      pond: { badge: 'POND', text: 'Drag outward to carve a tranquil water basin' },
      prop: { badge: 'PROPS', text: 'Click to place cozy village details' },
      inspect: { badge: 'INSPECT', text: 'Left-click + drag to orbit, scroll to zoom' },
      demolish: { badge: 'DEMOLISH', text: 'Click on any building or element to remove' }
    };

    this.setupListeners();
    this.updateSubToolbar('house');
  }

  setupListeners() {
    // Dock Buttons
    this.dockButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        this.selectTool(tool);
        this.app.audio.playUIClick();
      });
    });

    // Presets Modal
    this.btnPresets.addEventListener('click', () => {
      this.presetsModal.classList.add('open');
      this.app.audio.playUIClick();
    });

    this.btnCloseModal.addEventListener('click', () => {
      this.presetsModal.classList.remove('open');
    });

    this.presetsModal.addEventListener('click', (e) => {
      if (e.target === this.presetsModal) this.presetsModal.classList.remove('open');
    });

    // Quest 3 Guide Modal
    const btnQuest = document.getElementById('btn-quest-info');
    const questModal = document.getElementById('quest-modal');
    const btnCloseQuest = document.getElementById('btn-close-quest-modal');

    if (btnQuest && questModal) {
      btnQuest.addEventListener('click', () => {
        questModal.classList.add('open');
        this.app.audio.playUIClick();
      });

      if (btnCloseQuest) {
        btnCloseQuest.addEventListener('click', () => {
          questModal.classList.remove('open');
        });
      }

      questModal.addEventListener('click', (e) => {
        if (e.target === questModal) questModal.classList.remove('open');
      });
    }

    document.querySelectorAll('.preset-card').forEach((card) => {
      card.addEventListener('click', () => {
        const preset = card.dataset.preset;
        this.app.world.loadPreset(preset);
        this.presetsModal.classList.remove('open');
        this.showToast(`Loaded ${card.querySelector('h4').textContent}`);
        this.app.audio.playBuildChord();
      });
    });

    // Environment Drawer
    this.btnEnvToggle.addEventListener('click', () => {
      this.envDrawer.classList.toggle('open');
      this.app.audio.playUIClick();
    });

    this.btnCloseDrawer.addEventListener('click', () => {
      this.envDrawer.classList.remove('open');
    });

    // Time of Day
    this.timePills.forEach((pill) => {
      pill.addEventListener('click', () => {
        this.timePills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const timeType = pill.dataset.time;
        const timeVals = { dawn: 6.5, noon: 12.0, sunset: 18.0, night: 22.5 };
        const val = timeVals[timeType] || 12.0;
        this.timeSlider.value = val;
        this.showToast(`Updating Atmosphere (${timeType.toUpperCase()})... ☀️`);
        this.app.audio.playUIClick();
        requestAnimationFrame(() => {
          this.app.sceneManager.setTimeOfDay(val);
        });
      });
    });

    this.timeSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.timePills.forEach(p => p.classList.remove('active'));
      requestAnimationFrame(() => {
        this.app.sceneManager.setTimeOfDay(val);
      });
    });

    // Weather
    this.weatherPills.forEach((pill) => {
      pill.addEventListener('click', () => {
        this.weatherPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const weather = pill.dataset.weather;
        this.showToast(`Changing Weather (${weather.toUpperCase()})... 🌤️`);
        this.app.audio.playUIClick();
        requestAnimationFrame(() => {
          this.app.sceneManager.setWeather(weather);
        });
      });
    });

    // Camera Presets
    document.getElementById('cam-iso').addEventListener('click', () => {
      this.app.sceneManager.setCameraPreset('iso');
      this.app.audio.playUIClick();
    });
    document.getElementById('cam-close').addEventListener('click', () => {
      this.app.sceneManager.setCameraPreset('close');
      this.app.audio.playUIClick();
    });
    document.getElementById('cam-top').addEventListener('click', () => {
      this.app.sceneManager.setCameraPreset('top');
      this.app.audio.playUIClick();
    });

    // Undo / Redo
    this.btnUndo.addEventListener('click', () => {
      if (this.app.world.undo()) {
        this.showToast('Undone action');
        this.app.audio.playPop();
      }
    });

    this.btnRedo.addEventListener('click', () => {
      if (this.app.world.redo()) {
        this.showToast('Redone action');
        this.app.audio.playPop();
      }
    });

    // Audio Toggle
    this.btnAudio.addEventListener('click', () => {
      const muted = this.app.audio.toggleMute();
      this.audioIconOn.style.display = muted ? 'none' : 'block';
      this.audioIconOff.style.display = muted ? 'block' : 'none';
      this.showToast(muted ? 'Sound Muted' : 'Sound Enabled');
    });

    // Photo Mode
    this.btnPhotoMode.addEventListener('click', () => this.enterPhotoMode());
    this.btnExitPhoto.addEventListener('click', () => this.exitPhotoMode());
    this.btnCapturePhoto.addEventListener('click', () => this.capturePhoto());

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;

      if (e.key === '1') this.selectTool('house');
      if (e.key === '2') this.selectTool('wall');
      if (e.key === '3') this.selectTool('path');
      if (e.key === '4') this.selectTool('tree');
      if (e.key === '5') this.selectTool('pond');
      if (e.key === '6') this.selectTool('prop');
      if (e.key.toLowerCase() === 'q') this.selectTool('inspect');
      if (e.key.toLowerCase() === 'x') this.selectTool('demolish');

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) this.app.world.redo();
        else this.app.world.undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        this.app.world.redo();
      }
      if (e.key.toLowerCase() === 'p') {
        if (document.body.classList.contains('photo-mode')) this.exitPhotoMode();
        else this.enterPhotoMode();
      }
      if (e.key === 'Escape') {
        if (document.body.classList.contains('photo-mode')) this.exitPhotoMode();
        this.presetsModal.classList.remove('open');
        this.envDrawer.classList.remove('open');
      }
    });
  }

  selectTool(tool) {
    this.dockButtons.forEach((btn) => {
      if (btn.dataset.tool === tool) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    // Update Action Prompt
    const tip = this.promptTips[tool] || { badge: tool.toUpperCase(), text: '' };
    this.promptBadge.textContent = tip.badge;
    this.promptText.textContent = tip.text;

    // Update Sub-toolbar
    this.updateSubToolbar(tool);

    // Notify Raycaster
    const defaultVar = this.toolVariations[tool] ? this.toolVariations[tool][0].id : null;
    this.app.raycaster.setTool(tool, defaultVar);
  }

  updateSubToolbar(tool) {
    const vars = this.toolVariations[tool];
    this.subToolbar.innerHTML = '';

    if (!vars || vars.length <= 1) {
      this.subToolbar.classList.remove('visible');
      return;
    }

    this.subToolbar.classList.add('visible');

    vars.forEach((item, index) => {
      const btn = document.createElement('button');
      btn.className = `sub-pill-btn ${index === 0 ? 'active' : ''}`;
      btn.innerHTML = `<span class="sub-pill-swatch" style="background:${item.color};"></span><span>${item.label}</span>`;

      btn.addEventListener('click', () => {
        this.subToolbar.querySelectorAll('.sub-pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.app.raycaster.setVariation(item.id);
        this.app.audio.playUIClick();
      });

      this.subToolbar.appendChild(btn);
    });
  }

  enterPhotoMode() {
    document.body.classList.add('photo-mode');
    this.app.raycaster.setTool('inspect');
    this.showToast('Photo Mode: Frame your shot');
  }

  exitPhotoMode() {
    document.body.classList.remove('photo-mode');
    // Restore previous tool
    const activeBtn = document.querySelector('.dock-btn.active');
    if (activeBtn) {
      this.selectTool(activeBtn.dataset.tool);
    }
  }

  capturePhoto() {
    this.app.audio.playUIClick();

    // Render 3D scene cleanly
    this.app.sceneManager.render();

    const canvas = this.app.sceneManager.renderer.domElement;
    const dataURL = canvas.toDataURL('image/png');

    const link = document.createElement('a');
    link.download = `tiny-world-${Date.now()}.png`;
    link.href = dataURL;
    link.click();

    this.showToast('📸 Screenshot saved to Downloads!');
  }

  showToast(message) {
    this.toast.textContent = message;
    this.toast.classList.add('show');
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.toast.classList.remove('show');
    }, 2400);
  }
}
