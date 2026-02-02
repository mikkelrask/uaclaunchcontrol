// This service is a client-side interface for handling files
// For actual file operations, API requests are sent to the server

export const fileService = {
  // Upload a screenshot
  async uploadScreenshot(file: File): Promise<string> {
    // Create a form data object
    const formData = new FormData();
    formData.append('screenshot', file);
    
    // Make the request
    const res = await fetch('/api/upload/screenshot', {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    
    if (!res.ok) {
      throw new Error(`Failed to upload screenshot: ${res.statusText}`);
    }
    
    const data = await res.json();
    return data.path;
  },
  
  // Get a simple file url for a path
  getFileUrl(path: string): string {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    return `/api/files/${encodeURIComponent(path)}`;
  }
};
