// QLess Taxi Rank System - Core Application Logic with Pre-registered Plates

const TaxiSystem = (function() {
  // ========== DATA STRUCTURE ==========
  let routes = [
    { id: 'town', name: '🏙️ Town', active: true },
    { id: 'mall', name: '🛍️ Mall', active: true },
    { id: 'station', name: '🚉 Station', active: true },
    { id: 'hospital', name: '🏥 Hospital', active: true },
    { id: 'school', name: '🏫 School', active: true },
    { id: 'market', name: '🛒 Market', active: true },
    { id: 'airport', name: '✈️ Airport', active: true },
    { id: 'university', name: '🎓 University', active: true },
    { id: 'industrial', name: '🏭 Industrial', active: true },
    { id: 'residential', name: '🏠 Residential', active: true }
  ];
  
  // PRE-REGISTERED TAXI PLATES (You manage these)
  let registeredPlates = [
    { plate: "ABC123 GP", owner: "Thabo Motors", active: true },
    { plate: "DEF456 GP", owner: "Soweto Taxis", active: true },
    { plate: "GHI789 GP", owner: "Johannesburg Cabs", active: true },
    { plate: "JKL012 GP", owner: "Alexandra Taxis", active: true },
    { plate: "MNO345 GP", owner: "Diepkloof Transport", active: true },
    { plate: "PQR678 GP", owner: "Orlando Cabs", active: true },
    { plate: "STU901 GP", owner: "Meadowlands Taxis", active: true },
    { plate: "VWX234 GP", owner: "Protea Transport", active: true },
    { plate: "YZA567 GP", owner: "Pimville Cabs", active: true },
    { plate: "BCD890 GP", owner: "Dube Taxis", active: true }
  ];
  
  let queues = {};  // { routeId: [{ id, plate, driverName, joinTime, status }] }
  let currentLoading = {};  // { routeId: taxiId }
  let analytics = {};  // { routeId: { totalServed: 0 } }
  
  let currentDriver = null;
  let currentMarshalRoute = null;
  let refreshInterval = null;
  let audioContext = null;
  
  // ========== INITIALIZATION ==========
  function init() {
    loadFromStorage();
    if (Object.keys(queues).length === 0) {
      routes.forEach(route => {
        queues[route.id] = [];
        analytics[route.id] = { totalServed: 0 };
      });
    }
    saveToStorage();
  }
  
  function loadFromStorage() {
    const savedQueues = localStorage.getItem('taxi_queues');
    const savedAnalytics = localStorage.getItem('taxi_analytics');
    const savedRoutes = localStorage.getItem('taxi_routes');
    const savedPlates = localStorage.getItem('taxi_registered_plates');
    
    if (savedQueues) queues = JSON.parse(savedQueues);
    if (savedAnalytics) analytics = JSON.parse(savedAnalytics);
    if (savedRoutes) routes = JSON.parse(savedRoutes);
    if (savedPlates) registeredPlates = JSON.parse(savedPlates);
  }
  
  function saveToStorage() {
    localStorage.setItem('taxi_queues', JSON.stringify(queues));
    localStorage.setItem('taxi_analytics', JSON.stringify(analytics));
    localStorage.setItem('taxi_routes', JSON.stringify(routes));
    localStorage.setItem('taxi_registered_plates', JSON.stringify(registeredPlates));
  }
  
  // ========== PLATE MANAGEMENT ==========
  function getRegisteredPlates() {
    return registeredPlates.filter(p => p.active);
  }
  
  function addRegisteredPlate(plate, owner) {
    const existing = registeredPlates.find(p => p.plate === plate.toUpperCase());
    if (existing) {
      showToast(`⚠️ Plate ${plate} already exists!`);
      return false;
    }
    registeredPlates.push({
      plate: plate.toUpperCase(),
      owner: owner || 'Unknown',
      active: true
    });
    saveToStorage();
    triggerUpdate();
    showToast(`✅ Plate ${plate} added successfully!`);
    return true;
  }
  
  function removeRegisteredPlate(plate) {
    const index = registeredPlates.findIndex(p => p.plate === plate);
    if (index !== -1) {
      // Check if plate is currently in any queue
      let inQueue = false;
      for (const routeId in queues) {
        if (queues[routeId].some(t => t.plate === plate && t.status !== 'departed')) {
          inQueue = true;
          break;
        }
      }
      if (inQueue) {
        showToast(`⚠️ Cannot remove ${plate} - taxi is currently in queue!`);
        return false;
      }
      registeredPlates.splice(index, 1);
      saveToStorage();
      triggerUpdate();
      showToast(`❌ Plate ${plate} removed`);
      return true;
    }
    return false;
  }
  
  function togglePlateStatus(plate) {
    const plateEntry = registeredPlates.find(p => p.plate === plate);
    if (plateEntry) {
      plateEntry.active = !plateEntry.active;
      saveToStorage();
      triggerUpdate();
      showToast(`${plateEntry.active ? '✅ Activated' : '⛔ Deactivated'} ${plate}`);
    }
  }
  
  // ========== HELPER FUNCTIONS ==========
  function generateId() {
    return Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  
  function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  }
  
  function calculateWaitTime(position) {
    const baseWait = position * 6;
    return `${baseWait} min`;
  }
  
  function playSound() {
    try {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.frequency.value = 800;
      gain.gain.value = 0.3;
      oscillator.start();
      gain.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 1);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch(e) { console.log('Audio not supported'); }
  }
  
  function showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
  }
  
  // ========== QUEUE MANAGEMENT ==========
  function isPlateValid(plate) {
    return registeredPlates.some(p => p.plate === plate && p.active);
  }
  
  function joinQueue(plate, driverName, routeId) {
    // Validate plate is pre-registered
    if (!isPlateValid(plate)) {
      showToast(`❌ Taxi ${plate} is not registered! Contact marshal to add it.`);
      return false;
    }
    
    // Check for duplicate in same route
    const routeQueue = queues[routeId] || [];
    const existing = routeQueue.find(t => t.plate === plate && t.status !== 'departed');
    if (existing) {
      showToast(`⚠️ Taxi ${plate} is already in queue for this route!`);
      return false;
    }
    
    const plateInfo = registeredPlates.find(p => p.plate === plate);
    
    const newTaxi = {
      id: generateId(),
      plate: plate.toUpperCase(),
      driverName: driverName || plateInfo?.owner || 'Anonymous',
      joinTime: Date.now(),
      status: 'waiting',
      routeId: routeId
    };
    
    queues[routeId].push(newTaxi);
    saveToStorage();
    triggerUpdate();
    showToast(`✅ ${plate} joined the ${getRouteName(routeId)} queue! Position: ${queues[routeId].length}`);
    return true;
  }
  
  function leaveQueue(plate, routeId) {
    const routeQueue = queues[routeId];
    const index = routeQueue.findIndex(t => t.plate === plate && t.status !== 'departed');
    if (index !== -1) {
      routeQueue.splice(index, 1);
      saveToStorage();
      triggerUpdate();
      showToast(`❌ ${plate} removed from queue`);
      return true;
    }
    return false;
  }
  
  function callNext(routeId) {
    const routeQueue = queues[routeId];
    const waitingIndex = routeQueue.findIndex(t => t.status === 'waiting');
    
    if (waitingIndex === -1) {
      showToast(`No waiting taxis for ${getRouteName(routeId)}`);
      return false;
    }
    
    const nextTaxi = routeQueue[waitingIndex];
    nextTaxi.status = 'next';
    currentLoading[routeId] = nextTaxi.id;
    
    const soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
    if (soundEnabled) playSound();
    
    saveToStorage();
    triggerUpdate();
    showToast(`📢 CALLING NEXT: ${nextTaxi.plate} for ${getRouteName(routeId)}`, 5000);
    
    // Flash notification
    if (typeof window.flashNotification === 'function') {
      window.flashNotification(nextTaxi.plate, getRouteName(routeId));
    }
    
    return true;
  }
  
  function markDeparted(routeId, taxiId) {
    const routeQueue = queues[routeId];
    const index = routeQueue.findIndex(t => t.id === taxiId);
    if (index !== -1) {
      const departed = routeQueue[index];
      analytics[routeId].totalServed = (analytics[routeId].totalServed || 0) + 1;
      routeQueue.splice(index, 1);
      delete currentLoading[routeId];
      saveToStorage();
      triggerUpdate();
      showToast(`✅ ${departed.plate} DEPARTED! Total served: ${analytics[routeId].totalServed}`);
    }
  }
  
  function clearQueue(routeId) {
    if (confirm(`Clear entire queue for ${getRouteName(routeId)}?`)) {
      queues[routeId] = [];
      delete currentLoading[routeId];
      saveToStorage();
      triggerUpdate();
      showToast(`🗑️ Queue cleared for ${getRouteName(routeId)}`);
    }
  }
  
  // ========== ROUTE MANAGEMENT ==========
  function getRouteName(routeId) {
    const route = routes.find(r => r.id === routeId);
    return route ? route.name : routeId;
  }
  
  function getAllRoutes() {
    return routes.filter(r => r.active);
  }
  
  function addRoute(name) {
    if (routes.length >= 10) {
      showToast('Maximum 10 routes reached!');
      return false;
    }
    const newId = name.toLowerCase().replace(/[^a-z]/g, '_');
    if (routes.find(r => r.id === newId)) {
      showToast('Route already exists!');
      return false;
    }
    routes.push({ id: newId, name: name, active: true });
    queues[newId] = [];
    analytics[newId] = { totalServed: 0 };
    saveToStorage();
    triggerUpdate();
    showToast(`✅ Route "${name}" added!`);
    return true;
  }
  
  function removeRoute(routeId) {
    if (routes.length <= 1) {
      showToast('Cannot remove the last route!');
      return false;
    }
    routes = routes.filter(r => r.id !== routeId);
    delete queues[routeId];
    delete analytics[routeId];
    saveToStorage();
    triggerUpdate();
    showToast(`Route removed`);
    return true;
  }
  
  // ========== UI UPDATE TRIGGER ==========
  function triggerUpdate() {
    window.dispatchEvent(new CustomEvent('taxiQueueUpdate', { 
      detail: { queues, currentLoading, analytics, routes, registeredPlates } 
    }));
  }
  
  // ========== DRIVER SCREEN ==========
  function initDriver() {
    init();
    renderRoutesForDriver();
    renderPlateSelect();
    
    // Check if driver has existing session
    const savedPlate = localStorage.getItem('driver_plate');
    const savedRoute = localStorage.getItem('driver_route');
    if (savedPlate && savedRoute) {
      const routeQueue = queues[savedRoute];
      const existing = routeQueue?.find(t => t.plate === savedPlate && t.status !== 'departed');
      if (existing) {
        currentDriver = existing;
        showDriverStatus(existing);
        document.getElementById('registerSection').style.display = 'none';
        document.getElementById('statusSection').style.display = 'block';
      }
    }
    
    window.addEventListener('taxiQueueUpdate', () => {
      renderPlateSelect(); // Refresh plate list if changed
      if (currentDriver) {
        const updated = queues[currentDriver.routeId]?.find(t => t.id === currentDriver.id);
        if (updated) {
          currentDriver = updated;
          showDriverStatus(updated);
        } else if (currentDriver) {
          document.getElementById('registerSection').style.display = 'block';
          document.getElementById('statusSection').style.display = 'none';
          currentDriver = null;
          localStorage.removeItem('driver_plate');
          localStorage.removeItem('driver_route');
          showToast('You have been removed from the queue');
        }
      }
    });
    
    const soundToggle = document.getElementById('soundEnabled');
    if (soundToggle) {
      soundToggle.addEventListener('change', (e) => {
        localStorage.setItem('soundEnabled', e.target.checked);
      });
      const savedSound = localStorage.getItem('soundEnabled');
      if (savedSound !== null) soundToggle.checked = savedSound === 'true';
    }
    
    document.getElementById('joinQueueBtn')?.addEventListener('click', () => {
      const driverName = document.getElementById('driverName').value;
      const plate = document.getElementById('plateSelect').value;
      const selectedRoute = document.querySelector('.route-btn.selected')?.dataset.routeId;
      
      if (!plate) {
        showToast('Please select your taxi plate');
        return;
      }
      if (!selectedRoute) {
        showToast('Please select a route');
        return;
      }
      
      if (joinQueue(plate, driverName, selectedRoute)) {
        localStorage.setItem('driver_plate', plate);
        localStorage.setItem('driver_route', selectedRoute);
        document.getElementById('registerSection').style.display = 'none';
        document.getElementById('statusSection').style.display = 'block';
        
        const routeQueue = queues[selectedRoute];
        currentDriver = routeQueue.find(t => t.plate === plate);
        showDriverStatus(currentDriver);
        
        document.getElementById('driverName').value = '';
      }
    });
    
    document.getElementById('leaveQueueBtn')?.addEventListener('click', () => {
      if (currentDriver && leaveQueue(currentDriver.plate, currentDriver.routeId)) {
        document.getElementById('registerSection').style.display = 'block';
        document.getElementById('statusSection').style.display = 'none';
        currentDriver = null;
        localStorage.removeItem('driver_plate');
        localStorage.removeItem('driver_route');
      }
    });
  }
  
  function renderPlateSelect() {
    const select = document.getElementById('plateSelect');
    if (!select) return;
    
    const plates = getRegisteredPlates();
    select.innerHTML = '<option value="">-- Select your taxi registration --</option>' +
      plates.map(plate => `<option value="${plate.plate}">${plate.plate} (${plate.owner})</option>`).join('');
  }
  
  function renderRoutesForDriver() {
    const container = document.getElementById('routesGrid');
    if (!container) return;
    
    container.innerHTML = getAllRoutes().map(route => `
      <div class="route-btn" data-route-id="${route.id}">
        ${route.name}
      </div>
    `).join('');
    
    document.querySelectorAll('.route-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.route-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });
  }
  
  function showDriverStatus(taxi) {
    const position = queues[taxi.routeId]?.findIndex(t => t.id === taxi.id) + 1 || '?';
    const waitTime = calculateWaitTime(position);
    
    document.getElementById('queuePosition').textContent = `#${position}`;
    document.getElementById('waitTime').textContent = `⏱️ Est. wait: ${waitTime}`;
    document.getElementById('routeName').textContent = getRouteName(taxi.routeId);
    document.getElementById('taxiPlate').textContent = taxi.plate;
    document.getElementById('driverDisplayName').textContent = taxi.driverName;
    
    const statusBadge = document.getElementById('statusBadge');
    let statusText = 'Waiting';
    let statusClass = 'status-waiting';
    
    if (taxi.status === 'next') {
      statusText = '🔔 YOU ARE NEXT! Proceed to loading';
      statusClass = 'status-next';
      if (localStorage.getItem('soundEnabled') !== 'false') playSound();
    } else if (taxi.status === 'loading') {
      statusText = '🚐 Loading passengers...';
      statusClass = 'status-loading';
    } else if (taxi.status === 'departed') {
      statusText = '✅ Departed';
      statusClass = 'status-departed';
    }
    
    statusBadge.textContent = statusText;
    statusBadge.className = `status-badge ${statusClass}`;
    
    if (taxi.status === 'next') {
      const statusCard = document.getElementById('statusCard');
      statusCard.style.animation = 'pulse 0.5s infinite';
      setTimeout(() => { statusCard.style.animation = ''; }, 5000);
    }
  }
  
  // ========== MARSHAL SCREEN ==========
  function initMarshal() {
    init();
    renderRouteTabs();
    renderAnalytics();
    
    if (getAllRoutes().length > 0) {
      currentMarshalRoute = getAllRoutes()[0].id;
      renderQueueForRoute(currentMarshalRoute);
    }
    
    window.addEventListener('taxiQueueUpdate', () => {
      renderAnalytics();
      if (currentMarshalRoute) renderQueueForRoute(currentMarshalRoute);
    });
    
    document.getElementById('callNextBtn')?.addEventListener('click', () => {
      if (currentMarshalRoute) callNext(currentMarshalRoute);
    });
    
    document.getElementById('clearQueueBtn')?.addEventListener('click', () => {
      if (currentMarshalRoute) clearQueue(currentMarshalRoute);
    });
    
    document.getElementById('refreshBtn')?.addEventListener('click', () => {
      renderQueueForRoute(currentMarshalRoute);
      renderAnalytics();
      showToast('Refreshed');
    });
    
    document.getElementById('editRoutesBtn')?.addEventListener('click', () => {
      renderEditRoutesModal();
      document.getElementById('editRoutesModal').style.display = 'flex';
    });
    
    document.getElementById('managePlatesBtn')?.addEventListener('click', () => {
      renderManagePlatesModal();
      document.getElementById('managePlatesModal').style.display = 'flex';
    });
    
    document.getElementById('closeModalBtn')?.addEventListener('click', () => {
      document.getElementById('editRoutesModal').style.display = 'none';
    });
    
    document.getElementById('closePlatesModalBtn')?.addEventListener('click', () => {
      document.getElementById('managePlatesModal').style.display = 'none';
    });
    
    document.getElementById('addRouteBtn')?.addEventListener('click', () => {
      const newName = document.getElementById('newRouteName').value;
      if (newName) {
        addRoute(newName);
        document.getElementById('newRouteName').value = '';
        renderRouteTabs();
        renderEditRoutesModal();
      }
    });
    
    document.getElementById('addPlateBtn')?.addEventListener('click', () => {
      const newPlate = document.getElementById('newPlateNumber').value;
      if (newPlate) {
        addRegisteredPlate(newPlate, 'New Owner');
        document.getElementById('newPlateNumber').value = '';
        renderManagePlatesModal();
        renderPlateSelect(); // Update driver dropdown
      }
    });
  }
  
  function renderRouteTabs() {
    const container = document.getElementById('routeTabs');
    if (!container) return;
    
    container.innerHTML = getAllRoutes().map(route => `
      <button class="route-tab ${currentMarshalRoute === route.id ? 'active' : ''}" data-route-id="${route.id}">
        ${route.name}
      </button>
    `).join('');
    
    document.querySelectorAll('.route-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        currentMarshalRoute = tab.dataset.routeId;
        renderRouteTabs();
        renderQueueForRoute(currentMarshalRoute);
      });
    });
  }
  
  function renderAnalytics() {
    const container = document.getElementById('analyticsGrid');
    if (!container) return;
    
    container.innerHTML = getAllRoutes().map(route => `
      <div class="analytics-card">
        <div class="analytics-number">${analytics[route.id]?.totalServed || 0}</div>
        <div>Served: ${route.name}</div>
      </div>
    `).join('');
  }
  
  function renderQueueForRoute(routeId) {
    const container = document.getElementById('queueList');
    const title = document.getElementById('activeRouteTitle');
    if (!container) return;
    
    const routeQueue = queues[routeId] || [];
    const loadingId = currentLoading[routeId];
    
    title.textContent = `${getRouteName(routeId)} Queue (${routeQueue.length} waiting)`;
    
    if (routeQueue.length === 0) {
      container.innerHTML = '<div style="text-align: center; padding: 2rem; color: #666;">✨ No taxis in queue</div>';
      return;
    }
    
    container.innerHTML = routeQueue.map((taxi, idx) => `
      <div class="queue-item ${loadingId === taxi.id ? 'now-loading' : ''}">
        <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
          <span class="queue-position">#${idx + 1}</span>
          <div>
            <strong>${taxi.plate}</strong>
            <div style="font-size: 0.7rem; color: #666;">${taxi.driverName} · Joined: ${formatTime(taxi.joinTime)}</div>
          </div>
        </div>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <span class="status-badge status-${taxi.status}">${taxi.status.toUpperCase()}</span>
          ${taxi.status === 'waiting' ? `<button class="btn-outline" onclick="window.callSpecificTaxi('${routeId}', '${taxi.id}')">📢 Call</button>` : ''}
          ${taxi.status === 'next' || taxi.status === 'loading' ? `<button class="btn-outline" onclick="window.departTaxi('${routeId}', '${taxi.id}')">✅ Departed</button>` : ''}
          <button class="btn-danger" onclick="window.removeTaxi('${routeId}', '${taxi.id}')">✖️</button>
        </div>
      </div>
    `).join('');
  }
  
  function renderEditRoutesModal() {
    const container = document.getElementById('routesList');
    if (!container) return;
    
    container.innerHTML = routes.map(route => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; border-bottom: 1px solid #eee;">
        <span>${route.name}</span>
        <button class="btn-danger" onclick="TaxiSystem.removeRouteFromAdmin('${route.id}')">Remove</button>
      </div>
    `).join('');
  }
  
  function renderManagePlatesModal() {
    const container = document.getElementById('platesList');
    if (!container) return;
    
    container.innerHTML = registeredPlates.map(plate => `
      <div class="plate-item">
        <div>
          <strong>${plate.plate}</strong>
          <div style="font-size: 0.7rem;">${plate.owner}</div>
        </div>
        <div>
          <span class="${plate.active ? 'status-active' : 'status-inactive'}">${plate.active ? '● Active' : '○ Inactive'}</span>
          <button class="btn-outline" style="margin-left: 0.5rem; padding: 0.25rem 0.5rem;" onclick="TaxiSystem.togglePlate('${plate.plate}')">Toggle</button>
          <button class="btn-danger" style="margin-left: 0.25rem; padding: 0.25rem 0.5rem;" onclick="TaxiSystem.removePlate('${plate.plate}')">Remove</button>
        </div>
      </div>
    `).join('');
  }
  
  // Expose global functions
  window.callSpecificTaxi = (routeId, taxiId) => {
    callNext(routeId);
  };
  
  window.departTaxi = (routeId, taxiId) => {
    markDeparted(routeId, taxiId);
  };
  
  window.removeTaxi = (routeId, taxiId) => {
    if (confirm('Remove this taxi from queue?')) {
      const routeQueue = queues[routeId];
      const index = routeQueue.findIndex(t => t.id === taxiId);
      if (index !== -1) {
        routeQueue.splice(index, 1);
        saveToStorage();
        triggerUpdate();
        showToast('Taxi removed from queue');
      }
    }
  };
  
  window.TaxiSystem = {
    removeRouteFromAdmin: (routeId) => {
      if (confirm(`Remove route "${getRouteName(routeId)}"?`)) {
        removeRoute(routeId);
        renderRouteTabs();
        renderEditRoutesModal();
        if (currentMarshalRoute === routeId && getAllRoutes().length > 0) {
          currentMarshalRoute = getAllRoutes()[0].id;
          renderQueueForRoute(currentMarshalRoute);
        }
      }
    },
    togglePlate: (plate) => {
      togglePlateStatus(plate);
      renderManagePlatesModal();
      renderPlateSelect();
    },
    removePlate: (plate) => {
      if (confirm(`Remove plate ${plate}?`)) {
        removeRegisteredPlate(plate);
        renderManagePlatesModal();
        renderPlateSelect();
      }
    }
  };
  
  // ========== TV DISPLAY ==========
  function initDisplay() {
    init();
    renderTVDisplay();
    
    window.addEventListener('taxiQueueUpdate', () => {
      renderTVDisplay();
    });
    
    setInterval(() => {
      const el = document.getElementById('lastUpdated');
      if (el) el.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    }, 1000);
  }
  
  function renderTVDisplay() {
    const container = document.getElementById('tvRoutesGrid');
    if (!container) return;
    
    const activeRoutes = getAllRoutes();
    
    container.innerHTML = activeRoutes.map(route => {
      const routeQueue = queues[route.id] || [];
      const loadingId = currentLoading[route.id];
      const loadingTaxi = routeQueue.find(t => t.id === loadingId);
      const nextThree = routeQueue.filter(t => t.status === 'waiting' || t.status === 'next').slice(0, 3);
      
      return `
        <div class="tv-route-card">
          <div class="tv-route-name">${route.name}</div>
          <div class="queue-count">${routeQueue.length} taxi${routeQueue.length !== 1 ? 's' : ''} in queue</div>
          
          <div class="now-loading-box">
            <div class="now-loading-label">🚐 NOW LOADING</div>
            <div class="now-loading-taxi">${loadingTaxi ? loadingTaxi.plate : '— Waiting —'}</div>
            <div style="font-size: 0.8rem; margin-top: 0.25rem;">${loadingTaxi ? loadingTaxi.driverName : 'Calling next taxi...'}</div>
          </div>
          
          <div class="next-list">
            <div style="font-weight: 600; margin-bottom: 0.5rem;">⏩ Next in line</div>
            ${nextThree.length > 0 ? nextThree.map((taxi, idx) => `
              <div class="next-item">
                <span class="next-position">${idx + 1}</span>
                <span><strong>${taxi.plate}</strong></span>
                <span style="font-size: 0.7rem;">${taxi.driverName}</span>
              </div>
            `).join('') : '<div style="color: #64748b;">No taxis waiting</div>'}
          </div>
        </div>
      `;
    }).join('');
  }
  
  return {
    init,
    initDriver,
    initMarshal,
    initDisplay,
    joinQueue,
    leaveQueue,
    callNext,
    markDeparted,
    clearQueue,
    addRoute,
    removeRoute,
    addRegisteredPlate,
    removeRegisteredPlate,
    getRegisteredPlates,
    getRouteName,
    getAllRoutes,
    removeRouteFromAdmin: window.TaxiSystem?.removeRouteFromAdmin,
    togglePlate: window.TaxiSystem?.togglePlate,
    removePlate: window.TaxiSystem?.removePlate
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  if (path.includes('driver')) {
    TaxiSystem.initDriver();
  } else if (path.includes('marshal')) {
    TaxiSystem.initMarshal();
  } else if (path.includes('display')) {
    TaxiSystem.initDisplay();
  }
});