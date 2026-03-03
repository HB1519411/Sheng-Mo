const apiServiceModule = {
  performApiCall: async (endpoint, method = 'GET', body = null, headers = {}, signal = null, isFormData = false) => {
    try {
      const defaultHeaders = isFormData ? {} : {
        'Content-Type': 'application/json'
      };
      const finalHeaders = {
        ...defaultHeaders,
        ...headers
      };

      const requestOptions = {
        method: method,
        headers: finalHeaders,
        signal: signal
      };

      if (body) {
        requestOptions.body = isFormData ? body : JSON.stringify(body);
      }

      const response = await fetch(endpoint, requestOptions);

      const responseData = await response.json().catch(() => ({
        success: false,
        error: {
          code: "INVALID_JSON_RESPONSE",
          message: `HTTP error! status: ${response.status}. Non-JSON response or JSON parse error.`
        }
      }));

      if (responseData && Array.isArray(responseData.alerts)) {
          responseData.alerts.forEach(msg => alert(msg));
      }

      if (!response.ok) {
        const errorPayload = responseData.error || {
          code: 'HTTP_ERROR',
          message: `API Error! Status: ${response.status}`
        };
        return {
          success: false,
          error: errorPayload
        };
      }

      if (responseData.success === false) {
        const errorPayload = responseData.error || {
          code: 'API_LOGICAL_ERROR',
          message: 'API returned success: false without a specific error object.'
        };
        return {
          success: false,
          error: errorPayload
        };
      }

      return responseData;

    } catch (error) {
      const errorData = {
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: error.message
        }
      };
      if (error.name === 'AbortError') {
        errorData.error.code = 'REQUEST_ABORTED';
      }
      return errorData;
    }
  }
};