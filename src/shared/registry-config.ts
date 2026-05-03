const isDebug = process.env.DEBUG === 'true';

const PROD_URL = 'https://db.uac-soft.online';
const DEV_URL = 'http://localhost:8787';

export const REGISTRY_API_URL = isDebug ? DEV_URL : PROD_URL;
