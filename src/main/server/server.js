\
import express from 'express';
import path from 'path';
// Remove unused imports if they were added previously
// import { fileURLToPath } from 'url';

// ... existing imports and server setup ...

const app = express();

// ... other middleware ...

// Correctly point to the dist/public directory relative to the project root
const publicPath = path.join(process.cwd(), 'dist', 'public'); // Use process.cwd() as the script runs from the root
app.use(express.static(publicPath));

// ... rest of existing server code ...

// Make sure the server listens on the correct port, e.g., 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
