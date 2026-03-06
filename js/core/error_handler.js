const _logAndDisplayError = (message, source = 'UnknownSource', lineno = 'N/A', colno = 'N/A', errorObj = null) => {
  const timestamp = new Date().toLocaleString();
  let fullMessage = `[${source} @ ${timestamp}] ${message}`;
  if (lineno !== 'N/A') {
    fullMessage += ` (Line: ${lineno}, Col: ${colno})`;
  }

  let stackTrace = 'No stack trace available';
  if (errorObj && errorObj.stack) {
    stackTrace = errorObj.stack;
    fullMessage += `\nStack Trace:\n${errorObj.stack}`;
  }

  console.error(fullMessage, errorObj);
  
  elementsModule.errorLogDisplay.value += (elementsModule.errorLogDisplay.value ? '\n------------------------------\n' : '') + fullMessage;
  elementsModule.errorLogDisplay.scrollTop = elementsModule.errorLogDisplay.scrollHeight;

  fetch('/log-client-error', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: fullMessage,
      stack: stackTrace
    })
  }).catch(() => {});
};

window.onerror = (message, source, lineno, colno, error) => {
  _logAndDisplayError(message, source, lineno, colno, error);
  return true;
};

window.addEventListener('unhandledrejection', function(event) {
  _logAndDisplayError(event.reason, 'Promise', 'N/A', 'N/A', event.reason);
});