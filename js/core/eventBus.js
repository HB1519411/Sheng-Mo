const eventBus = (() => {
  const events = {};

  const on = (eventName, callback) => {
    (events[eventName] ||= []).push(callback);
  };

  const off = (eventName, callback) => {
    if (events[eventName]) {
      events[eventName] = events[eventName].filter(cb => cb !== callback);
    }
  };

  const emit = (eventName, data) => {
    const callbacks = events[eventName];
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  };

  return {
    on,
    off,
    emit
  };
})();