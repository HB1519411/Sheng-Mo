const eventBus = (() => {
  const events = {};

  const on = (eventName, callback) => {
    if (!events[eventName]) {
      events[eventName] = [];
    }
    events[eventName].push(callback);
  };

  const off = (eventName, callback) => {
    if (!events[eventName]) {
      return;
    }
    events[eventName] = events[eventName].filter(cb => cb !== callback);
  };

  const emit = (eventName, data) => {
    if (!events[eventName]) {
      return;
    }
    events[eventName].forEach(callback => {
      try {
        callback(data);
      } catch (e) {
        _logAndDisplayError(`Error in event listener for '${eventName}': ${e.message}`, 'eventBus.emit');
      }
    });
  };

  return {
    on,
    off,
    emit
  };
})();