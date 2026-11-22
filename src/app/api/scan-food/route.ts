import { NextResponse } from "next/server";
import { GoogleGenAI, Type, Schema } from "@google/genai";

const FALLBACK_MODELS = ["gemini-3.8-flash", "gemini-3-flash-preview"];

const FOOD_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    is_food: {
      type: Type.BOOLEAN,
      description:
        "True solo si la imagen muestra comida, bebida o una etiqueta nutricional. False si es un teclado, pared, ropa o cualquier objeto no alimentario.",
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

async function getAvailableFlashModels(ai: GoogleGenAI): Promise<string[]> {
  try {
    const pager = await ai.models.list();
    const found: string[] = [];

    for await (const model of pager) {
      const rawName = String(model?.name || "").replace(/^models\//, "");
      const actions = Array.isArray(model?.supportedActions) ? model.supportedActions : [];
      const supportsGenerate =
        actions.length === 0 || actions.includes("generateContent");

      if (supportsGenerate && rawName.includes("flash")) {
        found.push(rawName);
      }
    }

    // Priorizar modelos más recientes / 3.x / flash antes que versiones antiguas
    found.sort((a, b) => {
      const score = (m: string) => {
        if (m.includes("3.8")) return 100;
        if (m.includes("3-") || m.includes("3.")) return 90;
        if (m.includes("flash-lite")) return 70;
        if (m.includes("flash")) return 80;
        return 10;
      };
      return score(b) - score(a);
    });

    return found.length > 0 ? Array.from(new Set(found)).slice(0, 3) : FALLBACK_MODELS;
  } catch {
    return FALLBACK_MODELS;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const imageBase64 = body?.imageBase64;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Falta configurar GEMINI_API_KEY en Vercel o en .env.local." },
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

    const ai = new GoogleGenAI({ apiKey });
    const models = await getAvailableFlashModels(ai);

    const prompt = `Eres un nutricionista deportivo analizando una foto capturada desde la cámara.
1. Si NO hay comida, bebida ni etiqueta de información nutricional (por ejemplo: teclado, móvil, pared, zapato, mesa, etc.), pon is_food: false y todos los números en 0.
2. Si SÍ hay comida o etiqueta nutricional:
   - Si es una etiqueta nutricional, prioriza los valores de la etiqueta (ajustados a la porción visible si aplica).
   - Si es un plato o alimento, estima de forma realista calorías, proteínas (g), carbohidratos (g) y grasas (g).
Responde en español en summary.`;

    let lastErrorMessage = "No se pudo completar el análisis.";

    for (const model of models) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout con ${model}`)), 20000)
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
      } catch (err: any) {
        lastErrorMessage = err?.message || String(err);
        continue;
      }
    }

    return NextResponse.json(
      { error: `Error al analizar con IA: ${lastErrorMessage}` },
      { status: 503 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error inesperado al analizar la imagen." },
      { status: 500 }
    );
  }
}