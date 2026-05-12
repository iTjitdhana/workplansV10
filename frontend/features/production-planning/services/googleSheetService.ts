type GoogleSheetPayload = Record<string, unknown>;

const parseResultSafe = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

export const sendToGoogleSheet = async (payload: GoogleSheetPayload): Promise<unknown> => {
  const response = await fetch("/api/send-to-google-sheet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const result = await parseResultSafe(response);

  if (!response.ok) {
    const message =
      typeof result === "object" && result && "message" in result
        ? String((result as { message?: unknown }).message ?? `HTTP ${response.status}`)
        : `HTTP ${response.status}`;
    throw new Error(message);
  }

  return result;
};

