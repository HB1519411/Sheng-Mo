const apiServiceModule = {
  performApiCall: async (endpoint, method = 'GET', body = null, headers = {}, signal = null, isFormData = false) => {
    const defaultHeaders = isFormData ? {} : { 'Content-Type': 'application/json' };
    const requestOptions = {
      method,
      headers: { ...defaultHeaders, ...headers },
      signal
    };

    if (body) {
      requestOptions.body = isFormData ? body : JSON.stringify(body);
    }

    const response = await fetch(endpoint, requestOptions);
    const responseData = await response.json();

    if (!response.ok) {
      throw new Error(responseData.error?.message || `HTTP Error ${response.status}`);
    }

    if (responseData.success === false) {
      throw new Error(responseData.error?.message || 'API Logic Error');
    }

    return responseData;
  }
};