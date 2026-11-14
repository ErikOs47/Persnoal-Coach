// Coach: Claude über die Anthropic Messages API, direkt aus dem Browser mit dem eigenen API-Schlüssel.
// Das SDK (vendor/anthropic-sdk.mjs, gebündelt aus @anthropic-ai/sdk) wird erst beim ersten Aufruf geladen.

export const COACH_MODELS = {
  'claude-opus-5-5': 'Claude Opus 5.5 (Standard, beste Qualität)',
  'claude-sonnet-5-5': 'Claude Sonnet 5.5 (günstiger)',
  'claude-haiku-5-5': 'Claude Haiku 5.5 (am günstigsten)',
};

let sdk = null;
async function loadSdk() {
  if (!sdk) sdk = (await import('../vendor/anthropic-sdk.mjs')).default;
  return sdk;
}

// Fehler in verständliche Hinweise übersetzen
function explain(Anthropic, e) {
  const err = new Error(e && e.message ? e.message : String(e));
  if (e instanceof Anthropic.APIUserAbortError) err.userMessage = 'Abgebrochen.';
  else if (e instanceof Anthropic.AuthenticationError) err.userMessage = 'Der API-Schlüssel wurde abgelehnt. Bitte unter Profil prüfen.';
  else if (e instanceof Anthropic.PermissionDeniedError) err.userMessage = 'Der Schlüssel hat keinen Zugriff auf dieses Modell. Anderes Modell unter Profil wählen.';
  else if (e instanceof Anthropic.RateLimitError) err.userMessage = 'Zu viele Anfragen oder Guthaben aufgebraucht. Bitte später erneut versuchen.';
  else if (e instanceof Anthropic.BadRequestError) err.userMessage = 'Anfrage abgelehnt: ' + err.message;
  else if (e instanceof Anthropic.APIConnectionError) err.userMessage = 'Keine Verbindung zu api.anthropic.com. Bist du online?';
  else if (e instanceof Anthropic.InternalServerError) err.userMessage = 'Anthropic-Server gerade überlastet. Bitte gleich nochmal versuchen.';
  return err;
}

export async function askCoach({ apiKey, model, system, messages, onText, signal }) {
  const Anthropic = await loadSdk();
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  // Opus und Sonnet: serverseitiger Fallback, falls ein Sicherheitsfilter die Anfrage ablehnt. Haiku hat keinen.
  const fallback = model === 'claude-haiku-5-5' ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' };
  try {
    const stream = client.beta.messages.stream({
      model,
      max_tokens: 16000,
      system,
      messages,
      output_config: { effort: 'medium' },
      ...fallback,
    }, { signal });
    stream.on('text', (_delta, snapshot) => onText && onText(snapshot));
    const msg = await stream.finalMessage();
    if (msg.stop_reason === 'refusal') return 'Der Coach hat diese Anfrage abgelehnt. Formuliere sie bitte anders.';
    const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('');
    return msg.stop_reason === 'max_tokens' ? text + '\n\n(Antwort gekürzt)' : text;
  } catch (e) {
    throw explain(Anthropic, e);
  }
}
