const _logAndDisplayError = (message, source = 'UnknownSource', lineno = 'N/A', colno = 'N/A', errorObj = null) => {
  const timestamp = new Date().toLocaleString();
  let fullMessage = `[${source} @ ${timestamp}] ${message}`;
  if (lineno !== 'N/A') {
    fullMessage = `[${source} @ ${timestamp}] ${message} (Line: ${lineno}, Col: ${colno})`;
  }

  console.error(fullMessage, errorObj);
  if (typeof elementsModule !== 'undefined' && elementsModule.errorLogDisplay) {
    const currentLog = elementsModule.errorLogDisplay.value;
    const separator = currentLog ? '\n------------------------------\n' : '';
    elementsModule.errorLogDisplay.value += separator + fullMessage;
    elementsModule.errorLogDisplay.scrollTop = elementsModule.errorLogDisplay.scrollHeight;
  }
};
window.onerror = (message, source, lineno, colno, error) => {
  _logAndDisplayError(message, source, lineno, colno, error);
  return true;
};
window.addEventListener('unhandledrejection', function(event) {
  const reason = event.reason;
  let message = 'Unhandled Promise Rejection';
  let source = 'Promise';
  let errorObj = reason;
  if (reason instanceof Error) {
    message = reason.message;
    source = reason.stack ? reason.stack.split('\n')[1] || source : source;
  } else if (typeof reason === 'string') {
    message = reason;
  } else {
    try {
      message = JSON.stringify(reason);
    } catch {
      message = 'Non-serializable reason';
    }
  }
  _logAndDisplayError(message, source, 'N/A', 'N/A', errorObj);
});