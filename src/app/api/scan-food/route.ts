import { NextResponse } from "next/server";

const MODELS_TO_TRY = ["gemini-3.8-flash", "gemini-2.5-flash"];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function callGeminiWithFallback(apiKey: string, payload: unknown) {
  let lastErrorText = "";
  let lastStatus = 502;

  for (const model of MODELS_TO_TRY) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (response.ok) {
        return { ok: true as const, data: await response.json() };
      }

      lastStatus = response.status;
      lastErrorText = await response.text();

      if (response.status === 503 && attempt < 2) {
        await wait(1200 * attempt);
        continue;
      }

      if (response.status === 503 || response.status === 404) {
        break;
      }

      return { ok: false as const, status: lastStatus, errorText: lastErrorText };
    }
  }

  return { ok: false as const, status: lastStatus, errorText: lastErrorText };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const imageBase64 = body?.imageBase64;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Falta configurar GEMINI_API_KEY en el entorno del servidor." },
        { status: 500 }
      );
    }

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json(
        { error: "No se recibió una imagen válida para analizar." },
        { status: 400 }
      );
    }

    const mimeMatch = imageBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");

    const prompt = `Eres un nutricionista deportivo analizando una foto capturada desde la cámara de un usuario.
1. Revisa si en la imagen hay COMIDA, BEBIDA o una ETIQUETA DE INFORMACIÓN NUTRICIONAL.
2. Si NO hay comida, bebida ni etiqueta nutricional (por ejemplo: un teclado, una pared, un zapato, un objeto cualquiera), pon "is_food": false y todos los números en 0.
3. Si SÍ hay comida o etiqueta nutricional:
   - Si es una etiqueta nutricional, prioriza los valores indicados en la etiqueta (ajustados a la porción visible si se aprecia).
   - Si es un plato o alimento, estima de forma realista calorías, proteínas (g), carbohidratos (g) y grasas (g).
Responde ÚNICAMENTE con un objeto JSON válido con esta estructura exacta:
{
  "is_food": boolean,
  "calories": number,
  "protein_g": number,
  "carbs_g": number,
  "fats_g": number,
  "summary": "descripción breve en español de lo detectado"
}`;

    const payload = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: cleanBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    };

    const result = await callGeminiWithFallback(apiKey, payload);

    if (!result.ok) {
      return NextResponse.json(
        { error: `Error de Gemini (${result.status}): ${result.errorText}` },
        { status: 502 }
      );
    }

    const rawText = result.data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsed = JSON.parse(rawText);

    const isFood = Boolean(parsed.is_food);

    return NextResponse.json({
      is_food: isFood,
      calories: isFood ? Math.max(0, Math.round(Number(parsed.calories) || 0)) : 0,
      protein_g: isFood ? Math.max(0, Math.round(Number(parsed.protein_g) || 0)) : 0,
      carbs_g: isFood ? Math.max(0, Math.round(Number(parsed.carbs_g) || 0)) : 0,
      fats_g: isFood ? Math.max(0, Math.round(Number(parsed.fats_g) || 0)) : 0,
      summary:
        String(parsed.summary || "").trim() ||
        (isFood ? "Alimento detectado" : "No se detectó comida ni etiqueta nutricional"),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error inesperado al analizar la imagen." },
      { status: 500 }
    );
  }
}