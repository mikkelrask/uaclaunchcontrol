// Registry backend URL.
//
// Defaults to production. Override with UAC_REGISTRY_URL (e.g.
// http://localhost:8787 when developing the registry server itself).
//
// NOTE: DEBUG must NOT select the URL. DEBUG is a logging flag — pointing
// the app at a dead localhost registry just because you wanted verbose
// logs silently breaks registry search. (This footgun existed for a while;
// it is now explicit.)
const explicit = process.env.UAC_REGISTRY_URL

export const REGISTRY_API_URL =
  explicit && explicit.trim().length > 0 ? explicit : 'https://db.uac-soft.online'

// Registry browse frontend URL — embedded in the app as an iframe. It detects
// embedded mode (?embedded=1) and hands protocols back via postMessage
// ('uac-install'). Override with UAC_REGISTRY_FRONTEND_URL when developing
// the frontend locally.
const frontendExplicit = process.env.UAC_REGISTRY_FRONTEND_URL

export const REGISTRY_FRONTEND_URL =
  frontendExplicit && frontendExplicit.trim().length > 0
    ? frontendExplicit
    : 'https://registry.uac-soft.online'
