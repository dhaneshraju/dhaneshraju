// Process query using the server endpoint
export const processQuery = async (query) => {
  try {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
    const response = await fetch(`${apiBaseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: query })
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }

    const data = await response.json();
    
    return {
      response: data.response,
      type: 'response',
      sources: data.sources || []
    };
  } catch (error) {
    console.error('Error processing query:', error);
    return {
      response: "I'm having trouble connecting to the server. Please try again later.",
      type: 'error',
      sources: []
    };
  }
};

export default {
  processQuery
};
