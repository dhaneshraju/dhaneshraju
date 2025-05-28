// Process query using the server endpoint
/**
 * Process a query by sending it to the server
 * @param {string} query - The user's query
 * @returns {Promise<{response: string, type: string, sources: Array}>}
 */
export const processQuery = async (query) => {
  try {
    console.log('Sending request to /api/chat with query:', query);
    
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ message: query })
    });

    console.log('Received response status:', response.status);
    
    // Try to parse the response as JSON
    let data;
    try {
      const text = await response.text();
      console.log('Response text:', text);
      data = text ? JSON.parse(text) : {};
    } catch (parseError) {
      console.error('Error parsing response:', parseError);
      throw new Error('Invalid response from server');
    }

    if (!response.ok) {
      const errorMessage = data.error?.message || `Server responded with ${response.status}`;
      console.error('API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: data.error
      });
      throw new Error(errorMessage);
    }

    if (!data.response) {
      console.error('Invalid response format:', data);
      throw new Error('Invalid response format from server');
    }
    
    return {
      response: data.response,
      type: 'response',
      sources: data.sources || []
    };
  } catch (error) {
    console.error('Error in processQuery:', {
      error: error.message,
      stack: error.stack,
      name: error.name
    });
    
    let errorMessage = "I'm having trouble connecting to the server. ";
    
    if (error.message.includes('Failed to fetch')) {
      errorMessage += "Please check your internet connection.";
    } else if (error.message.includes('404')) {
      errorMessage = "The chat service is currently unavailable. Please try again later.";
    } else if (error.message.includes('500')) {
      errorMessage = "An error occurred on the server. The team has been notified.";
    } else {
      errorMessage += error.message;
    }
    
    return {
      response: errorMessage,
      type: 'error',
      sources: []
    };
  }
};

export default {
  processQuery
};
