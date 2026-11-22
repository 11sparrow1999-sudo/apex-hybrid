import { NextResponse } from "next/server";
import { GoogleGenAI, Type, Schema } from "@google/genai";

const PREFERRED_MODELS = [
  "gemini-3.8-flash",
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
];

const FOOD_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    is_food: {
      type: Type.BOOLEAN,
      description:
        "True solo si la imagen muestra comida, bebida o una etiqueta nutricional. False si es un teclado, pared, objeto no alimentario o borroso ilegible.",
    },
    calories: {
      type: Type.NUMBER,
      description: "Calorías estimadas (kcal). 0 si is_food es false.",
    },
    protein_g: {
      type: Type.NUMBER,
      description: "Proteínas en gramos. 0 si is_food es false.",
    },
    carbs_g: {
      type: Type.NUMBER,
      description: "Carbohidratos en gramos. 0 si is_food es false.",
    },
    fats_g: {
      type: Type.NUMBER,
      description: "Grasas en gramos. 0 si is_food es false.",
    },
    summary: {
      type: Type.STRING,
      description: "Resumen breve en español de lo detectado.",
    },
  },
  required: ["is_food", "calories", "protein_g", "carbs_g", "fats_g", "summary"],
};

function isRetryableModelError(err: unknown): boolean {
  const msg = String((err as any)?.message || err || "").toLowerCase();
  const status = Number((err as any)?.status || (err as any)?.code || 0);
  return (
    status === 404 ||
    status === 429 ||
    status === 503 ||
    msg.includes("404") ||
    msg.includes("not_found") ||
    msg.includes("no longer available") ||
    msg.includes("503") ||
    msg.includes("unavailable") ||
    msg.includes("high demand") ||
    msg.includes("quota") ||
    msg.includes("429")
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const imageBase64 = body?.imageBase64;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Falta configurar GEMINI_API_KEY en las variables de entorno." },
        { status: 500 }
      );
    }

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json(
        { error: "No se recibió una imagen válida." },
        { status: 400 }
      );
    }

    const mimeMatch = imageBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Analiza esta imagen como nutricionista deportivo.
- Si NO muestra comida, bebida ni etiqueta de información nutricional (por ejemplo un teclado, escritorio, ropa, pared o un objeto cualquiera), devuelve is_food: false y todos los valores numéricos en 0.
- Si SÍ muestra comida o etiqueta nutricional:
  * Si es una tabla/etiqueta nutricional, lee los valores indicados (ajustando a la porción si es evidente).
  * Si es un plato o alimento, estima de forma realista calorías, proteínas (g), carbohidratos (g) y grasas (g).
Responde en español en el campo summary.`;

    let lastError: unknown = null;

    for (const model of PREFERRED_MODELS) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Tiempo de espera agotado (10s)")), 10000)
        );

        const requestPromise = ai.models.generateContent({
          model,
          contents: [
            {
              inlineData: {
                mimeType,
                data: cleanBase64,
              },
            },
            prompt,
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: FOOD_RESPONSE_SCHEMA,
            temperature: 0.1,
          },
        });

        const response = await Promise.race([requestPromise, timeoutPromise]);
        const rawText = response.text || "{}";
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
            (isFood ? "Alimento o etiqueta detectada" : "No se detectó comida ni etiqueta nutricional"),
        });
      } catch (err) {
        lastError = err;
        if (isRetryableModelError(err)) {
          continue;
        }
        throw err;
      }
    }

    const detail = String((lastError as any)?.message || "Servicio temporalmente saturado");
    return NextResponse.json(
      { error: `No se pudo completar el análisis tras probar modelos disponibles: ${detail}` },
      { status: 503 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error inesperado al analizar la imagen." },
      { status: 500 }
    );
  }
}